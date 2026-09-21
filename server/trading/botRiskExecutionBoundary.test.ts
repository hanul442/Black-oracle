import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BotRiskExecutionInput,
  evaluateBotRiskExecutionBoundary,
} from './botRiskExecutionBoundary';

const base = (): BotRiskExecutionInput => ({
  contractVersion: 'bot.risk-execution-boundary.v1',
  now: '2026-09-21T12:00:00.000Z',
  mode: 'PAPER',
  governance: {
    contractVersion: 'bot.governance-decision.v1',
    decisionId: 'gov-1',
    outcome: 'APPROVE',
    strategyId: 'strategy-a',
    strategyRevision: 'r1',
    evidenceFingerprint: 'gov-fp-1',
    decidedAt: '2026-09-21T11:59:30.000Z',
    executionAuthority: false,
    capitalAuthority: false,
    riskBypassAuthority: false,
    liveAuthority: false,
  },
  risk: {
    snapshotId: 'risk-1',
    strategyId: 'strategy-a',
    strategyRevision: 'r1',
    observedAt: '2026-09-21T11:59:45.000Z',
    maxAgeMs: 60_000,
    killSwitchEngaged: false,
    duplicateIntent: false,
    marketDataFresh: true,
    limitsSatisfied: true,
  },
});

test('allows only a non-authoritative PAPER intent after deterministic risk pass', () => {
  const decision = evaluateBotRiskExecutionBoundary(base());
  assert.equal(decision.outcome, 'ALLOW_INTENT');
  assert.equal(decision.mode, 'PAPER');
  assert.equal(decision.orderIntentAuthority, false);
  assert.equal(decision.brokerSubmissionAuthority, false);
  assert.equal(decision.executionAuthority, false);
  assert.equal(decision.capitalAuthority, false);
  assert.equal(decision.liveAuthority, false);
});

test('governance NO_TRADE is terminal', () => {
  const input = base();
  input.governance.outcome = 'NO_TRADE';
  assert.deepEqual(evaluateBotRiskExecutionBoundary(input).reasonCodes, ['GOVERNANCE_NO_TRADE']);
});

test('missing and stale risk evidence fail closed', () => {
  const missing = base();
  missing.risk = undefined;
  assert.equal(evaluateBotRiskExecutionBoundary(missing).outcome, 'NO_TRADE');

  const stale = base();
  stale.risk!.observedAt = '2026-09-21T11:00:00.000Z';
  assert.deepEqual(evaluateBotRiskExecutionBoundary(stale).reasonCodes, ['RISK_SNAPSHOT_STALE']);
});

test('identity mismatch, kill switch, duplicate intent and failed limits fail closed', () => {
  const mismatch = base();
  mismatch.risk!.strategyRevision = 'r2';
  assert.deepEqual(evaluateBotRiskExecutionBoundary(mismatch).reasonCodes, ['RISK_STRATEGY_IDENTITY_MISMATCH']);

  const killed = base();
  killed.risk!.killSwitchEngaged = true;
  assert.deepEqual(evaluateBotRiskExecutionBoundary(killed).reasonCodes, ['KILL_SWITCH_ENGAGED']);

  const duplicate = base();
  duplicate.risk!.duplicateIntent = true;
  assert.deepEqual(evaluateBotRiskExecutionBoundary(duplicate).reasonCodes, ['DUPLICATE_INTENT']);

  const limits = base();
  limits.risk!.limitsSatisfied = false;
  assert.deepEqual(evaluateBotRiskExecutionBoundary(limits).reasonCodes, ['RISK_LIMITS_NOT_SATISFIED']);
});

test('LIVE is not an Alpha mode', () => {
  const input: unknown = { ...base(), mode: 'LIVE' };
  assert.throws(
    () => evaluateBotRiskExecutionBoundary(input as BotRiskExecutionInput),
    /unrestricted LIVE/,
  );
});

test('LIVE_SHADOW remains non-authoritative', () => {
  const input = base();
  input.mode = 'LIVE_SHADOW';
  const decision = evaluateBotRiskExecutionBoundary(input);
  assert.equal(decision.outcome, 'ALLOW_INTENT');
  assert.equal(decision.liveAuthority, false);
  assert.equal(decision.brokerSubmissionAuthority, false);
});
