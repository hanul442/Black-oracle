import type {
  MeanReversionSignal,
  MomentumSignal,
  RegimeSnapshot,
  SignalFusionSnapshot,
  StrategyWeightSet,
  TrendSignal,
} from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Crypto spot is technical-first. Event/news evidence is supplementary, never dominant. */
const baseWeightsForRegime = (regime: RegimeSnapshot['regime']): StrategyWeightSet => {
  switch (regime) {
    case 'STRONG_UPTREND':
    case 'STRONG_DOWNTREND':
      return { trend: 0.50, momentum: 0.35, meanReversion: 0.10, event: 0.05 };
    case 'UPTREND':
    case 'DOWNTREND':
      return { trend: 0.45, momentum: 0.32, meanReversion: 0.15, event: 0.08 };
    case 'RANGE':
    default:
      return { trend: 0.18, momentum: 0.22, meanReversion: 0.52, event: 0.08 };
  }
};

const redistributeMissingEventWeight = (weights: StrategyWeightSet): StrategyWeightSet => {
  const technicalTotal = weights.trend + weights.momentum + weights.meanReversion;
  if (technicalTotal <= 0) return { trend: 1 / 3, momentum: 1 / 3, meanReversion: 1 / 3, event: 0 };
  return {
    trend: weights.trend + weights.event * (weights.trend / technicalTotal),
    momentum: weights.momentum + weights.event * (weights.momentum / technicalTotal),
    meanReversion: weights.meanReversion + weights.event * (weights.meanReversion / technicalTotal),
    event: 0,
  };
};

const meanReversionDirectionalScore = (signal: MeanReversionSignal) => {
  if (signal.action === 'BUY') return signal.score;
  if (signal.action === 'SELL') return -signal.score;
  return 0;
};

export const buildSignalFusion = (
  trend: TrendSignal,
  momentum: MomentumSignal,
  meanReversion: MeanReversionSignal,
  regime: RegimeSnapshot,
  eventScore?: number,
): SignalFusionSnapshot => {
  const hasEventScore = Number.isFinite(eventScore);
  const baseWeights = baseWeightsForRegime(regime.regime);
  const weights = hasEventScore ? baseWeights : redistributeMissingEventWeight(baseWeights);
  const normalizedEventScore = hasEventScore ? clamp(eventScore as number, -100, 100) : 0;
  const reversionDirectional = meanReversionDirectionalScore(meanReversion);

  const rawDirectional =
    trend.directionalScore * weights.trend +
    momentum.directionalScore * weights.momentum +
    reversionDirectional * weights.meanReversion +
    normalizedEventScore * weights.event;

  const directionalScore = Math.round(clamp(rawDirectional, -100, 100));
  const oracleTradeScore = Math.round(clamp((directionalScore + 100) / 2, 0, 100));
  const action = directionalScore >= 25 ? 'BUY' : directionalScore <= -25 ? 'SELL' : 'WAIT';

  const componentSigns = [trend.directionalScore, momentum.directionalScore, reversionDirectional, normalizedEventScore]
    .filter((value, index) => index < 3 || hasEventScore)
    .filter((value) => Math.abs(value) >= 20)
    .map((value) => Math.sign(value));
  const hasConflict = componentSigns.includes(1) && componentSigns.includes(-1);

  const averageComponentConfidence =
    trend.confidence * weights.trend +
    momentum.confidence * weights.momentum +
    meanReversion.confidence * weights.meanReversion +
    (hasEventScore ? 0.65 * weights.event : 0);
  const confidence = clamp(
    averageComponentConfidence + Math.abs(directionalScore) / 300 - (hasConflict ? 0.12 : 0) - (regime.highVolatility ? 0.08 : 0),
    0,
    0.95,
  );

  // This multiplier is diagnostic only for Unified sizing; actual notional is set
  // by equal-notional + stop-risk caps rather than confidence scaling.
  const positionRiskMultiplier = regime.highVolatility ? 0.5 : hasConflict ? 0.75 : 1;
  const reasons = [
    `Crypto technical-first weights are ${Math.round(weights.trend * 100)}/${Math.round(weights.momentum * 100)}/${Math.round(weights.meanReversion * 100)}/${Math.round(weights.event * 100)} for trend/momentum/mean-reversion/event.`,
    hasEventScore ? 'External evidence is supplementary context and carries only a small crypto weight.' : 'No external evidence is required; its small weight is redistributed across technical engines.',
  ];
  if (hasConflict) reasons.push('Directional disagreement across technical engines reduces confidence but no longer directly shrinks notional.');
  if (regime.highVolatility) reasons.push('High volatility is recorded for risk diagnostics; stop-distance risk limits control actual capital size.');

  return {
    action,
    directionalScore,
    oracleTradeScore,
    confidence,
    positionRiskMultiplier,
    weights,
    components: {
      trend: trend.directionalScore,
      momentum: momentum.directionalScore,
      meanReversion: reversionDirectional,
      event: normalizedEventScore,
    },
    reasons,
  };
};
