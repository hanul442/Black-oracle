import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintStrategyGenome, normalizeStrategyGenome, type StrategyGenome } from './strategyGenome';

const baseGenome = (overrides: Partial<StrategyGenome> = {}): StrategyGenome => ({
  id: 'genome-1',
  generation: 0,
  createdAt: 1,
  parentGenomeIds: [],
  strategyVersion: 'strategy-v1',
  modelVersion: null,
  markets: ['krw-btc', 'KRW-ETH'],
  regimes: ['range', 'UPTREND'],
  timeframesMinutes: [60, 15, 60, 240],
  weights: {
    eventNews: 2,
    trendMomentum: 5,
    meanReversion: 3,
  },
  thresholds: {
    entryScore: 70,
    exitScore: 45,
    minConfidence: 0.62,
  },
  risk: {
    maxPositionPct: 0.02,
    maxDailyLossPct: 0.01,
    maxTotalDrawdownPct: 0.05,
  },
  mutations: [],
  executionAuthority: false,
  ...overrides,
});

test('normalizes scopes and strategy weights deterministically', () => {
  const genome = normalizeStrategyGenome(baseGenome());

  assert.deepEqual(genome.markets, ['KRW-BTC', 'KRW-ETH']);
  assert.deepEqual(genome.regimes, ['RANGE', 'UPTREND']);
  assert.deepEqual(genome.timeframesMinutes, [15, 60, 240]);
  assert.equal(genome.weights.eventNews, 0.2);
  assert.equal(genome.weights.trendMomentum, 0.5);
  assert.equal(genome.weights.meanReversion, 0.3);
  assert.equal(genome.executionAuthority, false);
});

test('genome cannot exceed hard Black Oracle risk limits', () => {
  assert.throws(() => normalizeStrategyGenome(baseGenome({
    risk: {
      maxPositionPct: 0.021,
      maxDailyLossPct: 0.01,
      maxTotalDrawdownPct: 0.05,
    },
  })), /maxPositionPct/);

  assert.throws(() => normalizeStrategyGenome(baseGenome({
    risk: {
      maxPositionPct: 0.02,
      maxDailyLossPct: 0.011,
      maxTotalDrawdownPct: 0.05,
    },
  })), /maxDailyLossPct/);

  assert.throws(() => normalizeStrategyGenome(baseGenome({
    risk: {
      maxPositionPct: 0.02,
      maxDailyLossPct: 0.01,
      maxTotalDrawdownPct: 0.051,
    },
  })), /maxTotalDrawdownPct/);
});

test('fingerprint represents strategy phenotype rather than metadata identity', () => {
  const first = fingerprintStrategyGenome(baseGenome());
  const samePhenotype = fingerprintStrategyGenome(baseGenome({
    id: 'genome-copy',
    generation: 5,
    createdAt: 999,
    parentGenomeIds: ['ancestor'],
    mutations: [{ type: 'CROSSOVER', field: 'weights', from: null, to: 'same phenotype' }],
  }));

  assert.equal(first, samePhenotype);

  const changed = fingerprintStrategyGenome(baseGenome({
    weights: {
      eventNews: 1,
      trendMomentum: 7,
      meanReversion: 2,
    },
  }));
  assert.notEqual(first, changed);
});
