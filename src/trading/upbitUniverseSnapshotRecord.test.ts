import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpbitKrwUniverse } from './upbitKrwUniverse';
import { toUpbitUniverseSnapshotRecord } from './upbitUniverseSnapshotRecord';

test('creates auditable public-universe persistence metadata', () => {
  const observedAt = new Date('2026-09-20T17:00:00.000Z');
  const recordedAt = new Date('2026-09-20T17:00:01.000Z');
  const snapshot = buildUpbitKrwUniverse([
    { market: 'KRW-BTC' },
    { market: 'KRW-XRP', market_event: { warning: true } },
  ], observedAt);

  const record = toUpbitUniverseSnapshotRecord(snapshot, recordedAt);
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.source, 'UPBIT_PUBLIC_MARKETS');
  assert.equal(record.observedAt, observedAt.toISOString());
  assert.equal(record.recordedAt, recordedAt.toISOString());
  assert.equal(record.entryCount, 2);
  assert.equal(record.eligibleCount, 1);
  assert.equal(record.snapshot, snapshot);
});

test('rejects persistence metadata that predates observation', () => {
  const snapshot = buildUpbitKrwUniverse([{ market: 'KRW-BTC' }], new Date('2026-09-20T17:00:00.000Z'));
  assert.throws(
    () => toUpbitUniverseSnapshotRecord(snapshot, new Date('2026-09-20T16:59:59.999Z')),
    /RECORDED_BEFORE_OBSERVED/,
  );
});

test('rejects an invalid persistence clock', () => {
  const snapshot = buildUpbitKrwUniverse([{ market: 'KRW-BTC' }], new Date('2026-09-20T17:00:00.000Z'));
  assert.throws(() => toUpbitUniverseSnapshotRecord(snapshot, new Date(Number.NaN)), /INVALID_RECORDED_AT/);
});
