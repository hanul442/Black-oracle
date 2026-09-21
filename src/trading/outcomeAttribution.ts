import type { LiveCanaryReadinessResult } from './liveCanaryReadiness';
import type { AlphaExecutionMode, UpbitDryRunPreview } from './upbitDryRunReconciliation';

export const OUTCOME_ATTRIBUTION_VERSION = 'bot.outcome-attribution.v1' as const;

export interface ObservedOutcome {
  outcomeId: string;
  mode: AlphaExecutionMode;
  market: string;
  observedAt: string;
  sourceEventLedgerId: string;
  sourceDecisionReplayId: string;
  requestId: string;
  idempotencyKey: string;
  realizedPnl: number;
  realizedReturn: number;
}

export interface OutcomeAttributionRequest {
  evaluatedAt: string;
  maxOutcomeAgeMs: number;
  dryRun: UpbitDryRunPreview;
  readiness: LiveCanaryReadinessResult;
  outcome: ObservedOutcome;
}

export interface OutcomeAttributionResult {
  contractVersion: typeof OUTCOME_ATTRIBUTION_VERSION;
  status: 'ATTRIBUTED' | 'NO_TRADE';
  reason: string;
  outcomeId: string;
  mode: AlphaExecutionMode;
  market: string;
  requestId: string;
  idempotencyKey: string;
  eventLedgerId: string;
  decisionReplayId: string;
  lineage: UpbitDryRunPreview['lineage'];
  realizedPnl: number | null;
  realizedReturn: number | null;
  appendOnlyEvidence: true;
  submissionAuthority: false;
  executionAuthority: false;
  capitalAuthority: false;
  liveAuthority: false;
}

const parseMs = (value: string): number => Date.parse(value);

function result(request: OutcomeAttributionRequest, status: 'ATTRIBUTED' | 'NO_TRADE', reason: string): OutcomeAttributionResult {
  const { dryRun, outcome } = request;
  return {
    contractVersion: OUTCOME_ATTRIBUTION_VERSION,
    status,
    reason,
    outcomeId: outcome.outcomeId,
    mode: outcome.mode,
    market: outcome.market,
    requestId: outcome.requestId,
    idempotencyKey: outcome.idempotencyKey,
    eventLedgerId: outcome.sourceEventLedgerId,
    decisionReplayId: outcome.sourceDecisionReplayId,
    lineage: dryRun.lineage,
    realizedPnl: status === 'ATTRIBUTED' ? outcome.realizedPnl : null,
    realizedReturn: status === 'ATTRIBUTED' ? outcome.realizedReturn : null,
    appendOnlyEvidence: true,
    submissionAuthority: false,
    executionAuthority: false,
    capitalAuthority: false,
    liveAuthority: false,
  };
}

export function attributeObservedOutcome(
  request: OutcomeAttributionRequest,
  seenOutcomeIds: ReadonlySet<string> = new Set(),
): OutcomeAttributionResult {
  const { dryRun, readiness, outcome } = request;
  const evaluatedAt = parseMs(request.evaluatedAt);
  const observedAt = parseMs(outcome.observedAt);

  if (outcome.mode !== 'PAPER' && outcome.mode !== 'LIVE_SHADOW') return result(request, 'NO_TRADE', 'UNSUPPORTED_EXECUTION_MODE');
  if (!outcome.outcomeId || seenOutcomeIds.has(outcome.outcomeId)) return result(request, 'NO_TRADE', 'DUPLICATE_OR_MISSING_OUTCOME');
  if (!Number.isFinite(evaluatedAt) || !Number.isFinite(observedAt) || !Number.isFinite(request.maxOutcomeAgeMs) || request.maxOutcomeAgeMs < 0) {
    return result(request, 'NO_TRADE', 'INVALID_TIME_LINEAGE');
  }
  if (observedAt > evaluatedAt || evaluatedAt - observedAt > request.maxOutcomeAgeMs) return result(request, 'NO_TRADE', 'STALE_OR_FUTURE_OUTCOME');
  if (!Number.isFinite(outcome.realizedPnl) || !Number.isFinite(outcome.realizedReturn)) return result(request, 'NO_TRADE', 'INVALID_OUTCOME_NUMERIC');
  if (dryRun.contractVersion !== 'bot.upbit-dry-run-reconciliation.v1' || dryRun.status !== 'DRY_RUN') return result(request, 'NO_TRADE', 'DRY_RUN_NOT_ELIGIBLE');
  if (readiness.contractVersion !== 'bot.live-canary-readiness.v1' || readiness.status !== 'READY') return result(request, 'NO_TRADE', 'READINESS_NO_TRADE_TERMINAL');
  if (dryRun.executionAuthority !== false || dryRun.liveAuthority !== false || readiness.executionAuthority !== false || readiness.liveAuthority !== false) {
    return result(request, 'NO_TRADE', 'AUTHORITY_VIOLATION');
  }
  if (![outcome.requestId, outcome.idempotencyKey, outcome.sourceEventLedgerId, outcome.sourceDecisionReplayId,
        dryRun.lineage.intentId, dryRun.lineage.strategyId, dryRun.lineage.routerDecisionId,
        dryRun.lineage.governanceDecisionId, dryRun.lineage.riskDecisionId].every(Boolean)) {
    return result(request, 'NO_TRADE', 'MISSING_LINEAGE');
  }
  if (outcome.mode !== dryRun.mode || outcome.mode !== readiness.mode || outcome.market !== dryRun.market ||
      outcome.requestId !== dryRun.requestId || outcome.requestId !== readiness.requestId ||
      outcome.idempotencyKey !== dryRun.idempotencyKey || outcome.idempotencyKey !== readiness.idempotencyKey ||
      outcome.sourceEventLedgerId !== dryRun.lineage.eventLedgerId || outcome.sourceEventLedgerId !== readiness.eventLedgerId ||
      outcome.sourceDecisionReplayId !== dryRun.lineage.decisionReplayId || outcome.sourceDecisionReplayId !== readiness.decisionReplayId) {
    return result(request, 'NO_TRADE', 'LINEAGE_MISMATCH');
  }

  return result(request, 'ATTRIBUTED', 'EXPLICIT_LINEAGE_ATTRIBUTED_EVIDENCE_ONLY');
}
