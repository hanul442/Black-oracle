import { CANONICAL_ORDER_INTENT_VERSION, canonicalOrderIntentFingerprint, isFinitePositive, isNonEmpty, type CanonicalOrderIntent } from './canonicalOrderIntent';

export type BotExecutionMode = 'PAPER' | 'LIVE_SHADOW';
export type BotGovernanceOutcome = 'APPROVE' | 'NO_TRADE';
export type BotRiskOutcome = 'ALLOW_INTENT' | 'NO_TRADE';

export interface BotGovernanceRiskInput { contractVersion: 'bot.governance-decision.v1'; decisionId: string; outcome: BotGovernanceOutcome; strategyId?: string; strategyRevision?: string; evidenceFingerprint: string; decidedAt: string; executionAuthority: false; capitalAuthority: false; riskBypassAuthority: false; liveAuthority: false; }
export interface BotRiskSnapshot { snapshotId: string; strategyId: string; strategyRevision: string; observedAt: string; maxAgeMs: number; killSwitchEngaged: boolean; duplicateIntent: boolean; marketDataFresh: boolean; limitsSatisfied: boolean; }
export interface BotRiskExecutionInput { contractVersion: 'bot.risk-execution-boundary.v1'; now: string; mode: BotExecutionMode; governance: BotGovernanceRiskInput; orderIntent?: CanonicalOrderIntent; risk?: BotRiskSnapshot; }
export interface BotOrderIntentAttestation { contractVersion: typeof CANONICAL_ORDER_INTENT_VERSION; fingerprint: string; intentId: string; market: string; side: 'BUY' | 'SELL'; quantity: number; referencePrice: number; strategyId: string; strategyRevision: string; observedAt: string; expiresAt: string; }
export interface BotRiskExecutionDecision { contractVersion: 'bot.risk-execution-boundary.v1'; decisionId: string; outcome: BotRiskOutcome; mode: BotExecutionMode; reasonCodes: string[]; governanceDecisionId: string; governanceEvidenceFingerprint: string; strategyId?: string; strategyRevision?: string; riskSnapshotId?: string; orderIntent?: BotOrderIntentAttestation; evaluatedAt: string; orderIntentAuthority: false; brokerSubmissionAuthority: false; executionAuthority: false; capitalAuthority: false; riskBypassAuthority: false; liveAuthority: false; }

const parseTime = (value: string): number => { const parsed = Date.parse(value); if (!Number.isFinite(parsed)) throw new Error(`invalid timestamp: ${value}`); return parsed; };
const assertNoAuthorityEscalation = (g: BotGovernanceRiskInput): void => { if (g.executionAuthority !== false || g.capitalAuthority !== false || g.riskBypassAuthority !== false || g.liveAuthority !== false) throw new Error('governance authority escalation rejected'); };

export function evaluateBotRiskExecutionBoundary(input: BotRiskExecutionInput): BotRiskExecutionDecision {
  if (input.contractVersion !== 'bot.risk-execution-boundary.v1') throw new Error('unsupported risk execution contract');
  if (input.mode !== 'PAPER' && input.mode !== 'LIVE_SHADOW') throw new Error('unrestricted LIVE mode is not permitted');
  if (input.governance.contractVersion !== 'bot.governance-decision.v1') throw new Error('unsupported governance contract');
  if (!isNonEmpty(input.governance.decisionId) || !isNonEmpty(input.governance.evidenceFingerprint)) throw new Error('missing governance lineage');
  assertNoAuthorityEscalation(input.governance);
  const nowMs = parseTime(input.now); const governanceMs = parseTime(input.governance.decidedAt);
  if (governanceMs > nowMs) return noTrade(input, ['GOVERNANCE_FUTURE_TIMESTAMP']);
  if (input.governance.outcome !== 'APPROVE') return noTrade(input, ['GOVERNANCE_NO_TRADE']);
  if (!isNonEmpty(input.governance.strategyId) || !isNonEmpty(input.governance.strategyRevision)) return noTrade(input, ['GOVERNANCE_STRATEGY_IDENTITY_MISSING']);
  if (!input.orderIntent) return noTrade(input, ['ORDER_INTENT_MISSING']);
  const order = input.orderIntent;
  if (order.contractVersion !== CANONICAL_ORDER_INTENT_VERSION) return noTrade(input, ['ORDER_INTENT_CONTRACT_MISMATCH']);
  if (![order.intentId, order.market, order.strategyId, order.strategyRevision].every(isNonEmpty) || !Number.isFinite(order.maxAgeMs) || order.maxAgeMs < 0) return noTrade(input, ['ORDER_INTENT_MALFORMED']);
  if (!/^KRW-[A-Z0-9]+$/.test(order.market) || (order.side !== 'BUY' && order.side !== 'SELL') || !isFinitePositive(order.quantity) || !isFinitePositive(order.referencePrice)) return noTrade(input, ['ORDER_ECONOMICS_INVALID']);
  if (order.strategyId !== input.governance.strategyId || order.strategyRevision !== input.governance.strategyRevision) return noTrade(input, ['ORDER_STRATEGY_IDENTITY_MISMATCH']);
  const orderObservedMs = parseTime(order.observedAt);
  if (orderObservedMs > nowMs) return noTrade(input, ['ORDER_INTENT_FUTURE']);
  if (nowMs - orderObservedMs > order.maxAgeMs) return noTrade(input, ['ORDER_INTENT_STALE']);
  if (!input.risk) return noTrade(input, ['RISK_SNAPSHOT_MISSING']);
  const risk = input.risk;
  if (!isNonEmpty(risk.snapshotId) || !isNonEmpty(risk.strategyId) || !isNonEmpty(risk.strategyRevision) || !Number.isFinite(risk.maxAgeMs) || risk.maxAgeMs < 0) throw new Error('malformed risk snapshot');
  if (risk.strategyId !== input.governance.strategyId || risk.strategyRevision !== input.governance.strategyRevision) return noTrade(input, ['RISK_STRATEGY_IDENTITY_MISMATCH'], risk.snapshotId);
  const observedMs = parseTime(risk.observedAt);
  if (observedMs > nowMs) return noTrade(input, ['RISK_SNAPSHOT_FUTURE'], risk.snapshotId);
  if (nowMs - observedMs > risk.maxAgeMs) return noTrade(input, ['RISK_SNAPSHOT_STALE'], risk.snapshotId);
  if (!risk.marketDataFresh) return noTrade(input, ['MARKET_DATA_STALE'], risk.snapshotId);
  if (risk.killSwitchEngaged) return noTrade(input, ['KILL_SWITCH_ENGAGED'], risk.snapshotId);
  if (risk.duplicateIntent) return noTrade(input, ['DUPLICATE_INTENT'], risk.snapshotId);
  if (!risk.limitsSatisfied) return noTrade(input, ['RISK_LIMITS_NOT_SATISFIED'], risk.snapshotId);
  const expiresAt = new Date(orderObservedMs + order.maxAgeMs).toISOString();
  return { contractVersion: 'bot.risk-execution-boundary.v1', decisionId: `risk:${input.governance.decisionId}:${risk.snapshotId}:${canonicalOrderIntentFingerprint(order)}`, outcome: 'ALLOW_INTENT', mode: input.mode, reasonCodes: ['DETERMINISTIC_RISK_PASS', `MODE_${input.mode}`], governanceDecisionId: input.governance.decisionId, governanceEvidenceFingerprint: input.governance.evidenceFingerprint, strategyId: input.governance.strategyId, strategyRevision: input.governance.strategyRevision, riskSnapshotId: risk.snapshotId, orderIntent: { contractVersion: CANONICAL_ORDER_INTENT_VERSION, fingerprint: canonicalOrderIntentFingerprint(order), intentId: order.intentId, market: order.market, side: order.side, quantity: order.quantity, referencePrice: order.referencePrice, strategyId: order.strategyId, strategyRevision: order.strategyRevision, observedAt: order.observedAt, expiresAt }, evaluatedAt: input.now, orderIntentAuthority: false, brokerSubmissionAuthority: false, executionAuthority: false, capitalAuthority: false, riskBypassAuthority: false, liveAuthority: false };
}

function noTrade(input: BotRiskExecutionInput, reasonCodes: string[], riskSnapshotId?: string): BotRiskExecutionDecision { return { contractVersion: 'bot.risk-execution-boundary.v1', decisionId: `risk:${input.governance.decisionId}:${riskSnapshotId ?? 'none'}`, outcome: 'NO_TRADE', mode: input.mode, reasonCodes, governanceDecisionId: input.governance.decisionId, governanceEvidenceFingerprint: input.governance.evidenceFingerprint, strategyId: input.governance.strategyId, strategyRevision: input.governance.strategyRevision, riskSnapshotId, evaluatedAt: input.now, orderIntentAuthority: false, brokerSubmissionAuthority: false, executionAuthority: false, capitalAuthority: false, riskBypassAuthority: false, liveAuthority: false }; }
