import { readCanonicalEvents, type CanonicalEventRow } from '../server/eventLedger';
import { readCanonicalLedgerHealth } from '../server/eventLedgerHealth';

const boundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

const textQuery = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

const mapDbEvent = (row: any): CanonicalEventRow => ({
  id: String(row.id ?? ''),
  eventKey: String(row.event_key ?? ''),
  occurredAt: row.occurred_at ? Date.parse(row.occurred_at) : 0,
  recordedAt: row.recorded_at ? Date.parse(row.recorded_at) : 0,
  runtimeId: row.runtime_id == null ? null : String(row.runtime_id),
  eventType: String(row.event_type ?? 'SYSTEM') as CanonicalEventRow['eventType'],
  eventName: String(row.event_name ?? ''),
  market: row.market == null ? null : String(row.market),
  strategyId: row.strategy_id == null ? null : String(row.strategy_id),
  strategyVersion: row.strategy_version == null ? null : String(row.strategy_version),
  action: row.action == null ? null : String(row.action),
  summary: String(row.summary ?? ''),
  reason: row.reason == null ? null : String(row.reason),
  severity: String(row.severity ?? 'INFO') as CanonicalEventRow['severity'],
  authority: String(row.authority ?? 'observed'),
  executionAuthority: Boolean(row.execution_authority),
  source: String(row.source ?? ''),
  trace: row.trace && typeof row.trace === 'object' ? row.trace : {},
  links: row.links && typeof row.links === 'object' ? row.links : {},
  schemaVersion: Number(row.schema_version ?? 1),
});

const readKrxInstrumentDiscovery = async (limit: number): Promise<CanonicalEventRow[]> => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  if (!base || !key || limit <= 0) return [];

  const url = new URL(`${base}/rest/v1/black_oracle_events`);
  url.searchParams.set('select', '*');
  url.searchParams.set('event_type', 'eq.SYSTEM');
  url.searchParams.set('event_name', 'eq.V10_UNIVERSE_GATE_EVALUATED');
  url.searchParams.set('market', 'like.KRX-*');
  url.searchParams.set('order', 'occurred_at.desc,recorded_at.desc');
  url.searchParams.set('limit', '500');

  const result = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!result.ok) {
    throw new Error(`KRX instrument discovery read failed (${result.status}): ${(await result.text()).slice(0, 500)}`);
  }

  const rows = ((await result.json()) as any[]).map(mapDbEvent);
  const latestByMarket = new Map<string, CanonicalEventRow>();
  for (const event of rows) {
    const market = event.market?.toUpperCase() ?? '';
    if (!/^KRX-\d{6}$/.test(market) || latestByMarket.has(market)) continue;
    latestByMarket.set(market, event);
    if (latestByMarket.size >= limit) break;
  }
  return [...latestByMarket.values()];
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const type = typeof request.query?.type === 'string' && request.query.type.trim()
      ? request.query.type.trim().toUpperCase()
      : null;
    const market = typeof request.query?.market === 'string' && request.query.market.trim()
      ? request.query.market.trim().toUpperCase()
      : null;
    const limit = boundedInt(request.query?.limit, 300, 1, 500);
    const configuredRuntimeId = process.env.TRADING_RUNTIME_ID?.trim() || 'black-oracle-paper';
    const requestedRuntime = textQuery(request.query?.runtimeId, 200);
    const runtimeScope = requestedRuntime?.toUpperCase() === 'ALL'
      ? null
      : (requestedRuntime ?? configuredRuntimeId);

    // The main event tape remains runtime-scoped. KRX instrument discovery is the
    // sole default cross-runtime exception because S2/V9 shadow runtimes own the
    // account-free KRX Universe while the Web UI can run under a different Paper
    // runtime. Discovery events remain SYSTEM/read-only and never grant lineage or
    // execution authority to the operational runtime.
    const shouldIncludeInstrumentDiscovery = requestedRuntime == null && type == null && market == null;
    const discoveryLimit = shouldIncludeInstrumentDiscovery
      ? Math.min(120, Math.max(1, Math.floor(limit / 4)))
      : 0;

    let instrumentDiscoveryEvents: CanonicalEventRow[] = [];
    let instrumentDiscoveryError: string | null = null;
    if (shouldIncludeInstrumentDiscovery) {
      try {
        instrumentDiscoveryEvents = await readKrxInstrumentDiscovery(discoveryLimit);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown KRX instrument discovery error.';
        instrumentDiscoveryError = 'KRX canonical instrument discovery temporarily unavailable.';
        console.warn('Black Oracle KRX instrument discovery degraded:', message);
      }
    }

    // readCanonicalEvents predates runtime scoping. Pull the bounded maximum and
    // filter here so unrelated Paper/shadow runtimes cannot silently mix in one UI tape.
    const rawEvents = await readCanonicalEvents({ limit: 500, type, market });
    const scopedEvents = runtimeScope
      ? rawEvents.filter((event) => event.runtimeId === runtimeScope)
      : rawEvents;
    const operationalLimit = Math.max(0, limit - instrumentDiscoveryEvents.length);
    const operationalEvents = scopedEvents.slice(0, operationalLimit || (instrumentDiscoveryEvents.length ? 0 : limit));
    const seenIds = new Set(operationalEvents.map((event) => event.id));
    const events = [...operationalEvents, ...instrumentDiscoveryEvents.filter((event) => !seenIds.has(event.id))]
      .sort((a, b) => b.occurredAt - a.occurredAt || b.recordedAt - a.recordedAt)
      .slice(0, limit);

    // Ledger producer health is supplementary observability. A transient health
    // read failure must not erase a successfully retrieved canonical event tape.
    // Preserve the data and surface health as explicitly degraded/unknown instead.
    let health: Awaited<ReturnType<typeof readCanonicalLedgerHealth>> | null = null;
    let healthError: string | null = null;
    if (runtimeScope) {
      try {
        health = await readCanonicalLedgerHealth(runtimeScope);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown canonical ledger health error.';
        healthError = 'Canonical ledger health temporarily unavailable.';
        console.warn(`Black Oracle canonical ledger health degraded for ${runtimeScope}:`, message);
      }
    }

    const runtimeBreakdown = events.reduce<Record<string, number>>((acc, event) => {
      const key = event.runtimeId ?? 'UNSCOPED';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const discoveryMixed = instrumentDiscoveryEvents.length > 0;
    const coverage = health
      ? `CUTOVER_FORWARD · ${health.status}${discoveryMixed ? ' · KRX_DISCOVERY' : ''}`
      : runtimeScope
        ? `CUTOVER_FORWARD · HEALTH_UNKNOWN${discoveryMixed ? ' · KRX_DISCOVERY' : ''}`
        : 'CUTOVER_FORWARD · ALL_RUNTIMES';

    return response.status(200).json({
      success: true,
      canonical: true,
      appendOnly: true,
      coverage,
      source: 'black_oracle_events',
      runtimeScope: runtimeScope ?? 'ALL',
      configuredRuntimeId,
      runtimeMixed: runtimeScope == null || discoveryMixed,
      runtimeBreakdown,
      instrumentDiscovery: {
        included: shouldIncludeInstrumentDiscovery,
        source: 'V10_UNIVERSE_GATE_EVALUATED',
        authority: 'READ_ONLY_CROSS_RUNTIME_DISCOVERY',
        executionAuthority: false,
        count: instrumentDiscoveryEvents.length,
        degraded: Boolean(instrumentDiscoveryError),
        error: instrumentDiscoveryError,
      },
      count: events.length,
      health,
      healthDegraded: Boolean(healthError),
      healthError,
      events,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown canonical event ledger error.';
    console.error('Black Oracle canonical event API failed:', error);
    return response.status(500).json({ success: false, canonical: true, appendOnly: true, error: message, events: [] });
  }
}
