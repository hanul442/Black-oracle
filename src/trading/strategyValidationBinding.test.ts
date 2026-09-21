import assert from 'node:assert/strict';
import test from 'node:test';
import { REQUIRED_VALIDATION_STAGES, type ValidationStage } from './validationExperiment';
import type { ValidationEvaluation } from './validationStageResult';
import { bindStrategyCandidateToValidation, BOT_STRATEGY_VALIDATION_BINDING_SCHEMA } from './strategyValidationBinding';

function evaluation(status: ValidationEvaluation['status']): ValidationEvaluation {
  const fingerprints = Object.fromEntries(
    REQUIRED_VALIDATION_STAGES.map((stage) => [stage, `sha256:${stage.toLowerCase()}`]),
  ) as Record<ValidationStage, string>;
  return {
    schema: 'bot.validation-evaluation.v1',
    experimentId: 'exp-s6-001',
    evaluatedAt: '2026-09-21T07:00:00.000Z',
    status,
    stageResultFingerprints: fingerprints,
    gates: [{ gateId: 'canonical', status, reason: 'fixture' }],
    promotionAuthority: false,
    executionAuthority: false,
    capitalAuthority: false,
  };
}

test('PASS canonical evaluation makes candidate validation-eligible without authority', () => {
  const binding = bindStrategyCandidateToValidation({
    strategyId: 'genome-001', strategyRevision: 'rev-001', experimentId: 'exp-s6-001', evaluation: evaluation('PASS'),
  });
  assert.equal(binding.schema, BOT_STRATEGY_VALIDATION_BINDING_SCHEMA);
  assert.equal(binding.validationEligible, true);
  assert.equal(binding.promotionAuthority, false);
  assert.equal(binding.executionAuthority, false);
  assert.equal(binding.capitalAuthority, false);
  assert.equal(Object.keys(binding.stageResultFingerprints).length, REQUIRED_VALIDATION_STAGES.length);
  assert.equal(Object.isFrozen(binding), true);
});

test('BLOCKED and INSUFFICIENT_DATA fail closed', () => {
  for (const status of ['BLOCKED', 'INSUFFICIENT_DATA'] as const) {
    const binding = bindStrategyCandidateToValidation({
      strategyId: 'genome-001', strategyRevision: 'rev-001', experimentId: 'exp-s6-001', evaluation: evaluation(status),
    });
    assert.equal(binding.validationEligible, false);
    assert.equal(binding.validationStatus, status);
  }
});

test('rejects experiment lineage mismatch and authority escalation', () => {
  assert.throws(() => bindStrategyCandidateToValidation({
    strategyId: 'genome-001', strategyRevision: 'rev-001', experimentId: 'wrong-exp', evaluation: evaluation('PASS'),
  }), /experimentId/);
  assert.throws(() => bindStrategyCandidateToValidation({
    strategyId: 'genome-001', strategyRevision: 'rev-001', experimentId: 'exp-s6-001', evaluation: evaluation('PASS'), promotionAuthority: true,
  }), /cannot grant/);
});

test('rejects malformed candidate identity and missing canonical fingerprints', () => {
  assert.throws(() => bindStrategyCandidateToValidation({
    strategyId: ' ', strategyRevision: 'rev-001', experimentId: 'exp-s6-001', evaluation: evaluation('PASS'),
  }), /strategyId/);
  const empty = { ...evaluation('PASS'), stageResultFingerprints: {} as Record<ValidationStage, string> };
  assert.throws(() => bindStrategyCandidateToValidation({
    strategyId: 'genome-001', strategyRevision: 'rev-001', experimentId: 'exp-s6-001', evaluation: empty,
  }), /fingerprints/);
});
