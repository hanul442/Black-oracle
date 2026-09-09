import { buildMonteCarloValidation } from './monteCarlo';
import { buildTradingSnapshot } from './snapshot';
import { buildWaveTheorySnapshot } from './waveTheory';
import { scoreStrategyExperiment, type StrategyEvaluationMetrics, type StrategyEvaluationScore, type StrategyGenome } from './strategyFactory';
import type { Candle, MarketRegime } from './types';

export interface StrategyFactoryFeatureFrame {
  index: number;
  timestamp: number;
  close: number;
  nextOpen: number;
  atr14: number;
  regime: MarketRegime;
  features: Record<string, number>;
}

export interface StrategyFactoryTrade {
  entryIndex: number;
  exitIndex: number;
  entryTimestamp: number;
  exitTimestamp: number;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  grossReturnPct: number;
  holdingBars: number;
  entryRegime: MarketRegime;
  exitReason: 'STOP' | 'TAKE_PROFIT' | 'SIGNAL' | 'MAX_HOLD' | 'END_OF_DATA';
  entryScore: number;
  exitScore: number;
  oos: boolean;
}

export interface StrategyFactoryBacktestConfig {
  warmupBars?: number;
  oosFraction?: number;
  costPerSideBps?: number;
  maxWindowBars?: number;
}

export interface StrategyFactoryBacktestResult {
  genome: StrategyGenome;
  trades: StrategyFactoryTrade[];
  metrics: StrategyEvaluationMetrics;
  evaluation: StrategyEvaluationScore;
  featureBars: number;
  oosStartIndex: number;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const stddev = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
};

const normalizedFeatureMap = (candles: Candle[], snapshot: ReturnType<typeof buildTradingSnapshot>) => {
  const indicators = snapshot.indicators;
  const structure = snapshot.structure;
  const wave = buildWaveTheorySnapshot(candles);
  const atr = Math.max(Number.EPSILON, indicators.atr14);
  const structureScore = structure?.bias === 'BULLISH'
    ? 0.65 + (structure.lastEvent?.direction === 'BULLISH' ? 0.2 : 0)
    : structure?.bias === 'BEARISH'
      ? -0.65 - (structure.lastEvent?.direction === 'BEARISH' ? 0.2 : 0)
      : 0;
  const macdScale = Math.max(atr * 0.5, Math.abs(indicators.close) * 0.001);
  return {
    EMA_STACK: clamp(snapshot.trend.directionalScore / 100, -1, 1),
    RSI14: clamp((indicators.rsi14 - 50) / 30, -1, 1),
    STOCH_RSI: clamp((indicators.stochRsi14 - 50) / 35, -1, 1),
    MACD_HISTOGRAM: clamp(Math.tanh(indicators.macdHistogram / macdScale), -1, 1),
    ROC20: clamp(Math.tanh(indicators.roc20 / 0.05), -1, 1),
    BOLLINGER_PERCENT_B: clamp((indicators.bollingerPercentB - 0.5) / 0.6, -1, 1),
    MARKET_STRUCTURE: clamp(structureScore, -1, 1),
    WAVE_STRUCTURE: clamp(wave.score / 100, -1, 1),
    ATR14: 0,
    BOLLINGER_BANDWIDTH: 0,
    VOLUME_Z: 0,
    MICROSTRUCTURE: 0,
    ADX_DMI: 0,
    VWAP: 0,
    ANCHORED_VWAP: 0,
    OPEN_INTEREST: 0,
    FUNDING_RATE: 0,
  } as Record<string, number>;
};

export const buildStrategyFactoryFeatureFrames = (
  inputCandles: Candle[],
  config: StrategyFactoryBacktestConfig = {},
): StrategyFactoryFeatureFrame[] => {
  const candles = inputCandles.slice().sort((a, b) => a.timestamp - b.timestamp);
  const warmup = Math.max(205, Math.trunc(config.warmupBars ?? 220));
  const maxWindow = Math.max(warmup, Math.trunc(config.maxWindowBars ?? 320));
  if (candles.length <= warmup + 2) return [];
  const frames: StrategyFactoryFeatureFrame[] = [];
  for (let index = warmup; index < candles.length - 1; index += 1) {
    const start = Math.max(0, index - maxWindow + 1);
    const window = candles.slice(start, index + 1);
    const snapshot = buildTradingSnapshot(window);
    frames.push({
      index,
      timestamp: candles[index].timestamp,
      close: candles[index].close,
      nextOpen: candles[index + 1].open,
      atr14: snapshot.indicators.atr14,
      regime: snapshot.regime.regime,
      features: normalizedFeatureMap(window, snapshot),
    });
  }
  return frames;
};

const genomeScore = (genome: StrategyGenome, frame: StrategyFactoryFeatureFrame) => {
  let score = 0;
  for (const indicator of genome.indicators) {
    score += (frame.features[indicator] ?? 0) * (genome.indicatorWeights[indicator] ?? 0);
  }
  return clamp(score, -1, 1);
};

const maxDrawdownFromReturns = (returns: number[]) => {
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const value of returns) {
    equity *= 1 + clamp(value, -0.999, 10);
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
  }
  return maxDrawdown;
};

const sharpe = (returns: number[]) => {
  const sd = stddev(returns);
  if (returns.length < 2 || sd <= Number.EPSILON) return 0;
  return average(returns) / sd * Math.sqrt(returns.length);
};

const sortino = (returns: number[]) => {
  if (returns.length < 2) return 0;
  const downside = returns.filter((value) => value < 0);
  const downsideDeviation = Math.sqrt(average(downside.map((value) => value ** 2)));
  if (downsideDeviation <= Number.EPSILON) return average(returns) > 0 ? 3 : 0;
  return average(returns) / downsideDeviation * Math.sqrt(returns.length);
};

const regimeStabilityScore = (trades: StrategyFactoryTrade[]) => {
  const groups = new Map<MarketRegime, number[]>();
  for (const trade of trades) {
    const values = groups.get(trade.entryRegime) ?? [];
    values.push(trade.returnPct);
    groups.set(trade.entryRegime, values);
  }
  const eligible = [...groups.values()].filter((values) => values.length >= 3);
  if (eligible.length === 0) return trades.length >= 10 ? 0.45 : 0;
  const positive = eligible.filter((values) => average(values) > 0).length;
  const dispersion = stddev(eligible.map((values) => average(values)));
  return clamp((positive / eligible.length) * (1 - Math.min(0.5, dispersion * 10)), 0, 1);
};

interface SimParams {
  entryThreshold: number;
  exitThreshold: number;
  stopAtrMultiple: number;
  takeProfitR: number;
}

const simulate = (
  genome: StrategyGenome,
  frames: StrategyFactoryFeatureFrame[],
  candles: Candle[],
  oosStartIndex: number,
  costPerSideBps: number,
  params: SimParams,
): StrategyFactoryTrade[] => {
  if (!frames.length) return [];
  const frameByIndex = new Map(frames.map((frame) => [frame.index, frame]));
  const costs = costPerSideBps / 10_000;
  const trades: StrategyFactoryTrade[] = [];
  let position: null | {
    entryIndex: number;
    entryTimestamp: number;
    entryPrice: number;
    stopPrice: number;
    takeProfitPrice: number;
    entryScore: number;
    entryRegime: MarketRegime;
  } = null;

  const closeTrade = (exitIndex: number, exitPrice: number, exitScore: number, exitReason: StrategyFactoryTrade['exitReason']) => {
    if (!position) return;
    const gross = exitPrice / position.entryPrice - 1;
    const net = gross - costs * 2;
    trades.push({
      entryIndex: position.entryIndex,
      exitIndex,
      entryTimestamp: position.entryTimestamp,
      exitTimestamp: candles[Math.min(candles.length - 1, exitIndex)].timestamp,
      entryPrice: position.entryPrice,
      exitPrice,
      returnPct: net,
      grossReturnPct: gross,
      holdingBars: Math.max(1, exitIndex - position.entryIndex),
      entryRegime: position.entryRegime,
      exitReason,
      entryScore: position.entryScore,
      exitScore,
      oos: position.entryIndex >= oosStartIndex,
    });
    position = null;
  };

  const firstIndex = frames[0].index + 1;
  for (let index = firstIndex; index < candles.length; index += 1) {
    const candle = candles[index];
    const previousFrame = frameByIndex.get(index - 1);
    if (position) {
      // Conservative same-bar assumption: if both levels are touched, stop is assumed first.
      if (candle.low <= position.stopPrice) {
        closeTrade(index, position.stopPrice, previousFrame ? genomeScore(genome, previousFrame) : 0, 'STOP');
      } else if (candle.high >= position.takeProfitPrice) {
        closeTrade(index, position.takeProfitPrice, previousFrame ? genomeScore(genome, previousFrame) : 0, 'TAKE_PROFIT');
      }
    }

    if (!previousFrame || index >= candles.length - 1) continue;
    const score = genomeScore(genome, previousFrame);

    if (position) {
      if (score <= -params.exitThreshold) {
        closeTrade(index, candle.open, score, 'SIGNAL');
      } else if (index - position.entryIndex >= genome.maxHoldingBars) {
        closeTrade(index, candle.open, score, 'MAX_HOLD');
      }
    }

    if (!position && score >= params.entryThreshold) {
      const entryPrice = candle.open;
      const riskPerUnit = clamp(previousFrame.atr14 * params.stopAtrMultiple, entryPrice * 0.005, entryPrice * 0.10);
      position = {
        entryIndex: index,
        entryTimestamp: candle.timestamp,
        entryPrice,
        stopPrice: entryPrice - riskPerUnit,
        takeProfitPrice: entryPrice + riskPerUnit * params.takeProfitR,
        entryScore: score,
        entryRegime: previousFrame.regime,
      };
    }
  }

  if (position) {
    const lastIndex = candles.length - 1;
    const lastFrame = frameByIndex.get(lastIndex - 1);
    closeTrade(lastIndex, candles[lastIndex].close, lastFrame ? genomeScore(genome, lastFrame) : 0, 'END_OF_DATA');
  }
  return trades;
};

const parameterRobustness = (
  genome: StrategyGenome,
  frames: StrategyFactoryFeatureFrame[],
  candles: Candle[],
  oosStartIndex: number,
  costPerSideBps: number,
) => {
  const variants: SimParams[] = [
    { entryThreshold: genome.entryThreshold - 0.03, exitThreshold: genome.exitThreshold, stopAtrMultiple: genome.stopAtrMultiple, takeProfitR: genome.takeProfitR },
    { entryThreshold: genome.entryThreshold + 0.03, exitThreshold: genome.exitThreshold, stopAtrMultiple: genome.stopAtrMultiple, takeProfitR: genome.takeProfitR },
    { entryThreshold: genome.entryThreshold, exitThreshold: genome.exitThreshold - 0.03, stopAtrMultiple: genome.stopAtrMultiple, takeProfitR: genome.takeProfitR },
    { entryThreshold: genome.entryThreshold, exitThreshold: genome.exitThreshold + 0.03, stopAtrMultiple: genome.stopAtrMultiple, takeProfitR: genome.takeProfitR },
    { entryThreshold: genome.entryThreshold, exitThreshold: genome.exitThreshold, stopAtrMultiple: Math.max(0.8, genome.stopAtrMultiple - 0.2), takeProfitR: genome.takeProfitR },
    { entryThreshold: genome.entryThreshold, exitThreshold: genome.exitThreshold, stopAtrMultiple: genome.stopAtrMultiple + 0.2, takeProfitR: genome.takeProfitR },
  ];
  const outcomes = variants.map((params) => {
    const trades = simulate(genome, frames, candles, oosStartIndex, costPerSideBps, params);
    const oos = trades.filter((trade) => trade.oos).map((trade) => trade.returnPct);
    return { sample: oos.length, expectancy: average(oos) };
  });
  const eligible = outcomes.filter((item) => item.sample >= 5);
  if (!eligible.length) return 0;
  const positiveShare = eligible.filter((item) => item.expectancy > 0).length / eligible.length;
  const expectationDispersion = stddev(eligible.map((item) => item.expectancy));
  return clamp(positiveShare * (1 - Math.min(0.6, expectationDispersion * 20)), 0, 1);
};

export const backtestStrategyGenome = (
  genome: StrategyGenome,
  inputCandles: Candle[],
  config: StrategyFactoryBacktestConfig = {},
  prebuiltFrames?: StrategyFactoryFeatureFrame[],
): StrategyFactoryBacktestResult => {
  const candles = inputCandles.slice().sort((a, b) => a.timestamp - b.timestamp);
  const oosFraction = clamp(config.oosFraction ?? 0.30, 0.20, 0.50);
  const costPerSideBps = clamp(config.costPerSideBps ?? 13, 0, 100);
  const frames = prebuiltFrames ?? buildStrategyFactoryFeatureFrames(candles, config);
  const oosStartIndex = Math.max(0, Math.floor(candles.length * (1 - oosFraction)));
  const baselineParams: SimParams = {
    entryThreshold: genome.entryThreshold,
    exitThreshold: genome.exitThreshold,
    stopAtrMultiple: genome.stopAtrMultiple,
    takeProfitR: genome.takeProfitR,
  };
  const trades = simulate(genome, frames, candles, oosStartIndex, costPerSideBps, baselineParams);
  const allReturns = trades.map((trade) => trade.returnPct);
  const oosTrades = trades.filter((trade) => trade.oos);
  const oosReturns = oosTrades.map((trade) => trade.returnPct);
  const monteCarlo = buildMonteCarloValidation(allReturns, {
    seed: genome.seed + genome.generation * 1_003,
    drawdownLimitPct: 0.25,
    minTrades: 20,
    costInflationBps: 8,
  });
  const metrics: StrategyEvaluationMetrics = {
    totalSamples: trades.length,
    oosSamples: oosTrades.length,
    oosExpectancy: average(oosReturns),
    sharpe: sharpe(oosReturns),
    sortino: sortino(oosReturns),
    maxDrawdownPct: maxDrawdownFromReturns(allReturns),
    monteCarloSurvivalRate: monteCarlo.survivalProbability ?? 0,
    regimeStability: regimeStabilityScore(oosTrades.length ? oosTrades : trades),
    parameterRobustness: parameterRobustness(genome, frames, candles, oosStartIndex, costPerSideBps),
  };
  const evaluation = scoreStrategyExperiment(genome, metrics);
  const reasons = [
    `Signals are generated only from data available at each bar close and entered at the next bar open.`,
    `OOS begins at candle index ${oosStartIndex} (${Math.round(oosFraction * 100)}% holdout).`,
    `Round-trip execution drag includes ${costPerSideBps.toFixed(1)} bps per side before Monte Carlo stress inflation.`,
    `Same-bar stop/target collisions are resolved conservatively in favor of the stop.`,
    `Factory candidates never receive execution or automatic promotion authority from this backtest.`,
  ];
  return { genome, trades, metrics, evaluation, featureBars: frames.length, oosStartIndex, reasons };
};

export const rankStrategyFactoryCandidates = (
  genomes: StrategyGenome[],
  candles: Candle[],
  config: StrategyFactoryBacktestConfig = {},
) => {
  const frames = buildStrategyFactoryFeatureFrames(candles, config);
  return genomes.map((genome) => backtestStrategyGenome(genome, candles, config, frames))
    .sort((a, b) => b.evaluation.score - a.evaluation.score);
};
