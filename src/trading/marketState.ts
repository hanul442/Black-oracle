import type { TradingHorizon } from './horizonPolicy';

export type MarketStateStance = 'STRONG_RISK_ON' | 'RISK_ON' | 'NEUTRAL' | 'RISK_OFF' | 'STRONG_RISK_OFF';

export interface MarketStateInput {
  horizon: TradingHorizon;
  asOf: number;
  indexTrendScore: number;
  breadthScore: number;
  turnoverScore: number;
  volatilityScore: number;
  evidenceScore: number;
  fxRiskScore?: number | null;
  ratesRiskScore?: number | null;
  crossAssetScore?: number | null;
  sourceIds?: string[];
  dataGaps?: string[];
}

export interface MarketStateSnapshot extends MarketStateInput {
  id: string;
  score: number;
  confidence: number;
  stance: MarketStateStance;
  riskMultiplier: number;
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const bounded = (value: number) => clamp(Number.isFinite(value) ? value : 50, 0, 100);

export const buildMarketStateSnapshot = (input: MarketStateInput): MarketStateSnapshot => {
  const fx = input.fxRiskScore == null ? 50 : bounded(input.fxRiskScore);
  const rates = input.ratesRiskScore == null ? 50 : bounded(input.ratesRiskScore);
  const crossAsset = input.crossAssetScore == null ? 50 : bounded(input.crossAssetScore);
  const gaps = input.dataGaps ?? [];

  const score = clamp(
    bounded(input.indexTrendScore) * 0.28
      + bounded(input.breadthScore) * 0.22
      + bounded(input.turnoverScore) * 0.14
      + bounded(input.volatilityScore) * 0.12
      + bounded(input.evidenceScore) * 0.10
      + fx * 0.05
      + rates * 0.05
      + crossAsset * 0.04,
    0,
    100,
  );

  const stance: MarketStateStance = score >= 75
    ? 'STRONG_RISK_ON'
    : score >= 62
      ? 'RISK_ON'
      : score >= 42
        ? 'NEUTRAL'
        : score >= 28
          ? 'RISK_OFF'
          : 'STRONG_RISK_OFF';

  const availableOptional = [input.fxRiskScore, input.ratesRiskScore, input.crossAssetScore]
    .filter((value) => value != null && Number.isFinite(value)).length;
  const coverage = (5 + availableOptional) / 8;
  const gapPenalty = Math.min(0.35, gaps.length * 0.06);
  const confidence = clamp(coverage * (1 - gapPenalty), 0, 0.95);
  const riskMultiplier = stance === 'STRONG_RISK_ON'
    ? 1
    : stance === 'RISK_ON'
      ? 0.9
      : stance === 'NEUTRAL'
        ? 0.65
        : stance === 'RISK_OFF'
          ? 0.4
          : 0.25;

  const reasons = [
    `${input.horizon} market-state score ${score.toFixed(1)} (${stance}).`,
    `Trend ${bounded(input.indexTrendScore).toFixed(0)}, breadth ${bounded(input.breadthScore).toFixed(0)}, turnover ${bounded(input.turnoverScore).toFixed(0)}, volatility ${bounded(input.volatilityScore).toFixed(0)}.`,
    `Evidence ${bounded(input.evidenceScore).toFixed(0)}; optional macro/cross-asset coverage ${availableOptional}/3.`,
  ];
  if (gaps.length) reasons.push(`${gaps.length} DATA_GAP item(s) reduce confidence but never fabricate missing inputs.`);

  return {
    ...input,
    id: `market-state::${input.horizon}::${input.asOf}`,
    score,
    confidence,
    stance,
    riskMultiplier,
    reasons,
  };
};

export const buildMarketStateMap = (inputs: MarketStateInput[]) => {
  const snapshots = inputs.map(buildMarketStateSnapshot);
  return Object.fromEntries(snapshots.map((snapshot) => [snapshot.horizon, snapshot])) as Partial<Record<TradingHorizon, MarketStateSnapshot>>;
};
