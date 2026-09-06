import type { EvidenceAggregate } from './evidence';
import { buildEvidenceForecast, type EvidenceForecast } from './evidenceForecast';
import { buildStrategyRouterDecision, type StrategyRouterDecision } from './strategyRouter';
import type {
  ExecutionDecision,
  MarketRegime,
  MultiCycleSnapshot,
  MultiTimeframeSnapshot,
  RiskDisposition,
  TradeMapSnapshot,
} from './types';

export type DecisionTraceAction = 'ENTER' | 'EXIT' | 'HOLD' | 'NO_TRADE';

export interface DecisionTrace {
  timestamp: number;
  market: string;
  action: DecisionTraceAction;
  regime: MarketRegime;
  regimeConfidence: number;
  oracleTradeScore: number;
  confidence: number;
  strategyDisposition: StrategyRouterDecision['route'];
  router: StrategyRouterDecision;
  riskDisposition: RiskDisposition;
  eventScore: number | null;
  forecast: EvidenceForecast;
  evidenceActiveCount: number;
  evidenceContradictionCount: number;
  evidenceIds: string[];
  technicalEvidence: null | {
    rawSignalCount: number;
    independentFamilyCount: number;
    correlatedSignalPenalty: number;
    directionalScore: number;
    confidence: number;
    bullishFamilies: number;
    bearishFamilies: number;
    neutralFamilies: number;
  };
  structure: null | {
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number;
    eventType: 'BOS' | 'CHOCH' | null;
    eventDirection: 'BULLISH' | 'BEARISH' | null;
    location: 'PREMIUM' | 'EQUILIBRIUM' | 'DISCOUNT';
    percentile: number;
    liquiditySweep: 'BULLISH' | 'BEARISH' | null;
  };
  cycle: MultiCycleSnapshot | null;
  tradeMap: TradeMapSnapshot | null;
  primaryReason: string;
  reasons: string[];
  riskReasons: string[];
}

export interface DecisionTraceInput {
  timestamp?: number;
  market: string;
  decision: ExecutionDecision;
  multiTimeframe: MultiTimeframeSnapshot;
  evidence: EvidenceAggregate;
  tradeMap?: TradeMapSnapshot | null;
  hasOpenPositionAfterStep: boolean;
}

export const classifyDecisionTraceAction = (
  executionAction: ExecutionDecision['action'],
  hasOpenPositionAfterStep: boolean,
): DecisionTraceAction => {
  if (executionAction === 'ENTER' || executionAction === 'EXIT') return executionAction;
  return hasOpenPositionAfterStep ? 'HOLD' : 'NO_TRADE';
};

export const buildDecisionTrace = (input: DecisionTraceInput): DecisionTrace => {
  const { decision, multiTimeframe, evidence } = input;
  const action = classifyDecisionTraceAction(decision.action, input.hasOpenPositionAfterStep);
  const oneHour = multiTimeframe.frames.oneHour;
  const oneHourRegime = oneHour.regime;
  const primaryReason = decision.reasons[0] ?? 'No explicit decision reason was recorded.';
  const forecast = buildEvidenceForecast(evidence);
  const router = buildStrategyRouterDecision(multiTimeframe, forecast);
  const technical = oneHour.technicalEvidence;
  const structure = oneHour.structure;

  return {
    timestamp: input.timestamp ?? Date.now(),
    market: input.market.toUpperCase(),
    action,
    regime: oneHourRegime.regime,
    regimeConfidence: oneHourRegime.confidence,
    oracleTradeScore: multiTimeframe.oracleTradeScore,
    confidence: decision.confidence,
    strategyDisposition: router.route,
    router,
    riskDisposition: decision.riskDisposition,
    eventScore: evidence.activeCount > 0 ? evidence.score : null,
    forecast,
    evidenceActiveCount: evidence.activeCount,
    evidenceContradictionCount: evidence.contradictionCount,
    evidenceIds: evidence.evidenceIds.slice(),
    technicalEvidence: technical ? {
      rawSignalCount: technical.rawSignalCount,
      independentFamilyCount: technical.independentFamilyCount,
      correlatedSignalPenalty: technical.correlatedSignalPenalty,
      directionalScore: technical.directionalScore,
      confidence: technical.confidence,
      bullishFamilies: technical.bullishFamilies,
      bearishFamilies: technical.bearishFamilies,
      neutralFamilies: technical.neutralFamilies,
    } : null,
    structure: structure ? {
      bias: structure.bias,
      confidence: structure.confidence,
      eventType: structure.lastEvent?.type ?? null,
      eventDirection: structure.lastEvent?.direction ?? null,
      location: structure.location.zone,
      percentile: structure.location.percentile,
      liquiditySweep: structure.liquiditySweep?.direction ?? null,
    } : null,
    cycle: multiTimeframe.cycle ? {
      ...multiTimeframe.cycle,
      frames: { ...multiTimeframe.cycle.frames },
      reasons: multiTimeframe.cycle.reasons.slice(),
    } : null,
    tradeMap: input.tradeMap ? { ...input.tradeMap, reasons: input.tradeMap.reasons.slice() } : null,
    primaryReason,
    reasons: decision.reasons.slice(),
    riskReasons: decision.riskReasons.slice(),
  };
};
