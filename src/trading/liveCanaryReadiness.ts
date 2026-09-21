import type { AlphaExecutionMode, ReconciliationResult } from './upbitDryRunReconciliation';

export const LIVE_CANARY_READINESS_VERSION = 'bot.live-canary-readiness.v1' as const;

export interface AdapterHealthEvidence {
  adapter: 'UPBIT';
  status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  observedAt: string;
  expiresAt: string;
}

export interface LiveCanaryReadinessRequest {
  mode: AlphaExecutionMode;
  evaluatedAt: string;
  killSwitchActive: boolean;
  adapterHealth: AdapterHealthEvidence;
  reconciliation: ReconciliationResult;
  expectedRequestId: string;
  expectedIdempotencyKey: string;
  expectedEventLedgerId: string;
  expectedDecisionReplayId: string;
}

export interface LiveCanaryReadinessResult {
  contractVersion: typeof LIVE_CANARY_READINESS_VERSION;
  status: 'READY' | 'NO_TRADE';
  reason: string;
  mode: AlphaExecutionMode;
  requestId: string;
  idempotencyKey: string;
  eventLedgerId: string;
  decisionReplayId: string;
  evidenceOnly: true;
  submissionAuthority: false;
  executionAuthority: false;
  capitalAuthority: false;
  liveAuthority: false;
}

const parseMs = (value: string): number => Date.parse(value);

function result(request: LiveCanaryReadinessRequest, status: 'READY' | 'NO_TRADE', reason: string): LiveCanaryReadinessResult {
  return {
    contractVersion: LIVE_CANARY_READINESS_VERSION,
    status,
    reason,
    mode: request.mode,
    requestId: request.expectedRequestId,
    idempotencyKey: request.expectedIdempotencyKey,
    eventLedgerId: request.expectedEventLedgerId,
    decisionReplayId: request.expectedDecisionReplayId,
    evidenceOnly: true,
    submissionAuthority: false,
    executionAuthority: false,
    capitalAuthority: false,
    liveAuthority: false,
  };
}

export function evaluateLiveCanaryReadiness(request: LiveCanaryReadinessRequest): LiveCanaryReadinessResult {
  const evaluatedAt = parseMs(request.evaluatedAt);
  const observedAt = parseMs(request.adapterHealth.observedAt);
  const expiresAt = parseMs(request.adapterHealth.expiresAt);
  const reconciliation = request.reconciliation;

  if (request.mode !== 'PAPER' && request.mode !== 'LIVE_SHADOW') return result(request, 'NO_TRADE', 'UNSUPPORTED_EXECUTION_MODE');
  if (request.killSwitchActive) return result(request, 'NO_TRADE', 'KILL_SWITCH_ACTIVE');
  if (request.adapterHealth.adapter !== 'UPBIT') return result(request, 'NO_TRADE', 'ADAPTER_MISMATCH');
  if (request.adapterHealth.status !== 'HEALTHY') return result(request, 'NO_TRADE', 'ADAPTER_NOT_HEALTHY');
  if (![evaluatedAt, observedAt, expiresAt].every(Number.isFinite)) return result(request, 'NO_TRADE', 'INVALID_HEALTH_TIME');
  if (observedAt > evaluatedAt || expiresAt < evaluatedAt) return result(request, 'NO_TRADE', 'STALE_OR_FUTURE_HEALTH');
  if (![request.expectedRequestId, request.expectedIdempotencyKey, request.expectedEventLedgerId, request.expectedDecisionReplayId].every(Boolean)) {
    return result(request, 'NO_TRADE', 'MISSING_EXPECTED_LINEAGE');
  }
  if (reconciliation.contractVersion !== 'bot.upbit-dry-run-reconciliation.v1') return result(request, 'NO_TRADE', 'RECONCILIATION_CONTRACT_MISMATCH');
  if (reconciliation.status !== 'MATCH') return result(request, 'NO_TRADE', 'RECONCILIATION_NOT_MATCHED');
  if (reconciliation.executionAuthority !== false || reconciliation.liveAuthority !== false) return result(request, 'NO_TRADE', 'RECONCILIATION_AUTHORITY_VIOLATION');
  if (reconciliation.requestId !== request.expectedRequestId || reconciliation.idempotencyKey !== request.expectedIdempotencyKey ||
      reconciliation.eventLedgerId !== request.expectedEventLedgerId || reconciliation.decisionReplayId !== request.expectedDecisionReplayId) {
    return result(request, 'NO_TRADE', 'LINEAGE_MISMATCH');
  }

  return result(request, 'READY', 'EVIDENCE_COMPLETE_AUTHORITY_NOT_GRANTED');
}
