import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExperimentLedgerEvent } from './experimentLedger.ts';
import { buildLineageAwareDeflatedSharpe, buildResearchTrialLineage } from './researchTrialLineage.ts';

const strategyPanel = (count = 9) => ({
  observations: [{
    predictions: Array.from({ length: count }, (_, index) => ({
      candidateId: `candidate-${index}`,
      fingerprint: `fingerprint-${index}`,
    })),
  }],
});

const planned = (id: string, sequence: number, candidate = 0.7): ExperimentLedgerEvent => ({
  id: `event-${sequence}`,
  sequence,
  timestamp: 1_700_000_000_000 + sequence,
  type: 'EXPERIMENT_PLANNED',
  experimentId: id,
  payload: {
    spec: {
      id,
      createdAt: 1_700_000_000_000,
      hypothesis: 'candidate improves robustness',
      strategyVersion: 'strategy-v1',
      modelVersion: null,
      markets: ['KRW-BTC'],
      regimes: ['RANGE'],
      variables: [{ name: 'minConfidence', baseline: 0.62, candidate }],
      criteria: [{ metric: 'sharpe', operator: 'GTE', threshold: 0.5 }],
      parentExperimentIds: [],
      evidenceIds: [],
    },
  },
});

const started = (id: string, sequence: number): ExperimentLedgerEvent => ({
  id: `event-${sequence}`,
  sequence,
  timestamp: 1_700_000_000_000 + sequence,
  type: 'EXPERIMENT_STARTED',
  experimentId: id,
  payload: { run: { id: `run-${id}`, experimentId: id, status: 'RUNNING' } },
});

test('trial lineage is missing when no configuration was actually tried', () => {
  const lineage = buildResearchTrialLineage({ strategyReturnPanel: null, experimentLedgerEvents: [] });
  assert.equal(lineage.available, false);
  assert.equal(lineage.trialCount, 0);
  assert.equal(lineage.integrity, 'MISSING');
});

test('observed Strategy Factory fingerprints become actual DSR trials', () => {
  const lineage = buildResearchTrialLineage({ strategyReturnPanel: strategyPanel(9), experimentLedgerEvents: [] });
  assert.equal(lineage.available, true);
  assert.equal(lineage.strategyFactoryTrials, 9);
  assert.equal(lineage.trialCount, 9);
  assert.equal(lineage.source, 'STRATEGY_FACTORY_OBSERVED');
  assert.equal(lineage.integrity, 'PASS');
});

test('planned-only experiments are not counted as tried configurations', () => {
  const lineage = buildResearchTrialLineage({ experimentLedgerEvents: [planned('exp-a', 1)] });
  assert.equal(lineage.available, false);
  assert.equal(lineage.experimentTrials, 0);
});

test('started experiments count and duplicate configurations deduplicate', () => {
  const events = [
    planned('exp-a', 1), started('exp-a', 2),
    planned('exp-b', 3), started('exp-b', 4),
  ];
  const lineage = buildResearchTrialLineage({ experimentLedgerEvents: events });
  assert.equal(lineage.available, true);
  assert.equal(lineage.experimentTrials, 1);
  assert.equal(lineage.trialCount, 1);
  assert.equal(lineage.integrity, 'PASS');
});

test('different experiment configurations remain distinct trials', () => {
  const events = [
    planned('exp-a', 1, 0.7), started('exp-a', 2),
    planned('exp-b', 3, 0.8), started('exp-b', 4),
  ];
  const lineage = buildResearchTrialLineage({ experimentLedgerEvents: events });
  assert.equal(lineage.experimentTrials, 2);
});

test('combined sources use conservative sum with explicit lower bound', () => {
  const events = [planned('exp-a', 1), started('exp-a', 2)];
  const lineage = buildResearchTrialLineage({ strategyReturnPanel: strategyPanel(9), experimentLedgerEvents: events });
  assert.equal(lineage.trialCount, 10);
  assert.equal(lineage.lowerBoundTrialCount, 9);
  assert.equal(lineage.source, 'COMBINED_CONSERVATIVE');
  assert.equal(lineage.integrity, 'CONSERVATIVE');
});

test('DSR fails closed when tried-configuration lineage is missing', () => {
  const returns = Array.from({ length: 120 }, (_, index) => 0.003 + ((index % 7) - 3) * 0.0015);
  const lineage = buildResearchTrialLineage({});
  const result = buildLineageAwareDeflatedSharpe(returns, lineage);
  assert.equal(result.available, false);
  assert.equal(result.verdict, 'INSUFFICIENT_DATA');
  assert.equal(result.trialCount, 0);
  assert.equal(result.probability, null);
  assert.ok(result.sharpePerObservation != null);
});
