import { eligibleUpbitKrwMarkets } from './upbitKrwUniverse';
import {
  collectUpbitPublicMarketUniverse,
  type PublicMarketFetch,
} from './upbitPublicMarketCollector';
import {
  readLatestUpbitUniverse,
  type UpbitUniverseReadModel,
  type UpbitUniverseSnapshotRepository,
} from './upbitUniverseRepository';
import {
  toUpbitUniverseSnapshotRecord,
  type UpbitUniverseSnapshotRecord,
} from './upbitUniverseSnapshotRecord';
import type { UniverseFreshnessPolicy } from './upbitUniverseFreshness';

export const BOT_UPBIT_SCANNER_FLOW_SCHEMA = 'bot.upbit-scanner-flow.v1' as const;

export type UpbitScannerFlowReason =
  | 'READY'
  | 'COLLECTOR_ERROR'
  | 'COLLECTION_NOT_FRESH'
  | 'PERSISTENCE_WRITE_FAILED'
  | 'REPOSITORY_READ_FAILED'
  | 'NO_SNAPSHOT'
  | 'STALE'
  | 'FUTURE_TIMESTAMP'
  | 'INVALID_TIMESTAMP'
  | 'PERSISTENCE_READBACK_MISMATCH'
  | 'NO_ELIGIBLE_MARKETS';

export interface UpbitScannerFlowResult {
  schema: typeof BOT_UPBIT_SCANNER_FLOW_SCHEMA;
  status: 'READY' | 'BLOCKED';
  reason: UpbitScannerFlowReason;
  observedAt: string | null;
  recordedAt: string | null;
  eligibleMarkets: readonly string[];
  eligibleCount: number;
  excludedCount: number;
  collectorError: string | null;
  record: UpbitUniverseSnapshotRecord | null;
  executionAuthority: false;
  capitalAuthority: false;
  liveAuthority: false;
}

const DEFAULT_FRESHNESS_POLICY: UniverseFreshnessPolicy = {
  maxAgeMs: 5 * 60_000,
  maxFutureSkewMs: 30_000,
};

function blocked(
  reason: UpbitScannerFlowReason,
  record: UpbitUniverseSnapshotRecord | null,
  collectorError: string | null,
): Readonly<UpbitScannerFlowResult> {
  return Object.freeze({
    schema: BOT_UPBIT_SCANNER_FLOW_SCHEMA,
    status: 'BLOCKED',
    reason,
    observedAt: record?.observedAt ?? null,
    recordedAt: record?.recordedAt ?? null,
    eligibleMarkets: Object.freeze([]),
    eligibleCount: 0,
    excludedCount: record?.snapshot.excludedCount ?? 0,
    collectorError,
    record,
    executionAuthority: false,
    capitalAuthority: false,
    liveAuthority: false,
  });
}

async function auditRead(
  repository: UpbitUniverseSnapshotRepository,
  now: Date,
  policy: UniverseFreshnessPolicy,
): Promise<{ read: UpbitUniverseReadModel | null; error: boolean }> {
  try {
    return {
      read: await readLatestUpbitUniverse(repository, now, policy),
      error: false,
    };
  } catch {
    return { read: null, error: true };
  }
}

/**
 * End-to-end, public-data-only scanner input flow.
 *
 * Final eligible markets are derived only from the repository read-back record.
 * Any collection/persistence/freshness/lineage problem fails closed and grants no
 * execution, capital, portfolio or LIVE authority.
 */
export async function runUpbitKrwScannerFlow(
  fetchMarket: PublicMarketFetch,
  repository: UpbitUniverseSnapshotRepository,
  now: Date = new Date(),
  policy: UniverseFreshnessPolicy = DEFAULT_FRESHNESS_POLICY,
): Promise<Readonly<UpbitScannerFlowResult>> {
  const collection = await collectUpbitPublicMarketUniverse(fetchMarket, now);

  if (!collection.snapshot || collection.error) {
    const audit = await auditRead(repository, now, policy);
    return blocked(
      audit.error ? 'REPOSITORY_READ_FAILED' : 'COLLECTOR_ERROR',
      audit.read?.record ?? null,
      collection.error,
    );
  }

  if (!collection.scannerEligible || collection.freshness?.usable !== true) {
    return blocked('COLLECTION_NOT_FRESH', null, collection.error);
  }

  const record = toUpbitUniverseSnapshotRecord(collection.snapshot, now);

  try {
    await repository.save(record);
  } catch {
    return blocked('PERSISTENCE_WRITE_FAILED', record, null);
  }

  const audit = await auditRead(repository, now, policy);
  if (audit.error || !audit.read) {
    return blocked('REPOSITORY_READ_FAILED', record, null);
  }
  if (!audit.read.record) {
    return blocked('NO_SNAPSHOT', null, null);
  }
  if (!audit.read.scannerEligible) {
    return blocked(audit.read.reason, audit.read.record, null);
  }

  const persisted = audit.read.record;
  if (
    persisted.observedAt !== record.observedAt
    || persisted.recordedAt !== record.recordedAt
    || persisted.source !== record.source
  ) {
    return blocked('PERSISTENCE_READBACK_MISMATCH', persisted, null);
  }

  const eligibleMarkets = eligibleUpbitKrwMarkets(persisted.snapshot);
  if (eligibleMarkets.length === 0) {
    return blocked('NO_ELIGIBLE_MARKETS', persisted, null);
  }

  return Object.freeze({
    schema: BOT_UPBIT_SCANNER_FLOW_SCHEMA,
    status: 'READY',
    reason: 'READY',
    observedAt: persisted.observedAt,
    recordedAt: persisted.recordedAt,
    eligibleMarkets: Object.freeze([...eligibleMarkets]),
    eligibleCount: eligibleMarkets.length,
    excludedCount: persisted.snapshot.excludedCount,
    collectorError: null,
    record: persisted,
    executionAuthority: false,
    capitalAuthority: false,
    liveAuthority: false,
  });
}
