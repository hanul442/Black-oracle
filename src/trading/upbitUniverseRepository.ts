import type { UpbitUniverseSnapshotRecord } from './upbitUniverseSnapshotRecord';
import {
  DEFAULT_UPBIT_UNIVERSE_FRESHNESS_POLICY,
  evaluateUpbitUniverseFreshness,
  type UpbitUniverseFreshnessPolicy,
} from './upbitUniverseFreshness';

export interface UpbitUniverseSnapshotRepository {
  save(record: UpbitUniverseSnapshotRecord): Promise<void>;
  latest(): Promise<UpbitUniverseSnapshotRecord | null>;
}

export interface UpbitUniverseReadModel {
  record: UpbitUniverseSnapshotRecord | null;
  scannerEligible: boolean;
  reason: 'NO_SNAPSHOT' | 'FRESH' | 'STALE' | 'INVALID_TIMESTAMP' | 'FUTURE_TIMESTAMP';
}

/**
 * Reads the latest persisted public-market observation and re-evaluates freshness at read time.
 * Persisted last-good data remains available for audit, but stale/invalid data never becomes
 * scanner-eligible and this boundary grants no execution authority.
 */
export const readLatestUpbitUniverse = async (
  repository: UpbitUniverseSnapshotRepository,
  now: Date = new Date(),
  policy: UpbitUniverseFreshnessPolicy = DEFAULT_UPBIT_UNIVERSE_FRESHNESS_POLICY,
): Promise<UpbitUniverseReadModel> => {
  const record = await repository.latest();
  if (!record) return { record: null, scannerEligible: false, reason: 'NO_SNAPSHOT' };

  const freshness = evaluateUpbitUniverseFreshness(record.snapshot, now, policy);
  return {
    record,
    scannerEligible: freshness.scannerEligible,
    reason: freshness.reason,
  };
};
