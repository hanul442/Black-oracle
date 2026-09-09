import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessRuntimeCheckpointCompatibility,
  checkpointIdentityFromProfile,
  readTradingRuntimeProfile,
  VNEXT_PAPER_RUNTIME_ID,
} from './runtimeProfile';

const qualificationEnv = {
  TRADING_RUNTIME_ID: VNEXT_PAPER_RUNTIME_ID,
  TRADING_INITIAL_EQUITY_KRW: '100000000',
  PAPER_QUALIFICATION_ID: 'paper-100m-20260909',
  PAPER_QUALIFICATION_ARMED_AT: '2026-09-09T09:00:00Z',
  PAPER_SYSTEM_REVISION: 'git:abc123',
};

test('vNext qualification profile pins 100M capital and identity', () => {
  const profile = readTradingRuntimeProfile(qualificationEnv);
  assert.equal(profile.runtimeId, VNEXT_PAPER_RUNTIME_ID);
  assert.equal(profile.initialEquityKrw, 100_000_000);
  assert.equal(profile.qualificationMode, true);
  assert.equal(profile.qualificationId, 'paper-100m-20260909');
  assert.equal(profile.qualificationArmedAt, '2026-09-09T09:00:00.000Z');
  assert.equal(profile.systemRevision, 'git:abc123');
  assert.match(profile.riskConfigHash, /^[0-9a-f]{16}$/);
});

test('fresh qualification checkpoint identity matches exactly', () => {
  const profile = readTradingRuntimeProfile(qualificationEnv);
  const identity = checkpointIdentityFromProfile(profile);
  const assessment = assessRuntimeCheckpointCompatibility(profile, identity, 100_000_000);
  assert.equal(assessment.status, 'MATCH');
  assert.equal(assessment.compatible, true);
  assert.equal(assessment.strict, true);
});

test('qualification runtime blocks inherited 1M legacy checkpoint', () => {
  const profile = readTradingRuntimeProfile(qualificationEnv);
  const assessment = assessRuntimeCheckpointCompatibility(profile, undefined, 1_000_000);
  assert.equal(assessment.status, 'BLOCKED');
  assert.equal(assessment.compatible, false);
  assert.match(assessment.reasons.join(' '), /100000000 KRW differs from checkpoint 1000000 KRW/);
  assert.match(assessment.reasons.join(' '), /missing runtime identity metadata/);
});

test('legacy runtime observes capital drift without mutating or blocking history', () => {
  const profile = readTradingRuntimeProfile({
    TRADING_RUNTIME_ID: 'black-oracle-paper',
    TRADING_INITIAL_EQUITY_KRW: '100000000',
    APP_REV: 'legacy-observer',
  });
  const assessment = assessRuntimeCheckpointCompatibility(profile, undefined, 1_000_000);
  assert.equal(assessment.status, 'LEGACY_DRIFT');
  assert.equal(assessment.compatible, true);
  assert.equal(assessment.strict, false);
});

test('qualification runtime blocks system revision changes inside one window', () => {
  const profile = readTradingRuntimeProfile(qualificationEnv);
  const identity = { ...checkpointIdentityFromProfile(profile), systemRevision: 'git:previous' };
  const assessment = assessRuntimeCheckpointCompatibility(profile, identity, 100_000_000);
  assert.equal(assessment.status, 'BLOCKED');
  assert.match(assessment.reasons.join(' '), /System revision changed/);
});

test('armed timestamp cannot exist without a qualification id', () => {
  assert.throws(() => readTradingRuntimeProfile({
    TRADING_RUNTIME_ID: 'black-oracle-paper',
    PAPER_QUALIFICATION_ARMED_AT: '2026-09-09T09:00:00Z',
  }), /requires PAPER_QUALIFICATION_ID/);
});

test('vNext cannot start without a qualification id', () => {
  assert.throws(() => readTradingRuntimeProfile({
    TRADING_RUNTIME_ID: VNEXT_PAPER_RUNTIME_ID,
    TRADING_INITIAL_EQUITY_KRW: '100000000',
    PAPER_QUALIFICATION_ARMED_AT: '2026-09-09T09:00:00Z',
    PAPER_SYSTEM_REVISION: 'git:abc123',
  }), /requires PAPER_QUALIFICATION_ID/);
});

test('vNext cannot start without an armed timestamp', () => {
  assert.throws(() => readTradingRuntimeProfile({
    TRADING_RUNTIME_ID: VNEXT_PAPER_RUNTIME_ID,
    TRADING_INITIAL_EQUITY_KRW: '100000000',
    PAPER_QUALIFICATION_ID: 'paper-100m-20260909',
    PAPER_SYSTEM_REVISION: 'git:abc123',
  }), /requires PAPER_QUALIFICATION_ARMED_AT/);
});

test('vNext cannot start with capital other than 100M KRW', () => {
  assert.throws(() => readTradingRuntimeProfile({
    ...qualificationEnv,
    TRADING_INITIAL_EQUITY_KRW: '1000000',
  }), /requires TRADING_INITIAL_EQUITY_KRW=100000000/);
});