import { readCanonicalEvents } from '../server/eventLedger';

const marketPattern = /^(KRW-[A-Z0-9]+|KRX-\d{6})$/;
const supportedTypes = ['EVIDENCE', 'STRATEGY', 'COUNCIL', 'DECISION', 'RISK', 'ORDER', 'TRADE', 'OUTCOME'] as const;

const boundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

const traceIdOf = (event: any) => {
  const candidates = [
    event?.trace?.traceId,
    event?.trace?.trace_id,
    event?.links?.traceId,
    event?.links?.trace_id,
    event?.links?.entryTraceId,
    event?.links?.entry_trace_id,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() ?? null;
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  const market = String(request.query?.market ?? '').trim().toUpperCase();
  if (!marketPattern.test(market)) {
    return response.status(400).json({ success: false, error: 'market must be KRW-* or KRX-######.' });
  }

  const limit = boundedInt(request.query?.limit, 240, 20, 500);
  const configuredRuntimeId = String(process.env.TRADING_RUNTIME_ID ?? 'black-oracle-paper').trim();
  const requestedRuntimeId = String(request.query?.runtimeId ?? '').trim();
  const runtimeId = requestedRuntimeId || configuredRuntimeId;

  try {
    const raw = await readCanonicalEvents({ market, limit: 500 });
    const events = raw
      .filter((event) => !runtimeId || event.runtimeId === runtimeId)
      .sort((a, b) => Number(b.occurredAt ?? 0) - Number(a.occurredAt ?? 0))
      .slice(0, limit);

    const latestByType = Object.fromEntries(supportedTypes.map((type) => [
      type,
      events.find((event) => String(event.eventType).toUpperCase() === type) ?? null,
    ]));
    const latestDecision = latestByType.DECISION as any;
    const latestCouncil = latestByType.COUNCIL as any;
    const latestStrategy = latestByType.STRATEGY as any;
    const latestOutcome = latestByType.OUTCOME as any;
    const analysisAnchor = latestDecision ?? latestCouncil ?? latestStrategy ?? events[0] ?? null;
    const analysisAsOf = analysisAnchor ? Number(analysisAnchor.occurredAt ?? 0) || null : null;
    const currentTraceId = traceIdOf(analysisAnchor);

    const counts = supportedTypes.reduce<Record<string, number>>((acc, type) => {
      acc[type] = events.filter((event) => String(event.eventType).toUpperCase() === type).length;
      return acc;
    }, {});

    return response.status(200).json({
      success: true,
      canonical: true,
      instrumentCentric: true,
      market,
      assetClass: market.startsWith('KRX-') ? 'EQUITY' : 'CRYPTO',
      runtimeId,
      analysisAsOf,
      analysisExpiresAt: null,
      analysisExpiryReason: 'No canonical validity horizon has been asserted for this analysis yet.',
      currentTraceId,
      counts,
      latestByType,
      latestDecision,
      latestCouncil,
      latestStrategy,
      latestOutcome,
      events,
    });
  } catch (error) {
    console.error(`Instrument cockpit read failed for ${market}:`, error);
    return response.status(500).json({
      success: false,
      canonical: true,
      instrumentCentric: true,
      market,
      error: error instanceof Error ? error.message : 'Unknown instrument cockpit error.',
      events: [],
    });
  }
}
