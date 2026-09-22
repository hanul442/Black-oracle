import { readCanonicalEvents, type CanonicalEventRow } from '../server/eventLedger';
import { readCanonicalLedgerHealth } from '../server/eventLedgerHealth';
import { canonicalSourceHealth } from '../server/canonicalSourceHealth';

const boundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

const textQuery = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

const selectKrxInstrumentDiscovery = (events: CanonicalEventRow[], limit: number) => {
  if (limit <= 0) return [] as CanonicalEventRow[];
  const latestByMarket = new Map<string, CanonicalEventRow>();
  for (const event of events) {
    const market = event.market?.toUpperCase() ?? '';
    if (event.eventType !== 'SYSTEM') continue;
    if (event.eventName !== 'V10_UNIVERSE_GATE_EVALUATED') continue;
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

    const rawEvents = await readCanonicalEvents({ limit: 500, type, market });

    const shouldIncludeInstrumentDiscovery = requestedRuntime == null && type == null && market == null;
    const discoveryLimit = shouldIncludeInstrumentDiscovery
      ? Math.min(120, Math.max(1, Math.floor(limit / 4)))
      : 0;
    const instrumentDiscoveryEvents = shouldIncludeInstrumentDiscovery
      ? selectKrxInstrumentDiscovery(rawEvents, discoveryLimit)
      : [];

    const scopedEvents = runtimeScope
      ? rawEvents.filter((event) => event.runtimeId === runtimeScope)
      : rawEvents;
    const operationalLimit = Math.max(0, limit - instrumentDiscoveryEvents.length);
    const operationalEvents = scopedEvents.slice(0, operationalLimit || (instrumentDiscoveryEvents.length ? 0 : limit));
    const seenIds = new Set(operationalEvents.map((event) => event.id));
    const events = [...operationalEvents, ...instrumentDiscoveryEvents.filter((event) => !seenIds.has(event.id))]
      .sort((a, b) => b.occurredAt - a.occurredAt || b.recordedAt - a.recordedAt)
      .slice(0, limit);

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
    const observedAt = events.length
      ? Math.max(...events.map((event) => Number(event.recordedAt || event.occurredAt || 0)).filter(Number.isFinite))
      : Date.now();
    const sourceHealth = canonicalSourceHealth({
      observedAt,
      itemCount: events.length,
      degraded: Boolean(healthError) || Boolean(health && health.status !== 'OK'),
      error: healthError,
      // Event freshness is producer-specific. A18 does not invent a global event-age
      // threshold; producer health remains authoritative for degradation here.
      staleAfterMs: Number.MAX_SAFE_INTEGER,
    });

    return response.status(200).json({
      success: true,
      canonical: true,
      appendOnly: true,
      observedAt,
      sourceHealth,
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
        windowRows: rawEvents.length,
        windowLimited: true,
        degraded: false,
        error: null,
      },
      count: events.length,
      health,
      healthDegraded: sourceHealth.state !== 'OK',
      healthError,
      events,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown canonical event ledger error.';
    console.error('Black Oracle canonical event API failed:', error);
    return response.status(500).json({
      success: false,
      canonical: true,
      appendOnly: true,
      observedAt: Date.now(),
      sourceHealth: canonicalSourceHealth({ unavailable: true, itemCount: 0, error: message }),
      error: message,
      events: [],
    });
  }
}
