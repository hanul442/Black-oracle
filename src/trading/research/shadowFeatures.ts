import { atrLatest } from '../indicators';
import type { Candle } from '../types';
import type { ResearchTimeframe, TechnicalResearchFamily } from './featureRegistry';

export type ShadowAvailability = 'AVAILABLE' | 'UNAVAILABLE';

export interface ShadowFeatureValue {
  featureId: string;
  featureFamily: TechnicalResearchFamily;
  featureVersion: '1.0.0';
  status: 'SHADOW';
  authority: 'OBSERVATION_ONLY';
  available: boolean;
  value: number | null;
  normalizedValue: number | null;
  state: string;
  confidence: number;
  reasons: string[];
  metadata: Record<string, number | string | boolean | null>;
}

export interface RelativeStrengthPointInTime {
  universeAt: number;
  universeMarkets: string[];
  returns: {
    return15m: number;
    return1h: number;
    return4h: number;
    return24h: number;
  };
  percentiles: {
    percentileRank15m: number;
    percentileRank1h: number;
    percentileRank4h: number;
    percentileRank24h: number;
  };
  relativeReturns: {
    relativeReturn15m: number;
    relativeReturn1h: number;
    relativeReturn4h: number;
    relativeReturn24h: number;
  };
  liquidityAdjustedPercentile?: number | null;
}

export interface TechnicalFeatureShadowSnapshot {
  market: string;
  timeframe: ResearchTimeframe;
  asOf: number;
  status: 'SHADOW';
  authority: 'OBSERVATION_ONLY';
  trendStrength: ShadowFeatureValue;
  breakout: ShadowFeatureValue;
  relativeStrength: ShadowFeatureValue;
  vwap: ShadowFeatureValue;
  realizedVolatility: ShadowFeatureValue;
}

export interface CrossTimeframeShadowConsensus {
  breakoutAlignment: 'ALIGNED_BULLISH' | 'ALIGNED_BEARISH' | 'MIXED' | 'UNAVAILABLE';
  trendStrengthAlignment: 'ALIGNED_BULLISH' | 'ALIGNED_BEARISH' | 'MIXED' | 'UNAVAILABLE';
  relativeStrengthAlignment: 'ALIGNED_BULLISH' | 'ALIGNED_BEARISH' | 'MIXED' | 'UNAVAILABLE';
  volatilityAlignment: 'ALIGNED_BULLISH' | 'ALIGNED_BEARISH' | 'MIXED' | 'UNAVAILABLE';
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const standardDeviation = (values: number[]) => {
  if (values.length === 0) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
};
const tanh = (value: number) => Math.tanh(value);

const unavailable = (featureId: string, featureFamily: TechnicalResearchFamily, reason: string): ShadowFeatureValue => ({
  featureId,
  featureFamily,
  featureVersion: '1.0.0',
  status: 'SHADOW',
  authority: 'OBSERVATION_ONLY',
  available: false,
  value: null,
  normalizedValue: null,
  state: 'UNAVAILABLE',
  confidence: 0,
  reasons: [reason],
  metadata: {},
});

const value = (
  featureId: string,
  featureFamily: TechnicalResearchFamily,
  rawValue: number,
  normalizedValue: number,
  state: string,
  confidence: number,
  metadata: ShadowFeatureValue['metadata'],
  reasons: string[],
): ShadowFeatureValue => ({
  featureId,
  featureFamily,
  featureVersion: '1.0.0',
  status: 'SHADOW',
  authority: 'OBSERVATION_ONLY',
  available: true,
  value: Number.isFinite(rawValue) ? rawValue : null,
  normalizedValue: Number.isFinite(normalizedValue) ? clamp(normalizedValue, -1, 1) : null,
  state,
  confidence: clamp(confidence, 0, 1),
  reasons,
  metadata,
});

const highest = (candles: Candle[]) => Math.max(...candles.map((candle) => candle.high));
const lowest = (candles: Candle[]) => Math.min(...candles.map((candle) => candle.low));

export const buildBreakoutShadow = (candles: Candle[]): ShadowFeatureValue => {
  const featureId = 'breakout.donchian.v1';
  if (candles.length < 51) return unavailable(featureId, 'BREAKOUT', 'Donchian shadow feature requires at least 51 candles.');

  const current = candles[candles.length - 1];
  const previous20 = candles.slice(-21, -1);
  const previous50 = candles.slice(-51, -1);
  const highestHigh20 = highest(previous20);
  const lowestLow20 = lowest(previous20);
  const highestHigh50 = highest(previous50);
  const lowestLow50 = lowest(previous50);
  const range20 = Math.max(Number.EPSILON, highestHigh20 - lowestLow20);
  const range50 = Math.max(Number.EPSILON, highestHigh50 - lowestLow50);
  const rangePosition20 = (current.close - lowestLow20) / range20;
  const rangePosition50 = (current.close - lowestLow50) / range50;
  const atr = atrLatest(candles, 14);

  let state = 'INSIDE_RANGE';
  let signedDistance = 0;
  if (current.close > highestHigh20) {
    state = 'BREAKOUT_UP';
    signedDistance = (current.close - highestHigh20) / Math.max(Number.EPSILON, atr);
  } else if (current.close < lowestLow20) {
    state = 'BREAKOUT_DOWN';
    signedDistance = -((lowestLow20 - current.close) / Math.max(Number.EPSILON, atr));
  } else if (rangePosition20 >= 0.9) state = 'NEAR_HIGH';
  else if (rangePosition20 <= 0.1) state = 'NEAR_LOW';

  const falseBreakUp = current.high > highestHigh20 && current.close <= highestHigh20;
  const falseBreakDown = current.low < lowestLow20 && current.close >= lowestLow20;
  const falseBreak = falseBreakUp || falseBreakDown;
  if (falseBreak) state = 'FALSE_BREAK';

  const volumes = previous20.map((candle) => candle.volume);
  const volumeAvg = mean(volumes);
  const volumeStd = standardDeviation(volumes);
  const breakoutVolumeZScore = volumeStd > 0 ? (current.volume - volumeAvg) / volumeStd : 0;

  const threshold = state === 'BREAKOUT_DOWN' ? lowestLow20 : highestHigh20;
  let breakoutBars = 0;
  for (let index = candles.length - 1; index >= Math.max(0, candles.length - 10); index -= 1) {
    const close = candles[index].close;
    const stillOutside = state === 'BREAKOUT_UP' ? close > threshold : state === 'BREAKOUT_DOWN' ? close < threshold : false;
    if (!stillOutside) break;
    breakoutBars += 1;
  }

  let reclaimBars = 0;
  if (falseBreak) {
    for (let index = candles.length - 1; index >= Math.max(0, candles.length - 5); index -= 1) {
      const close = candles[index].close;
      if (close >= lowestLow20 && close <= highestHigh20) reclaimBars += 1;
      else break;
    }
  }

  return value(
    featureId,
    'BREAKOUT',
    signedDistance,
    tanh(signedDistance / 2),
    state,
    1,
    {
      highestHigh20,
      lowestLow20,
      highestHigh50,
      lowestLow50,
      rangePosition20,
      rangePosition50,
      breakoutStrength: signedDistance,
      breakoutBars,
      reclaimBars,
      falseBreak,
      breakoutVolumeZScore,
    },
    [
      `20/50-bar range positions are ${rangePosition20.toFixed(3)}/${rangePosition50.toFixed(3)}.`,
      `ATR-normalized breakout distance is ${signedDistance.toFixed(3)}; volume z-score is ${breakoutVolumeZScore.toFixed(2)}.`,
    ],
  );
};

interface AdxPoint {
  adx: number;
  plusDi: number;
  minusDi: number;
}

const adxSeries = (candles: Candle[], period = 14): AdxPoint[] => {
  if (candles.length < period * 2 + 1) return [];
  const trs: number[] = [];
  const plusDms: number[] = [];
  const minusDms: number[] = [];

  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;
    trs.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close)));
    plusDms.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDms.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  let smoothedTr = trs.slice(0, period).reduce((sum, item) => sum + item, 0);
  let smoothedPlus = plusDms.slice(0, period).reduce((sum, item) => sum + item, 0);
  let smoothedMinus = minusDms.slice(0, period).reduce((sum, item) => sum + item, 0);
  const dxs: Array<{ dx: number; plusDi: number; minusDi: number }> = [];

  const pushDx = () => {
    const plusDi = smoothedTr > 0 ? (100 * smoothedPlus) / smoothedTr : 0;
    const minusDi = smoothedTr > 0 ? (100 * smoothedMinus) / smoothedTr : 0;
    const denominator = plusDi + minusDi;
    const dx = denominator > 0 ? (100 * Math.abs(plusDi - minusDi)) / denominator : 0;
    dxs.push({ dx, plusDi, minusDi });
  };
  pushDx();

  for (let index = period; index < trs.length; index += 1) {
    smoothedTr = smoothedTr - smoothedTr / period + trs[index];
    smoothedPlus = smoothedPlus - smoothedPlus / period + plusDms[index];
    smoothedMinus = smoothedMinus - smoothedMinus / period + minusDms[index];
    pushDx();
  }

  if (dxs.length < period) return [];
  let adx = mean(dxs.slice(0, period).map((item) => item.dx));
  const output: AdxPoint[] = [{ adx, plusDi: dxs[period - 1].plusDi, minusDi: dxs[period - 1].minusDi }];
  for (let index = period; index < dxs.length; index += 1) {
    adx = ((adx * (period - 1)) + dxs[index].dx) / period;
    output.push({ adx, plusDi: dxs[index].plusDi, minusDi: dxs[index].minusDi });
  }
  return output;
};

export const buildAdxShadow = (candles: Candle[]): ShadowFeatureValue => {
  const featureId = 'trend-strength.adx-dmi.v1';
  const series = adxSeries(candles, 14);
  if (series.length === 0) return unavailable(featureId, 'TREND_STRENGTH', 'ADX/DMI shadow feature requires at least 29 candles.');
  const current = series[series.length - 1];
  const previous = series[Math.max(0, series.length - 2)];
  const diSpread = current.plusDi - current.minusDi;
  const denominator = Math.max(Number.EPSILON, current.plusDi + current.minusDi);
  const signedDirection = diSpread / denominator;
  const normalized = signedDirection * clamp(current.adx / 100, 0, 1);
  const adxSlope = current.adx - previous.adx;
  let state = current.adx >= 25 ? 'TRENDING' : current.adx < 18 ? 'WEAK_TREND' : 'TRANSITION';
  if (current.adx >= 25 && diSpread > 0) state = 'STRONG_BULLISH_TREND';
  if (current.adx >= 25 && diSpread < 0) state = 'STRONG_BEARISH_TREND';

  return value(
    featureId,
    'TREND_STRENGTH',
    current.adx,
    normalized,
    state,
    clamp(series.length / 30, 0.5, 1),
    {
      adx14: current.adx,
      plusDi14: current.plusDi,
      minusDi14: current.minusDi,
      diSpread,
      adxSlope,
    },
    [`ADX14 is ${current.adx.toFixed(2)} with DI spread ${diSpread.toFixed(2)} and slope ${adxSlope.toFixed(2)}.`],
  );
};

const rollingVwap = (candles: Candle[], period: number, offset = 0) => {
  if (candles.length < period + offset) return null;
  const end = candles.length - offset;
  const window = candles.slice(end - period, end);
  const totalVolume = window.reduce((sum, candle) => sum + candle.volume, 0);
  if (totalVolume <= 0) return null;
  return window.reduce((sum, candle) => sum + ((candle.high + candle.low + candle.close) / 3) * candle.volume, 0) / totalVolume;
};

export const buildVwapShadow = (candles: Candle[]): ShadowFeatureValue => {
  const featureId = 'volume-weighted-location.rolling-vwap.v1';
  if (candles.length < 51) return unavailable(featureId, 'VOLUME_WEIGHTED_LOCATION', 'Rolling VWAP shadow feature requires at least 51 candles.');
  const current = candles[candles.length - 1];
  const rollingVWAP20 = rollingVwap(candles, 20);
  const rollingVWAP50 = rollingVwap(candles, 50);
  const previousVWAP20 = rollingVwap(candles, 20, 1);
  const previousVWAP50 = rollingVwap(candles, 50, 1);
  if (rollingVWAP20 === null || rollingVWAP50 === null || previousVWAP20 === null || previousVWAP50 === null) {
    return unavailable(featureId, 'VOLUME_WEIGHTED_LOCATION', 'VWAP is unavailable because the rolling window has no usable volume.');
  }
  const atr = atrLatest(candles, 14);
  const priceVsVWAP20 = current.close / rollingVWAP20 - 1;
  const priceVsVWAP50 = current.close / rollingVWAP50 - 1;
  const vwapDistanceAtr20 = (current.close - rollingVWAP20) / Math.max(Number.EPSILON, atr);
  const vwapDistanceAtr50 = (current.close - rollingVWAP50) / Math.max(Number.EPSILON, atr);
  const vwapSlope20 = rollingVWAP20 / previousVWAP20 - 1;
  const vwapSlope50 = rollingVWAP50 / previousVWAP50 - 1;
  const previousClose = candles[candles.length - 2].close;
  const previousDistance = previousClose - previousVWAP20;
  const currentDistance = current.close - rollingVWAP20;

  let state = currentDistance >= 0 ? 'ABOVE_VWAP' : 'BELOW_VWAP';
  if (previousDistance < 0 && currentDistance >= 0) state = 'VWAP_RECLAIM';
  else if (previousDistance > 0 && currentDistance <= 0) state = 'VWAP_REJECTION';
  else if (vwapDistanceAtr20 >= 1.5) state = 'EXTENDED_ABOVE';
  else if (vwapDistanceAtr20 <= -1.5) state = 'EXTENDED_BELOW';

  return value(
    featureId,
    'VOLUME_WEIGHTED_LOCATION',
    vwapDistanceAtr20,
    tanh(vwapDistanceAtr20 / 2),
    state,
    1,
    {
      rollingVWAP20,
      rollingVWAP50,
      priceVsVWAP20,
      priceVsVWAP50,
      vwapSlope20,
      vwapSlope50,
      vwapDistanceAtr20,
      vwapDistanceAtr50,
    },
    [`Price is ${vwapDistanceAtr20.toFixed(2)} ATR from VWAP20 and ${vwapDistanceAtr50.toFixed(2)} ATR from VWAP50.`],
  );
};

const realizedVolatility = (candles: Candle[], period: number) => {
  if (candles.length < period + 1) return null;
  const window = candles.slice(-(period + 1));
  const returns: number[] = [];
  for (let index = 1; index < window.length; index += 1) {
    if (window[index - 1].close <= 0 || window[index].close <= 0) return null;
    returns.push(Math.log(window[index].close / window[index - 1].close));
  }
  return Math.sqrt(mean(returns.map((item) => item ** 2)));
};

const parkinsonVolatility = (candles: Candle[], period = 20) => {
  if (candles.length < period) return null;
  const window = candles.slice(-period);
  const terms = window.map((candle) => candle.low > 0 ? Math.log(candle.high / candle.low) ** 2 : 0);
  return Math.sqrt(mean(terms) / (4 * Math.log(2)));
};

export const buildRealizedVolatilityShadow = (candles: Candle[]): ShadowFeatureValue => {
  const featureId = 'volatility.realized-ratio.v1';
  if (candles.length < 60) return unavailable(featureId, 'VOLATILITY', 'Realized-volatility shadow feature requires at least 60 candles.');
  const rv20 = realizedVolatility(candles, 20);
  const rv50 = realizedVolatility(candles, 50);
  const parkinson20 = parkinsonVolatility(candles, 20);
  if (rv20 === null || rv50 === null || parkinson20 === null) return unavailable(featureId, 'VOLATILITY', 'Realized volatility could not be calculated.');
  const volRatio = rv50 > 0 ? rv20 / rv50 : 1;

  const rollingRv: number[] = [];
  for (let offset = 0; offset < 20; offset += 1) {
    const end = candles.length - offset;
    const sliced = candles.slice(0, end);
    const point = realizedVolatility(sliced, 20);
    if (point !== null) rollingRv.push(point);
  }
  const volatilityOfVolatility = standardDeviation(rollingRv);
  let state = 'VOL_STABLE';
  if (volRatio >= 1.8) state = 'VOL_SHOCK';
  else if (volRatio >= 1.2) state = 'VOL_EXPANSION';
  else if (volRatio <= 0.8) state = 'VOL_CONTRACTION';

  return value(
    featureId,
    'VOLATILITY',
    volRatio,
    tanh(Math.log(Math.max(Number.EPSILON, volRatio))),
    state,
    1,
    {
      rv20,
      rv50,
      parkinson20,
      volRatio,
      volatilityOfVolatility,
    },
    [`RV20/RV50 is ${volRatio.toFixed(3)}; Parkinson20 is ${parkinson20.toFixed(5)}.`],
  );
};

const relativeFieldsForTimeframe = (relative: RelativeStrengthPointInTime, timeframe: ResearchTimeframe) => {
  if (timeframe === '15M') return {
    marketReturn: relative.returns.return15m,
    percentile: relative.percentiles.percentileRank15m,
    relativeReturn: relative.relativeReturns.relativeReturn15m,
  };
  if (timeframe === '1H') return {
    marketReturn: relative.returns.return1h,
    percentile: relative.percentiles.percentileRank1h,
    relativeReturn: relative.relativeReturns.relativeReturn1h,
  };
  return {
    marketReturn: relative.returns.return4h,
    percentile: relative.percentiles.percentileRank4h,
    relativeReturn: relative.relativeReturns.relativeReturn4h,
  };
};

export const buildRelativeStrengthShadow = (
  timeframe: ResearchTimeframe,
  relative?: RelativeStrengthPointInTime | null,
): ShadowFeatureValue => {
  const featureId = 'relative-strength.cross-sectional.v1';
  if (!relative || relative.universeMarkets.length < 2) {
    return unavailable(featureId, 'RELATIVE_STRENGTH', 'Point-in-time universe data is unavailable for relative strength.');
  }
  const fields = relativeFieldsForTimeframe(relative, timeframe);
  let state = 'MIDDLE_QUINTILES';
  if (fields.percentile >= 0.8) state = 'TOP_QUINTILE';
  else if (fields.percentile <= 0.2) state = 'BOTTOM_QUINTILE';

  return value(
    featureId,
    'RELATIVE_STRENGTH',
    fields.relativeReturn,
    fields.percentile * 2 - 1,
    state,
    clamp(relative.universeMarkets.length / 20, 0.25, 1),
    {
      marketReturn: fields.marketReturn,
      percentileRank: fields.percentile,
      relativeReturn: fields.relativeReturn,
      return24h: relative.returns.return24h,
      percentileRank24h: relative.percentiles.percentileRank24h,
      relativeReturn24h: relative.relativeReturns.relativeReturn24h,
      liquidityAdjustedPercentile: relative.liquidityAdjustedPercentile ?? null,
      universeSize: relative.universeMarkets.length,
      universeAt: relative.universeAt,
    },
    [`Point-in-time rank is ${(fields.percentile * 100).toFixed(1)}th percentile across ${relative.universeMarkets.length} market(s).`],
  );
};

export const buildTechnicalFeatureShadowSnapshot = (
  candles: Candle[],
  timeframe: ResearchTimeframe,
  relative?: RelativeStrengthPointInTime | null,
): TechnicalFeatureShadowSnapshot => {
  const latest = candles[candles.length - 1];
  const market = latest?.market ?? 'UNKNOWN';
  return {
    market,
    timeframe,
    asOf: latest?.timestamp ?? 0,
    status: 'SHADOW',
    authority: 'OBSERVATION_ONLY',
    trendStrength: buildAdxShadow(candles),
    breakout: buildBreakoutShadow(candles),
    relativeStrength: buildRelativeStrengthShadow(timeframe, relative),
    vwap: buildVwapShadow(candles),
    realizedVolatility: buildRealizedVolatilityShadow(candles),
  };
};

const alignment = (values: Array<number | null>, volatility = false): CrossTimeframeShadowConsensus['breakoutAlignment'] => {
  const available = values.filter((item): item is number => item !== null && Number.isFinite(item));
  if (available.length < 2) return 'UNAVAILABLE';
  const positive = available.filter((item) => item > 0.1).length;
  const negative = available.filter((item) => item < -0.1).length;
  if (volatility) {
    if (positive === available.length) return 'ALIGNED_BULLISH';
    if (negative === available.length) return 'ALIGNED_BEARISH';
    return 'MIXED';
  }
  if (positive === available.length) return 'ALIGNED_BULLISH';
  if (negative === available.length) return 'ALIGNED_BEARISH';
  return 'MIXED';
};

export const buildCrossTimeframeShadowConsensus = (
  snapshots: TechnicalFeatureShadowSnapshot[],
): CrossTimeframeShadowConsensus => ({
  breakoutAlignment: alignment(snapshots.map((item) => item.breakout.normalizedValue)),
  trendStrengthAlignment: alignment(snapshots.map((item) => item.trendStrength.normalizedValue)),
  relativeStrengthAlignment: alignment(snapshots.map((item) => item.relativeStrength.normalizedValue)),
  volatilityAlignment: alignment(snapshots.map((item) => item.realizedVolatility.normalizedValue), true),
});
