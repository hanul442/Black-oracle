import type { DecisionTapeItem, LedgerEvent, OpenPosition, OperationsPayload } from '../v2/types';

export type InstrumentAssetClass = 'CRYPTO' | 'EQUITY' | 'UNKNOWN';
export type InstrumentLineageStatus = 'COMPLETE' | 'PARTIAL' | 'DATA_GAP';

export type InstrumentSummary = {
  market: string;
  assetClass: InstrumentAssetClass;
  latestDecision: DecisionTapeItem | null;
  latestDecisionAt: number | null;
  openPosition: OpenPosition | null;
  latestEventAt: number | null;
  latestEventType: string | null;
  activityCount: number;
  recentlyAnalyzed: boolean;
};

export type InstrumentCockpitProjection = InstrumentSummary & {
  events: LedgerEvent[];
  evidence: LedgerEvent[];
  strategyEvents: LedgerEvent[];
  councilEvents: LedgerEvent[];
  riskEvents: LedgerEvent[];
  tradeEvents: LedgerEvent[];
  outcomes: LedgerEvent[];
  latestByType: Record<string, LedgerEvent | null>;
  observedLatestByType: Record<string, LedgerEvent | null>;
  currentTraceId: string | null;
  lineageStatus: InstrumentLineageStatus;
  lineageScope: 'CANDIDATE_DECISION';
  linkagePolicy: 'EXPLICIT_ONLY';
};

const assetClassOf = (market: string): InstrumentAssetClass => {
  if (/^KRW-[A-Z0-9]+$/.test(market)) return 'CRYPTO';
  if (/^KRX-\d{6}$/.test(market)) return 'EQUITY';
  return 'UNKNOWN';
};

const eventTime = (event: LedgerEvent) => Number(event.occurredAt) || 0;
const nonEmptyText = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const ownTraceIdOf = (event: LedgerEvent | null | undefined) =>
  nonEmptyText(event?.trace?.traceId)
  ?? nonEmptyText(event?.trace?.trace_id)
  ?? nonEmptyText(event?.links?.traceId)
  ?? nonEmptyText(event?.links?.trace_id);
const entryTraceIdOf = (event: LedgerEvent | null | undefined) =>
  nonEmptyText(event?.links?.entryTraceId)
  ?? nonEmptyText(event?.links?.entry_trace_id);
const explicitlyLinksTrace = (event: LedgerEvent, traceId: string) =>
  ownTraceIdOf(event) === traceId || entryTraceIdOf(event) === traceId;

const lineageTypes = ['EVIDENCE', 'STRATEGY', 'COUNCIL', 'DECISION', 'RISK', 'ORDER', 'TRADE', 'OUTCOME'] as const;

const latestByTypeFrom = (events: LedgerEvent[]) => Object.fromEntries(
  lineageTypes.map((type) => [type, events.find((item) => item.eventType?.toUpperCase() === type) ?? null]),
) as Record<string, LedgerEvent | null>;

const selectAnalysisAnchor = (events: LedgerEvent[]) => {
  const observed = latestByTypeFrom(events);
  return observed.DECISION ?? observed.COUNCIL ?? observed.STRATEGY ?? events[0] ?? null;
};

export const deriveInstrumentUniverse = (
  operations: OperationsPayload | null,
  events: LedgerEvent[],
  now = Date.now(),
): InstrumentSummary[] => {
  const decisions = operations?.decisionTape ?? [];
  const positions = operations?.portfolio?.openPositions ?? [];
  const marketSet = new Set<string>();
  for (const decision of decisions) if (decision.market) marketSet.add(decision.market.toUpperCase());
  for (const position of positions) if (position.market) marketSet.add(position.market.toUpperCase());
  for (const event of events) if (event.market) marketSet.add(event.market.toUpperCase());

  return [...marketSet].map((market) => {
    const marketDecisions = decisions
      .filter((item) => item.market?.toUpperCase() === market)
      .sort((a, b) => b.timestamp - a.timestamp);
    const marketEvents = events
      .filter((item) => item.market?.toUpperCase() === market)
      .sort((a, b) => eventTime(b) - eventTime(a));
    const latestDecision = marketDecisions[0] ?? null;
    const latestEvent = marketEvents[0] ?? null;
    const latestDecisionAt = latestDecision?.timestamp ?? null;
    const latestEventAt = latestEvent ? eventTime(latestEvent) : null;
    const lastAnalysisAt = Math.max(latestDecisionAt ?? 0, latestEventAt ?? 0) || null;
    return {
      market,
      assetClass: assetClassOf(market),
      latestDecision,
      latestDecisionAt,
      openPosition: positions.find((item) => item.market?.toUpperCase() === market) ?? null,
      latestEventAt,
      latestEventType: latestEvent?.eventType ?? null,
      activityCount: marketEvents.length,
      recentlyAnalyzed: lastAnalysisAt != null && now - lastAnalysisAt <= 24 * 60 * 60 * 1000,
    } satisfies InstrumentSummary;
  }).sort((a, b) => {
    if (Boolean(b.openPosition) !== Boolean(a.openPosition)) return Number(Boolean(b.openPosition)) - Number(Boolean(a.openPosition));
    return Math.max(b.latestDecisionAt ?? 0, b.latestEventAt ?? 0) - Math.max(a.latestDecisionAt ?? 0, a.latestEventAt ?? 0);
  });
};

export const deriveInstrumentCockpit = (
  market: string,
  operations: OperationsPayload | null,
  events: LedgerEvent[],
): InstrumentCockpitProjection => {
  const normalized = market.toUpperCase();
  const universe = deriveInstrumentUniverse(operations, events);
  const summary = universe.find((item) => item.market === normalized) ?? {
    market: normalized,
    assetClass: assetClassOf(normalized),
    latestDecision: null,
    latestDecisionAt: null,
    openPosition: null,
    latestEventAt: null,
    latestEventType: null,
    activityCount: 0,
    recentlyAnalyzed: false,
  };
  const observedEvents = events
    .filter((item) => item.market?.toUpperCase() === normalized)
    .sort((a, b) => eventTime(b) - eventTime(a));
  const observedLatestByType = latestByTypeFrom(observedEvents);
  const analysisAnchor = selectAnalysisAnchor(observedEvents);
  const currentTraceId = ownTraceIdOf(analysisAnchor);

  // Match the server instrument-cockpit contract: every displayed canonical stage
  // must explicitly link to the same analysis trace. Missing trace identity fails
  // closed instead of borrowing newer/older events from unrelated decisions.
  const scoped = currentTraceId
    ? observedEvents.filter((item) => explicitlyLinksTrace(item, currentTraceId))
    : [];
  const by = (type: string) => scoped.filter((item) => item.eventType?.toUpperCase() === type);
  const latestByType = latestByTypeFrom(scoped);
  const linkedStageCount = lineageTypes.reduce((count, type) => count + (latestByType[type] ? 1 : 0), 0);
  const lineageStatus: InstrumentLineageStatus = !currentTraceId
    ? 'DATA_GAP'
    : linkedStageCount === lineageTypes.length
      ? 'COMPLETE'
      : 'PARTIAL';

  return {
    ...summary,
    events: scoped,
    evidence: by('EVIDENCE'),
    strategyEvents: by('STRATEGY'),
    councilEvents: by('COUNCIL'),
    riskEvents: by('RISK'),
    tradeEvents: [...by('ORDER'), ...by('TRADE')].sort((a, b) => eventTime(b) - eventTime(a)),
    outcomes: by('OUTCOME'),
    latestByType,
    observedLatestByType,
    currentTraceId,
    lineageStatus,
    lineageScope: 'CANDIDATE_DECISION',
    linkagePolicy: 'EXPLICIT_ONLY',
  };
};
