import type { UpbitKrwUniverseSnapshot } from './upbitKrwUniverse';

export const UPBIT_UNIVERSE_SCHEMA_VERSION = 1 as const;

export interface UpbitUniverseSnapshotRecord {
  schemaVersion: typeof UPBIT_UNIVERSE_SCHEMA_VERSION;
  source: UpbitKrwUniverseSnapshot['source'];
  observedAt: string;
  recordedAt: string;
  entryCount: number;
  eligibleCount: number;
  snapshot: UpbitKrwUniverseSnapshot;
}

/**
 * Persistence boundary for BOT market-universe observations.
 * This record contains public market metadata only and grants no execution authority.
 */
export const toUpbitUniverseSnapshotRecord = (
  snapshot: UpbitKrwUniverseSnapshot,
  recordedAt: Date = new Date(),
): UpbitUniverseSnapshotRecord => {
  const recordedAtMs = recordedAt.getTime();
  if (!Number.isFinite(recordedAtMs)) throw new Error('INVALID_RECORDED_AT');

  const observedAtMs = Date.parse(snapshot.observedAt);
  if (!Number.isFinite(observedAtMs)) throw new Error('INVALID_OBSERVED_AT');
  if (recordedAtMs < observedAtMs) throw new Error('RECORDED_BEFORE_OBSERVED');

  return {
    schemaVersion: UPBIT_UNIVERSE_SCHEMA_VERSION,
    source: snapshot.source,
    observedAt: snapshot.observedAt,
    recordedAt: recordedAt.toISOString(),
    entryCount: snapshot.entries.length,
    eligibleCount: snapshot.entries.filter((entry) => entry.eligible).length,
    snapshot,
  };
};
