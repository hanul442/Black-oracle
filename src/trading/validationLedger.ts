import type { BlindValidationSample, HistoricalValidationVerdict } from './blindValidation';
import type { InputValidationLedgerRecord } from './validationDataset';

export interface ValidationLedgerSummary {
  verdict: HistoricalValidationVerdict;
  sampleCount: number;
  observationDays: number;
  favorableRate: number | null;
  meanDirectionalReturn: number | null;
  medianDirectionalReturn: number | null;
  byRegime: Array<{ regime: string; samples: number; favorableRate: number; meanDirectionalReturn: number }>;
  reasons: string[];
}

const key = (sample: BlindValidationSample) => `${sample.market}|${sample.decisionTimestamp}|${sample.action}|${sample.targetTimestamp}`;
const eligibleForPromotionLedger = (sample: BlindValidationSample) => sample.action === 'ENTER' || sample.action === 'EXIT';

export const mergeValidationSamples = (
  existing: BlindValidationSample[],
  incoming: BlindValidationSample[],
  maxSamples = 10_000,
): BlindValidationSample[] => {
  const map = new Map<string, BlindValidationSample>();
  for (const sample of [...(existing ?? []), ...(incoming ?? [])]) {
    if (!sample?.market || !eligibleForPromotionLedger(sample) || !Number.isFinite(sample.decisionTimestamp) || !Number.isFinite(sample.targetTimestamp)) continue;
    map.set(key(sample), { ...sample });
  }
  return Array.from(map.values())
    .sort((a, b) => a.decisionTimestamp - b.decisionTimestamp || a.market.localeCompare(b.market))
    .slice(-Math.max(100, Math.min(50_000, Math.trunc(maxSamples) || 10_000)));
};

/**
 * Input-validation provenance is retained separately from outcome samples so data
 * quality cannot be mistaken for alpha evidence. The same deterministic record ID
 * is idempotent across repeated persistence attempts.
 */
export const mergeInputValidationRecords = (
  existing: InputValidationLedgerRecord[],
  incoming: InputValidationLedgerRecord[],
  maxRecords = 5_000,
): InputValidationLedgerRecord[] => {
  const map = new Map<string, InputValidationLedgerRecord>();
  for (const record of [...(existing ?? []), ...(incoming ?? [])]) {
    if (!record?.id || !Number.isFinite(record.evaluationCutoff) || record.evaluationCutoff <= 0) continue;
    if (!record.dataset?.datasetId || !/^sha256:[0-9a-f]{64}$/.test(record.dataset.checksum)) continue;
    if (record.executionAuthority !== false) continue;
    map.set(record.id, record);
  }
  return Array.from(map.values())
    .sort((a, b) => a.evaluationCutoff - b.evaluationCutoff || a.id.localeCompare(b.id))
    .slice(-Math.max(100, Math.min(20_000, Math.trunc(maxRecords) || 5_000)));
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const summarizeValidationSamples = (
  samples: BlindValidationSample[],
  options: { minSamples?: number; minObservationDays?: number } = {},
): ValidationLedgerSummary => {
  const ordered = (samples ?? []).filter(eligibleForPromotionLedger).slice().sort((a, b) => a.decisionTimestamp - b.decisionTimestamp);
  const minSamples = Math.max(5, Math.trunc(options.minSamples ?? 60));
  const minObservationDays = Math.max(1, options.minObservationDays ?? 14);
  const observationDays = ordered.length > 1 ? (ordered[ordered.length - 1].decisionTimestamp - ordered[0].decisionTimestamp) / 86_400_000 : 0;
  const favorableRate = ordered.length ? ordered.filter((item) => item.favorable).length / ordered.length : null;
  const meanDirectionalReturn = ordered.length ? ordered.reduce((sum, item) => sum + item.directionalReturn, 0) / ordered.length : null;
  const medianDirectionalReturn = median(ordered.map((item) => item.directionalReturn));
  const regimes = [...new Set(ordered.map((item) => item.regime))].sort();
  const byRegime = regimes.map((regime) => {
    const scoped = ordered.filter((item) => item.regime === regime);
    return {
      regime,
      samples: scoped.length,
      favorableRate: scoped.filter((item) => item.favorable).length / scoped.length,
      meanDirectionalReturn: scoped.reduce((sum, item) => sum + item.directionalReturn, 0) / scoped.length,
    };
  });
  let verdict: HistoricalValidationVerdict = 'INSUFFICIENT_DATA';
  if (ordered.length >= minSamples && observationDays >= minObservationDays) {
    if ((favorableRate ?? 0) >= 0.52 && (meanDirectionalReturn ?? 0) > 0) verdict = 'PASS';
    else if ((favorableRate ?? 0) >= 0.48 || (meanDirectionalReturn ?? 0) > 0) verdict = 'WATCH';
    else verdict = 'REJECT';
  }
  const reasons = [
    `${ordered.length}/${minSamples} compact no-lookahead ENTER/EXIT sample(s) retained across ${observationDays.toFixed(2)}/${minObservationDays} required day(s).`,
    'Repeated HOLD/NO_TRADE observations are excluded from live-promotion statistics to prevent inactivity from dominating the sample.',
  ];
  const weakRegimes = byRegime.filter((item) => item.samples >= 5 && item.meanDirectionalReturn < 0).map((item) => item.regime);
  if (weakRegimes.length) reasons.push(`Negative directional expectancy remains in regime(s): ${weakRegimes.join(', ')}.`);
  return { verdict, sampleCount: ordered.length, observationDays, favorableRate, meanDirectionalReturn, medianDirectionalReturn, byRegime, reasons };
};
