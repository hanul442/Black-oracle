import type { Candle } from '../types';
import type { ResearchTimeframe, TechnicalFeatureStatus, TechnicalResearchFamily } from './featureRegistry';

export type ResearchObservationProvenance = 'PROSPECTIVE' | 'RECONSTRUCTED';
export type ResearchOutcomeHorizon = '15M' | '1H' | '4H' | '24H';
export type SampleSufficiency = 'INSUFFICIENT' | 'EXPLORATORY' | 'PRELIMINARY' | 'INTERMEDIATE' | 'PRIMARY_FEATURE_EVALUATION';

export interface ResearchFeatureObservation {
  id: string;
  cycleId: string;
  timestamp: number;
  market: string;
  timeframe: ResearchTimeframe;
  featureFamily: TechnicalResearchFamily;
  featureName: string;
  featureVersion: string;
  rawValue: number | null;
  normalizedValue: number | null;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'CONTEXTUAL' | 'UNAVAILABLE';
  confidence: number;
  status: TechnicalFeatureStatus;
  strategyVersion: string;
  codeCommit: string;
  configVersion: string;
  provenance: ResearchObservationProvenance;
  referencePrice: number;
  executionDecision: 'ENTER' | 'EXIT' | 'HOLD' | 'NO_TRADE';
  evidenceScore: number | null;
  evidenceConfidence: number;
  oracleTradeScore: number;
  metadata: Record<string, unknown>;
}

export interface ResearchFeatureOutcome {
  observationId: string;
  horizon: ResearchOutcomeHorizon;
  futureReturn: number;
  mfe: number;
  mae: number;
  resolvedAt: number;
}

export const RESEARCH_HORIZON_MS: Record<ResearchOutcomeHorizon, number> = Object.freeze({
  '15M': 15 * 60 * 1000,
  '1H': 60 * 60 * 1000,
  '4H': 4 * 60 * 60 * 1000,
  '24H': 24 * 60 * 60 * 1000,
});

export const sampleSufficiency = (observationCount: number): SampleSufficiency => {
  if (observationCount < 100) return 'INSUFFICIENT';
  if (observationCount < 500) return 'EXPLORATORY';
  if (observationCount < 2_000) return 'PRELIMINARY';
  if (observationCount < 5_000) return 'INTERMEDIATE';
  return 'PRIMARY_FEATURE_EVALUATION';
};

export const resolveFeatureOutcome = (
  observation: ResearchFeatureObservation,
  horizon: ResearchOutcomeHorizon,
  candles: Candle[],
  now = Date.now(),
): ResearchFeatureOutcome | null => {
  const targetAt = observation.timestamp + RESEARCH_HORIZON_MS[horizon];
  if (now < targetAt) return null;

  // Explicit anti-lookahead: no candle with a timestamp after `now` may be used,
  // and no candle at/before the decision timestamp belongs to the outcome window.
  const eligible = candles
    .filter((candle) => candle.market === observation.market && candle.timestamp > observation.timestamp && candle.timestamp <= now)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (eligible.length === 0) return null;

  const resolution = eligible.find((candle) => candle.timestamp >= targetAt);
  if (!resolution) return null;
  const path = eligible.filter((candle) => candle.timestamp <= resolution.timestamp);
  if (path.length === 0 || observation.referencePrice <= 0) return null;

  const futureReturn = resolution.close / observation.referencePrice - 1;
  const mfe = Math.max(...path.map((candle) => candle.high / observation.referencePrice - 1));
  const mae = Math.min(...path.map((candle) => candle.low / observation.referencePrice - 1));

  return {
    observationId: observation.id,
    horizon,
    futureReturn,
    mfe,
    mae,
    resolvedAt: Math.max(targetAt, resolution.timestamp),
  };
};

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

export const pearsonCorrelation = (left: number[], right: number[]) => {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const l = left[index] - leftMean;
    const r = right[index] - rightMean;
    covariance += l * r;
    leftVariance += l * l;
    rightVariance += r * r;
  }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator > 0 ? covariance / denominator : null;
};

const ranks = (values: number[]) => {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const output = Array(values.length).fill(0);
  let cursor = 0;
  while (cursor < indexed.length) {
    let end = cursor + 1;
    while (end < indexed.length && indexed[end].value === indexed[cursor].value) end += 1;
    const rank = (cursor + end - 1) / 2 + 1;
    for (let index = cursor; index < end; index += 1) output[indexed[index].index] = rank;
    cursor = end;
  }
  return output;
};

export const spearmanCorrelation = (left: number[], right: number[]) => {
  if (left.length !== right.length || left.length < 2) return null;
  return pearsonCorrelation(ranks(left), ranks(right));
};
