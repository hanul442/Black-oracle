import type { Candle } from './types';
import { assessCandleIntegrity, type CandleIntegrityResult } from './validationIntegrity';
import { assessIndicatorWarmupStability, type WarmupStabilityResult } from './warmupStability';

export type InputValidationDisposition = 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';

export interface CandleDatasetIdentity {
  datasetId: string;
  checksum: string;
  checksumAlgorithm: 'SHA-256';
  canonicalization: 'BLACK_ORACLE_CANDLE_DATASET_V1';
  candleCount: number;
  market: string | null;
  timeframeMinutes: number | null;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
}

export interface InputValidationPolicy {
  policyVersion?: string;
  minWarmupCandles?: number;
  warmupWindows?: number[];
  warmupWatchThreshold?: number;
  warmupRejectThreshold?: number;
  maxGapFactor?: number;
}

export interface InputValidationLedgerRecord {
  id: string;
  createdAt: number;
  evaluationCutoff: number;
  policyVersion: string;
  dataset: CandleDatasetIdentity;
  integrity: CandleIntegrityResult;
  warmup: WarmupStabilityResult | null;
  disposition: InputValidationDisposition;
  reasons: string[];
  executionAuthority: false;
}

const canonicalNumber = (value: number | null | undefined): number | string | null => {
  if (value == null) return null;
  if (Number.isFinite(value)) return Object.is(value, -0) ? 0 : value;
  return `NON_FINITE:${String(value)}`;
};

export const canonicalizeCandleDataset = (candles: Candle[]): string => JSON.stringify({
  canonicalization: 'BLACK_ORACLE_CANDLE_DATASET_V1',
  candles: (candles ?? []).map((candle) => [
    candle.market,
    canonicalNumber(candle.timeframeMinutes),
    canonicalNumber(candle.timestamp),
    canonicalNumber(candle.open),
    canonicalNumber(candle.high),
    canonicalNumber(candle.low),
    canonicalNumber(candle.close),
    canonicalNumber(candle.volume),
    canonicalNumber(candle.quoteVolume),
  ]),
});

const sha256Hex = async (value: string): Promise<string> => {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 Web Crypto is unavailable; candle dataset identity cannot be established.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const buildCandleDatasetIdentity = async (candles: Candle[]): Promise<CandleDatasetIdentity> => {
  const source = Array.isArray(candles) ? candles : [];
  const checksumHex = await sha256Hex(canonicalizeCandleDataset(source));
  const markets = [...new Set(source.map((candle) => candle.market))];
  const timeframes = [...new Set(source.map((candle) => candle.timeframeMinutes))];
  return {
    datasetId: `candle-set:${checksumHex.slice(0, 24)}`,
    checksum: `sha256:${checksumHex}`,
    checksumAlgorithm: 'SHA-256',
    canonicalization: 'BLACK_ORACLE_CANDLE_DATASET_V1',
    candleCount: source.length,
    market: markets.length === 1 ? markets[0] : null,
    timeframeMinutes: timeframes.length === 1 ? timeframes[0] : null,
    firstTimestamp: source[0]?.timestamp ?? null,
    lastTimestamp: source[source.length - 1]?.timestamp ?? null,
  };
};

const combineDisposition = (
  integrity: CandleIntegrityResult,
  warmup: WarmupStabilityResult | null,
): InputValidationDisposition => {
  if (integrity.disposition === 'REJECT' || warmup?.disposition === 'REJECT') return 'REJECT';
  if (!warmup || warmup.disposition === 'INSUFFICIENT_DATA') return 'INSUFFICIENT_DATA';
  if (integrity.disposition === 'WATCH' || warmup.disposition === 'WATCH') return 'WATCH';
  return 'PASS';
};

/**
 * Build the evidence record that must accompany a historical candle dataset before
 * it can be considered by later validation/promotion gates. This record has no
 * trading authority and does not mutate PAPER or LIVE state.
 */
export const buildInputValidationRecord = async (
  candles: Candle[],
  evaluationCutoff: number,
  policy: InputValidationPolicy = {},
): Promise<InputValidationLedgerRecord> => {
  const windows = [...new Set((policy.warmupWindows ?? [200, 250, 300, 400]).map((value) => Math.trunc(value)))]
    .filter((value) => value >= 200)
    .sort((a, b) => a - b);
  const requiredWarmup = Math.max(200, Math.trunc(policy.minWarmupCandles ?? Math.max(...windows, 400)));
  const policyVersion = policy.policyVersion?.trim() || 'S7_INPUT_VALIDATION_V1';

  const [dataset, integrity] = await Promise.all([
    buildCandleDatasetIdentity(candles),
    Promise.resolve(assessCandleIntegrity(candles, {
      asOf: evaluationCutoff,
      minWarmupCandles: requiredWarmup,
      maxGapFactor: policy.maxGapFactor,
    })),
  ]);

  const warmup = integrity.disposition === 'REJECT'
    ? null
    : assessIndicatorWarmupStability(candles, {
      windows,
      watchThreshold: policy.warmupWatchThreshold,
      rejectThreshold: policy.warmupRejectThreshold,
    });
  const disposition = combineDisposition(integrity, warmup);
  const reasons = [
    `Dataset ${dataset.datasetId} contains ${dataset.candleCount} candle(s) with ${dataset.checksum}.`,
    `Input integrity disposition: ${integrity.disposition}.`,
    warmup
      ? `Recursive warm-up disposition: ${warmup.disposition}; baseline=${warmup.baselineCandles ?? 'none'} candle(s).`
      : 'Recursive warm-up evaluation was skipped because candle integrity failed closed.',
  ];

  const recordSeed = JSON.stringify({ datasetId: dataset.datasetId, evaluationCutoff, policyVersion, windows, requiredWarmup });
  const recordHash = await sha256Hex(recordSeed);
  return {
    id: `input-validation:${recordHash.slice(0, 24)}`,
    createdAt: evaluationCutoff,
    evaluationCutoff,
    policyVersion,
    dataset,
    integrity,
    warmup,
    disposition,
    reasons,
    executionAuthority: false,
  };
};
