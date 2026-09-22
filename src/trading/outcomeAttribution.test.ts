import assert from 'node:assert/strict';
import test from 'node:test';
import { attributeObservedOutcome, type OutcomeAttributionRequest } from './outcomeAttribution';
import type { UpbitDryRunPreview } from './upbitDryRunReconciliation';
import type { LiveCanaryReadinessResult } from './liveCanaryReadiness';

const dryRun: UpbitDryRunPreview = {
  contractVersion: 'bot.upbit-dry-run-reconciliation.v1', status: 'DRY_RUN', reason: 'RISK_APPROVED_DRY_RUN_ONLY',
  requestId: 'req-1', idempotencyKey: 'idem-1', mode: 'PAPER', market: 'KRW-BTC', side: 'BUY',
  quantity: 0.001, referencePrice: 100_000_000, notional: 100_000,
  lineage: { intentId: 'intent-1', strategyId: 'strategy-1', routerDecisionId: 'router-1', governanceDecisionId: 'gov-1', riskDecisionId: 'risk-1', eventLedgerId: 'event-1', decisionReplayId: 'replay-1', orderIntentFingerprint: 'order-intent-v1-fixture' },
  submissionAuthority: false, executionAuthority: false, capitalAuthority: false, liveAuthority: false,
};
const readiness: LiveCanaryReadinessResult = {
  contractVersion: 'bot.live-canary-readiness.v1', status: 'READY', reason: 'EVIDENCE_COMPLETE_AUTHORITY_NOT_GRANTED',
  mode: 'PAPER', requestId: 'req-1', idempotencyKey: 'idem-1', eventLedgerId: 'event-1', decisionReplayId: 'replay-1',
  evidenceOnly: true, submissionAuthority: false, executionAuthority: false, capitalAuthority: false, liveAuthority: false,
};
const base: OutcomeAttributionRequest = {
  evaluatedAt: '2026-09-22T00:01:00.000Z', maxOutcomeAgeMs: 120_000, dryRun, readiness,
  outcome: { outcomeId: 'outcome-1', mode: 'PAPER', market: 'KRW-BTC', observedAt: '2026-09-22T00:00:30.000Z', sourceEventLedgerId: 'event-1', sourceDecisionReplayId: 'replay-1', requestId: 'req-1', idempotencyKey: 'idem-1', realizedPnl: 1000, realizedReturn: 0.01 },
};

test('attributes explicit PAPER lineage without authority', () => {
  const value = attributeObservedOutcome(base);
  assert.equal(value.status, 'ATTRIBUTED');
  assert.equal(value.appendOnlyEvidence, true);
  assert.equal(value.executionAuthority, false);
  assert.equal(value.liveAuthority, false);
});

test('fails closed on missing or mismatched lineage', () => {
  assert.equal(attributeObservedOutcome({ ...base, outcome: { ...base.outcome, sourceDecisionReplayId: '' } }).reason, 'MISSING_LINEAGE');
  assert.equal(attributeObservedOutcome({ ...base, outcome: { ...base.outcome, requestId: 'wrong' } }).reason, 'LINEAGE_MISMATCH');
});

test('fails closed on duplicate, future and stale outcomes', () => {
  assert.equal(attributeObservedOutcome(base, new Set(['outcome-1'])).reason, 'DUPLICATE_OR_MISSING_OUTCOME');
  assert.equal(attributeObservedOutcome({ ...base, outcome: { ...base.outcome, observedAt: '2026-09-22T00:02:00.000Z' } }).reason, 'STALE_OR_FUTURE_OUTCOME');
  assert.equal(attributeObservedOutcome({ ...base, maxOutcomeAgeMs: 10_000 }).reason, 'STALE_OR_FUTURE_OUTCOME');
});

test('readiness NO_TRADE is terminal', () => {
  const blocked = { ...readiness, status: 'NO_TRADE' as const, reason: 'KILL_SWITCH_ACTIVE' };
  assert.equal(attributeObservedOutcome({ ...base, readiness: blocked }).reason, 'READINESS_NO_TRADE_TERMINAL');
});
