import type { MultiTimeframeSnapshot, TradingSnapshot } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const buildMultiTimeframeConsensus = (
  fourHour: TradingSnapshot,
  oneHour: TradingSnapshot,
  fifteenMinute: TradingSnapshot,
): MultiTimeframeSnapshot => {
  const weights = { fourHour: 0.45, oneHour: 0.35, fifteenMinute: 0.2 };
  const directionalScore = Math.round(
    fourHour.fusion.directionalScore * weights.fourHour +
      oneHour.fusion.directionalScore * weights.oneHour +
      fifteenMinute.fusion.directionalScore * weights.fifteenMinute,
  );
  const oracleTradeScore = Math.round(clamp((directionalScore + 100) / 2, 0, 100));

  const weightedConfidence =
    fourHour.fusion.confidence * weights.fourHour +
    oneHour.fusion.confidence * weights.oneHour +
    fifteenMinute.fusion.confidence * weights.fifteenMinute;

  const signs = [fourHour.fusion.directionalScore, oneHour.fusion.directionalScore, fifteenMinute.fusion.directionalScore]
    .map((score) => (Math.abs(score) < 15 ? 0 : Math.sign(score)));
  const nonZero = signs.filter((sign) => sign !== 0);
  const aligned = nonZero.length >= 2 && nonZero.every((sign) => sign === nonZero[0]);
  const oppositeHigherTimeframe =
    directionalScore > 0
      ? fourHour.fusion.directionalScore <= -15 || oneHour.fusion.directionalScore <= -15
      : directionalScore < 0
        ? fourHour.fusion.directionalScore >= 15 || oneHour.fusion.directionalScore >= 15
        : false;

  const confidence = clamp(
    weightedConfidence + (aligned ? 0.08 : 0) - (oppositeHigherTimeframe ? 0.16 : 0),
    0,
    0.95,
  );

  const action = directionalScore >= 25 && !oppositeHigherTimeframe
    ? 'BUY'
    : directionalScore <= -25 && !oppositeHigherTimeframe
      ? 'SELL'
      : 'WAIT';

  const baseRiskMultiplier = Math.min(
    fourHour.fusion.positionRiskMultiplier,
    oneHour.fusion.positionRiskMultiplier,
    fifteenMinute.fusion.positionRiskMultiplier,
  );
  const positionRiskMultiplier = clamp(
    baseRiskMultiplier * (aligned ? 1 : 0.75) * (oppositeHigherTimeframe ? 0.5 : 1),
    0.25,
    1,
  );

  const reasons = [
    `4H/1H/15M directional scores: ${fourHour.fusion.directionalScore}/${oneHour.fusion.directionalScore}/${fifteenMinute.fusion.directionalScore}.`,
    'Consensus weights are 45% / 35% / 20%, giving higher timeframes most of the authority.',
  ];
  if (aligned) reasons.push('At least two meaningful timeframe signals are directionally aligned.');
  if (oppositeHigherTimeframe) reasons.push('A higher timeframe opposes the aggregate direction, so new entries are blocked.');

  return {
    market: oneHour.market,
    asOf: Math.max(fourHour.asOf, oneHour.asOf, fifteenMinute.asOf),
    action,
    directionalScore,
    oracleTradeScore,
    confidence,
    aligned,
    positionRiskMultiplier,
    frames: {
      fourHour,
      oneHour,
      fifteenMinute,
    },
    reasons,
  };
};
