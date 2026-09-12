import { readCanonicalEvents } from '../server/eventLedger';
import { readCanonicalLedgerHealth } from '../server/eventLedgerHealth';

const boundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

const textQuery = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

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

    // readCanonicalEvents predates runtime scoping. Pull the bounded maximum and
    // filter here so unrelated Paper/shadow runtimes cannot silently mix in one UI tape.
    const rawEvents = await readCanonicalEvents({ limit: 500, type, market });
    const events = (runtimeScope
      ? rawEvents.filter((event) => event.runtimeId === runtimeScope)
      : rawEvents
    ).slice(0, limit);

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

    const runtimeBreakdown = rawEvents.reduce<Record<string, number>>((acc, event) => {
      const key = event.runtimeId ?? 'UNSCOPED';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const coverage = health
      ? `CUTOVER_FORWARD · ${health.status}`
      : runtimeScope
        ? 'CUTOVER_FORWARD · HEALTH_UNKNOWN'
        : 'CUTOVER_FORWARD · ALL_RUNTIMES';

    return response.status(200).json({
      success: true,
      canonical: true,
      appendOnly: true,
      coverage,
      source: 'black_oracle_events',
      runtimeScope: runtimeScope ?? 'ALL',
      configuredRuntimeId,
      runtimeMixed: runtimeScope == null,
      runtimeBreakdown,
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
