import type { CanonicalEventInput } from './eventLedger';

const normalizeMarket = (value: unknown) => String(value ?? '').trim().toUpperCase();
const validTimestamp = (value: unknown) => {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
};

export const buildCanonicalDecisionTraceId = (runtimeId: string, market: string, timestamp: number) =>
  `${runtimeId}:${normalizeMarket(market)}:${timestamp}`;

export const buildCanonicalDecisionId = (traceId: string) => `${traceId}:decision`;

export const attachDecisionReplayLineage = (
  events: CanonicalEventInput[],
  cycle: any,
  runtimeId: string,
): CanonicalEventInput[] => {
  const cycleMarkets = Array.isArray(cycle?.markets) ? cycle.markets : [];
  const equityDecisions = Array.isArray(cycle?.equityCycle?.decisions) ? cycle.equityCycle.decisions : [];
  const equityCycleTimestamp = validTimestamp(cycle?.equityCycle?.finishedAt);
  const lineageByMarket = new Map<string, { traceId: string; decisionId: string; evidenceIds: string[] }>();

  for (const item of cycleMarkets) {
    const market = normalizeMarket(item?.market);
    const timestamp = validTimestamp(item?.timestamp);
    if (!market || timestamp == null) continue;
    const traceId = buildCanonicalDecisionTraceId(runtimeId, market, timestamp);
    lineageByMarket.set(market, {
      traceId,
      decisionId: buildCanonicalDecisionId(traceId),
      evidenceIds: Array.isArray(item?.evidenceIds) ? item.evidenceIds.map(String) : [],
    });
  }

  // Equity research decisions are emitted outside cycle.markets, but they belong to
  // the same canonical replay model. Use the equity cycle completion timestamp—the
  // same timestamp used by the equity decision/evidence projection—as the trace root.
  for (const item of equityDecisions) {
    const market = normalizeMarket(item?.market);
    const timestamp = validTimestamp(item?.timestamp) ?? equityCycleTimestamp;
    if (!market || timestamp == null) continue;
    const traceId = buildCanonicalDecisionTraceId(runtimeId, market, timestamp);
    lineageByMarket.set(market, {
      traceId,
      decisionId: buildCanonicalDecisionId(traceId),
      evidenceIds: Array.isArray(item?.evidenceIds) ? item.evidenceIds.map(String) : [],
    });
  }

  return events.map((event) => {
    const internalEvent = event as CanonicalEventInput & { __lineagePolicy?: 'PRESERVE' };
    if (internalEvent.__lineagePolicy === 'PRESERVE') {
      const { __lineagePolicy: _lineagePolicy, ...preserved } = internalEvent as CanonicalEventInput & { __lineagePolicy?: 'PRESERVE' };
      return preserved as CanonicalEventInput;
    }

    const market = normalizeMarket(event.market);
    const lineage = market ? lineageByMarket.get(market) : null;
    if (!lineage) return event;

    const existingTrace = event.trace ?? {};
    const existingLinks = event.links ?? {};
    const existingEvidenceIds = Array.isArray(existingLinks.evidenceIds)
      ? existingLinks.evidenceIds.map(String)
      : [];
    const evidenceIds = existingEvidenceIds.length ? existingEvidenceIds : lineage.evidenceIds;

    const links: Record<string, unknown> = {
      ...existingLinks,
      decisionId: lineage.decisionId,
    };
    if (evidenceIds.length) links.evidenceIds = evidenceIds;

    if (event.eventType === 'OUTCOME') {
      const entryTimestamp = validTimestamp((existingTrace as any)?.entryAudit?.timestamp);
      if (entryTimestamp != null) {
        links.entryTraceId = buildCanonicalDecisionTraceId(runtimeId, market, entryTimestamp);
      }
    }

    return {
      ...event,
      trace: {
        ...existingTrace,
        traceId: lineage.traceId,
      },
      links,
    };
  });
};