import type { MultiCycleSnapshot, TradingSnapshot } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const frameScore = (snapshot: TradingSnapshot) => {
  const momentum = snapshot.momentum.directionalScore;
  const fusion = snapshot.fusion.directionalScore;
  const structure = snapshot.structure?.bias === 'BULLISH' ? 70 : snapshot.structure?.bias === 'BEARISH' ? -70 : 0;
  return Math.round(clamp(momentum * 0.45 + fusion * 0.35 + structure * 0.2, -100, 100));
};

const meaningfulSign = (score: number) => Math.abs(score) < 15 ? 0 : Math.sign(score);

export const buildMultiCycleResonance = (
  fourHour: TradingSnapshot,
  oneHour: TradingSnapshot,
  fifteenMinute: TradingSnapshot,
): MultiCycleSnapshot => {
  const frames = {
    fourHour: frameScore(fourHour),
    oneHour: frameScore(oneHour),
    fifteenMinute: frameScore(fifteenMinute),
  };
  const weights = { fourHour: 0.45, oneHour: 0.35, fifteenMinute: 0.2 };
  const directionalScore = Math.round(clamp(
    frames.fourHour * weights.fourHour + frames.oneHour * weights.oneHour + frames.fifteenMinute * weights.fifteenMinute,
    -100,
    100,
  ));

  const signs = [frames.fourHour, frames.oneHour, frames.fifteenMinute].map(meaningfulSign);
  const meaningful = signs.filter((sign) => sign !== 0);
  const aligned = meaningful.length >= 2 && meaningful.every((sign) => sign === meaningful[0]);
  const higherDirection = meaningfulSign(frames.fourHour * 0.56 + frames.oneHour * 0.44);
  const tacticalDirection = meaningfulSign(frames.fifteenMinute);
  const pullback = higherDirection !== 0 && tacticalDirection !== 0 && higherDirection !== tacticalDirection;

  const state: MultiCycleSnapshot['state'] = aligned && directionalScore >= 20
    ? 'ALIGNED_BULLISH'
    : aligned && directionalScore <= -20
      ? 'ALIGNED_BEARISH'
      : pullback
        ? 'PULLBACK'
        : Math.abs(directionalScore) < 15
          ? 'NEUTRAL'
          : 'MIXED';

  const entryTiming: MultiCycleSnapshot['entryTiming'] = state === 'ALIGNED_BULLISH'
    ? 'READY'
    : state === 'PULLBACK' && higherDirection > 0
      ? 'WAIT_PULLBACK'
      : state === 'MIXED' || state === 'PULLBACK'
        ? 'WAIT_CONFIRMATION'
        : 'NO_EDGE';

  const frameConfidence =
    fourHour.fusion.confidence * weights.fourHour
    + oneHour.fusion.confidence * weights.oneHour
    + fifteenMinute.fusion.confidence * weights.fifteenMinute;
  const confidence = clamp(frameConfidence + (aligned ? 0.08 : 0) - (pullback ? 0.08 : 0), 0, 0.95);

  const reasons = [
    `Cycle scores 4H/1H/15M are ${frames.fourHour}/${frames.oneHour}/${frames.fifteenMinute}.`,
    `Higher horizons retain 45/35/20 authority; tactical disagreement is treated as timing information rather than an automatic reversal.`,
  ];
  if (aligned) reasons.push('At least two meaningful cycle scores are directionally aligned.');
  if (pullback) reasons.push('15M opposes the higher-cycle direction, so the state is treated as a pullback/confirmation wait.');

  return {
    state,
    directionalScore,
    confidence,
    aligned,
    entryTiming,
    frames,
    reasons,
  };
};
