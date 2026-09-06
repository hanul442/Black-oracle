import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_RISK_LIMITS, TRADING_STRATEGY_VERSION } from '../../src/trading/config.ts';
import type { ExperimentSpec } from '../../src/trading/experiment.ts';
import { buildResearchConfigurationIdFromGenome } from '../../src/trading/researchConfiguration.ts';
import type { StrategyGenome } from '../../src/trading/strategyGenome.ts';
import type { QualificationWindowCheckpoint } from '../../src/trading/qualificationWindow.ts';
import { runtimeExperimentLedgerStore } from './experimentLedgerStore.ts';

const START = Date.UTC(2026, 8, 6, 4, 0, 0);
const genome: StrategyGenome = {
  id: 'runtime-genome-a',
  generation: 1,
  createdAt: START,
  parentGenomeIds: [],
  strategyVersion: TRADING_STRATEGY_VERSION,
  modelVersion: null,
  markets: ['KRW-SPOT-UNIVERSE'],
  regimes: ['RANGE'],
  timeframesMinutes: [15, 60, 240],
  weights: { eventNews: 0.15, trendMomentum: 0.70, meanReversion: 0.15 },
  thresholds: { entryScore: 62, exitScore: 45, minConfidence: 0.62 },
  risk: {
    maxPositionPct: DEFAULT_RISK_LIMITS.maxPositionPct,
    maxDailyLossPct: DEFAULT_RISK_LIMITS.maxDailyLossPct,
    maxTotalDrawdownPct: DEFAULT_RISK_LIMITS.maxTotalDrawdownPct,
  },
  mutations: [],
  executionAuthority: false,
};

const spec: ExperimentSpec = {
  id: 'runtime-qualified-exp',
  createdAt: START + 60_000,
  hypothesis: 'qualified Strategy Genome improves robustness',
  strategyVersion: TRADING_STRATEGY_VERSION,
  modelVersion: null,
  markets: ['KRW-BTC'],
  regimes: ['RANGE'],
  variables: [{ name: 'minConfidence', baseline: 0.62, candidate: 0.66 }],
  criteria: [{ metric: 'expectancy', operator: 'GTE', threshold: 0 }],
  parentExperimentIds: [],
  evidenceIds: [],
};

const collectingWindow: QualificationWindowCheckpoint = {
  schemaVersion: 1,
  id: 'paper-qualification-2026-09',
  armedAt: START - 60_000,
  startedAt: START,
  sourceRevision: 'revision-a',
  startCycleStartedAt: START,
  startCycleFinishedAt: START + 10_000,
  startEvidenceIds: ['ev-start'],
  status: 'COLLECTING',
  invalidationReasons: [],
  executionAuthority: false,
  promotionAuthority: false,
};

test('runtime qualified Strategy Genome planning binds both rcfg and qualification identity', () => {
  runtimeExperimentLedgerStore.restore([]);
  const event = runtimeExperimentLedgerStore.planForQualifiedStrategyGenome(spec, genome, collectingWindow, START + 60_000);
  const planned = event.payload.spec as ExperimentSpec;
  assert.equal(planned.researchConfigurationId, buildResearchConfigurationIdFromGenome(genome));
  assert.deepEqual(planned.qualification, {
    windowId: collectingWindow.id,
    sourceRevision: collectingWindow.sourceRevision,
    windowStartedAt: START,
  });
});

test('runtime refuses qualification experiment planning before window becomes COLLECTING', () => {
  runtimeExperimentLedgerStore.restore([]);
  assert.throws(
    () => runtimeExperimentLedgerStore.planForQualifiedStrategyGenome(spec, genome, { ...collectingWindow, status: 'ARMED', startedAt: null }, START + 60_000),
    /active COLLECTING qualification window/,
  );
});
