import type { EvidenceAggregate } from './evidence';
import { buildEvidenceForecast, type EvidenceForecast } from './evidenceForecast';
import type { FinalDecision } from './intelligencePipeline';
import { buildStrategyRouterDecision, type StrategyRouterDecision } from './strategyRouter';
import type {
  ExecutionDecision,
  MarketRegime,
  MultiTimeframeSnapshot,
  RiskDisposition,
} from './types';

export type DecisionTraceAction = 'ENTER' | 'EXIT' | 'HOLD' | 'NO_TRADE';

export interface DecisionGovernanceTrace {
  finalDecisionId: string;
  baseAction: FinalDecision['baseAction'];
  mode: FinalDecision['mode'];
  policy: FinalDecision['policy'];
  intelligenceDisposition: FinalDecision['intelligenceDisposition'];
  intelligenceConfidence: number;
  intelligencePackageId: string | null;
  scenarioSetId: string | null;
  recommendedScenarioId: string | null;
  councilRunId: string | null;
  reasons: string[];
}

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
  primaryReason: string;
  reasons: string[];
  riskReasons: string[];
  governance?: DecisionGovernanceTrace;
}

export interface DecisionTraceInput {
  timestamp?: number;
  market: string;
  decision: ExecutionDecision;
  multiTimeframe: MultiTimeframeSnapshot;
  evidence: EvidenceAggregate;
  hasOpenPositionAfterStep: boolean;
  governance?: {
    finalDecision: FinalDecision;
    intelligencePackageId?: string | null;
    scenarioSetId?: string | null;
    councilRunId?: string | null;
  } | null;
}

export const classifyDecisionTraceAction = (
  executionAction: ExecutionDecision['action'],
  hasOpenPositionAfterStep: boolean,
): DecisionTraceAction => {
  if (executionAction === 'ENTER' || executionAction === 'EXIT') return executionAction;
  return hasOpenPositionAfterStep ? 'HOLD' : 'NO_TRADE';
};

const stableFinalDecisionId = (input: DecisionTraceInput, timestamp: number) => {
  const base = `${input.market.toUpperCase()}|${timestamp}|${input.governance?.finalDecision.baseAction ?? input.decision.action}|${input.governance?.finalDecision.action ?? input.decision.action}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < base.length; index += 1) {
    hash ^= base.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `decision-${(hash >>> 0).toString(36)}`;
};

export const buildDecisionTrace = (input: DecisionTraceInput): DecisionTrace => {
  const { decision, multiTimeframe, evidence } = input;
  const timestamp = input.timestamp ?? Date.now();
  const action = classifyDecisionTraceAction(decision.action, input.hasOpenPositionAfterStep);
  const oneHourRegime = multiTimeframe.frames.oneHour.regime;
  const primaryReason = decision.reasons[0] ?? 'No explicit decision reason was recorded.';
  const forecast = buildEvidenceForecast(evidence);
  const router = buildStrategyRouterDecision(multiTimeframe, forecast);
  const governance = input.governance ? {
    finalDecisionId: stableFinalDecisionId(input, timestamp),
    baseAction: input.governance.finalDecision.baseAction,
    mode: input.governance.finalDecision.mode,
    policy: input.governance.finalDecision.policy,
    intelligenceDisposition: input.governance.finalDecision.intelligenceDisposition,
    intelligenceConfidence: input.governance.finalDecision.intelligenceConfidence,
    intelligencePackageId: input.governance.intelligencePackageId ?? null,
    scenarioSetId: input.governance.scenarioSetId ?? null,
    recommendedScenarioId: input.governance.finalDecision.recommendedScenarioId,
    councilRunId: input.governance.councilRunId ?? null,
    reasons: input.governance.finalDecision.reasons.slice(),
  } satisfies DecisionGovernanceTrace : undefined;

  return {
    timestamp,
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
    primaryReason,
    reasons: decision.reasons.slice(),
    riskReasons: decision.riskReasons.slice(),
    governance,
  };
};
