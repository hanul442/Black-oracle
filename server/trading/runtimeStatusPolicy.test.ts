import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateRuntimeReadiness,
  isPublicRuntimeId,
  type RuntimeReadinessInput,
} from '../../supabase/functions/black-oracle-runtime-status/policy.ts';

const NOW = 2_000_000;
const STALE_AFTER_MS = 25 * 60_000;

const fixture = (overrides: Partial<RuntimeReadinessInput> = {}): RuntimeReadinessInput => ({
  runtimeId: 'black-oracle-paper',
  now: NOW,
  staleAfterMs: STALE_AFTER_MS,
  checkpointSavedAt: NOW - 60_000,
  scheduler: {
    enabled: true,
    lastInvokedAt: NOW - 30_000,
    lastHttpStatus: 200,
    lastOk: true,
  },
  cycleErrors: 0,
  attachmentAuditStatus: 'PASS',
  ...overrides,
});

test('public status exposes only the legacy and native-shadow runtime ids', () => {
  assert.equal(isPublicRuntimeId('black-oracle-paper'), true);
  assert.equal(isPublicRuntimeId('black-oracle-paper-native-shadow'), true);
  assert.equal(isPublicRuntimeId('black-oracle-paper-vnext-s1r2'), false);
  assert.equal(isPublicRuntimeId('black-oracle-paper-vnext-100m-v03'), false);
  assert.equal(isPublicRuntimeId('black-oracle-secret'), false);
});

test('fresh persisted checkpoint plus recent accepted scheduler is ready', () => {
  const result = evaluateRuntimeReadiness(fixture());
  assert.equal(result.state, 'RUNNING');
  assert.equal(result.ready, true);
  assert.equal(result.evidence.checkpointFresh, true);
  assert.equal(result.evidence.schedulerAccepted, true);
});

test('HTTP 409 never becomes readiness even when scheduler last_ok is true', () => {
  const result = evaluateRuntimeReadiness(fixture({
    scheduler: { enabled: true, lastInvokedAt: NOW - 10_000, lastHttpStatus: 409, lastOk: true },
  }));
  assert.equal(result.state, 'DEGRADED');
  assert.equal(result.ready, false);
  assert.equal(result.evidence.schedulerAccepted, false);
});

test('fresh scheduler heartbeat cannot hide a stale checkpoint', () => {
  const result = evaluateRuntimeReadiness(fixture({
    checkpointSavedAt: NOW - STALE_AFTER_MS - 1,
  }));
  assert.equal(result.state, 'STALLED');
  assert.equal(result.ready, false);
  assert.equal(result.evidence.checkpointFresh, false);
});

test('missing checkpoint stays UNKNOWN instead of becoming zero or success', () => {
  const result = evaluateRuntimeReadiness(fixture({ checkpointSavedAt: null }));
  assert.equal(result.state, 'UNKNOWN');
  assert.equal(result.ready, false);
  assert.equal(result.evidence.checkpointPersisted, false);
});

test('disabled scheduler is BLOCKED regardless of fresh checkpoint', () => {
  const result = evaluateRuntimeReadiness(fixture({
    scheduler: { enabled: false, lastInvokedAt: NOW - 10_000, lastHttpStatus: 200, lastOk: true },
  }));
  assert.equal(result.state, 'BLOCKED');
  assert.equal(result.ready, false);
});

test('HTTP 503 and failed scheduler remain DEGRADED', () => {
  const result = evaluateRuntimeReadiness(fixture({
    scheduler: { enabled: true, lastInvokedAt: NOW - 10_000, lastHttpStatus: 503, lastOk: false },
  }));
  assert.equal(result.state, 'DEGRADED');
  assert.equal(result.ready, false);
});

test('cycle errors and attachment failures fail closed', () => {
  assert.equal(evaluateRuntimeReadiness(fixture({ cycleErrors: 1 })).ready, false);
  assert.equal(evaluateRuntimeReadiness(fixture({ attachmentAuditStatus: 'FAIL' })).ready, false);
});

test('native shadow requires a fresh checkpoint but no legacy scheduler evidence', () => {
  const result = evaluateRuntimeReadiness(fixture({
    runtimeId: 'black-oracle-paper-native-shadow',
    scheduler: null,
  }));
  assert.equal(result.state, 'RUNNING');
  assert.equal(result.ready, true);
  assert.equal(result.evidence.schedulerRequired, false);
  assert.equal(result.evidence.schedulerAccepted, null);
});
