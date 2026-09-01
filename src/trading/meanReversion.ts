import type { IndicatorSnapshot, MeanReversionSignal, RegimeSnapshot } from './types';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const overboughtComponents = (indicators: IndicatorSnapshot) => ({
  rsi: clamp01((indicators.rsi14 - 60) / 20),
  stochRsi: clamp01((indicators.stochRsi14 - 70) / 30),
  bollinger: clamp01((indicators.bollingerPercentB - 0.85) / 0.3),
});

const oversoldComponents = (indicators: IndicatorSnapshot) => ({
  rsi: clamp01((40 - indicators.rsi14) / 20),
  stochRsi: clamp01((30 - indicators.stochRsi14) / 30),
  bollinger: clamp01((0.15 - indicators.bollingerPercentB) / 0.3),
});

const weightedExtreme = (components: { rsi: number; stochRsi: number; bollinger: number }) =>
  components.rsi * 0.4 + components.stochRsi * 0.3 + components.bollinger * 0.3;

const trendPenaltyFor = (
  side: 'OVERBOUGHT' | 'OVERSOLD',
  regime: RegimeSnapshot['regime'],
) => {
  if (side === 'OVERBOUGHT') {
    if (regime === 'STRONG_UPTREND') return 0.45;
    if (regime === 'UPTREND') return 0.7;
  }
  if (side === 'OVERSOLD') {
    if (regime === 'STRONG_DOWNTREND') return 0.45;
    if (regime === 'DOWNTREND') return 0.7;
  }
  return regime === 'RANGE' ? 1 : 0.9;
};

export const buildMeanReversionSignal = (
  indicators: IndicatorSnapshot,
  regime: RegimeSnapshot,
): MeanReversionSignal => {
  const overbought = weightedExtreme(overboughtComponents(indicators));
  const oversold = weightedExtreme(oversoldComponents(indicators));
  const side = overbought > oversold ? 'OVERBOUGHT' : 'OVERSOLD';
  const extreme = Math.max(overbought, oversold);
  const reasons: string[] = [];

  if (extreme < 0.45) {
    return {
      action: 'WAIT',
      state: 'NEUTRAL',
      score: Math.round(extreme * 100),
      confidence: 0.5,
      rawExtremeScore: Math.round(extreme * 100),
      trendPenalty: 1,
      reasons: ['RSI, Stoch RSI, and Bollinger position do not form a strong price-extreme cluster.'],
    };
  }

  const trendPenalty = trendPenaltyFor(side, regime.regime);
  const reversalConfirmed =
    (side === 'OVERBOUGHT' && indicators.macdHistogram < 0) ||
    (side === 'OVERSOLD' && indicators.macdHistogram > 0);
  const volumeExhaustion = indicators.volumeZScore < -0.5;
  const confirmationBoost = (reversalConfirmed ? 0.12 : 0) + (volumeExhaustion ? 0.06 : 0);
  const adjusted = clamp01(extreme * trendPenalty * (1 + confirmationBoost));

  if (side === 'OVERBOUGHT') {
    reasons.push(`RSI ${indicators.rsi14.toFixed(1)}, Stoch RSI ${indicators.stochRsi14.toFixed(1)}, and Bollinger %B ${indicators.bollingerPercentB.toFixed(2)} indicate upside extension.`);
  } else {
    reasons.push(`RSI ${indicators.rsi14.toFixed(1)}, Stoch RSI ${indicators.stochRsi14.toFixed(1)}, and Bollinger %B ${indicators.bollingerPercentB.toFixed(2)} indicate downside extension.`);
  }

  if (trendPenalty < 1) {
    reasons.push(`Mean-reversion score is discounted because the ${regime.regime} regime can keep an extreme condition extended.`);
  }
  if (reversalConfirmed) reasons.push('MACD histogram provides reversal-direction confirmation.');
  if (volumeExhaustion) reasons.push('Below-normal volume adds a mild exhaustion confirmation.');

  const strongContinuationConflict =
    (side === 'OVERBOUGHT' && regime.regime === 'STRONG_UPTREND') ||
    (side === 'OVERSOLD' && regime.regime === 'STRONG_DOWNTREND');

  const actionable = adjusted >= 0.6 && (!strongContinuationConflict || reversalConfirmed);
  const action = actionable ? (side === 'OVERSOLD' ? 'BUY' : 'SELL') : 'WAIT';
  if (strongContinuationConflict && !reversalConfirmed) {
    reasons.push('Extreme reading is informational only; no reversal trade is allowed without confirmation against the strong trend.');
  }

  return {
    action,
    state: side,
    score: Math.round(adjusted * 100),
    confidence: clamp01(0.45 + adjusted * 0.4 + (reversalConfirmed ? 0.08 : 0) - (regime.highVolatility ? 0.08 : 0)),
    rawExtremeScore: Math.round(extreme * 100),
    trendPenalty,
    reasons,
  };
};
