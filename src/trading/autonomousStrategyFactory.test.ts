import test from 'node:test';
import assert from 'node:assert/strict';
import { runAutonomousStrategyFactoryResearch } from './autonomousStrategyFactory';
import { clearStrategyFactoryGuidedSeeds, setStrategyFactoryGuidedSeeds } from './strategyFactory';
import type { Candle } from './types';

const syntheticCandles = (count = 900, blindShock = 0): Candle[] => {
  const rows: Candle[] = [];
  let previous = 100;
  const blindStart = Math.floor(count * 0.8);
  for (let index = 0; index < count; index += 1) {
    const baseDrift = 0.0007;
    const cycle = Math.sin(index / 17) * 0.0045 + Math.sin(index / 43) * 0.0025;
    const shock = index >= blindStart ? blindShock * Math.sin(index / 3) : 0;
    const close = Math.max(5, previous * (1 + baseDrift + cycle + shock));
    const open = previous;
    const spread = 0.006 + Math.abs(Math.sin(index / 11)) * 0.003;
    const high = Math.max(open, close) * (1 + spread);
    const low = Math.min(open, close) * (1 - spread);
    const volume = 1_000 + (index % 37) * 31 + Math.round(Math.abs(Math.sin(index / 9)) * 700);
    rows.push({
      market: 'KRW-TEST',
      timeframeMinutes: 60,
      timestamp: 1_700_000_000_000 + index * 60 * 60_000,
      open,
      high,
      low,
      close,
      volume,
      quoteVolume: close * volume,
    });
    previous = close;
  }
  return rows;
};

const config = {
  seed: 44_206_230,
  generations: 2,
  candidatesPerGeneration: 8,
  parentPoolSize: 4,
  blindFraction: 0.20,
  walkForwardFolds: 3,
  warmupBars: 220,
  baseCostPerSideBps: 13,
} as const;

test('Autonomous Strategy Factory is deterministic for identical historical input and seed', () => {
  clearStrategyFactoryGuidedSeeds();
  const candles = syntheticCandles();
  const first = runAutonomousStrategyFactoryResearch(candles, config);
  const second = runAutonomousStrategyFactoryResearch(candles, config);

  assert.deepEqual(first.generationGenomeIds, second.generationGenomeIds);
  assert.deepEqual(
    first.experiments.map((item) => [item.candidate.genome.id, item.evaluation.score, item.evaluation.lifecycle]),
    second.experiments.map((item) => [item.candidate.genome.id, item.evaluation.score, item.evaluation.lifecycle]),
  );
  assert.equal(first.candidateCount, 16);
});

test('AI-guided factor combinations are injected into generation one without gaining authority', () => {
  setStrategyFactoryGuidedSeeds([
    {
      indicators: ['EMA_STACK', 'RSI14', 'BOLLINGER_PERCENT_B'],
      reversionIndicators: ['RSI14', 'BOLLINGER_PERCENT_B'],
    },
  ]);
  try {
    const result = runAutonomousStrategyFactoryResearch(syntheticCandles(), { ...config, generations: 1 });
    const guided = result.experiments.filter((item) =>
      item.candidate.genome.indicators.join('|') === ['BOLLINGER_PERCENT_B', 'EMA_STACK', 'RSI14'].join('|'),
    );
    assert.ok(guided.length >= 1);
    assert.ok((guided[0].candidate.genome.indicatorWeights.RSI14 ?? 0) < 0);
    assert.ok((guided[0].candidate.genome.indicatorWeights.BOLLINGER_PERCENT_B ?? 0) < 0);
    assert.equal(guided[0].candidate.genome.executionAuthority, false);
    assert.equal(guided[0].candidate.genome.promotionAuthority, false);
  } finally {
    clearStrategyFactoryGuidedSeeds();
  }
});

test('Locked Blind data cannot influence generation or parent-selection decisions', () => {
  clearStrategyFactoryGuidedSeeds();
  const calmBlind = syntheticCandles(900, 0);
  const hostileBlind = syntheticCandles(900, -0.018);

  assert.deepEqual(calmBlind.slice(0, 720), hostileBlind.slice(0, 720));

  const first = runAutonomousStrategyFactoryResearch(calmBlind, config);
  const second = runAutonomousStrategyFactoryResearch(hostileBlind, config);

  assert.equal(first.blindStartIndex, 720);
  assert.equal(second.blindStartIndex, 720);
  assert.deepEqual(first.generationGenomeIds, second.generationGenomeIds);

  const firstBlind = first.experiments.map((item) => item.validation.blind.expectancy);
  const secondBlind = second.experiments.map((item) => item.validation.blind.expectancy);
  assert.notDeepEqual(firstBlind, secondBlind);
});

test('Every autonomous candidate remains research-only and human-gated', () => {
  clearStrategyFactoryGuidedSeeds();
  const result = runAutonomousStrategyFactoryResearch(syntheticCandles(), config);
  const allowed = new Set(['REJECT', 'INCUBATOR', 'CHALLENGER', 'CHAMPION_CANDIDATE']);

  assert.equal(result.executionAuthority, false);
  assert.equal(result.promotionAuthority, false);
  assert.equal(result.championPromotionRequiresHumanApproval, true);
  assert.equal(result.liveDeploymentRequiresHumanApproval, true);
  assert.ok(result.experiments.length > 0);

  for (const item of result.experiments) {
    assert.ok(allowed.has(item.evaluation.lifecycle));
    assert.equal(item.candidate.genome.executionAuthority, false);
    assert.equal(item.candidate.genome.promotionAuthority, false);
    assert.equal(item.evaluation.executionAuthority, false);
    assert.equal(item.evaluation.promotionAuthority, false);
    assert.equal(item.evaluation.requiresHumanApproval, true);
    assert.equal(item.evaluation.humanReviewStatus, 'NOT_REQUESTED');
  }
});

test('Cost, walk-forward and regime stress evidence is retained for every candidate', () => {
  clearStrategyFactoryGuidedSeeds();
  const result = runAutonomousStrategyFactoryResearch(syntheticCandles(), config);
  const sample = result.experiments[0];
  assert.ok(sample);
  assert.equal(sample.validation.costStress.scenarios.length, 3);
  assert.equal(sample.validation.walkForward.folds.length, 3);
  assert.equal(sample.validation.regimeStress.rows.length, 5);
  assert.ok(Number.isFinite(sample.validation.monteCarloSurvivalRate));
  assert.ok(Number.isFinite(sample.validation.parameterRobustness));
  assert.ok(sample.candidate.hypothesis.thesis.length > 20);
});
