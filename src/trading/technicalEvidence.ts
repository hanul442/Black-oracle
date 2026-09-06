import type {
  IndicatorSnapshot,
  MarketStructureSnapshot,
  MomentumSignal,
  RegimeSnapshot,
  TechnicalEvidenceItem,
  TechnicalEvidenceSnapshot,
  TrendSignal,
} from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const signFor = (direction: TechnicalEvidenceItem['direction']) => direction === 'BULLISH' ? 1 : direction === 'BEARISH' ? -1 : 0;

export interface TechnicalEvidenceInput {
  market: string;
  timeframeMinutes: number;
  asOf: number;
  indicators: IndicatorSnapshot;
  structure: MarketStructureSnapshot;
  trend: TrendSignal;
  momentum: MomentumSignal;
  regime: RegimeSnapshot;
}

export const buildTechnicalEvidence = (input: TechnicalEvidenceInput): TechnicalEvidenceSnapshot => {
  const { indicators, structure, trend, momentum, regime } = input;
  const ttl = Math.max(60_000, input.timeframeMinutes * 60_000 * 2);
  const expiresAt = input.asOf + ttl;
  const prefix = `${input.market}-${input.timeframeMinutes}-${input.asOf}`;
  const items: TechnicalEvidenceItem[] = [];

  const structureDirection: TechnicalEvidenceItem['direction'] = structure.bias;
  items.push({
    id: `${prefix}-structure`,
    family: 'STRUCTURE',
    direction: structureDirection,
    strength: Math.round(clamp((structure.lastEvent ? 65 : 35) + (structure.liquiditySweep ? 10 : 0), 0, 100)),
    confidence: structure.confidence,
    observedAt: input.asOf,
    expiresAt,
    sourceFields: ['confirmed swing pivots', 'BOS/CHOCH close confirmation', 'liquidity sweep'],
    reason: structure.lastEvent
      ? `${structure.lastEvent.type} ${structure.lastEvent.direction} is the latest confirmed structural event.`
      : 'No confirmed structural break is active.',
  });

  const trendDirection: TechnicalEvidenceItem['direction'] = trend.directionalScore >= 20
    ? 'BULLISH'
    : trend.directionalScore <= -20
      ? 'BEARISH'
      : 'NEUTRAL';
  items.push({
    id: `${prefix}-trend`,
    family: 'TREND',
    direction: trendDirection,
    strength: Math.round(clamp(Math.abs(trend.directionalScore), 0, 100)),
    confidence: trend.confidence,
    observedAt: input.asOf,
    expiresAt,
    sourceFields: ['EMA20', 'EMA50', 'EMA200', 'regime trend strength'],
    reason: `Trend engine directional score is ${trend.directionalScore}; correlated EMA inputs are collapsed into one trend family.`,
  });

  const momentumDirection: TechnicalEvidenceItem['direction'] = momentum.directionalScore >= 20
    ? 'BULLISH'
    : momentum.directionalScore <= -20
      ? 'BEARISH'
      : 'NEUTRAL';
  items.push({
    id: `${prefix}-momentum`,
    family: 'MOMENTUM',
    direction: momentumDirection,
    strength: Math.round(clamp(Math.abs(momentum.directionalScore), 0, 100)),
    confidence: momentum.confidence,
    observedAt: input.asOf,
    expiresAt,
    sourceFields: ['MACD histogram', 'ROC20', 'RSI14', 'Stoch RSI14'],
    reason: `Momentum engine directional score is ${momentum.directionalScore}; oscillator transforms are counted as one evidence family.`,
  });

  const locationDirection: TechnicalEvidenceItem['direction'] = structure.location.zone === 'DISCOUNT'
    ? 'BULLISH'
    : structure.location.zone === 'PREMIUM'
      ? 'BEARISH'
      : 'NEUTRAL';
  items.push({
    id: `${prefix}-location`,
    family: 'LOCATION',
    direction: locationDirection,
    strength: Math.round(clamp(Math.abs(structure.location.percentile - 0.5) * 180, 0, 90)),
    confidence: structure.lastSwingHigh && structure.lastSwingLow ? 0.72 : 0.48,
    observedAt: input.asOf,
    expiresAt,
    sourceFields: ['confirmed range high', 'confirmed range low', 'range percentile'],
    reason: `Price is in ${structure.location.zone} at ${(structure.location.percentile * 100).toFixed(1)}% of the confirmed range.`,
  });

  const volumeDirection: TechnicalEvidenceItem['direction'] = indicators.volumeZScore >= 1
    ? (trendDirection === 'BEARISH' ? 'BEARISH' : 'BULLISH')
    : indicators.volumeZScore <= -1
      ? 'NEUTRAL'
      : 'NEUTRAL';
  items.push({
    id: `${prefix}-volume`,
    family: 'VOLUME',
    direction: volumeDirection,
    strength: Math.round(clamp(Math.abs(indicators.volumeZScore) * 30, 0, 100)),
    confidence: clamp(0.45 + Math.min(0.35, Math.abs(indicators.volumeZScore) * 0.08), 0, 0.8),
    observedAt: input.asOf,
    expiresAt,
    sourceFields: ['volume Z-score'],
    reason: `Volume Z-score is ${indicators.volumeZScore.toFixed(2)}; volume is contextual evidence, not an independent directional trigger by itself.`,
  });

  const volatilityDirection: TechnicalEvidenceItem['direction'] = 'NEUTRAL';
  items.push({
    id: `${prefix}-volatility`,
    family: 'VOLATILITY',
    direction: volatilityDirection,
    strength: Math.round(clamp(indicators.atrPct * 10_000, 0, 100)),
    confidence: regime.highVolatility ? 0.8 : 0.6,
    observedAt: input.asOf,
    expiresAt,
    sourceFields: ['ATR14', 'Bollinger bandwidth', 'regime volatility state'],
    reason: regime.highVolatility
      ? 'High-volatility regime is active and should reduce downstream risk budget.'
      : 'Volatility regime is not elevated; this family modifies risk rather than direction.',
  });

  const rawSignalCount = 4 + 4 + 3 + 3 + 1 + 3;
  const independentFamilyCount = items.length;
  const correlatedSignalPenalty = clamp(1 - independentFamilyCount / rawSignalCount, 0, 0.9);
  const directionalItems = items.filter((item) => item.direction !== 'NEUTRAL');
  const weighted = directionalItems.reduce((sum, item) => sum + signFor(item.direction) * (item.strength / 100) * item.confidence, 0);
  const denominator = directionalItems.reduce((sum, item) => sum + (item.strength / 100) * item.confidence, 0);
  const directionalScore = denominator > 0 ? Math.round(clamp(weighted / denominator * 100, -100, 100)) : 0;
  const familyAgreement = directionalItems.length > 0
    ? Math.abs(directionalItems.reduce((sum, item) => sum + signFor(item.direction), 0)) / directionalItems.length
    : 0;
  const averageConfidence = items.reduce((sum, item) => sum + item.confidence, 0) / items.length;
  const confidence = clamp(averageConfidence * 0.7 + familyAgreement * 0.3, 0, 0.95);

  const bullishFamilies = items.filter((item) => item.direction === 'BULLISH').length;
  const bearishFamilies = items.filter((item) => item.direction === 'BEARISH').length;
  const neutralFamilies = items.length - bullishFamilies - bearishFamilies;

  return {
    items,
    rawSignalCount,
    independentFamilyCount,
    correlatedSignalPenalty,
    bullishFamilies,
    bearishFamilies,
    neutralFamilies,
    directionalScore,
    confidence,
    reasons: [
      `${rawSignalCount} raw technical transforms are collapsed into ${independentFamilyCount} independent evidence families.`,
      `Correlation penalty is ${(correlatedSignalPenalty * 100).toFixed(1)}%; duplicate transforms cannot inflate evidence count.`,
      `Family vote is ${bullishFamilies} bullish / ${bearishFamilies} bearish / ${neutralFamilies} neutral with directional score ${directionalScore}.`,
    ],
  };
};
