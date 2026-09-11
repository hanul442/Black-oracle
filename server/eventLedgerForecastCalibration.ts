import type { CanonicalEventRow } from './eventLedger';

export interface DirectionalForecastSnapshot {
  available: boolean;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNAVAILABLE' | string;
  probabilityBullish: number | null;
  probabilityBearish: number | null;
  confidence: number | null;
  uncertainty: number | null;
  asOf: number | null;
}

export interface DirectionalOutcomeCalibration {
  entryTraceId: string;
  outcomeTraceId: string | null;
  tradeId: string | null;
  market: string | null;
  predictedBullish: number;
  predictedBearish: number;
  forecastDirection: string;
  realizedReturnPct: number;
  actualDirection: 'BULLISH' | 'BEARISH' | 'FLAT';
  actualBullish: 0 | 1 | null;
  directionCorrect: boolean | null;
  brierScore: number | null;
  absoluteProbabilityError: number | null;
  openedAt: number | null;
  closedAt: number | null;
  holdingPeriodMs: number | null;
}

export interface EmpiricalReturnDistribution {
  available: boolean;
  method: 'EMPIRICAL_ENTRY_FORECAST_BUCKET';
  targetProbabilityBullish: number | null;
  probabilityBucket: { lower: number; upper: number } | null;
  sampleSize: number;
  minimumSamples: number;
  quantiles: null | {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  meanBrierScore: number | null;
  directionalAccuracy: number | null;
  medianHoldingPeriodMs: number | null;
  reason: string;
}

const finiteNumber = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

const traceIdOf = (event: CanonicalEventRow) =>
  typeof event.trace?.traceId === 'string' && event.trace.traceId.trim() ? event.trace.traceId.trim() : null;

const entryTraceIdOf = (event: CanonicalEventRow) =>
  typeof event.links?.entryTraceId === 'string' && event.links.entryTraceId.trim() ? event.links.entryTraceId.trim() : null;

const tradeIdOf = (event: CanonicalEventRow) =>
  typeof event.links?.tradeId === 'string' && event.links.tradeId.trim() ? event.links.tradeId.trim() : null;

const normalizeForecast = (value: unknown): DirectionalForecastSnapshot | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const probabilityBullish = finiteNumber(raw.probabilityBullish);
  const probabilityBearish = finiteNumber(raw.probabilityBearish);
  const confidence = finiteNumber(raw.confidence);
  const uncertainty = finiteNumber(raw.uncertainty);
  const asOf = finiteNumber(raw.asOf);
  const available = Boolean(raw.available) && probabilityBullish != null && probabilityBearish != null;
  return {
    available,
    direction: String(raw.direction ?? 'UNAVAILABLE'),
    probabilityBullish: probabilityBullish == null ? null : clamp01(probabilityBullish),
    probabilityBearish: probabilityBearish == null ? null : clamp01(probabilityBearish),
    confidence: confidence == null ? null : clamp01(confidence),
    uncertainty: uncertainty == null ? null : clamp01(uncertainty),
    asOf,
  };
};

export const extractDirectionalForecast = (
  events: CanonicalEventRow[],
  traceId?: string | null,
): DirectionalForecastSnapshot | null => {
  const normalizedTraceId = String(traceId ?? '').trim() || null;
  const scoped = normalizedTraceId
    ? events.filter((event) => traceIdOf(event) === normalizedTraceId)
    : events;

  for (const event of scoped) {
    const direct = normalizeForecast(event.trace?.forecast);
    if (direct?.available) return direct;
    const nestedDecision = event.trace?.decision;
    if (nestedDecision && typeof nestedDecision === 'object') {
      const nested = normalizeForecast((nestedDecision as Record<string, unknown>).forecast);
      if (nested?.available) return nested;
    }
  }

  return null;
};

export const buildDirectionalOutcomeCalibration = (
  timeline: CanonicalEventRow[],
  outcome: CanonicalEventRow,
): DirectionalOutcomeCalibration | null => {
  if (outcome.eventType !== 'OUTCOME') return null;
  const entryTraceId = entryTraceIdOf(outcome);
  if (!entryTraceId) return null;
  const forecast = extractDirectionalForecast(timeline, entryTraceId);
  if (!forecast?.available || forecast.probabilityBullish == null || forecast.probabilityBearish == null) return null;

  const realizedReturnPct = finiteNumber(outcome.trace?.returnPct);
  if (realizedReturnPct == null) return null;
  const epsilon = 1e-10;
  const actualDirection: DirectionalOutcomeCalibration['actualDirection'] = realizedReturnPct > epsilon
    ? 'BULLISH'
    : realizedReturnPct < -epsilon
      ? 'BEARISH'
      : 'FLAT';
  const actualBullish = actualDirection === 'FLAT' ? null : actualDirection === 'BULLISH' ? 1 : 0;
  const predictedDirection = forecast.direction === 'BULLISH'
    ? 'BULLISH'
    : forecast.direction === 'BEARISH'
      ? 'BEARISH'
      : null;
  const directionCorrect = actualDirection === 'FLAT' || predictedDirection == null
    ? null
    : predictedDirection === actualDirection;
  const brierScore = actualBullish == null
    ? null
    : round6((forecast.probabilityBullish - actualBullish) ** 2);
  const absoluteProbabilityError = actualBullish == null
    ? null
    : round6(Math.abs(forecast.probabilityBullish - actualBullish));
  const openedAt = finiteNumber(outcome.trace?.openedAt);
  const closedAt = finiteNumber(outcome.trace?.closedAt);
  const holdingPeriodMs = openedAt != null && closedAt != null && closedAt >= openedAt
    ? closedAt - openedAt
    : null;

  return {
    entryTraceId,
    outcomeTraceId: traceIdOf(outcome),
    tradeId: tradeIdOf(outcome),
    market: outcome.market,
    predictedBullish: round6(forecast.probabilityBullish),
    predictedBearish: round6(forecast.probabilityBearish),
    forecastDirection: forecast.direction,
    realizedReturnPct: round6(realizedReturnPct),
    actualDirection,
    actualBullish,
    directionCorrect,
    brierScore,
    absoluteProbabilityError,
    openedAt,
    closedAt,
    holdingPeriodMs,
  };
};

const quantile = (sorted: number[], probability: number) => {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return quantile(sorted, 0.5);
};

export const buildEmpiricalReturnDistribution = (
  calibrations: DirectionalOutcomeCalibration[],
  targetProbabilityBullish: number | null | undefined,
  minimumSamples = 8,
): EmpiricalReturnDistribution => {
  const target = finiteNumber(targetProbabilityBullish);
  if (target == null) {
    return {
      available: false,
      method: 'EMPIRICAL_ENTRY_FORECAST_BUCKET',
      targetProbabilityBullish: null,
      probabilityBucket: null,
      sampleSize: 0,
      minimumSamples,
      quantiles: null,
      meanBrierScore: null,
      directionalAccuracy: null,
      medianHoldingPeriodMs: null,
      reason: 'Current trace has no source-backed bullish probability, so no empirical return distribution is asserted.',
    };
  }

  const normalizedTarget = clamp01(target);
  const bucketWidth = 0.2;
  const lower = Math.min(0.8, Math.floor(normalizedTarget / bucketWidth) * bucketWidth);
  const upper = Math.min(1, lower + bucketWidth);
  const inBucket = calibrations.filter((item) =>
    item.predictedBullish >= lower
    && (upper === 1 ? item.predictedBullish <= upper : item.predictedBullish < upper),
  );
  const returns = inBucket.map((item) => item.realizedReturnPct).filter(Number.isFinite).sort((a, b) => a - b);
  const briers = inBucket.map((item) => item.brierScore).filter((value): value is number => value != null && Number.isFinite(value));
  const directional = inBucket.map((item) => item.directionCorrect).filter((value): value is boolean => value != null);
  const holdingPeriods = inBucket.map((item) => item.holdingPeriodMs).filter((value): value is number => value != null && Number.isFinite(value));
  const sampleSize = returns.length;
  const available = sampleSize >= minimumSamples;

  return {
    available,
    method: 'EMPIRICAL_ENTRY_FORECAST_BUCKET',
    targetProbabilityBullish: round6(normalizedTarget),
    probabilityBucket: { lower: round6(lower), upper: round6(upper) },
    sampleSize,
    minimumSamples,
    quantiles: available ? {
      p10: round6(quantile(returns, 0.10)),
      p25: round6(quantile(returns, 0.25)),
      p50: round6(quantile(returns, 0.50)),
      p75: round6(quantile(returns, 0.75)),
      p90: round6(quantile(returns, 0.90)),
    } : null,
    meanBrierScore: briers.length ? round6(briers.reduce((sum, value) => sum + value, 0) / briers.length) : null,
    directionalAccuracy: directional.length ? round6(directional.filter(Boolean).length / directional.length) : null,
    medianHoldingPeriodMs: median(holdingPeriods),
    reason: available
      ? `Quantiles are empirical realized trade returns from ${sampleSize} completed outcomes in the same 20-point bullish-probability bucket; they are not synthetic price targets.`
      : `Only ${sampleSize}/${minimumSamples} completed outcomes exist in the same bullish-probability bucket. Quantiles remain unavailable to avoid fabricating a distribution.`,
  };
};
