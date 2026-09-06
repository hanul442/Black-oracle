import type { DecisionTrace } from './decisionTrace';
import type { MarketPriceSnapshot } from './marketHistory';

export type HistoricalValidationVerdict = 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';

export interface BlindValidationSample {
  market: string;
  decisionTimestamp: number;
  anchorTimestamp: number;
  targetTimestamp: number;
  action: 'ENTER' | 'EXIT' | 'HOLD';
  regime: string;
  anchorPrice: number;
  targetPrice: number;
  rawReturn: number;
  directionalReturn: number;
  favorable: boolean;
}

export interface BlindValidationResult {
  verdict: HistoricalValidationVerdict;
  sampleCount: number;
  observationDays: number;
  favorableRate: number | null;
  meanDirectionalReturn: number | null;
  medianDirectionalReturn: number | null;
  byRegime: Array<{
    regime: string;
    samples: number;
    favorableRate: number;
    meanDirectionalReturn: number;
  }>;
  reasons: string[];
  provenance: {
    noLookahead: true;
    anchorRule: 'FIRST_PERSISTED_PRICE_AT_OR_AFTER_DECISION';
    targetRule: 'FIRST_PERSISTED_PRICE_AT_OR_AFTER_ANCHOR_PLUS_HORIZON';
    horizonMs: number;
    minSamples: number;
    minObservationDays: number;
  };
  samples: BlindValidationSample[];
}

export interface WalkForwardResult {
  verdict: HistoricalValidationVerdict;
  folds: Array<{
    fold: number;
    trainEndTimestamp: number;
    testStartTimestamp: number;
    testEndTimestamp: number;
    samples: number;
    favorableRate: number | null;
    meanDirectionalReturn: number | null;
    verdict: HistoricalValidationVerdict;
  }>;
  positiveFoldRate: number | null;
  reasons: string[];
  provenance: {
    chronological: true;
    testDataAlwaysAfterTrainingData: true;
  };
}

const priceMaps = (history: MarketPriceSnapshot[]) => (history ?? [])
  .filter((item) => Number.isFinite(item?.timestamp) && item.timestamp > 0 && Array.isArray(item.prices))
  .sort((a, b) => a.timestamp - b.timestamp)
  .map((item) => ({
    timestamp: item.timestamp,
    prices: new Map(item.prices
      .filter(([market, price]) => /^KRW-[A-Z0-9]+$/.test(String(market).toUpperCase()) && Number.isFinite(price) && price > 0)
      .map(([market, price]) => [String(market).toUpperCase(), price] as [string, number])),
  }));

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const classify = (samples: BlindValidationSample[], minSamples: number, observationDays: number, minObservationDays: number): HistoricalValidationVerdict => {
  if (samples.length < minSamples || observationDays < minObservationDays) return 'INSUFFICIENT_DATA';
  const favorableRate = samples.filter((item) => item.favorable).length / samples.length;
  const mean = samples.reduce((sum, item) => sum + item.directionalReturn, 0) / samples.length;
  if (favorableRate >= 0.52 && mean > 0) return 'PASS';
  if (favorableRate >= 0.48 || mean > 0) return 'WATCH';
  return 'REJECT';
};

export const buildBlindValidationSamples = (
  decisions: DecisionTrace[],
  history: MarketPriceSnapshot[],
  horizonMs = 4 * 60 * 60_000,
): BlindValidationSample[] => {
  const orderedPrices = priceMaps(history);
  if (!orderedPrices.length) return [];
  const allowedActions = new Set(['ENTER', 'EXIT', 'HOLD']);

  return (decisions ?? []).flatMap((decision) => {
    if (!allowedActions.has(decision.action)) return [];
    const market = decision.market.toUpperCase();
    // The evaluator never uses a price timestamp earlier than the decision. This may delay the
    // evaluation anchor, but it cannot leak future market state into the historical decision itself.
    const anchor = orderedPrices.find((item) => item.timestamp >= decision.timestamp && item.prices.has(market));
    if (!anchor) return [];
    const target = orderedPrices.find((item) => item.timestamp >= anchor.timestamp + horizonMs && item.prices.has(market));
    if (!target) return [];
    const anchorPrice = anchor.prices.get(market)!;
    const targetPrice = target.prices.get(market)!;
    const rawReturn = targetPrice / anchorPrice - 1;
    if (!Number.isFinite(rawReturn) || rawReturn <= -1 || rawReturn >= 10) return [];
    const directionalReturn = decision.action === 'EXIT' ? -rawReturn : rawReturn;
    return [{
      market,
      decisionTimestamp: decision.timestamp,
      anchorTimestamp: anchor.timestamp,
      targetTimestamp: target.timestamp,
      action: decision.action as BlindValidationSample['action'],
      regime: decision.regime,
      anchorPrice,
      targetPrice,
      rawReturn,
      directionalReturn,
      favorable: directionalReturn > 0,
    }];
  }).sort((a, b) => a.decisionTimestamp - b.decisionTimestamp || a.market.localeCompare(b.market));
};

export const runBlindValidation = (
  decisions: DecisionTrace[],
  history: MarketPriceSnapshot[],
  options: { horizonMs?: number; minSamples?: number; minObservationDays?: number } = {},
): BlindValidationResult => {
  const horizonMs = Math.max(15 * 60_000, options.horizonMs ?? 4 * 60 * 60_000);
  const minSamples = Math.max(5, Math.trunc(options.minSamples ?? 60));
  const minObservationDays = Math.max(1, options.minObservationDays ?? 14);
  const samples = buildBlindValidationSamples(decisions, history, horizonMs);
  const observationDays = samples.length > 1
    ? (samples[samples.length - 1].decisionTimestamp - samples[0].decisionTimestamp) / 86_400_000
    : 0;
  const favorableRate = samples.length ? samples.filter((item) => item.favorable).length / samples.length : null;
  const meanDirectionalReturn = samples.length ? samples.reduce((sum, item) => sum + item.directionalReturn, 0) / samples.length : null;
  const medianDirectionalReturn = median(samples.map((item) => item.directionalReturn));
  const regimes = [...new Set(samples.map((item) => item.regime))].sort();
  const byRegime = regimes.map((regime) => {
    const scoped = samples.filter((item) => item.regime === regime);
    return {
      regime,
      samples: scoped.length,
      favorableRate: scoped.filter((item) => item.favorable).length / scoped.length,
      meanDirectionalReturn: scoped.reduce((sum, item) => sum + item.directionalReturn, 0) / scoped.length,
    };
  });
  const verdict = classify(samples, minSamples, observationDays, minObservationDays);
  const reasons = [
    `${samples.length} decision sample(s) have a strictly post-decision ${Math.round(horizonMs / 60_000)}m outcome.`,
    `${observationDays.toFixed(2)} observation day(s) are represented.`,
  ];
  if (verdict === 'INSUFFICIENT_DATA') reasons.push(`Promotion requires at least ${minSamples} evaluable samples across ${minObservationDays} days.`);
  if (byRegime.some((item) => item.samples >= 5 && item.meanDirectionalReturn < 0)) reasons.push('At least one observed regime has negative directional expectancy and must remain visible in robustness review.');

  return {
    verdict,
    sampleCount: samples.length,
    observationDays,
    favorableRate,
    meanDirectionalReturn,
    medianDirectionalReturn,
    byRegime,
    reasons,
    provenance: {
      noLookahead: true,
      anchorRule: 'FIRST_PERSISTED_PRICE_AT_OR_AFTER_DECISION',
      targetRule: 'FIRST_PERSISTED_PRICE_AT_OR_AFTER_ANCHOR_PLUS_HORIZON',
      horizonMs,
      minSamples,
      minObservationDays,
    },
    samples,
  };
};

export const runWalkForwardValidation = (
  samples: BlindValidationSample[],
  options: { folds?: number; minimumTestSamples?: number } = {},
): WalkForwardResult => {
  const ordered = (samples ?? []).slice().sort((a, b) => a.decisionTimestamp - b.decisionTimestamp);
  const folds = Math.max(2, Math.min(8, Math.trunc(options.folds ?? 4)));
  const minimumTestSamples = Math.max(3, Math.trunc(options.minimumTestSamples ?? 10));
  if (ordered.length < minimumTestSamples * folds + minimumTestSamples) {
    return {
      verdict: 'INSUFFICIENT_DATA',
      folds: [],
      positiveFoldRate: null,
      reasons: [`Walk-forward requires enough chronological data for ${folds} out-of-sample folds with at least ${minimumTestSamples} samples each.`],
      provenance: { chronological: true, testDataAlwaysAfterTrainingData: true },
    };
  }

  const initialTrain = Math.max(minimumTestSamples, Math.floor(ordered.length * 0.4));
  const remaining = ordered.length - initialTrain;
  const testSize = Math.max(minimumTestSamples, Math.floor(remaining / folds));
  const results: WalkForwardResult['folds'] = [];

  for (let fold = 0; fold < folds; fold += 1) {
    const testStart = initialTrain + fold * testSize;
    const testEndExclusive = fold === folds - 1 ? ordered.length : Math.min(ordered.length, testStart + testSize);
    const test = ordered.slice(testStart, testEndExclusive);
    if (test.length < minimumTestSamples) continue;
    const favorableRate = test.filter((item) => item.favorable).length / test.length;
    const meanDirectionalReturn = test.reduce((sum, item) => sum + item.directionalReturn, 0) / test.length;
    const verdict: HistoricalValidationVerdict = favorableRate >= 0.52 && meanDirectionalReturn > 0
      ? 'PASS'
      : favorableRate >= 0.48 || meanDirectionalReturn > 0
        ? 'WATCH'
        : 'REJECT';
    results.push({
      fold: fold + 1,
      trainEndTimestamp: ordered[testStart - 1].decisionTimestamp,
      testStartTimestamp: test[0].decisionTimestamp,
      testEndTimestamp: test[test.length - 1].decisionTimestamp,
      samples: test.length,
      favorableRate,
      meanDirectionalReturn,
      verdict,
    });
  }

  if (results.length < folds) {
    return {
      verdict: 'INSUFFICIENT_DATA',
      folds: results,
      positiveFoldRate: results.length ? results.filter((item) => item.meanDirectionalReturn != null && item.meanDirectionalReturn > 0).length / results.length : null,
      reasons: ['Not every requested chronological out-of-sample fold had the minimum sample count.'],
      provenance: { chronological: true, testDataAlwaysAfterTrainingData: true },
    };
  }

  const positiveFoldRate = results.filter((item) => (item.meanDirectionalReturn ?? 0) > 0).length / results.length;
  const rejected = results.filter((item) => item.verdict === 'REJECT').length;
  const verdict: HistoricalValidationVerdict = rejected === 0 && positiveFoldRate >= 0.75
    ? 'PASS'
    : rejected <= 1 && positiveFoldRate >= 0.5
      ? 'WATCH'
      : 'REJECT';
  return {
    verdict,
    folds: results,
    positiveFoldRate,
    reasons: [`${results.length} chronological out-of-sample fold(s) completed; ${(positiveFoldRate * 100).toFixed(0)}% had positive directional expectancy.`],
    provenance: { chronological: true, testDataAlwaysAfterTrainingData: true },
  };
};
