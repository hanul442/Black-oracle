import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateExperimentCriteria, type ExperimentSpec } from './experiment';
import { ExperimentLedger } from './experimentLedger';

const spec: ExperimentSpec = {
  id: 'exp-mean-reversion-001',
  createdAt: 1_788_500_000_000,
  hypothesis: 'Mean reversion candidate reduces drawdown without destroying expectancy.',
  strategyVersion: 'paper-v1',
  modelVersion: null,
  markets: ['krw-btc', 'KRW-ETH', 'KRW-BTC'],
  regimes: ['RANGE'],
  variables: [{ name: 'entryRsi', baseline: 35, candidate: 30 }],
  criteria: [
    { metric: 'maxDrawdownPct', operator: 'LTE', threshold: 0.05 },
    { metric: 'expectancy', operator: 'GTE', threshold: 0 },
  ],
  parentExperimentIds: [],
  evidenceIds: ['ev-2', 'ev-1', 'ev-1'],
};

test('Experiment Ledger preserves an append-only lifecycle', () => {
  const ledger = new ExperimentLedger();
  const planned = ledger.plan(spec, spec.createdAt);
  assert.equal(planned.sequence, 1);
  assert.equal(ledger.status(spec.id), 'PLANNED');

  ledger.start({
    id: 'run-001',
    experimentId: spec.id,
    startedAt: spec.createdAt + 100,
    finishedAt: null,
    seed: 42,
    sampleSize: 100,
    source: 'MONTE_CARLO',
    status: 'RUNNING',
  }, spec.createdAt + 100);
  assert.equal(ledger.status(spec.id), 'RUNNING');

  ledger.complete({
    experimentId: spec.id,
    runId: 'run-001',
    status: 'REJECTED',
    finishedAt: spec.createdAt + 200,
    metrics: [
      { metric: 'maxDrawdownPct', value: 0.08, passed: false },
      { metric: 'expectancy', value: 120, passed: true },
    ],
    rejectionReasons: ['Drawdown acceptance criterion failed.'],
    decisionTraceIds: ['trace-1'],
    monteCarloSeed: 42,
  }, spec.createdAt + 200);

  assert.equal(ledger.status(spec.id), 'REJECTED');
  assert.equal(ledger.snapshot().length, 3);
  assert.deepEqual(ledger.snapshot().map((item) => item.sequence), [1, 2, 3]);
});

test('Experiment criteria preserve unavailable metrics explicitly', () => {
  const results = evaluateExperimentCriteria(spec, {
    maxDrawdownPct: 0.04,
    expectancy: null,
  });
  assert.equal(results[0].passed, true);
  assert.equal(results[1].value, null);
  assert.equal(results[1].passed, null);
});

test('Experiment spec normalization is deterministic', () => {
  const ledger = new ExperimentLedger();
  const event = ledger.plan(spec, spec.createdAt);
  const normalized = (event.payload.spec as ExperimentSpec);
  assert.deepEqual(normalized.markets, ['KRW-BTC', 'KRW-ETH']);
  assert.deepEqual(normalized.evidenceIds, ['ev-1', 'ev-2']);
});
