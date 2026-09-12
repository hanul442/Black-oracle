import type { DecisionTapeItem, LedgerEvent, OpenPosition, OperationsPayload } from '../v2/types';

export type InstrumentAssetClass = 'CRYPTO' | 'EQUITY' | 'UNKNOWN';

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
};

const assetClassOf = (market: string): InstrumentAssetClass => {
  if (/^KRW-[A-Z0-9]+$/.test(market)) return 'CRYPTO';
  if (/^KRX-\d{6}$/.test(market)) return 'EQUITY';
  return 'UNKNOWN';
};

const eventTime = (event: LedgerEvent) => Number(event.occurredAt) || 0;

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
  const scoped = events
    .filter((item) => item.market?.toUpperCase() === normalized)
    .sort((a, b) => eventTime(b) - eventTime(a));
  const by = (type: string) => scoped.filter((item) => item.eventType?.toUpperCase() === type);
  const types = ['EVIDENCE', 'STRATEGY', 'COUNCIL', 'DECISION', 'RISK', 'ORDER', 'TRADE', 'OUTCOME'];
  return {
    ...summary,
    events: scoped,
    evidence: by('EVIDENCE'),
    strategyEvents: by('STRATEGY'),
    councilEvents: by('COUNCIL'),
    riskEvents: by('RISK'),
    tradeEvents: [...by('ORDER'), ...by('TRADE')].sort((a, b) => eventTime(b) - eventTime(a)),
    outcomes: by('OUTCOME'),
    latestByType: Object.fromEntries(types.map((type) => [type, by(type)[0] ?? null])),
  };
};
