import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_RISK_LIMITS, TRADING_STRATEGY_VERSION } from './config.ts';
import { bindExperimentSpecToStrategyGenome, buildResearchConfigurationIdFromGenome } from './researchConfiguration.ts';
import type { ExperimentSpec } from './experiment.ts';
import type { StrategyGenome } from './strategyGenome.ts';

const genome = (entryScore = 62, id = 'genome-a'): StrategyGenome => ({
  id,
  generation: 1,
  createdAt: 1_700_000_000_000,
  parentGenomeIds: ['parent'],
  strategyVersion: TRADING_STRATEGY_VERSION,
  modelVersion: null,
  markets: ['KRW-SPOT-UNIVERSE'],
  regimes: ['RANGE', 'UPTREND'],
  timeframesMinutes: [15, 60, 240],
  weights: { eventNews: 0.15, trendMomentum: 0.70, meanReversion: 0.15 },
  thresholds: { entryScore, exitScore: 45, minConfidence: 0.62 },
  risk: {
    maxPositionPct: DEFAULT_RISK_LIMITS.maxPositionPct,
    maxDailyLossPct: DEFAULT_RISK_LIMITS.maxDailyLossPct,
    maxTotalDrawdownPct: DEFAULT_RISK_LIMITS.maxTotalDrawdownPct,
  },
  mutations: [],
  executionAuthority: false,
});

const experiment = (): ExperimentSpec => ({
  id: 'exp-a',
  createdAt: 1_700_000_000_100,
  hypothesis: 'candidate improves robustness',
  strategyVersion: TRADING_STRATEGY_VERSION,
  modelVersion: null,
  markets: ['KRW-BTC'],
  regimes: ['RANGE'],
  variables: [{ name: 'minConfidence', baseline: 0.62, candidate: 0.66 }],
  criteria: [{ metric: 'sharpe', operator: 'GTE', threshold: 0.5 }],
  parentExperimentIds: [],
  evidenceIds: [],
});

test('research configuration id ignores lineage metadata but changes when strategy configuration changes', () => {
  const first = buildResearchConfigurationIdFromGenome(genome(62, 'genome-a'));
  const sameConfiguration = buildResearchConfigurationIdFromGenome({ ...genome(62, 'genome-b'), generation: 9, createdAt: 1_800_000_000_000, parentGenomeIds: ['other'] });
  const changedConfiguration = buildResearchConfigurationIdFromGenome(genome(68, 'genome-c'));
  assert.equal(first, sameConfiguration);
  assert.notEqual(first, changedConfiguration);
  assert.match(first, /^rcfg-v1-[0-9a-f]{16}$/);
});

test('binding an experiment to a Strategy Genome carries the exact canonical configuration id', () => {
  const candidate = genome();
  const bound = bindExperimentSpecToStrategyGenome(experiment(), candidate);
  assert.equal(bound.researchConfigurationId, buildResearchConfigurationIdFromGenome(candidate));
  assert.deepEqual(bound.markets, ['KRW-BTC']);
  assert.deepEqual(bound.regimes, ['RANGE']);
});

test('binding refuses strategy/model version mismatches instead of inventing cross-source identity', () => {
  assert.throws(() => bindExperimentSpecToStrategyGenome({ ...experiment(), strategyVersion: 'other' }, genome()), /strategyVersion/);
  assert.throws(() => bindExperimentSpecToStrategyGenome({ ...experiment(), modelVersion: 'model-b' }, genome()), /modelVersion/);
});
