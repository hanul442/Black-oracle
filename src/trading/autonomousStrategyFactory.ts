import { factoryEligibleIndicators, INDICATOR_CATALOG } from './indicatorCatalog';
import { generateStrategyFactoryCandidates, type StrategyGenome } from './strategyFactory';
import {
  backtestStrategyGenome,
  buildStrategyFactoryFeatureFrames,
  type StrategyFactoryBacktestResult,
  type StrategyFactoryTrade,
} from './strategyFactoryBacktest';
import type { Candle, MarketRegime } from './types';

export type StrategyLifecycle = 'REJECT' | 'INCUBATOR' | 'CHALLENGER' | 'CHAMPION_CANDIDATE';
export type StrategyHypothesisOrigin = 'SEED_GRAMMAR' | 'MUTATION';

export interface StrategyFactorHypothesis {
  indicator: string;
  family: string;
  interpretation: 'CONTINUATION' | 'REVERSION';
  weight: number;
  rationale: string;
}

export interface StrategyHypothesis {
  id: string;
  generation: number;
  origin: StrategyHypothesisOrigin;
  parentIds: string[];
  thesis: string;
  factors: StrategyFactorHypothesis[];
}

export interface AutonomousStrategyCandidate {
  genome: StrategyGenome;
  hypothesis: StrategyHypothesis;
}

export interface StrategyTradeSummary {
  samples: number;
  expectancy: number;
  sharpe: number;
  sortino: number;
  maxDrawdownPct: number;
  winRate: number;
}

export interface WalkForwardFold {
  fold: number;
  startIndex: number;
  endIndexExclusive: number;
  summary: StrategyTradeSummary;
  eligible: boolean;
}

export interface WalkForwardSummary {
  folds: WalkForwardFold[];
  eligibleFolds: number;
  positiveFoldRate: number;
  worstExpectancy: number;
}

export interface CostStressScenario {
  name: 'BASE' | 'HIGH_COST' | 'EXTREME_COST';
  costPerSideBps: number;
  summary: StrategyTradeSummary;
  survived: boolean;
}

export interface CostStressSummary {
  scenarios: CostStressScenario[];
  survivalRate: number;
  worstExpectancy: number;
}

export interface RegimeStressRow {
  regime: MarketRegime;
  summary: StrategyTradeSummary;
  eligible: boolean;
}

export interface RegimeStressSummary {
  rows: RegimeStressRow[];
  eligibleRegimes: number;
  positiveRegimeRate: number;
  worstExpectancy: number;
}

export interface AutonomousDevelopmentValidation {
  backtest: StrategyFactoryBacktestResult;
  walkForward: WalkForwardSummary;
  costStress: CostStressSummary;
  regimeStress: RegimeStressSummary;
  selectionScore: number;
}

export interface AutonomousFinalValidation {
  development: {
    totalSamples: number;
    oosSamples: number;
    oosExpectancy: number;
    sharpe: number;
    sortino: number;
    maxDrawdownPct: number;
  };
  blind: StrategyTradeSummary;
  walkForward: WalkForwardSummary;
  costStress: CostStressSummary;
  regimeStress: RegimeStressSummary;
  monteCarloSurvivalRate: number;
  parameterRobustness: number;
  blindStartIndex: number;
  developmentBars: number;
  blindBars: number;
}

export interface AutonomousStrategyEvaluation {
  score: number;
  lifecycle: StrategyLifecycle;
  hardGatePassed: boolean;
  hardGateReasons: string[];
  fatalReasons: string[];
  dimensions: {
    blindQuality: number;
    developmentOos: number;
    walkForward: number;
    monteCarlo: number;
    drawdown: number;
    costStress: number;
    regimeStress: number;
    parameterRobustness: number;
    sampleSufficiency: number;
  };
  requiresHumanApproval: true;
  humanReviewStatus: 'NOT_REQUESTED';
  executionAuthority: false;
  promotionAuthority: false;
}

export interface AutonomousStrategyExperiment {
  experimentId: string;
  candidate: AutonomousStrategyCandidate;
  validation: AutonomousFinalValidation;
  evaluation: AutonomousStrategyEvaluation;
}

export interface AutonomousFactoryConfig {
  seed?: number;
  generations?: number;
  candidatesPerGeneration?: number;
  parentPoolSize?: number;
  blindFraction?: number;
  walkForwardFolds?: number;
  warmupBars?: number;
  baseCostPerSideBps?: number;
}

export interface AutonomousFactoryResearchResult {
  version: 'BO-SF-AUTO-v1';
  seed: number;
  generations: number;
  candidatesPerGeneration: number;
  candidateCount: number;
  blindFraction: number;
  blindStartIndex: number;
  developmentBars: number;
  blindBars: number;
  generationGenomeIds: string[][];
  lifecycleCounts: Record<StrategyLifecycle, number>;
  experiments: AutonomousStrategyExperiment[];
  executionAuthority: false;
  promotionAuthority: false;
  championPromotionRequiresHumanApproval: true;
  liveDeploymentRequiresHumanApproval: true;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
const clamp01 = (value: number) => clamp(value, 0, 1);
const round = (value: number, digits = 6) => Number(value.toFixed(digits));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const stddev = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
};

const sharpe = (returns: number[]) => {
  const sd = stddev(returns);
  return returns.length >= 2 && sd > Number.EPSILON ? average(returns) / sd * Math.sqrt(returns.length) : 0;
};

const sortino = (returns: number[]) => {
  if (returns.length < 2) return 0;
  const downside = returns.filter((value) => value < 0);
  const downsideDeviation = Math.sqrt(average(downside.map((value) => value ** 2)));
  if (downsideDeviation <= Number.EPSILON) return average(returns) > 0 ? 3 : 0;
  return average(returns) / downsideDeviation * Math.sqrt(returns.length);
};

const maxDrawdown = (returns: number[]) => {
  let equity = 1;
  let peak = 1;
  let worst = 0;
  for (const value of returns) {
    equity *= 1 + clamp(value, -0.999, 10);
    peak = Math.max(peak, equity);
    worst = Math.max(worst, peak > 0 ? (peak - equity) / peak : 0);
  }
  return worst;
};

export const summarizeStrategyTrades = (trades: StrategyFactoryTrade[]): StrategyTradeSummary => {
  const returns = trades.map((trade) => trade.returnPct);
  return {
    samples: returns.length,
    expectancy: average(returns),
    sharpe: sharpe(returns),
    sortino: sortino(returns),
    maxDrawdownPct: maxDrawdown(returns),
    winRate: returns.length ? returns.filter((value) => value > 0).length / returns.length : 0,
  };
};

const indicatorById = new Map(INDICATOR_CATALOG.map((item) => [item.id, item]));
const reversible = new Set(['RSI14', 'STOCH_RSI', 'BOLLINGER_PERCENT_B']);

export const buildStrategyHypothesis = (
  genome: StrategyGenome,
  origin: StrategyHypothesisOrigin,
  parentIds: string[] = [],
): StrategyHypothesis => {
  const factors = genome.indicators
    .map((indicator) => {
      const weight = genome.indicatorWeights[indicator] ?? 0;
      const definition = indicatorById.get(indicator);
      const interpretation = weight < 0 && reversible.has(indicator) ? 'REVERSION' as const : 'CONTINUATION' as const;
      return {
        indicator,
        family: definition?.family ?? 'UNKNOWN',
        interpretation,
        weight,
        rationale: `${indicator} is tested as ${interpretation.toLowerCase()} evidence with signed weight ${weight.toFixed(3)}.`,
      };
    })
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const lead = factors.slice(0, 3).map((factor) => `${factor.indicator}:${factor.interpretation}`).join(' + ');
  return {
    id: `HYP-${genome.id}`,
    generation: genome.generation,
    origin,
    parentIds: parentIds.slice(),
    thesis: `${lead || 'multi-factor'} with ATR-defined risk and explicit next-bar execution should retain positive expectancy outside the generation sample.`,
    factors,
  };
};

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

const correlationPenalty = (indicatorIds: string[]) => {
  const ids = new Set(indicatorIds);
  let pairs = 0;
  for (const id of ids) {
    const definition = indicatorById.get(id);
    if (!definition) continue;
    pairs += definition.correlatedWith.filter((other) => ids.has(other)).length;
  }
  return round(Math.min(0.35, pairs / 2 * 0.06), 4);
};

const normalizeWeights = (weights: Record<string, number>, indicators: string[]) => {
  const sum = indicators.reduce((total, id) => total + Math.abs(weights[id] ?? 0), 0) || 1;
  return Object.fromEntries(indicators.map((id) => [id, round((weights[id] ?? 0) / sum, 6)]));
};

export const evolveStrategyFactoryGeneration = (
  parents: AutonomousStrategyCandidate[],
  config: { seed: number; generation: number; candidates: number; minIndicators?: number; maxIndicators?: number },
): AutonomousStrategyCandidate[] => {
  if (!parents.length) return [];
  const eligible = factoryEligibleIndicators();
  const eligibleById = new Map(eligible.map((item) => [item.id, item]));
  const minIndicators = Math.max(2, Math.min(eligible.length, Math.trunc(config.minIndicators ?? 3)));
  const maxIndicators = Math.max(minIndicators, Math.min(eligible.length, Math.trunc(config.maxIndicators ?? 6)));
  const random = mulberry32(config.seed + config.generation * 104_729);
  const candidates = Math.max(1, Math.min(5_000, Math.trunc(config.candidates)));
  const unique = new Map<string, AutonomousStrategyCandidate>();
  let attempts = 0;

  while (unique.size < candidates && attempts < candidates * 60) {
    attempts += 1;
    const parent = parents[Math.floor(random() * parents.length)] ?? parents[0];
    let indicators = parent.genome.indicators.filter((id) => eligibleById.has(id));
    const weights: Record<string, number> = { ...parent.genome.indicatorWeights };

    const mutation = Math.floor(random() * 5);
    if (mutation === 0 && indicators.length < maxIndicators) {
      const pool = eligible.map((item) => item.id).filter((id) => !indicators.includes(id));
      if (pool.length) {
        const added = pool[Math.floor(random() * pool.length)];
        indicators = [...indicators, added];
        weights[added] = 0.25 + random() * 0.5;
      }
    } else if (mutation === 1 && indicators.length > minIndicators) {
      const dropped = indicators[Math.floor(random() * indicators.length)];
      indicators = indicators.filter((id) => id !== dropped);
      delete weights[dropped];
    } else if (mutation === 2) {
      const flipPool = indicators.filter((id) => reversible.has(id));
      if (flipPool.length) {
        const flipped = flipPool[Math.floor(random() * flipPool.length)];
        weights[flipped] = -(weights[flipped] ?? 0.2);
      }
    }

    indicators = [...new Set(indicators)].sort();
    const families = new Set(indicators.map((id) => eligibleById.get(id)?.family));
    if (families.size < 2) continue;
    for (const id of indicators) {
      const base = weights[id] ?? 1 / indicators.length;
      const jitter = 0.82 + random() * 0.36;
      weights[id] = base * jitter;
    }
    const normalized = normalizeWeights(weights, indicators);
    const ordinal = unique.size + 1;
    const genome: StrategyGenome = {
      ...parent.genome,
      id: `SF-G${config.generation}-${config.seed.toString(36)}-${ordinal.toString().padStart(4, '0')}-${indicators.join('_')}`,
      generation: config.generation,
      seed: config.seed,
      indicators,
      indicatorWeights: normalized,
      entryThreshold: round(clamp(parent.genome.entryThreshold + (random() - 0.5) * 0.10, 0.42, 0.82), 4),
      exitThreshold: round(clamp(parent.genome.exitThreshold + (random() - 0.5) * 0.08, 0.18, 0.58), 4),
      maxHoldingBars: Math.round(clamp(parent.genome.maxHoldingBars + (random() - 0.5) * 30, 8, 120)),
      stopAtrMultiple: round(clamp(parent.genome.stopAtrMultiple + (random() - 0.5) * 0.60, 0.8, 3.4), 3),
      takeProfitR: round(clamp(parent.genome.takeProfitR + (random() - 0.5) * 0.90, 1.1, 4.5), 3),
      correlationPenalty: correlationPenalty(indicators),
      executionAuthority: false,
      promotionAuthority: false,
    };
    const signature = JSON.stringify({
      indicators: genome.indicators,
      weights: genome.indicatorWeights,
      entry: genome.entryThreshold,
      exit: genome.exitThreshold,
      hold: genome.maxHoldingBars,
      stop: genome.stopAtrMultiple,
      tp: genome.takeProfitR,
    });
    if (unique.has(signature)) continue;
    unique.set(signature, {
      genome,
      hypothesis: buildStrategyHypothesis(genome, 'MUTATION', [parent.genome.id]),
    });
  }
  return [...unique.values()];
};

const buildWalkForwardSummary = (
  trades: StrategyFactoryTrade[],
  candleCount: number,
  warmupBars: number,
  folds: number,
): WalkForwardSummary => {
  const safeFolds = Math.max(2, Math.min(8, Math.trunc(folds)));
  const available = Math.max(1, candleCount - warmupBars);
  const rows: WalkForwardFold[] = [];
  for (let fold = 0; fold < safeFolds; fold += 1) {
    const startIndex = warmupBars + Math.floor(available * (fold + 1) / (safeFolds + 1));
    const endIndexExclusive = fold === safeFolds - 1
      ? candleCount
      : warmupBars + Math.floor(available * (fold + 2) / (safeFolds + 1));
    const selected = trades.filter((trade) => trade.entryIndex >= startIndex && trade.entryIndex < endIndexExclusive);
    const summary = summarizeStrategyTrades(selected);
    rows.push({ fold: fold + 1, startIndex, endIndexExclusive, summary, eligible: summary.samples >= 3 });
  }
  const eligible = rows.filter((row) => row.eligible);
  return {
    folds: rows,
    eligibleFolds: eligible.length,
    positiveFoldRate: eligible.length ? eligible.filter((row) => row.summary.expectancy > 0).length / eligible.length : 0,
    worstExpectancy: eligible.length ? Math.min(...eligible.map((row) => row.summary.expectancy)) : 0,
  };
};

const buildCostStress = (
  trades: StrategyFactoryTrade[],
  baseCostPerSideBps: number,
): CostStressSummary => {
  const costs = [baseCostPerSideBps, Math.max(baseCostPerSideBps + 12, 25), Math.max(baseCostPerSideBps + 27, 40)];
  const names: CostStressScenario['name'][] = ['BASE', 'HIGH_COST', 'EXTREME_COST'];
  const scenarios = costs.map((costPerSideBps, index) => {
    const extraRoundTrip = Math.max(0, costPerSideBps - baseCostPerSideBps) * 2 / 10_000;
    const stressed = trades.map((trade) => ({ ...trade, returnPct: trade.returnPct - extraRoundTrip }));
    const summary = summarizeStrategyTrades(stressed);
    return {
      name: names[index],
      costPerSideBps,
      summary,
      survived: summary.samples >= 5 && summary.expectancy > 0 && summary.maxDrawdownPct <= 0.30,
    };
  });
  return {
    scenarios,
    survivalRate: scenarios.filter((scenario) => scenario.survived).length / scenarios.length,
    worstExpectancy: Math.min(...scenarios.map((scenario) => scenario.summary.expectancy)),
  };
};

const buildRegimeStress = (trades: StrategyFactoryTrade[]): RegimeStressSummary => {
  const regimes: MarketRegime[] = ['STRONG_UPTREND', 'UPTREND', 'RANGE', 'DOWNTREND', 'STRONG_DOWNTREND'];
  const rows = regimes.map((regime) => {
    const summary = summarizeStrategyTrades(trades.filter((trade) => trade.entryRegime === regime));
    return { regime, summary, eligible: summary.samples >= 3 };
  });
  const eligible = rows.filter((row) => row.eligible);
  return {
    rows,
    eligibleRegimes: eligible.length,
    positiveRegimeRate: eligible.length ? eligible.filter((row) => row.summary.expectancy > 0).length / eligible.length : 0,
    worstExpectancy: eligible.length ? Math.min(...eligible.map((row) => row.summary.expectancy)) : 0,
  };
};

const developmentSelectionScore = (
  backtest: StrategyFactoryBacktestResult,
  walkForward: WalkForwardSummary,
  costStress: CostStressSummary,
  regimeStress: RegimeStressSummary,
) => round(clamp(
  backtest.evaluation.score * 0.55
  + walkForward.positiveFoldRate * 18
  + costStress.survivalRate * 12
  + regimeStress.positiveRegimeRate * 8
  + backtest.metrics.parameterRobustness * 7,
  0,
  100,
), 2);

const evaluateDevelopment = (
  candidate: AutonomousStrategyCandidate,
  developmentCandles: Candle[],
  prebuiltFrames: ReturnType<typeof buildStrategyFactoryFeatureFrames>,
  config: Required<Pick<AutonomousFactoryConfig, 'walkForwardFolds' | 'warmupBars' | 'baseCostPerSideBps'>>,
): AutonomousDevelopmentValidation => {
  const backtest = backtestStrategyGenome(candidate.genome, developmentCandles, {
    warmupBars: config.warmupBars,
    oosFraction: 0.30,
    costPerSideBps: config.baseCostPerSideBps,
    maxWindowBars: 320,
  }, prebuiltFrames);
  const oosTrades = backtest.trades.filter((trade) => trade.oos);
  const walkForward = buildWalkForwardSummary(backtest.trades, developmentCandles.length, config.warmupBars, config.walkForwardFolds);
  const costStress = buildCostStress(oosTrades, config.baseCostPerSideBps);
  const regimeStress = buildRegimeStress(oosTrades.length ? oosTrades : backtest.trades);
  return {
    backtest,
    walkForward,
    costStress,
    regimeStress,
    selectionScore: developmentSelectionScore(backtest, walkForward, costStress, regimeStress),
  };
};

const scoreFinalEvaluation = (validation: AutonomousFinalValidation): AutonomousStrategyEvaluation => {
  const fatalReasons: string[] = [];
  const hardGateReasons: string[] = [];
  const maxObservedDrawdown = Math.max(validation.development.maxDrawdownPct, validation.blind.maxDrawdownPct);

  if (validation.development.oosExpectancy <= 0) fatalReasons.push('Development OOS expectancy is not positive.');
  if (validation.blind.samples >= 5 && validation.blind.expectancy <= 0) fatalReasons.push('Locked Blind expectancy is not positive.');
  if (maxObservedDrawdown > 0.25) fatalReasons.push('Observed maximum drawdown exceeds 25%.');
  if (validation.monteCarloSurvivalRate < 0.60) fatalReasons.push('Monte Carlo survival is below 60%.');
  if (validation.costStress.survivalRate < 1 / 3) fatalReasons.push('Strategy fails most cost/slippage stress scenarios.');
  if (validation.walkForward.eligibleFolds >= 2 && validation.walkForward.positiveFoldRate < 0.50) fatalReasons.push('Less than half of eligible walk-forward folds are positive.');

  if (validation.development.totalSamples < 40) hardGateReasons.push('Development sample is below 40 trades.');
  if (validation.development.oosSamples < 20) hardGateReasons.push('Development OOS sample is below 20 trades.');
  if (validation.blind.samples < 15) hardGateReasons.push('Locked Blind sample is below 15 trades.');
  if (validation.walkForward.eligibleFolds < 2) hardGateReasons.push('Fewer than two walk-forward folds have enough trades.');
  if (validation.costStress.survivalRate < 2 / 3) hardGateReasons.push('Fewer than two-thirds of execution-cost stress scenarios survive.');
  if (validation.regimeStress.eligibleRegimes < 2) hardGateReasons.push('Fewer than two regimes have enough validation trades.');
  if (validation.regimeStress.positiveRegimeRate < 0.50) hardGateReasons.push('Regime stress is not positive in at least half of eligible regimes.');
  if (validation.parameterRobustness < 0.55) hardGateReasons.push('Parameter robustness is below 55%.');
  if (maxObservedDrawdown > 0.20) hardGateReasons.push('Drawdown exceeds the 20% Challenger qualification threshold.');
  if (validation.monteCarloSurvivalRate < 0.65) hardGateReasons.push('Monte Carlo survival is below the 65% qualification threshold.');

  const expectancyScore = clamp01((validation.blind.expectancy + 0.002) / 0.015);
  const sharpeScore = clamp01((validation.blind.sharpe + 0.25) / 2.25);
  const blindQuality = (expectancyScore * 0.65 + sharpeScore * 0.35) * 100;
  const developmentOos = clamp01((validation.development.oosExpectancy + 0.002) / 0.015) * 100;
  const walkForward = validation.walkForward.positiveFoldRate * Math.min(1, validation.walkForward.eligibleFolds / 3) * 100;
  const monteCarlo = validation.monteCarloSurvivalRate * 100;
  const drawdown = clamp01(1 - maxObservedDrawdown / 0.25) * 100;
  const costStress = validation.costStress.survivalRate * 100;
  const regimeStress = validation.regimeStress.positiveRegimeRate * Math.min(1, validation.regimeStress.eligibleRegimes / 3) * 100;
  const parameterRobustness = validation.parameterRobustness * 100;
  const sampleSufficiency = (
    Math.min(1, validation.blind.samples / 20) * 0.55
    + Math.min(1, validation.development.oosSamples / 30) * 0.45
  ) * 100;

  const score = round(clamp(
    blindQuality * 0.22
    + developmentOos * 0.12
    + walkForward * 0.14
    + monteCarlo * 0.12
    + drawdown * 0.10
    + costStress * 0.10
    + regimeStress * 0.08
    + parameterRobustness * 0.07
    + sampleSufficiency * 0.05,
    0,
    100,
  ), 2);

  const hardGatePassed = fatalReasons.length === 0 && hardGateReasons.length === 0;
  let lifecycle: StrategyLifecycle = 'INCUBATOR';
  if (fatalReasons.length) lifecycle = 'REJECT';
  else if (
    hardGatePassed
    && score >= 85
    && validation.blind.samples >= 20
    && validation.walkForward.positiveFoldRate >= 0.75
    && validation.costStress.survivalRate === 1
    && validation.parameterRobustness >= 0.70
  ) lifecycle = 'CHAMPION_CANDIDATE';
  else if (hardGatePassed && score >= 70) lifecycle = 'CHALLENGER';

  return {
    score,
    lifecycle,
    hardGatePassed,
    hardGateReasons,
    fatalReasons,
    dimensions: {
      blindQuality: round(blindQuality, 2),
      developmentOos: round(developmentOos, 2),
      walkForward: round(walkForward, 2),
      monteCarlo: round(monteCarlo, 2),
      drawdown: round(drawdown, 2),
      costStress: round(costStress, 2),
      regimeStress: round(regimeStress, 2),
      parameterRobustness: round(parameterRobustness, 2),
      sampleSufficiency: round(sampleSufficiency, 2),
    },
    requiresHumanApproval: true,
    humanReviewStatus: 'NOT_REQUESTED',
    executionAuthority: false,
    promotionAuthority: false,
  };
};

export const runAutonomousStrategyFactoryResearch = (
  inputCandles: Candle[],
  config: AutonomousFactoryConfig = {},
): AutonomousFactoryResearchResult => {
  const candles = inputCandles.slice().sort((a, b) => a.timestamp - b.timestamp);
  const seed = Math.trunc(config.seed ?? 4_420_623);
  const generations = Math.max(1, Math.min(8, Math.trunc(config.generations ?? 3)));
  const candidatesPerGeneration = Math.max(8, Math.min(1_000, Math.trunc(config.candidatesPerGeneration ?? 96)));
  const parentPoolSize = Math.max(4, Math.min(candidatesPerGeneration, Math.trunc(config.parentPoolSize ?? 24)));
  const blindFraction = clamp(config.blindFraction ?? 0.20, 0.20, 0.35);
  const walkForwardFolds = Math.max(2, Math.min(8, Math.trunc(config.walkForwardFolds ?? 4)));
  const warmupBars = Math.max(205, Math.trunc(config.warmupBars ?? 220));
  const baseCostPerSideBps = clamp(config.baseCostPerSideBps ?? 13, 0, 100);
  if (candles.length < Math.max(700, warmupBars + 300)) {
    throw new Error(`Autonomous Strategy Factory requires at least ${Math.max(700, warmupBars + 300)} bars.`);
  }

  const blindStartIndex = Math.floor(candles.length * (1 - blindFraction));
  const developmentCandles = candles.slice(0, blindStartIndex);
  if (developmentCandles.length <= warmupBars + 100) throw new Error('Development segment is too short after locking the Blind holdout.');
  const developmentFrames = buildStrategyFactoryFeatureFrames(developmentCandles, { warmupBars, maxWindowBars: 320 });
  const fullFrames = buildStrategyFactoryFeatureFrames(candles, { warmupBars, maxWindowBars: 320 });
  const developmentConfig = { walkForwardFolds, warmupBars, baseCostPerSideBps } as const;
  const allDevelopment = new Map<string, { candidate: AutonomousStrategyCandidate; validation: AutonomousDevelopmentValidation }>();
  const generationGenomeIds: string[][] = [];

  let population: AutonomousStrategyCandidate[] = generateStrategyFactoryCandidates({
    seed,
    generation: 1,
    assetClass: 'CRYPTO_SPOT',
    candidates: candidatesPerGeneration,
    minIndicators: 3,
    maxIndicators: 6,
  }).map((genome) => ({ genome, hypothesis: buildStrategyHypothesis(genome, 'SEED_GRAMMAR') }));

  for (let generation = 1; generation <= generations; generation += 1) {
    generationGenomeIds.push(population.map((candidate) => candidate.genome.id));
    const evaluated = population.map((candidate) => ({
      candidate,
      validation: evaluateDevelopment(candidate, developmentCandles, developmentFrames, developmentConfig),
    })).sort((a, b) => b.validation.selectionScore - a.validation.selectionScore);
    for (const item of evaluated) allDevelopment.set(item.candidate.genome.id, item);
    if (generation < generations) {
      const parents = evaluated.slice(0, parentPoolSize).map((item) => item.candidate);
      population = evolveStrategyFactoryGeneration(parents, {
        seed: seed + generation * 1_009,
        generation: generation + 1,
        candidates: candidatesPerGeneration,
        minIndicators: 3,
        maxIndicators: 6,
      });
      if (!population.length) throw new Error(`Autonomous Strategy Factory could not generate generation ${generation + 1}.`);
    }
  }

  // Blind data is opened only after every generation and parent-selection decision is complete.
  const experiments: AutonomousStrategyExperiment[] = [...allDevelopment.values()].map(({ candidate, validation: developmentValidation }) => {
    const blindBacktest = backtestStrategyGenome(candidate.genome, candles, {
      warmupBars,
      oosFraction: blindFraction,
      costPerSideBps: baseCostPerSideBps,
      maxWindowBars: 320,
    }, fullFrames);
    const blindTrades = blindBacktest.trades.filter((trade) => trade.entryIndex >= blindStartIndex);
    const blindSummary = summarizeStrategyTrades(blindTrades);
    const stressSource = blindTrades.length >= 5
      ? blindTrades
      : developmentValidation.backtest.trades.filter((trade) => trade.oos);
    const costStress = buildCostStress(stressSource, baseCostPerSideBps);
    const regimeStress = buildRegimeStress(stressSource);
    const validation: AutonomousFinalValidation = {
      development: {
        totalSamples: developmentValidation.backtest.metrics.totalSamples,
        oosSamples: developmentValidation.backtest.metrics.oosSamples,
        oosExpectancy: developmentValidation.backtest.metrics.oosExpectancy,
        sharpe: developmentValidation.backtest.metrics.sharpe,
        sortino: developmentValidation.backtest.metrics.sortino,
        maxDrawdownPct: developmentValidation.backtest.metrics.maxDrawdownPct,
      },
      blind: blindSummary,
      walkForward: developmentValidation.walkForward,
      costStress,
      regimeStress,
      monteCarloSurvivalRate: Math.min(
        developmentValidation.backtest.metrics.monteCarloSurvivalRate,
        blindBacktest.metrics.monteCarloSurvivalRate,
      ),
      parameterRobustness: Math.min(
        developmentValidation.backtest.metrics.parameterRobustness,
        blindBacktest.metrics.parameterRobustness,
      ),
      blindStartIndex,
      developmentBars: developmentCandles.length,
      blindBars: candles.length - blindStartIndex,
    };
    return {
      experimentId: `EXP-${candidate.genome.id}`,
      candidate,
      validation,
      evaluation: scoreFinalEvaluation(validation),
    };
  }).sort((a, b) => b.evaluation.score - a.evaluation.score);

  const lifecycleCounts: Record<StrategyLifecycle, number> = {
    REJECT: 0,
    INCUBATOR: 0,
    CHALLENGER: 0,
    CHAMPION_CANDIDATE: 0,
  };
  for (const experiment of experiments) lifecycleCounts[experiment.evaluation.lifecycle] += 1;

  return {
    version: 'BO-SF-AUTO-v1',
    seed,
    generations,
    candidatesPerGeneration,
    candidateCount: experiments.length,
    blindFraction,
    blindStartIndex,
    developmentBars: developmentCandles.length,
    blindBars: candles.length - blindStartIndex,
    generationGenomeIds,
    lifecycleCounts,
    experiments,
    executionAuthority: false,
    promotionAuthority: false,
    championPromotionRequiresHumanApproval: true,
    liveDeploymentRequiresHumanApproval: true,
  };
};
