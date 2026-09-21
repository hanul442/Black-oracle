import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REQUIRED_VALIDATION_STAGES,
  createValidationExperimentManifest,
  type ValidationExperimentInput,
  type ValidationStage,
} from './validationExperiment';
import {
  BOT_VALIDATION_EVALUATION_SCHEMA,
  BOT_VALIDATION_STAGE_RESULT_SCHEMA,
  createValidationStageResult,
  evaluateValidationExperiment,
  type ValidationStageResult,
} from './validationStageResult';

function manifestInput(): ValidationExperimentInput {
  return {
    experimentId: 'exp-s4-001', strategyId: 'trend-001', strategyRevision: 'strategy-sha-1',
    codeRevision: 'code-sha-1', engineId: 'bo-engine', engineVersion: '1.0.0',
    dataSnapshotId: 'upbit-snapshot-001', observedThrough: '2026-09-01T00:00:00.000Z',
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

const manifest = () => createValidationExperimentManifest(manifestInput());

function result(stage: ValidationStage): ValidationStageResult {
  const m = manifest();
  return createValidationStageResult(m, {
    experimentId: m.experimentId, strategyId: m.strategyId, strategyRevision: m.strategyRevision,
    codeRevision: m.codeRevision, engineId: m.engineId, engineVersion: m.engineVersion,
    dataSnapshotId: m.dataSnapshotId, stage, completedAt: '2026-09-02T00:00:00.000Z',
    outputFingerprint: `sha256:${stage.toLowerCase()}`,
    metrics: { sampleCount: 120, tradeCount: 20, totalReturnPct: 2.5, maxDrawdownPct: 1.2, sharpe: 0.8 },
    diagnostics: { reproducible: true },
  });
}

test('creates immutable authority-free stage result bound to manifest lineage', () => {
  const r = result('OOS');
  assert.equal(r.schema, BOT_VALIDATION_STAGE_RESULT_SCHEMA);
  assert.equal(r.executionAuthority, false);
  assert.equal(r.promotionAuthority, false);
  assert.equal(r.capitalAuthority, false);
  assert.equal(Object.isFrozen(r), true);
  assert.equal(Object.isFrozen(r.metrics), true);
});

test('fails closed on lineage mismatch, non-finite metrics and authority escalation', () => {
  const m = manifest();
  const base = {
    experimentId: m.experimentId, strategyId: m.strategyId, strategyRevision: m.strategyRevision,
    codeRevision: m.codeRevision, engineId: m.engineId, engineVersion: m.engineVersion,
    dataSnapshotId: m.dataSnapshotId, stage: 'BACKTEST' as const,
    completedAt: '2026-09-02T00:00:00.000Z', outputFingerprint: 'sha256:backtest',
    metrics: { sampleCount: 100, tradeCount: 10 },
  };
  assert.throws(() => createValidationStageResult(m, { ...base, codeRevision: 'wrong' }), /codeRevision/);
  assert.throws(() => createValidationStageResult(m, { ...base, metrics: { sampleCount: 100, tradeCount: 10, sharpe: Number.NaN } }), /finite/);
  assert.throws(() => createValidationStageResult(m, { ...base, promotionAuthority: true }), /cannot grant/);
});

test('requires exactly one result for every canonical stage', () => {
  const m = manifest();
  const all = REQUIRED_VALIDATION_STAGES.map(result);
  assert.throws(
    () => evaluateValidationExperiment(m, all.slice(0, -1), [{ gateId: 'coverage', status: 'PASS', reason: 'complete' }], '2026-09-03T00:00:00.000Z'),
    /exactly one result/,
  );
  const duplicate = [...all.slice(0, -1), all[0]!];
  assert.throws(
    () => evaluateValidationExperiment(m, duplicate, [{ gateId: 'coverage', status: 'PASS', reason: 'complete' }], '2026-09-03T00:00:00.000Z'),
    /duplicate validation stage result|missing validation stage result/,
  );
});

test('aggregate evaluation is explicit and fail-closed without hidden thresholds', () => {
  const m = manifest();
  const all = REQUIRED_VALIDATION_STAGES.map(result);
  const evaluation = evaluateValidationExperiment(m, all, [
    { gateId: 'oos-depth', status: 'PASS', reason: 'caller verified sample depth', researchIds: ['DI-001'] },
    { gateId: 'cost-stress', status: 'INSUFFICIENT_DATA', reason: 'stress family not deep enough', researchIds: ['Q-002'] },
  ], '2026-09-03T00:00:00.000Z');
  assert.equal(evaluation.schema, BOT_VALIDATION_EVALUATION_SCHEMA);
  assert.equal(evaluation.status, 'INSUFFICIENT_DATA');
  assert.equal(evaluation.executionAuthority, false);
  assert.equal(evaluation.promotionAuthority, false);
  assert.equal(evaluation.capitalAuthority, false);
  assert.equal(Object.keys(evaluation.stageResultFingerprints).length, REQUIRED_VALIDATION_STAGES.length);
});

test('BLOCKED dominates INSUFFICIENT_DATA and empty gate sets are rejected', () => {
  const m = manifest();
  const all = REQUIRED_VALIDATION_STAGES.map(result);
  assert.throws(() => evaluateValidationExperiment(m, all, [], '2026-09-03T00:00:00.000Z'), /explicit validation gate/);
  const evaluation = evaluateValidationExperiment(m, all, [
    { gateId: 'depth', status: 'INSUFFICIENT_DATA', reason: 'needs samples' },
    { gateId: 'integrity', status: 'BLOCKED', reason: 'integrity mismatch' },
  ], '2026-09-03T00:00:00.000Z');
  assert.equal(evaluation.status, 'BLOCKED');
});
