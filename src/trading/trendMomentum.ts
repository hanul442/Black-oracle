import type { IndicatorSnapshot, MomentumSignal, RegimeSnapshot, TrendSignal } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const actionFromDirectionalScore = (score: number) => {
  if (score >= 25) return 'BUY' as const;
  if (score <= -25) return 'SELL' as const;
  return 'WAIT' as const;
};

export const buildTrendSignal = (
  indicators: IndicatorSnapshot,
  regime: RegimeSnapshot,
): TrendSignal => {
  let score = 0;
  const reasons: string[] = [];

  score += indicators.close >= indicators.ema20 ? 15 : -15;
  score += indicators.ema20 >= indicators.ema50 ? 25 : -25;
  score += indicators.ema50 >= indicators.ema200 ? 30 : -30;
  score += indicators.close >= indicators.ema200 ? 15 : -15;

  const regimeDirection =
    regime.regime === 'STRONG_UPTREND' ? 1 :
      regime.regime === 'UPTREND' ? 0.6 :
        regime.regime === 'STRONG_DOWNTREND' ? -1 :
          regime.regime === 'DOWNTREND' ? -0.6 : 0;
  score += regimeDirection * 15 * Math.max(0.4, regime.trendStrength);
  score = Math.round(clamp(score, -100, 100));

  if (indicators.ema20 > indicators.ema50 && indicators.ema50 > indicators.ema200) {
    reasons.push('EMA 20/50/200 structure is bullish-aligned.');
  } else if (indicators.ema20 < indicators.ema50 && indicators.ema50 < indicators.ema200) {
    reasons.push('EMA 20/50/200 structure is bearish-aligned.');
  } else {
    reasons.push('EMA structure is mixed, reducing directional trend conviction.');
  }
  reasons.push(`Regime classifier reports ${regime.regime} with ${(regime.confidence * 100).toFixed(0)}% confidence.`);

  return {
    action: actionFromDirectionalScore(score),
    directionalScore: score,
    strength: Math.abs(score),
    confidence: clamp(0.45 + Math.abs(score) / 200 - (regime.highVolatility ? 0.08 : 0), 0, 1),
    reasons,
  };
};

export const buildMomentumSignal = (indicators: IndicatorSnapshot): MomentumSignal => {
  let score = 0;
  const reasons: string[] = [];

  const rsiImpulse = clamp((indicators.rsi14 - 50) / 20, -1, 1);
  const macdImpulse = indicators.atr14 > 0
    ? clamp(indicators.macdHistogram / indicators.atr14, -1, 1)
    : 0;
  const rocImpulse = clamp(indicators.roc20 / 0.08, -1, 1);
  const volumeConfirmation = clamp(indicators.volumeZScore / 3, -1, 1);

  score = Math.round(clamp(
    rsiImpulse * 25 +
    macdImpulse * 30 +
    rocImpulse * 35 +
    volumeConfirmation * 10,
    -100,
    100,
  ));

  if (Math.abs(indicators.roc20) >= 0.02) {
    reasons.push(`20-period rate of change is ${(indicators.roc20 * 100).toFixed(2)}%.`);
  }
  if (Math.abs(indicators.macdHistogram) > 0) {
    reasons.push(`MACD histogram is ${indicators.macdHistogram > 0 ? 'positive' : 'negative'}.`);
  }
  if (indicators.rsi14 >= 55 || indicators.rsi14 <= 45) {
    reasons.push(`RSI ${indicators.rsi14.toFixed(1)} confirms ${indicators.rsi14 >= 55 ? 'positive' : 'negative'} momentum bias.`);
  }
  if (Math.abs(indicators.volumeZScore) >= 1) {
    reasons.push(`Volume is ${indicators.volumeZScore.toFixed(2)} standard deviations from its recent mean.`);
  }
  if (reasons.length === 0) reasons.push('Momentum inputs are close to neutral.');

  return {
    action: actionFromDirectionalScore(score),
    directionalScore: score,
    strength: Math.abs(score),
    confidence: clamp(0.45 + Math.abs(score) / 180, 0, 0.95),
    reasons,
  };
};
