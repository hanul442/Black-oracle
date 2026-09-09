import type { Candle } from './types';
import type { VolumeAbsorptionSnapshot } from './volumeAbsorption';

export type EquityIntradayTimingAction = 'ENTER_NOW' | 'WAIT' | 'EXIT_WEAKNESS' | 'HOLD';

export interface EquityIntradayTimingSnapshot {
  action: EquityIntradayTimingAction;
  score: number;
  confidence: number;
  vwap: number | null;
  priceVsVwapPct: number | null;
  relativeVolume: number | null;
  momentum5Pct: number | null;
  rangeLocation20: number | null;
  breakoutWithVolume: boolean;
  pullbackResumption: boolean;
  bearishVolumeBreak: boolean;
  absorptionConfirmed: boolean;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const priceReturn = (from: number, to: number) => from > 0 ? (to - from) / from : 0;

const sessionVwap = (candles: Candle[]) => {
  let numerator = 0;
  let denominator = 0;
  for (const bar of candles) {
    if (!(bar.volume > 0)) continue;
    const typical = (bar.high + bar.low + bar.close) / 3;
    numerator += typical * bar.volume;
    denominator += bar.volume;
  }
  return denominator > 0 ? numerator / denominator : null;
};

/**
 * Intraday timing is deliberately separated from daily stock selection.
 * It can delay/confirm entries and flag discretionary weakness exits, while
 * hard protective stops remain outside this layer and always execute first.
 */
export const buildEquityIntradayTiming = (
  minuteCandles: Candle[],
  absorption: VolumeAbsorptionSnapshot,
): EquityIntradayTimingSnapshot => {
  const bars = minuteCandles.slice(-120);
  const reasons: string[] = [];
  if (bars.length < 30) {
    return {
      action: 'WAIT',
      score: 0,
      confidence: 0,
      vwap: null,
      priceVsVwapPct: null,
      relativeVolume: null,
      momentum5Pct: null,
      rangeLocation20: null,
      breakoutWithVolume: false,
      pullbackResumption: false,
      bearishVolumeBreak: false,
      absorptionConfirmed: false,
      reasons: ['At least 30 current-session minute bars are required for volume-aware timing.'],
    };
  }

  const last = bars[bars.length - 1];
  const vwap = sessionVwap(bars);
  const priceVsVwapPct = vwap && vwap > 0 ? (last.close - vwap) / vwap : null;
  const recent5 = bars.slice(-5);
  const prior30 = bars.slice(Math.max(0, bars.length - 35), -5);
  const recentAverageVolume = average(recent5.map((bar) => bar.volume));
  const baselineVolume = average(prior30.map((bar) => bar.volume).filter((value) => value > 0));
  const relativeVolume = baselineVolume > 0 ? recentAverageVolume / baselineVolume : null;
  const momentum5Pct = priceReturn(recent5[0].open, last.close);

  const previous20 = bars.slice(-21, -1);
  const high20 = Math.max(...previous20.map((bar) => bar.high));
  const low20 = Math.min(...previous20.map((bar) => bar.low));
  const rangeLocation20 = high20 > low20 ? (last.close - low20) / (high20 - low20) : 0.5;

  const breakoutWithVolume = last.close > high20
    && (relativeVolume ?? 0) >= 1.45
    && momentum5Pct > 0;
  const pullbackResumption = (priceVsVwapPct ?? -1) >= 0
    && momentum5Pct >= 0.0025
    && (relativeVolume ?? 0) >= 1.15
    && rangeLocation20 >= 0.55;
  const absorptionConfirmed = absorption.direction === 'BULLISH'
    && absorption.absorptionCandidate
    && (priceVsVwapPct ?? -1) >= -0.006
    && rangeLocation20 >= 0.4;
  const bearishVolumeBreak = (priceVsVwapPct ?? 1) < -0.006
    && momentum5Pct <= -0.006
    && (relativeVolume ?? 0) >= 1.4
    && rangeLocation20 <= 0.32;

  let score = 0;
  if ((priceVsVwapPct ?? 0) > 0) score += 14;
  if ((relativeVolume ?? 0) >= 1.15) score += 12;
  if ((relativeVolume ?? 0) >= 1.5) score += 10;
  if (momentum5Pct >= 0.0025) score += 12;
  if (rangeLocation20 >= 0.6) score += 8;
  if (breakoutWithVolume) score += 22;
  if (pullbackResumption) score += 16;
  if (absorptionConfirmed) score += 24;
  if (bearishVolumeBreak) score -= 55;
  score = clamp(score, -100, 100);

  let action: EquityIntradayTimingAction = 'WAIT';
  if (bearishVolumeBreak) action = 'EXIT_WEAKNESS';
  else if (breakoutWithVolume || pullbackResumption || absorptionConfirmed) action = 'ENTER_NOW';
  else if ((priceVsVwapPct ?? -1) >= -0.003 && momentum5Pct >= -0.002) action = 'HOLD';

  const confidence = clamp(
    0.22
      + Math.min(0.2, bars.length / 600)
      + ((relativeVolume ?? 0) >= 1.15 ? 0.12 : 0)
      + (Math.abs(momentum5Pct) >= 0.0025 ? 0.1 : 0)
      + (breakoutWithVolume || pullbackResumption ? 0.16 : 0)
      + (absorptionConfirmed ? 0.18 : 0),
    0,
    0.9,
  );

  reasons.push(`Minute timing: price is ${((priceVsVwapPct ?? 0) * 100).toFixed(2)}% versus session VWAP.`);
  reasons.push(`Recent 5-minute average volume is ${(relativeVolume ?? 0).toFixed(2)}x the prior-session intraday baseline; 5-minute price change is ${(momentum5Pct * 100).toFixed(2)}%.`);
  if (breakoutWithVolume) reasons.push('Price broke the prior 20-minute high with strong relative volume.');
  if (pullbackResumption) reasons.push('Price reclaimed/held VWAP with positive short momentum and improving volume.');
  if (absorptionConfirmed) reasons.push('High-volume/low-price-response absorption pattern confirms a possible accumulation timing window.');
  if (bearishVolumeBreak) reasons.push('High-volume weakness below VWAP indicates distribution/breakdown risk rather than bullish absorption.');
  if (action === 'WAIT') reasons.push('Daily thesis may remain valid, but intraday volume/price timing is not strong enough to enter now.');

  return {
    action,
    score,
    confidence,
    vwap,
    priceVsVwapPct,
    relativeVolume,
    momentum5Pct,
    rangeLocation20,
    breakoutWithVolume,
    pullbackResumption,
    bearishVolumeBreak,
    absorptionConfirmed,
    reasons,
  };
};
