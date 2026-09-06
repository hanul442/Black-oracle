import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQualificationReleaseReadiness } from './qualificationReleasePreflight.ts';

const NOW = Date.UTC(2026, 8, 6, 6, 0, 0);
const SHA = 'abcdef0123456789abcdef0123456789abcdef01';
const readyEnv = {
  TRADING_PERSISTENCE_BACKEND: 'supabase',
  VERCEL_ENV: 'production',
  VERCEL_GIT_COMMIT_SHA: SHA,
  PAPER_QUALIFICATION_WINDOW_ID: 'paper-2026-09-release-1',
  PAPER_QUALIFICATION_ARMED_AT: new Date(NOW - 60_000).toISOString(),
  PAPER_QUALIFICATION_SOURCE_REVISION: SHA,
};

test('exact production revision pin can become ready for first qualifying cycle', () => {
  const result = buildQualificationReleaseReadiness(readyEnv, NOW);
  assert.equal(result.state, 'READY_FOR_FIRST_QUALIFYING_CYCLE');
  assert.equal(result.readyForQualificationStart, true);
  assert.equal(result.sourceRevisionMatchesDeployedRevision, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.deploymentAuthority, false);
  assert.equal(result.qualificationStartAuthority, false);
});

test('preview deployment cannot start production qualification', () => {
  const result = buildQualificationReleaseReadiness({ ...readyEnv, VERCEL_ENV: 'preview' }, NOW);
  assert.equal(result.state, 'BLOCKED');
  assert.equal(result.readyForQualificationStart, false);
  assert.ok(result.blockers.includes('DEPLOYMENT_ENV_NOT_PRODUCTION'));
});

test('revision mismatch fails closed', () => {
  const result = buildQualificationReleaseReadiness({ ...readyEnv, PAPER_QUALIFICATION_SOURCE_REVISION: 'different' }, NOW);
  assert.equal(result.state, 'BLOCKED');
  assert.equal(result.sourceRevisionMatchesDeployedRevision, false);
  assert.ok(result.blockers.includes('PIN_REVISION_MISMATCH'));
});

test('partial qualification pin is invalid rather than inferred', () => {
  const result = buildQualificationReleaseReadiness({
    ...readyEnv,
    PAPER_QUALIFICATION_ARMED_AT: '',
  }, NOW);
  assert.equal(result.state, 'BLOCKED');
  assert.equal(result.windowPinConfigured, true);
  assert.equal(result.windowPinValid, false);
  assert.ok(result.blockers.includes('WINDOW_PIN_INVALID'));
});

test('future arming time remains pending even when revision is exact', () => {
  const result = buildQualificationReleaseReadiness({
    ...readyEnv,
    PAPER_QUALIFICATION_ARMED_AT: new Date(NOW + 60_000).toISOString(),
  }, NOW);
  assert.equal(result.state, 'ARMED_PENDING_TIME');
  assert.equal(result.readyForQualificationStart, false);
  assert.deepEqual(result.blockers, ['ARMING_TIME_NOT_REACHED']);
});

test('missing deployed revision blocks qualification credit', () => {
  const result = buildQualificationReleaseReadiness({ ...readyEnv, VERCEL_GIT_COMMIT_SHA: '' }, NOW);
  assert.equal(result.state, 'BLOCKED');
  assert.ok(result.blockers.includes('DEPLOYED_REVISION_MISSING'));
});
