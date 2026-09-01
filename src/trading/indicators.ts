import type { Candle, IndicatorSnapshot } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const standardDeviation = (values: number[]) => {
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

export const emaSeries = (values: number[], period: number): number[] => {
  if (period <= 0) throw new Error('EMA period must be positive.');
  if (values.length < period) throw new Error(`EMA${period} requires at least ${period} values.`);

  const result = Array(values.length).fill(Number.NaN);
  const seed = mean(values.slice(0, period));
  result[period - 1] = seed;

  const multiplier = 2 / (period + 1);
  let previous = seed;
  for (let index = period; index < values.length; index += 1) {
    previous = (values[index] - previous) * multiplier + previous;
    result[index] = previous;
  }

  return result;
};

export const emaLatest = (values: number[], period: number) => {
  const series = emaSeries(values, period);
  return series[series.length - 1];
};

export const rsiSeries = (values: number[], period = 14): number[] => {
  if (values.length < period + 1) throw new Error(`RSI${period} requires at least ${period + 1} values.`);

  const result = Array(values.length).fill(Number.NaN);
  let gainSum = 0;
  let lossSum = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    gainSum += Math.max(change, 0);
    lossSum += Math.max(-change, 0);
  }

  let averageGain = gainSum / period;
  let averageLoss = lossSum / period;
  result[period] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    result[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }

  return result;
};

export const rsiLatest = (values: number[], period = 14) => {
  const series = rsiSeries(values, period);
  return series[series.length - 1];
};

export const stochRsiLatest = (values: number[], rsiPeriod = 14, stochPeriod = 14) => {
  const series = rsiSeries(values, rsiPeriod).filter(Number.isFinite);
  if (series.length < stochPeriod) {
    throw new Error(`Stoch RSI requires at least ${rsiPeriod + stochPeriod} price observations.`);
  }

  const window = series.slice(-stochPeriod);
  const current = window[window.length - 1];
  const lowest = Math.min(...window);
  const highest = Math.max(...window);
  if (highest === lowest) return 50;
  return clamp(((current - lowest) / (highest - lowest)) * 100, 0, 100);
};

export const atrLatest = (candles: Candle[], period = 14) => {
  if (candles.length < period + 1) throw new Error(`ATR${period} requires at least ${period + 1} candles.`);

  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });

  let value = mean(trueRanges.slice(0, period));
  for (let index = period; index < trueRanges.length; index += 1) {
    value = (value * (period - 1) + trueRanges[index]) / period;
  }
  return value;
};

export const bollingerLatest = (values: number[], period = 20, deviations = 2) => {
  if (values.length < period) throw new Error(`Bollinger Bands require at least ${period} values.`);
  const window = values.slice(-period);
  const middle = mean(window);
  const deviation = standardDeviation(window);
  const upper = middle + deviations * deviation;
  const lower = middle - deviations * deviation;
  const width = upper - lower;
  const close = values[values.length - 1];

  return {
    middle,
    upper,
    lower,
    percentB: width === 0 ? 0.5 : (close - lower) / width,
    bandwidth: middle === 0 ? 0 : width / middle,
  };
};

export const macdLatest = (values: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  if (values.length < slowPeriod + signalPeriod) {
    throw new Error(`MACD requires at least ${slowPeriod + signalPeriod} values.`);
  }

  const fast = emaSeries(values, fastPeriod);
  const slow = emaSeries(values, slowPeriod);
  const macdValues: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    if (Number.isFinite(fast[index]) && Number.isFinite(slow[index])) {
      macdValues.push(fast[index] - slow[index]);
    }
  }

  const signalSeries = emaSeries(macdValues, signalPeriod);
  const macd = macdValues[macdValues.length - 1];
  const signal = signalSeries[signalSeries.length - 1];
  return { macd, signal, histogram: macd - signal };
};

export const zScoreLatest = (values: number[], period = 20) => {
  if (values.length < period) throw new Error(`Z-score requires at least ${period} values.`);
  const window = values.slice(-period);
  const avg = mean(window);
  const deviation = standardDeviation(window);
  return deviation === 0 ? 0 : (window[window.length - 1] - avg) / deviation;
};

export const buildIndicatorSnapshot = (candles: Candle[]): IndicatorSnapshot => {
  if (candles.length < 200) throw new Error('Trading indicators require at least 200 candles.');

  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const close = closes[closes.length - 1];
  const atr14 = atrLatest(candles, 14);
  const bollinger = bollingerLatest(closes, 20, 2);
  const macd = macdLatest(closes);

  return {
    close,
    ema20: emaLatest(closes, 20),
    ema50: emaLatest(closes, 50),
    ema200: emaLatest(closes, 200),
    rsi14: rsiLatest(closes, 14),
    stochRsi14: stochRsiLatest(closes, 14, 14),
    atr14,
    atrPct: close === 0 ? 0 : atr14 / close,
    macd: macd.macd,
    macdSignal: macd.signal,
    macdHistogram: macd.histogram,
    bollingerMiddle: bollinger.middle,
    bollingerUpper: bollinger.upper,
    bollingerLower: bollinger.lower,
    bollingerPercentB: bollinger.percentB,
    bollingerBandwidth: bollinger.bandwidth,
    volumeZScore: zScoreLatest(volumes, 20),
  };
};
