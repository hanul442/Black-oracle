import type { IndicatorSnapshot, RegimeSnapshot } from './types';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const classifyRegime = (indicators: IndicatorSnapshot): RegimeSnapshot => {
  const {
    close,
    ema20,
    ema50,
    ema200,
    atr14,
    atrPct,
    macdHistogram,
    bollingerBandwidth,
  } = indicators;

  const atrUnit = Math.max(atr14, close * 0.001);
  const shortSpread = Math.abs(ema20 - ema50) / atrUnit;
  const longSpread = Math.abs(ema50 - ema200) / atrUnit;
  const trendStrength = clamp01((shortSpread * 0.65 + longSpread * 0.35) / 3);
  const bullishStack = close > ema20 && ema20 > ema50 && ema50 > ema200;
  const bearishStack = close < ema20 && ema20 < ema50 && ema50 < ema200;
  const highVolatility = atrPct >= 0.025 || bollingerBandwidth >= 0.12;
  const reasons: string[] = [];

  let regime: RegimeSnapshot['regime'];

  if (bullishStack && trendStrength >= 0.55 && macdHistogram >= 0) {
    regime = 'STRONG_UPTREND';
    reasons.push('Price and EMA 20/50/200 are fully bullish-aligned.');
    reasons.push('EMA separation is large relative to ATR and MACD momentum is positive.');
  } else if (bearishStack && trendStrength >= 0.55 && macdHistogram <= 0) {
    regime = 'STRONG_DOWNTREND';
    reasons.push('Price and EMA 20/50/200 are fully bearish-aligned.');
    reasons.push('EMA separation is large relative to ATR and MACD momentum is negative.');
  } else if (ema20 > ema50 && close > ema50) {
    regime = 'UPTREND';
    reasons.push('Short EMA is above medium EMA and price remains above EMA50.');
  } else if (ema20 < ema50 && close < ema50) {
    regime = 'DOWNTREND';
    reasons.push('Short EMA is below medium EMA and price remains below EMA50.');
  } else {
    regime = 'RANGE';
    reasons.push('EMA structure is mixed or price is crossing the medium trend.');
  }

  if (highVolatility) reasons.push('ATR or Bollinger bandwidth indicates elevated volatility.');

  const structuralConfidence = regime === 'RANGE' ? 0.58 : 0.62 + trendStrength * 0.3;
  const confidence = clamp01(structuralConfidence - (highVolatility ? 0.08 : 0));

  return {
    regime,
    confidence,
    trendStrength,
    highVolatility,
    reasons,
  };
};
