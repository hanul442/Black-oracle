import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOT_VALIDATION_EXPERIMENT_SCHEMA,
  REQUIRED_VALIDATION_STAGES,
  createValidationExperimentManifest,
  type ValidationExperimentInput,
} from './validationExperiment';

function validInput(): ValidationExperimentInput {
  return {
    experimentId: 'exp-001',
    strategyId: 'trend-001',
    strategyRevision: 'strategy-sha-1',
    codeRevision: 'code-sha-1',
    engineId: 'bo-engine',
    engineVersion: '1.0.0',
    dataSnapshotId: 'upbit-snapshot-001',
    observedThrough: '2026-09-01T00:00:00.000Z',
    pointInTimeSafe: true,
    split: {
      train: { startAt: '2026-01-01T00:00:00.000Z', endAt: '2026-06-01T00:00:00.000Z' },
      outOfSample: { startAt: '2026-06-01T00:00:00.000Z', endAt: '2026-08-01T00:00:00.000Z' },
      walkForwardFolds: 4,
    },
    execution: { feeBps: 5, spreadBps: 4, slippageBps: 8 },
    stages: [...REQUIRED_VALIDATION_STAGES],
  };
}

test('creates a canonical authority-free validation manifest', () => {
  const manifest = createValidationExperimentManifest(validInput());
  assert.equal(manifest.schema, BOT_VALIDATION_EXPERIMENT_SCHEMA);
  assert.equal(manifest.pointInTimeSafe, true);
  assert.equal(manifest.promotionAuthority, false);
  assert.equal(manifest.executionAuthority, false);
  assert.equal(manifest.capitalAuthority, false);
  assert.deepEqual(manifest.stages, REQUIRED_VALIDATION_STAGES);
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.split), true);
  assert.equal(Object.isFrozen(manifest.execution), true);
});

test('fails closed when point-in-time safety is not asserted', () => {
  assert.throws(
    () => createValidationExperimentManifest({ ...validInput(), pointInTimeSafe: false }),
    /point-in-time-safe/,
  );
});

test('fails closed on overlapping train and OOS windows', () => {
  const input = validInput();
  input.split = {
    ...input.split,
    outOfSample: { startAt: '2026-05-01T00:00:00.000Z', endAt: '2026-08-01T00:00:00.000Z' },
  };
  assert.throws(() => createValidationExperimentManifest(input), /must not overlap/);
});

test('requires every canonical validation stage exactly once', () => {
  const missing = validInput();
  missing.stages = REQUIRED_VALIDATION_STAGES.filter((stage) => stage !== 'MONTE_CARLO');
  assert.throws(() => createValidationExperimentManifest(missing), /MONTE_CARLO/);

  const duplicate = validInput();
  duplicate.stages = [...REQUIRED_VALIDATION_STAGES, 'BACKTEST'];
  assert.throws(() => createValidationExperimentManifest(duplicate), /must be unique/);
});

test('rejects invalid execution assumptions and authority escalation', () => {
  const invalidCost = validInput();
  invalidCost.execution = { ...invalidCost.execution, slippageBps: -1 };
  assert.throws(() => createValidationExperimentManifest(invalidCost), /slippageBps/);

  assert.throws(
    () => createValidationExperimentManifest({ ...validInput(), executionAuthority: true }),
    /cannot grant/,
  );
});

test('requires stable identities and a complete observed-through boundary', () => {
  assert.throws(
    () => createValidationExperimentManifest({ ...validInput(), dataSnapshotId: '   ' }),
    /dataSnapshotId is required/,
  );
  assert.throws(
    () => createValidationExperimentManifest({ ...validInput(), observedThrough: '2026-07-01T00:00:00.000Z' }),
    /cannot precede/,
  );
});
