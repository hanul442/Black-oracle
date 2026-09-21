export const UPBIT_DRY_RUN_CONTRACT_VERSION = 'bot.upbit-dry-run-reconciliation.v1' as const;

export type AlphaExecutionMode = 'PAPER' | 'LIVE_SHADOW';
export type OrderSide = 'BUY' | 'SELL';

export interface RiskApprovedIntent {
  contractVersion: 'bot.risk-execution-boundary.v1';
  decision: 'APPROVE' | 'NO_TRADE';
  mode: AlphaExecutionMode;
  intentId: string;
  market: string;
  side: OrderSide;
  quantity: number;
  referencePrice: number;
  evaluatedAt: string;
  expiresAt: string;
  strategyId: string;
  routerDecisionId: string;
  governanceDecisionId: string;
  riskDecisionId: string;
  eventLedgerId: string;
  decisionReplayId: string;
  killSwitchActive: boolean;
  executionAuthority: false;
  capitalAuthority: false;
  liveAuthority: false;
}

export interface UpbitDryRunRequest {
  adapter: 'UPBIT';
  operation: 'ORDER_DRY_RUN';
  risk: RiskApprovedIntent;
  idempotencyKey: string;
  requestedAt: string;
}

export interface UpbitDryRunPreview {
  contractVersion: typeof UPBIT_DRY_RUN_CONTRACT_VERSION;
  status: 'DRY_RUN' | 'NO_TRADE';
  reason: string;
  requestId: string;
  idempotencyKey: string;
  mode: AlphaExecutionMode;
  market: string;
  side: OrderSide;
  quantity: number;
  referencePrice: number;
  notional: number;
  lineage: Pick<RiskApprovedIntent,
    'intentId' | 'strategyId' | 'routerDecisionId' | 'governanceDecisionId' |
    'riskDecisionId' | 'eventLedgerId' | 'decisionReplayId'>;
  submissionAuthority: false;
  executionAuthority: false;
  capitalAuthority: false;
  liveAuthority: false;
}

export interface ReconciliationResult {
  contractVersion: typeof UPBIT_DRY_RUN_CONTRACT_VERSION;
  status: 'MATCH' | 'NO_TRADE';
  reason: string;
  requestId: string;
  idempotencyKey: string;
  eventLedgerId: string;
  decisionReplayId: string;
  executionAuthority: false;
  liveAuthority: false;
}

const isoMs = (value: string): number => Date.parse(value);
const finitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;

function stableId(parts: string[]): string {
  // Deterministic identity only; this is not a credential/signature primitive.
  let hash = 2166136261;
  for (const ch of parts.join('|')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `upbit-dry-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function noTrade(request: UpbitDryRunRequest, reason: string): UpbitDryRunPreview {
  const r = request.risk;
  return {
    contractVersion: UPBIT_DRY_RUN_CONTRACT_VERSION,
    status: 'NO_TRADE', reason,
    requestId: stableId([request.idempotencyKey, r.intentId, r.riskDecisionId]),
    idempotencyKey: request.idempotencyKey,
    mode: r.mode,
    market: r.market,
    side: r.side,
    quantity: 0,
    referencePrice: 0,
    notional: 0,
    lineage: {
      intentId: r.intentId, strategyId: r.strategyId, routerDecisionId: r.routerDecisionId,
      governanceDecisionId: r.governanceDecisionId, riskDecisionId: r.riskDecisionId,
      eventLedgerId: r.eventLedgerId, decisionReplayId: r.decisionReplayId,
    },
    submissionAuthority: false, executionAuthority: false, capitalAuthority: false, liveAuthority: false,
  };
}

export function buildUpbitOrderDryRun(
  request: UpbitDryRunRequest,
  seenIdempotencyKeys: ReadonlySet<string> = new Set(),
): UpbitDryRunPreview {
  const r = request.risk;
  const requestedAt = isoMs(request.requestedAt);
  const evaluatedAt = isoMs(r.evaluatedAt);
  const expiresAt = isoMs(r.expiresAt);

  if (r.contractVersion !== 'bot.risk-execution-boundary.v1') return noTrade(request, 'RISK_CONTRACT_MISMATCH');
  if (r.decision !== 'APPROVE') return noTrade(request, 'RISK_NO_TRADE_TERMINAL');
  if (r.mode !== 'PAPER' && r.mode !== 'LIVE_SHADOW') return noTrade(request, 'UNSUPPORTED_EXECUTION_MODE');
  if (r.killSwitchActive) return noTrade(request, 'KILL_SWITCH_ACTIVE');
  if (!request.idempotencyKey || seenIdempotencyKeys.has(request.idempotencyKey)) return noTrade(request, 'IDEMPOTENCY_CONFLICT');
  if (![requestedAt, evaluatedAt, expiresAt].every(Number.isFinite)) return noTrade(request, 'INVALID_TIME_LINEAGE');
  if (evaluatedAt > requestedAt || expiresAt < requestedAt) return noTrade(request, 'STALE_OR_FUTURE_RISK');
  if (![r.intentId, r.market, r.strategyId, r.routerDecisionId, r.governanceDecisionId, r.riskDecisionId, r.eventLedgerId, r.decisionReplayId].every(Boolean)) {
    return noTrade(request, 'MISSING_LINEAGE');
  }
  if (!/^KRW-[A-Z0-9]+$/.test(r.market)) return noTrade(request, 'NON_KRW_UPBIT_MARKET');
  if (!finitePositive(r.quantity) || !finitePositive(r.referencePrice)) return noTrade(request, 'INVALID_ORDER_NUMERIC');

  const requestId = stableId([request.idempotencyKey, r.intentId, r.riskDecisionId, r.market, r.side, String(r.quantity), String(r.referencePrice)]);
  return {
    contractVersion: UPBIT_DRY_RUN_CONTRACT_VERSION,
    status: 'DRY_RUN', reason: 'RISK_APPROVED_DRY_RUN_ONLY', requestId,
    idempotencyKey: request.idempotencyKey, mode: r.mode, market: r.market, side: r.side,
    quantity: r.quantity, referencePrice: r.referencePrice, notional: r.quantity * r.referencePrice,
    lineage: {
      intentId: r.intentId, strategyId: r.strategyId, routerDecisionId: r.routerDecisionId,
      governanceDecisionId: r.governanceDecisionId, riskDecisionId: r.riskDecisionId,
      eventLedgerId: r.eventLedgerId, decisionReplayId: r.decisionReplayId,
    },
    submissionAuthority: false, executionAuthority: false, capitalAuthority: false, liveAuthority: false,
  };
}

export function reconcileUpbitDryRun(
  expected: UpbitDryRunPreview,
  observed: UpbitDryRunPreview,
): ReconciliationResult {
  const match = expected.status === 'DRY_RUN' && observed.status === 'DRY_RUN' &&
    expected.requestId === observed.requestId && expected.idempotencyKey === observed.idempotencyKey &&
    expected.mode === observed.mode && expected.market === observed.market && expected.side === observed.side &&
    expected.quantity === observed.quantity && expected.referencePrice === observed.referencePrice &&
    expected.notional === observed.notional &&
    JSON.stringify(expected.lineage) === JSON.stringify(observed.lineage);
  return {
    contractVersion: UPBIT_DRY_RUN_CONTRACT_VERSION,
    status: match ? 'MATCH' : 'NO_TRADE',
    reason: match ? 'DETERMINISTIC_RECONCILIATION_MATCH' : 'RECONCILIATION_MISMATCH',
    requestId: expected.requestId,
    idempotencyKey: expected.idempotencyKey,
    eventLedgerId: expected.lineage.eventLedgerId,
    decisionReplayId: expected.lineage.decisionReplayId,
    executionAuthority: false,
    liveAuthority: false,
  };
}
