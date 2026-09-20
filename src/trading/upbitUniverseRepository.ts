import type { UpbitUniverseSnapshotRecord } from './upbitUniverseSnapshotRecord';
import {
  evaluateUniverseFreshness,
  type UniverseFreshnessDecision,
  type UniverseFreshnessPolicy,
} from './upbitUniverseFreshness';

export interface UpbitUniverseSnapshotRepository {
  save(record: UpbitUniverseSnapshotRecord): Promise<void>;
  latest(): Promise<UpbitUniverseSnapshotRecord | null>;
}

export interface UpbitUniverseReadModel {
  record: UpbitUniverseSnapshotRecord | null;
  scannerEligible: boolean;
  reason: 'NO_SNAPSHOT' | UniverseFreshnessDecision['reason'];
}

/**
 * Reads the latest persisted public-market observation and re-evaluates freshness at read time.
 * Persisted last-good data remains available for audit, but stale/invalid data never becomes
 * scanner-eligible and this boundary grants no execution authority.
 */
export const readLatestUpbitUniverse = async (
  repository: UpbitUniverseSnapshotRepository,
  now: Date = new Date(),
  policy: UniverseFreshnessPolicy = { maxAgeMs: 5 * 60_000, maxFutureSkewMs: 30_000 },
): Promise<UpbitUniverseReadModel> => {
  const record = await repository.latest();
  if (!record) return { record: null, scannerEligible: false, reason: 'NO_SNAPSHOT' };

  const freshness = evaluateUniverseFreshness(record.snapshot, now, policy);
  return {
    record,
    scannerEligible: freshness.usable,
    reason: freshness.reason,
  };
};
