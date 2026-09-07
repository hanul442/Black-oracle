import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runOracleHarness,
  summarizeOracleHarnessAxes,
  type OracleHarnessRunInput,
} from './oracleHarness';
import type {
  PromotionGateCheck,
  PromotionGateVerdict,
  PromotionHardGateInput,
  StrategyPromotionEligibility,
} from './promotionHardGate';

const promotion = {
  stage: 'EXPERIMENT_TO_INCUBATOR',
  rating: { grade: 'BBB0', rawScore: 72 },
} as PromotionHardGateInput;

const input = (): OracleHarnessRunInput => ({
  experimentId: 'exp-001',
  genomeId: 'genome-001',
  promotion,
  evaluatedAt: 1_700_000_000_000,
});

const gate = (
  verdict: PromotionGateVerdict,
  checks: PromotionGateCheck[],
): StrategyPromotionEligibility => ({
  schemaVersion: 1,
  policyVersion: 'TEST_POLICY_V1',
  stage: 'EXPERIMENT_TO_INCUBATOR',
  verdict,
  eligible: verdict === 'PASS',
  minimumGrade: 'BBB-',
  checks,
  blockers: checks.filter((item) => !item.passed && !item.insufficient).map((item) => item.key),
  insufficientEvidence: checks.filter((item) => !item.passed && item.insufficient).map((item) => item.key),
  reasons: [`verdict=${verdict}`],
  promotionAuthority: false,
  executionAuthority: false,
  liveDeploymentAuthority: false,
});

const passCheck = (key: string): PromotionGateCheck => ({ key, passed: true, insufficient: false, reason: `${key} passed` });
const failCheck = (key: string): PromotionGateCheck => ({ key, passed: false, insufficient: false, reason: `${key} failed` });
const insufficientCheck = (key: string): PromotionGateCheck => ({ key, passed: false, insufficient: true, reason: `${key} needs evidence` });

test('PASS becomes KEEP and requests explicit promotion review without authority', () => {
  const result = runOracleHarness(input(), undefined, () => gate('PASS', [
    passCheck('BLIND_OOS'),
    passCheck('MONTE_CARLO_SURVIVAL'),
    passCheck('WALK_FORWARD'),
    passCheck('COST_STRESS'),
    passCheck('AUDIT_COVERAGE'),
  ]));

  assert.equal(result.disposition, 'KEEP');
  assert.equal(result.nextAction, 'REQUEST_PROMOTION_REVIEW');
  assert.equal(result.hardGateVerdict, 'PASS');
  assert.equal(result.requiresHumanApproval, true);
  assert.equal(result.autoTransition, false);
  assert.equal(result.promotionAuthority, false);
  assert.equal(result.executionAuthority, false);
  assert.equal(result.capitalAuthority, false);
  assert.equal(result.liveDeploymentAuthority, false);
  assert.ok(result.axes.every((axis) => axis.status === 'PASS'));
});

test('INSUFFICIENT_DATA stays KEEP but can only extend validation', () => {
  const result = runOracleHarness(input(), undefined, () => gate('INSUFFICIENT_DATA', [
    passCheck('BLIND_OOS'),
    insufficientCheck('MONTE_CARLO_SURVIVAL'),
  ]));

  assert.equal(result.disposition, 'KEEP');
  assert.equal(result.nextAction, 'EXTEND_VALIDATION');
  assert.equal(result.hardGateVerdict, 'INSUFFICIENT_DATA');
  assert.deepEqual(result.insufficientEvidence, ['MONTE_CARLO_SURVIVAL']);
  assert.equal(result.axes.find((axis) => axis.axis === 'RISK')?.status, 'INSUFFICIENT_DATA');
  assert.equal(result.requiresHumanApproval, false);
});

test('BLOCKED becomes DISCARD and preserves blocker evidence', () => {
  const result = runOracleHarness(input(), undefined, () => gate('BLOCKED', [
    passCheck('BLIND_OOS'),
    failCheck('ADAPTER_PARITY'),
  ]));

  assert.equal(result.disposition, 'DISCARD');
  assert.equal(result.nextAction, 'ARCHIVE_REJECTED_CANDIDATE');
  assert.deepEqual(result.blockers, ['ADAPTER_PARITY']);
  assert.equal(result.axes.find((axis) => axis.axis === 'EXECUTION')?.status, 'FAIL');
  assert.equal(result.requiresHumanApproval, false);
});

test('evaluator exception becomes CRASH and fails closed', () => {
  const result = runOracleHarness(input(), undefined, () => {
    throw new Error('simulated evaluator failure');
  });

  assert.equal(result.disposition, 'CRASH');
  assert.equal(result.nextAction, 'INVESTIGATE_HARNESS_FAILURE');
  assert.equal(result.crash?.phase, 'PROMOTION_EVALUATION');
  assert.match(result.crash?.message ?? '', /simulated evaluator failure/);
  assert.equal(result.executionAuthority, false);
  assert.equal(result.capitalAuthority, false);
});

test('missing audit identity becomes input-validation CRASH rather than an unauditable result', () => {
  const malformed = input();
  malformed.experimentId = '';
  const result = runOracleHarness(malformed, undefined, () => gate('PASS', []));

  assert.equal(result.disposition, 'CRASH');
  assert.equal(result.crash?.phase, 'INPUT_VALIDATION');
  assert.equal(result.experimentId, 'UNKNOWN_EXPERIMENT');
  assert.equal(result.autoTransition, false);
});

test('five-axis view maps hard-gate checks and defaults unknown governance checks to EVIDENCE', () => {
  const axes = summarizeOracleHarnessAxes([
    passCheck('BLIND_OOS'),
    failCheck('MONTE_CARLO_SURVIVAL'),
    insufficientCheck('WALK_FORWARD'),
    passCheck('COST_STRESS'),
    passCheck('AUDIT_COVERAGE'),
    passCheck('FUTURE_GOVERNANCE_CHECK'),
  ]);

  assert.deepEqual(axes.map((axis) => axis.axis), ['PERFORMANCE', 'RISK', 'ROBUSTNESS', 'EXECUTION', 'EVIDENCE']);
  assert.equal(axes.find((axis) => axis.axis === 'PERFORMANCE')?.status, 'PASS');
  assert.equal(axes.find((axis) => axis.axis === 'RISK')?.status, 'FAIL');
  assert.equal(axes.find((axis) => axis.axis === 'ROBUSTNESS')?.status, 'INSUFFICIENT_DATA');
  assert.equal(axes.find((axis) => axis.axis === 'EVIDENCE')?.totalChecks, 2);
});
