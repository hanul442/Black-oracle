import assert from 'node:assert/strict';
import test from 'node:test';
import { bindExperimentSpecToQualification, type ExperimentSpec } from './experiment.ts';
import { ExperimentLedger } from './experimentLedger.ts';
import { filterQualifiedExperimentEvents, isExperimentEventQualifiedForWindow } from './experimentQualification.ts';
import type { QualificationWindowCheckpoint } from './qualificationWindow.ts';

const START = Date.UTC(2026, 8, 6, 4, 0, 0);
const RCFG = 'rcfg-v1-0123456789abcdef';
const window: QualificationWindowCheckpoint = {
  schemaVersion: 1,
  id: 'paper-qualification-2026-09',
  armedAt: START - 60_000,
  startedAt: START,
  sourceRevision: '917e89c437f450dade4c71ff3851a1f25cc71431',
  startCycleStartedAt: START,
  startCycleFinishedAt: START + 10_000,
  startEvidenceIds: ['ev-start'],
  status: 'COLLECTING',
  invalidationReasons: [],
  executionAuthority: false,
  promotionAuthority: false,
};

const baseSpec = (): ExperimentSpec => ({
  id: 'exp-qualified-001',
  createdAt: START + 60_000,
  hypothesis: 'Qualified candidate improves empirical robustness.',
  strategyVersion: 'paper-v1',
  modelVersion: null,
  researchConfigurationId: RCFG,
  markets: ['KRW-BTC'],
  regimes: ['RANGE'],
  variables: [{ name: 'entryThreshold', baseline: 60, candidate: 65 }],
  criteria: [{ metric: 'expectancy', operator: 'GTE', threshold: 0 }],
  parentExperimentIds: [],
  evidenceIds: ['ev-start'],
});

const binding = {
  windowId: window.id,
  sourceRevision: window.sourceRevision,
  windowStartedAt: START,
};

test('qualified experiment lineage propagates from plan to start and complete events', () => {
  const ledger = new ExperimentLedger();
  const spec = bindExperimentSpecToQualification(baseSpec(), binding);
  ledger.plan(spec, START + 60_000);
  const started = ledger.start({
    id: 'run-qualified-001',
    experimentId: spec.id,
    startedAt: START + 120_000,
    finishedAt: null,
    seed: 42,
    sampleSize: 100,
    source: 'PAPER',
    status: 'RUNNING',
  }, START + 120_000);
  const completed = ledger.complete({
    experimentId: spec.id,
    runId: 'run-qualified-001',
    status: 'PASSED',
    finishedAt: START + 180_000,
    metrics: [{ metric: 'expectancy', value: 1, passed: true }],
    rejectionReasons: [],
    decisionTraceIds: ['trace-1'],
    monteCarloSeed: null,
  }, START + 180_000);

  assert.deepEqual(started.payload.qualification, binding);
  assert.equal(started.payload.researchConfigurationId, RCFG);
  assert.deepEqual(completed.payload.qualification, binding);
  assert.equal(completed.payload.researchConfigurationId, RCFG);
  assert.equal(isExperimentEventQualifiedForWindow(started, window), true);
  assert.equal(isExperimentEventQualifiedForWindow(completed, window), true);
  assert.equal(filterQualifiedExperimentEvents([...ledger.snapshot()], window).length, 2);
});

test('time alone cannot qualify an unbound experiment event', () => {
  const ledger = new ExperimentLedger();
  const spec = baseSpec();
  ledger.plan(spec, START + 60_000);
  const started = ledger.start({
    id: 'run-unbound-001',
    experimentId: spec.id,
    startedAt: START + 120_000,
    finishedAt: null,
    seed: null,
    sampleSize: 10,
    source: 'PAPER',
    status: 'RUNNING',
  }, START + 120_000);
  assert.equal(started.timestamp >= START, true);
  assert.equal(isExperimentEventQualifiedForWindow(started, window), false);
});

test('qualification requires a Strategy-bound Research Configuration ID', () => {
  const ledger = new ExperimentLedger();
  const spec = bindExperimentSpecToQualification({ ...baseSpec(), researchConfigurationId: null }, binding);
  ledger.plan(spec, START + 60_000);
  const started = ledger.start({
    id: 'run-no-rcfg',
    experimentId: spec.id,
    startedAt: START + 120_000,
    finishedAt: null,
    seed: null,
    sampleSize: 10,
    source: 'PAPER',
    status: 'RUNNING',
  }, START + 120_000);
  assert.equal(isExperimentEventQualifiedForWindow(started, window), false);
});

test('wrong window revision cannot receive qualification credit', () => {
  const ledger = new ExperimentLedger();
  const spec = bindExperimentSpecToQualification(baseSpec(), binding);
  ledger.plan(spec, START + 60_000);
  const started = ledger.start({
    id: 'run-revision-001',
    experimentId: spec.id,
    startedAt: START + 120_000,
    finishedAt: null,
    seed: null,
    sampleSize: 10,
    source: 'PAPER',
    status: 'RUNNING',
  }, START + 120_000);
  assert.equal(isExperimentEventQualifiedForWindow(started, { ...window, sourceRevision: 'different' }), false);
});

test('qualified experiment cannot be planned before its window start', () => {
  const ledger = new ExperimentLedger();
  const spec = bindExperimentSpecToQualification(baseSpec(), binding);
  assert.throws(() => ledger.plan(spec, START - 1), /cannot be planned before/);
});
