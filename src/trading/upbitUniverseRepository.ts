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

export type UpbitUniverseReadReason = 'NO_SNAPSHOT' | UniverseFreshnessDecision['reason'];

export interface UpbitUniverseReadModel {
  record: UpbitUniverseSnapshotRecord | null;
  scannerEligible: boolean;
  reason: UpbitUniverseReadReason;
}

/**
 * Read-time fail-closed boundary for persisted public Upbit market metadata.
 *
 * A last-good record remains available for audit/replay, but scanner eligibility is
 * recomputed from the canonical freshness policy every time it is read. This boundary
 * grants no execution, portfolio, broker, or LIVE authority.
 */
export const readLatestUpbitUniverse = async (
  repository: UpbitUniverseSnapshotRepository,
  now: Date = new Date(),
  policy: UniverseFreshnessPolicy = { maxAgeMs: 5 * 60_000, maxFutureSkewMs: 30_000 },
): Promise<UpbitUniverseReadModel> => {
  const record = await repository.latest();
  if (!record) {
    return { record: null, scannerEligible: false, reason: 'NO_SNAPSHOT' };
  }

  const freshness = evaluateUniverseFreshness(record.snapshot, now, policy);
  return {
    record,
    scannerEligible: freshness.usable,
    reason: freshness.reason,
  };
};
