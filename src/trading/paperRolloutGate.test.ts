import assert from 'node:assert/strict';
import test from 'node:test';
import { assessPaperRollout, type PaperRolloutInput } from './paperRolloutGate';

const readyInput = (overrides: Partial<PaperRolloutInput> = {}): PaperRolloutInput => ({
  stackLineageAccepted: true,
  coreCiPassed: true,
  securityGatePassed: true,
  localDeviceQaPassed: true,
  previewAccessible: true,
  previewRevisionVerified: true,
  previewOperatorQaPassed: true,
  readinessEndpointReachable: true,
  productionPreflightReady: true,
  schedulerChangeReviewed: true,
  productionRiskLimitsUnchanged: true,
  humanApproval: false,
  ...overrides,
});

test('PAPER rollout fails closed when release evidence is unavailable', () => {
  const result = assessPaperRollout(readyInput({
    previewAccessible: false,
    previewRevisionVerified: false,
    previewOperatorQaPassed: false,
    readinessEndpointReachable: false,
    productionPreflightReady: false,
  }));

  assert.equal(result.state, 'BLOCKED');
  assert.equal(result.deploymentAuthority, false);
  assert.deepEqual(result.blockers, [
    'PREVIEW_ACCESS',
    'PREVIEW_REVISION',
    'PREVIEW_OPERATOR_QA',
    'READINESS_ENDPOINT',
    'PRODUCTION_PREFLIGHT',
  ]);
});

test('local device QA cannot substitute for deployed Preview QA', () => {
  const result = assessPaperRollout(readyInput({
    localDeviceQaPassed: true,
    previewAccessible: false,
    previewRevisionVerified: false,
    previewOperatorQaPassed: false,
  }));

  assert.equal(result.state, 'BLOCKED');
  assert.equal(result.gates.find((gate) => gate.id === 'LOCAL_DEVICE_QA')?.passed, true);
  assert.equal(result.gates.find((gate) => gate.id === 'PREVIEW_ACCESS')?.passed, false);
});

test('production preflight must be explicitly ready', () => {
  const result = assessPaperRollout(readyInput({ productionPreflightReady: false }));

  assert.equal(result.state, 'BLOCKED');
  assert.deepEqual(result.blockers, ['PRODUCTION_PREFLIGHT']);
});

test('all deterministic gates yield ready-for-human-approval but no deployment authority', () => {
  const result = assessPaperRollout(readyInput());

  assert.equal(result.state, 'READY_FOR_HUMAN_APPROVAL');
  assert.equal(result.deploymentAuthority, false);
  assert.deepEqual(result.blockers, []);
});

test('human approval changes state only after every deterministic gate passes', () => {
  const approved = assessPaperRollout(readyInput({ humanApproval: true }));
  assert.equal(approved.state, 'APPROVED_FOR_PAPER_ROLLOUT');
  assert.equal(approved.deploymentAuthority, false);

  const blocked = assessPaperRollout(readyInput({ humanApproval: true, schedulerChangeReviewed: false }));
  assert.equal(blocked.state, 'BLOCKED');
  assert.deepEqual(blocked.blockers, ['SCHEDULER_REVIEW']);
});

test('risk-limit drift blocks rollout even when every other gate passes', () => {
  const result = assessPaperRollout(readyInput({ productionRiskLimitsUnchanged: false }));

  assert.equal(result.state, 'BLOCKED');
  assert.deepEqual(result.blockers, ['RISK_LIMIT_FREEZE']);
});
