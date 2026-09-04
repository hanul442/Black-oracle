import type { EvidenceAggregate } from './evidence';
import type {
  ExecutionDecision,
  MarketRegime,
  MultiTimeframeSnapshot,
  RiskDisposition,
} from './types';

export type DecisionTraceAction = 'ENTER' | 'EXIT' | 'HOLD' | 'NO_TRADE';
export type StrategyDisposition = 'LEGACY_FUSION';

export interface DecisionTrace {
  timestamp: number;
  market: string;
  action: DecisionTraceAction;
  regime: MarketRegime;
  regimeConfidence: number;
  oracleTradeScore: number;
  confidence: number;
  strategyDisposition: StrategyDisposition;
  riskDisposition: RiskDisposition;
  eventScore: number | null;
  evidenceActiveCount: number;
  evidenceContradictionCount: number;
  evidenceIds: string[];
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
  const oneHourRegime = multiTimeframe.frames.oneHour.regime;
  const primaryReason = decision.reasons[0] ?? 'No explicit decision reason was recorded.';

  return {
    timestamp: input.timestamp ?? Date.now(),
    market: input.market.toUpperCase(),
    action,
    regime: oneHourRegime.regime,
    regimeConfidence: oneHourRegime.confidence,
    oracleTradeScore: multiTimeframe.oracleTradeScore,
    confidence: decision.confidence,
    strategyDisposition: 'LEGACY_FUSION',
    riskDisposition: decision.riskDisposition,
    eventScore: evidence.activeCount > 0 ? evidence.score : null,
    evidenceActiveCount: evidence.activeCount,
    evidenceContradictionCount: evidence.contradictionCount,
    evidenceIds: evidence.evidenceIds.slice(),
    primaryReason,
    reasons: decision.reasons.slice(),
    riskReasons: decision.riskReasons.slice(),
  };
};