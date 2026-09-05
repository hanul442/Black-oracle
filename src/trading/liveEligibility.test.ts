import assert from 'node:assert/strict';
import test from 'node:test';
import { assessLiveEligibility, type LiveEligibilityInput } from './liveEligibility';

const passing = (): LiveEligibilityInput => ({
  paperObservationDays: 21,
  closedTrades: 80,
  evidenceCoverage: 0.99,
  evidenceLessEntries: 0,
  auditAverage: 0.95,
  weakExecutions: 0,
  blindVerdict: 'PASS',
  walkForwardVerdict: 'PASS',
  monteCarloVerdict: 'PASS',
  maxDrawdownPct: 0.035,
  dailyRiskBreaches: 0,
  riskBypasses: 0,
  staleOrDuplicateExecutionViolations: 0,
  fatalRuntimeIncidents: 0,
  unresolvedCriticalIncidents: 0,
  regimeRobustnessPass: true,
  costStressPass: true,
  humanApproval: false,
});

test('quantitative pass remains only a small-live candidate without human approval', () => {
  const result = assessLiveEligibility(passing());
  assert.equal(result.state, 'SMALL_LIVE_CANDIDATE');
  assert.equal(result.eligibleForLiveExecution, false);
  assert.equal(result.stageNotionalKrw, null);
});

test('evidence-less entry blocks promotion even when returns and validation pass', () => {
  const input = passing();
  input.evidenceLessEntries = 1;
  const result = assessLiveEligibility(input);
  assert.equal(result.state, 'BLOCKED');
  assert.ok(result.blockers.includes('EVIDENCELESS_ENTER'));
});

test('explicit approval can approve only the first 300k stage, never exchange execution', () => {
  const input = passing();
  input.humanApproval = true;
  const result = assessLiveEligibility(input);
  assert.equal(result.state, 'APPROVED_STAGE_300K');
  assert.equal(result.stageNotionalKrw, 300_000);
  assert.equal(result.eligibleForLiveExecution, false);
});
