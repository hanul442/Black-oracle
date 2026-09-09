import type { Candle } from './types';

export type VolumeAbsorptionDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface VolumeAbsorptionSnapshot {
  direction: VolumeAbsorptionDirection;
  score: number;
  confidence: number;
  referenceSurgeVolume: number | null;
  referenceSurgeReturnPct: number | null;
  referenceSurgeTimestamp: number | null;
  currentCumulativeVolume: number;
  currentVsReferenceVolume: number | null;
  recentVolumeRatio: number | null;
  recentPriceChangePct: number | null;
  recentRangePct: number | null;
  closeLocation: number | null;
  lowerWickRatio: number | null;
  historicalPriceDiscountPct: number | null;
  absorptionCandidate: boolean;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const pctReturn = (from: number, to: number) => from > 0 ? (to - from) / from : 0;

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

/**
 * Finds a prior daily bar that combined a material bullish move with unusually
 * high volume. It is used only as a historical effort benchmark; it is not a
 * forward-looking target or execution signal.
 */
const findReferenceBullishSurge = (daily: Candle[]) => {
  if (daily.length < 40) return null;
  const sample = daily.slice(-120, -1);
  const volumes = sample.map((bar) => bar.volume).filter((value) => Number.isFinite(value) && value > 0);
  if (!volumes.length) return null;
  const sorted = volumes.slice().sort((a, b) => a - b);
  const p70 = sorted[Math.floor((sorted.length - 1) * 0.7)] ?? average(sorted);
  const candidates = sample
    .map((bar) => ({ bar, returnPct: pctReturn(bar.open, bar.close) }))
    .filter(({ bar, returnPct }) => returnPct >= 0.035 && bar.volume >= p70)
    .sort((a, b) => (b.returnPct * Math.log1p(b.bar.volume)) - (a.returnPct * Math.log1p(a.bar.volume)));
  return candidates[0] ?? null;
};

/**
 * Measures the user's hypothesis: if a stock is materially below a prior
 * strong-volume bullish reference, then very heavy current buying/turnover with
 * limited downside progress may indicate supply absorption / accumulation.
 *
 * This is intentionally a bounded timing feature. High volume with weak price
 * response can also be distribution, so bullish classification additionally
 * requires price-location and rejection evidence from recent intraday bars.
 */
export const buildVolumeAbsorptionSnapshot = (
  dailyCandles: Candle[],
  minuteCandles: Candle[],
): VolumeAbsorptionSnapshot => {
  const reasons: string[] = [];
  const reference = findReferenceBullishSurge(dailyCandles);
  const intraday = minuteCandles.filter((bar) => Number.isFinite(bar.volume) && bar.volume >= 0).slice(-120);
  const currentCumulativeVolume = intraday.reduce((sum, bar) => sum + bar.volume, 0);

  if (!reference || intraday.length < 12) {
    return {
      direction: 'NEUTRAL',
      score: 0,
      confidence: 0,
      referenceSurgeVolume: reference?.bar.volume ?? null,
      referenceSurgeReturnPct: reference?.returnPct ?? null,
      referenceSurgeTimestamp: reference?.bar.timestamp ?? null,
      currentCumulativeVolume,
      currentVsReferenceVolume: reference?.bar.volume ? currentCumulativeVolume / reference.bar.volume : null,
      recentVolumeRatio: null,
      recentPriceChangePct: null,
      recentRangePct: null,
      closeLocation: null,
      lowerWickRatio: null,
      historicalPriceDiscountPct: null,
      absorptionCandidate: false,
      reasons: ['Insufficient daily surge reference or intraday bars for volume-absorption classification.'],
    };
  }

  const recent = intraday.slice(-12);
  const baseline = intraday.slice(0, Math.max(1, intraday.length - 12));
  const baselineBarVolume = average(baseline.map((bar) => bar.volume).filter((value) => value > 0));
  const recentBarVolume = average(recent.map((bar) => bar.volume));
  const recentVolumeRatio = baselineBarVolume > 0 ? recentBarVolume / baselineBarVolume : null;

  const first = recent[0];
  const last = recent[recent.length - 1];
  const recentHigh = Math.max(...recent.map((bar) => bar.high));
  const recentLow = Math.min(...recent.map((bar) => bar.low));
  const recentRangePct = first.open > 0 ? (recentHigh - recentLow) / first.open : null;
  const recentPriceChangePct = pctReturn(first.open, last.close);
  const closeLocation = recentHigh > recentLow ? (last.close - recentLow) / (recentHigh - recentLow) : 0.5;

  const bodyLow = Math.min(last.open, last.close);
  const fullRange = Math.max(1e-12, last.high - last.low);
  const lowerWickRatio = Math.max(0, bodyLow - last.low) / fullRange;

  const currentPrice = last.close;
  const historicalPriceDiscountPct = reference.bar.close > 0
    ? (reference.bar.close - currentPrice) / reference.bar.close
    : null;
  const currentVsReferenceVolume = reference.bar.volume > 0
    ? currentCumulativeVolume / reference.bar.volume
    : null;

  const materiallyBelowReference = (historicalPriceDiscountPct ?? 0) >= 0.08;
  const heavyRelativeVolume = (recentVolumeRatio ?? 0) >= 1.5 || (currentVsReferenceVolume ?? 0) >= 1.0;
  const extremeVolume = (recentVolumeRatio ?? 0) >= 2.0 || (currentVsReferenceVolume ?? 0) >= 2.0;
  const limitedPriceProgress = Math.abs(recentPriceChangePct) <= 0.018
    && (recentRangePct ?? 1) <= 0.045;
  const lowerPriceRejection = closeLocation >= 0.55 || lowerWickRatio >= 0.28;
  const notBreakingDown = recentPriceChangePct >= -0.012 && closeLocation >= 0.45;

  const absorptionCandidate = materiallyBelowReference
    && heavyRelativeVolume
    && limitedPriceProgress
    && lowerPriceRejection
    && notBreakingDown;

  let score = 0;
  if (materiallyBelowReference) score += 16;
  if ((currentVsReferenceVolume ?? 0) >= 1) score += 14;
  if ((currentVsReferenceVolume ?? 0) >= 2) score += 12;
  if ((recentVolumeRatio ?? 0) >= 1.5) score += 16;
  if ((recentVolumeRatio ?? 0) >= 2) score += 10;
  if (limitedPriceProgress) score += 16;
  if (closeLocation >= 0.6) score += 12;
  if (lowerWickRatio >= 0.28) score += 8;
  if (!notBreakingDown) score -= 35;
  if (closeLocation < 0.3 && recentPriceChangePct < -0.015) score -= 30;
  score = clamp(score, -100, 100);

  let direction: VolumeAbsorptionDirection = 'NEUTRAL';
  if (absorptionCandidate && score >= 55) direction = 'BULLISH';
  else if (score <= -35) direction = 'BEARISH';

  const confidence = clamp(
    0.18
      + Math.min(0.25, intraday.length / 240)
      + (materiallyBelowReference ? 0.12 : 0)
      + (heavyRelativeVolume ? 0.16 : 0)
      + (limitedPriceProgress ? 0.12 : 0)
      + (lowerPriceRejection ? 0.1 : 0),
    0,
    0.88,
  );

  reasons.push(`Prior bullish surge benchmark: ${(reference.returnPct * 100).toFixed(1)}% with volume ${Math.round(reference.bar.volume).toLocaleString()}.`);
  reasons.push(`Current intraday cumulative volume is ${(currentVsReferenceVolume ?? 0).toFixed(2)}x that historical surge-day volume.`);
  reasons.push(`Recent minute-bar volume intensity is ${(recentVolumeRatio ?? 0).toFixed(2)}x its earlier-session baseline while price moved ${(recentPriceChangePct * 100).toFixed(2)}%.`);
  if (materiallyBelowReference) reasons.push(`Current price remains ${(Math.max(0, historicalPriceDiscountPct ?? 0) * 100).toFixed(1)}% below the historical surge close.`);
  if (absorptionCandidate) reasons.push('Heavy volume with limited downside progress and price rejection is consistent with a bullish absorption candidate.');
  else reasons.push('Volume alone is insufficient: price response/rejection conditions did not confirm bullish absorption.');
  reasons.push('This feature can strengthen or delay timing only; it cannot independently authorize an equity entry.');

  return {
    direction,
    score,
    confidence,
    referenceSurgeVolume: reference.bar.volume,
    referenceSurgeReturnPct: reference.returnPct,
    referenceSurgeTimestamp: reference.bar.timestamp,
    currentCumulativeVolume,
    currentVsReferenceVolume,
    recentVolumeRatio,
    recentPriceChangePct,
    recentRangePct,
    closeLocation,
    lowerWickRatio,
    historicalPriceDiscountPct,
    absorptionCandidate,
    reasons,
  };
};
