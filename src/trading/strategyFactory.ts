import { factoryEligibleIndicators, INDICATOR_CATALOG, type IndicatorDefinition } from './indicatorCatalog';
import type { AssetClass } from './assets';

export type StrategyExperimentStatus = 'BLOCKED' | 'QUALIFYING' | 'CANDIDATE';

export interface StrategyGenome {
  id: string;
  generation: number;
  seed: number;
  assetClass: AssetClass;
  indicators: string[];
  /** Signed normalized weights. Negative oscillator/location weights represent mean-reversion interpretations. */
  indicatorWeights: Record<string, number>;
  entryThreshold: number;
  exitThreshold: number;
  maxHoldingBars: number;
  stopAtrMultiple: number;
  takeProfitR: number;
  correlationPenalty: number;
  executionAuthority: false;
  promotionAuthority: false;
}

export interface StrategyFactoryConfig {
  seed?: number;
  generation?: number;
  assetClass?: AssetClass;
  candidates?: number;
  minIndicators?: number;
  maxIndicators?: number;
}

export interface StrategyEvaluationMetrics {
  totalSamples: number;
  oosSamples: number;
  oosExpectancy: number;
  sharpe: number;
  sortino: number;
  maxDrawdownPct: number;
  monteCarloSurvivalRate: number;
  regimeStability: number;
  parameterRobustness: number;
}

export interface StrategyEvaluationScore {
  score: number;
  status: StrategyExperimentStatus;
  hardGatePassed: boolean;
  hardGateReasons: string[];
  dimensions: {
    oosExpectancy: number;
    sharpe: number;
    sortino: number;
    drawdown: number;
    monteCarlo: number;
    regimeStability: number;
    parameterRobustness: number;
    sampleSufficiency: number;
    correlationPenalty: number;
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const round = (value: number, digits = 4) => Number(value.toFixed(digits));

const mulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const pickWithoutReplacement = <T>(values: T[], count: number, random: () => number): T[] => {
  const pool = values.slice();
  const result: T[] = [];
  while (pool.length && result.length < count) {
    const index = Math.floor(random() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
};

const REVERSIBLE_INDICATORS = new Set(['RSI14', 'STOCH_RSI', 'BOLLINGER_PERCENT_B']);

const normalizeWeights = (items: IndicatorDefinition[], random: () => number) => {
  const raw = items.map((item) => {
    const magnitude = 0.35 + random() * 0.65;
    const polarity = REVERSIBLE_INDICATORS.has(item.id) && random() < 0.45 ? -1 : 1;
    return magnitude * polarity;
  });
  const sumAbs = raw.reduce((total, value) => total + Math.abs(value), 0);
  return Object.fromEntries(items.map((item, index) => [item.id, round(raw[index] / sumAbs, 6)]));
};

const calculateCorrelationPenalty = (selected: IndicatorDefinition[]) => {
  const ids = new Set(selected.map((item) => item.id));
  let correlatedPairs = 0;
  for (const item of selected) {
    correlatedPairs += item.correlatedWith.filter((other) => ids.has(other)).length;
  }
  correlatedPairs /= 2;
  return round(Math.min(0.35, correlatedPairs * 0.06), 4);
};

const stableGenomeId = (generation: number, seed: number, indicators: string[], ordinal: number) =>
  `SF-G${generation}-${seed.toString(36)}-${ordinal.toString().padStart(4, '0')}-${indicators.join('_')}`;

/**
 * Generates many reproducible strategy candidates. Randomness is seeded and is
 * used only for research/experimentation. It never changes Paper/live execution logic.
 */
export const generateStrategyFactoryCandidates = (config: StrategyFactoryConfig = {}): StrategyGenome[] => {
  const seed = Math.trunc(config.seed ?? 4420623);
  const generation = Math.max(1, Math.trunc(config.generation ?? 1));
  const assetClass = config.assetClass ?? 'CRYPTO_SPOT';
  const candidates = Math.max(1, Math.min(5_000, Math.trunc(config.candidates ?? 256)));
  const eligible = factoryEligibleIndicators();
  const minIndicators = Math.max(2, Math.min(eligible.length, Math.trunc(config.minIndicators ?? 3)));
  const maxIndicators = Math.max(minIndicators, Math.min(eligible.length, Math.trunc(config.maxIndicators ?? 6)));
  const random = mulberry32(seed);
  const unique = new Map<string, StrategyGenome>();

  let attempts = 0;
  while (unique.size < candidates && attempts < candidates * 40) {
    attempts += 1;
    const indicatorCount = minIndicators + Math.floor(random() * (maxIndicators - minIndicators + 1));
    const picked = pickWithoutReplacement(eligible, indicatorCount, random).sort((a, b) => a.id.localeCompare(b.id));
    if (new Set(picked.map((item) => item.family)).size < 2) continue;

    const signature = picked.map((item) => item.id).join('|');
    const entryThreshold = round(0.52 + random() * 0.2, 4);
    const exitThreshold = round(0.28 + random() * 0.18, 4);
    const stopAtrMultiple = round(1.1 + random() * 1.7, 3);
    const takeProfitR = round(1.4 + random() * 1.8, 3);
    const maxHoldingBars = 12 + Math.floor(random() * 85);
    const weights = normalizeWeights(picked, random);
    const variantSignature = `${signature}|${entryThreshold}|${exitThreshold}|${stopAtrMultiple}|${takeProfitR}|${maxHoldingBars}|${Object.values(weights).join(',')}`;
    if (unique.has(variantSignature)) continue;

    const ordinal = unique.size + 1;
    unique.set(variantSignature, {
      id: stableGenomeId(generation, seed, picked.map((item) => item.id), ordinal),
      generation,
      seed,
      assetClass,
      indicators: picked.map((item) => item.id),
      indicatorWeights: weights,
      entryThreshold,
      exitThreshold,
      maxHoldingBars,
      stopAtrMultiple,
      takeProfitR,
      correlationPenalty: calculateCorrelationPenalty(picked),
      executionAuthority: false,
      promotionAuthority: false,
    });
  }
  return [...unique.values()];
};

const dimensionScore = (metrics: StrategyEvaluationMetrics, correlationPenalty: number) => ({
  oosExpectancy: clamp01((metrics.oosExpectancy + 0.005) / 0.02),
  sharpe: clamp01((metrics.sharpe + 0.5) / 2.5),
  sortino: clamp01((metrics.sortino + 0.5) / 3),
  drawdown: clamp01(1 - metrics.maxDrawdownPct / 0.25),
  monteCarlo: clamp01(metrics.monteCarloSurvivalRate),
  regimeStability: clamp01(metrics.regimeStability),
  parameterRobustness: clamp01(metrics.parameterRobustness),
  sampleSufficiency: clamp01(Math.min(metrics.totalSamples, metrics.oosSamples * 2) / 120),
  correlationPenalty: clamp01(correlationPenalty),
});

/** Preliminary experiment score. Final Black Oracle credit grade is a separate mapping step. */
export const scoreStrategyExperiment = (
  genome: StrategyGenome,
  metrics: StrategyEvaluationMetrics,
): StrategyEvaluationScore => {
  const hardGateReasons: string[] = [];
  if (metrics.totalSamples < 30) hardGateReasons.push('Total sample is below 30 trades.');
  if (metrics.oosSamples < 15) hardGateReasons.push('OOS sample is below 15 trades.');
  if (metrics.oosExpectancy <= 0) hardGateReasons.push('OOS expectancy is not positive.');
  if (metrics.maxDrawdownPct > 0.25) hardGateReasons.push('Maximum drawdown exceeds 25%.');
  if (metrics.monteCarloSurvivalRate < 0.6) hardGateReasons.push('Monte Carlo survival is below 60%.');

  const dimensions = dimensionScore(metrics, genome.correlationPenalty);
  const raw = (
    dimensions.oosExpectancy * 20
    + dimensions.sharpe * 15
    + dimensions.sortino * 10
    + dimensions.drawdown * 15
    + dimensions.monteCarlo * 15
    + dimensions.regimeStability * 10
    + dimensions.parameterRobustness * 10
    + dimensions.sampleSufficiency * 5
  ) - dimensions.correlationPenalty * 10;
  const score = round(Math.max(0, Math.min(100, raw)), 2);
  const hardGatePassed = hardGateReasons.length === 0;
  const status: StrategyExperimentStatus = !hardGatePassed ? 'BLOCKED' : score >= 75 ? 'CANDIDATE' : 'QUALIFYING';

  return {
    score,
    status,
    hardGatePassed,
    hardGateReasons,
    dimensions: {
      oosExpectancy: round(dimensions.oosExpectancy * 100, 2),
      sharpe: round(dimensions.sharpe * 100, 2),
      sortino: round(dimensions.sortino * 100, 2),
      drawdown: round(dimensions.drawdown * 100, 2),
      monteCarlo: round(dimensions.monteCarlo * 100, 2),
      regimeStability: round(dimensions.regimeStability * 100, 2),
      parameterRobustness: round(dimensions.parameterRobustness * 100, 2),
      sampleSufficiency: round(dimensions.sampleSufficiency * 100, 2),
      correlationPenalty: round(dimensions.correlationPenalty * 100, 2),
    },
  };
};

export const strategyFactoryIndicatorCatalog = () => INDICATOR_CATALOG.map((item) => ({ ...item, correlatedWith: item.correlatedWith.slice() }));
