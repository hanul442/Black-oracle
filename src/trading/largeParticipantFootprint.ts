import type { Candle } from './types';

export type FootprintDirection = 'ACCUMULATION' | 'DISTRIBUTION' | 'MIXED' | 'NONE';
export type FootprintConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface LargeParticipantFootprintSnapshot {
  available: boolean;
  direction: FootprintDirection;
  score: number;
  confidence: FootprintConfidence;
  abnormalVolumeRatio: number | null;
  closeLocationValue: number | null;
  priceChangePct: number | null;
  volumeExpansionPersistence: number | null;
  absorptionLike: boolean;
  breakoutParticipation: boolean;
  warnings: string[];
  reasons: string[];
  actorIdentity: null;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const pct = (from: number, to: number) => from > 0 ? (to - from) / from : 0;

/**
 * Detects abnormal volume/price behaviour that can be consistent with large-participant
 * accumulation or distribution. It intentionally never identifies an actor. Foreign,
 * institution, program-trading, ownership or broker data must be supplied separately
 * before an actor can be named.
 */
export const buildLargeParticipantFootprint = (candles: Candle[], lookback = 20): LargeParticipantFootprintSnapshot => {
  const clean = candles.filter((candle) => Number.isFinite(candle.close) && candle.close > 0 && Number.isFinite(candle.volume) && candle.volume >= 0);
  if (clean.length < Math.max(8, lookback + 1)) {
    return {
      available: false,
      direction: 'NONE',
      score: 0,
      confidence: 'LOW',
      abnormalVolumeRatio: null,
      closeLocationValue: null,
      priceChangePct: null,
      volumeExpansionPersistence: null,
      absorptionLike: false,
      breakoutParticipation: false,
      warnings: ['Insufficient candle history for a defensible large-participant footprint estimate.'],
      reasons: [],
      actorIdentity: null,
    };
  }

  const latest = clean[clean.length - 1];
  const prior = clean.slice(-(lookback + 1), -1);
  const baselineVolume = avg(prior.map((candle) => candle.volume));
  const abnormalVolumeRatio = baselineVolume > 0 ? latest.volume / baselineVolume : 0;
  const highLowRange = Math.max(1e-9, latest.high - latest.low);
  const closeLocationValue = clamp((latest.close - latest.low) / highLowRange, 0, 1);
  const priceChangePct = pct(clean[clean.length - 2].close, latest.close);

  const recentFive = clean.slice(-5);
  const expandedBars = recentFive.filter((candle) => candle.volume >= baselineVolume * 1.25).length;
  const volumeExpansionPersistence = expandedBars / Math.max(1, recentFive.length);

  const priorHigh = Math.max(...prior.map((candle) => candle.high));
  const priorLow = Math.min(...prior.map((candle) => candle.low));
  const breakoutParticipation = latest.close > priorHigh && abnormalVolumeRatio >= 1.5;
  const breakdownParticipation = latest.close < priorLow && abnormalVolumeRatio >= 1.5;

  const smallBody = Math.abs(latest.close - latest.open) / Math.max(latest.close, 1) <= 0.012;
  const absorptionLike = abnormalVolumeRatio >= 1.8 && smallBody;

  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (abnormalVolumeRatio >= 2) {
    score += 24;
    reasons.push(`Latest volume is ${abnormalVolumeRatio.toFixed(2)}x the ${lookback}-bar baseline.`);
  } else if (abnormalVolumeRatio >= 1.5) {
    score += 14;
    reasons.push(`Latest volume is materially above baseline at ${abnormalVolumeRatio.toFixed(2)}x.`);
  }

  if (volumeExpansionPersistence >= 0.6) {
    score += 12;
    reasons.push('Volume expansion is persistent across recent bars rather than isolated to one print.');
  }

  if (closeLocationValue >= 0.72 && abnormalVolumeRatio >= 1.4) {
    score += 18;
    reasons.push('High-volume candle closed near the top of its range, consistent with demand absorbing supply.');
  }
  if (closeLocationValue <= 0.28 && abnormalVolumeRatio >= 1.4) {
    score -= 18;
    reasons.push('High-volume candle closed near the bottom of its range, consistent with supply overwhelming demand.');
  }

  if (breakoutParticipation) {
    score += 20;
    reasons.push('Price broke above the prior lookback high with meaningful volume participation.');
  }
  if (breakdownParticipation) {
    score -= 20;
    reasons.push('Price broke below the prior lookback low with meaningful volume participation.');
  }

  if (absorptionLike) {
    if (closeLocationValue >= 0.55) score += 12;
    else if (closeLocationValue <= 0.45) score -= 12;
    reasons.push('Very high volume with a relatively contained candle body resembles absorption; direction is inferred only from close location.');
  }

  if (abnormalVolumeRatio >= 2.5 && Math.abs(priceChangePct) < 0.005) {
    warnings.push('Extreme volume with little net price movement can indicate two-sided transfer. Do not label this accumulation without follow-through.');
  }

  score = clamp(score, -100, 100);
  const absScore = Math.abs(score);
  const direction: FootprintDirection = absScore < 20
    ? 'NONE'
    : score >= 45
      ? 'ACCUMULATION'
      : score <= -45
        ? 'DISTRIBUTION'
        : 'MIXED';
  const confidence: FootprintConfidence = absScore >= 60 && abnormalVolumeRatio >= 1.8
    ? 'HIGH'
    : absScore >= 35
      ? 'MEDIUM'
      : 'LOW';

  warnings.push('This is a behavioural footprint proxy, not proof of a specific “세력”, institution, foreign investor, broker, or manipulator.');

  return {
    available: true,
    direction,
    score,
    confidence,
    abnormalVolumeRatio,
    closeLocationValue,
    priceChangePct,
    volumeExpansionPersistence,
    absorptionLike,
    breakoutParticipation,
    warnings,
    reasons,
    actorIdentity: null,
  };
};
