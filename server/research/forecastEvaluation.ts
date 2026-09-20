import type { ForecastEvaluation, ReportForecast } from '../../src/report/contracts';

export type PriceObservation = {
  timestamp: number;
  open?: number;
  high: number;
  low: number;
  close: number;
};

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const baseScenario = (forecast: ReportForecast) =>
  forecast.scenarios.find((scenario) => scenario.label === 'BASE') ?? null;

const direction = (start: number, end: number, flatThresholdPct = 0.005) => {
  if (start <= 0) return 'AMBIGUOUS' as const;
  const change = end / start - 1;
  if (change > flatThresholdPct) return 'UP' as const;
  if (change < -flatThresholdPct) return 'DOWN' as const;
  return 'RANGE' as const;
};

export const evaluatePublishedForecast = (input: {
  forecast: ReportForecast;
  observations: PriceObservation[];
  evaluatedAt?: number;
  flatThresholdPct?: number;
}): ForecastEvaluation => {
  const sorted = input.observations
    .filter((item) => finite(item.timestamp) && finite(item.high) && finite(item.low) && finite(item.close))
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((item) => item.timestamp >= input.forecast.asOf);

  const horizonEnd = input.forecast.horizonEndAt ?? sorted.at(-1)?.timestamp ?? null;
  const inWindow = horizonEnd == null
    ? sorted
    : sorted.filter((item) => item.timestamp <= horizonEnd);

  const first = inWindow[0] ?? null;
  const last = inWindow.at(-1) ?? null;
  const base = baseScenario(input.forecast);
  const target = base?.targetPrice ?? null;
  const threshold = input.flatThresholdPct ?? 0.005;

  if (!first || !last || inWindow.length < 2 || !finite(first.close) || !finite(last.close)) {
    return {
      evaluationId: `evaluation:${input.forecast.forecastId}:${input.evaluatedAt ?? Date.now()}`,
      forecastId: input.forecast.forecastId,
      evaluatedAt: input.evaluatedAt ?? Date.now(),
      observationStartAt: first?.timestamp ?? input.forecast.asOf,
      observationEndAt: last?.timestamp ?? input.forecast.asOf,
      actualStartPrice: first?.close ?? null,
      actualEndPrice: last?.close ?? null,
      actualHighPrice: null,
      actualLowPrice: null,
      directionResult: 'NOT_EVALUABLE',
      baseTargetAbsoluteErrorPct: null,
      timingErrorMs: null,
      brierScore: null,
      notes: ['Insufficient point-in-time price observations for the forecast horizon.'],
    };
  }

  const actualHigh = Math.max(...inWindow.map((item) => item.high));
  const actualLow = Math.min(...inWindow.map((item) => item.low));
  const actualDirection = direction(first.close, last.close, threshold);
  const expectedDirection = finite(target)
    ? direction(first.close, target, threshold)
    : 'AMBIGUOUS';

  const directionResult: ForecastEvaluation['directionResult'] =
    expectedDirection === 'AMBIGUOUS'
      ? 'NOT_EVALUABLE'
      : expectedDirection === 'RANGE'
        ? (actualDirection === 'RANGE' ? 'CORRECT' : 'INCORRECT')
        : actualDirection === expectedDirection
          ? 'CORRECT'
          : 'INCORRECT';

  const baseTargetAbsoluteErrorPct = finite(target) && target > 0
    ? Math.abs(last.close - target) / target
    : null;

  let timingErrorMs: number | null = null;
  if (finite(target) && input.forecast.horizonEndAt != null) {
    const hit = inWindow.find((item) => item.low <= target && item.high >= target);
    timingErrorMs = hit ? Math.abs(hit.timestamp - input.forecast.horizonEndAt) : null;
  }

  return {
    evaluationId: `evaluation:${input.forecast.forecastId}:${input.evaluatedAt ?? Date.now()}`,
    forecastId: input.forecast.forecastId,
    evaluatedAt: input.evaluatedAt ?? Date.now(),
    observationStartAt: first.timestamp,
    observationEndAt: last.timestamp,
    actualStartPrice: first.close,
    actualEndPrice: last.close,
    actualHighPrice: actualHigh,
    actualLowPrice: actualLow,
    directionResult,
    baseTargetAbsoluteErrorPct,
    timingErrorMs,
    brierScore: null,
    notes: [
      'Evaluation uses immutable published forecast values and point-in-time observed prices.',
      'Brier scoring is deferred until mutually exclusive scenario calibration labels are formally defined.',
    ],
  };
};
