import assert from 'node:assert/strict';
import test from 'node:test';

import { buildUpbitKrwUniverse } from './upbitKrwUniverse';
import { readLatestUpbitUniverse, type UpbitUniverseSnapshotRepository } from './upbitUniverseRepository';
import { toUpbitUniverseSnapshotRecord } from './upbitUniverseSnapshotRecord';

const makeRecord = (observedAt: string) =>
  toUpbitUniverseSnapshotRecord(
    buildUpbitKrwUniverse([{ market: 'KRW-BTC', korean_name: '비트코인', english_name: 'Bitcoin' }], observedAt),
    new Date(observedAt),
  );

test('fails closed when no persisted universe exists', async () => {
  const repository: UpbitUniverseSnapshotRepository = {
    save: async () => undefined,
    latest: async () => null,
  };

  assert.deepEqual(await readLatestUpbitUniverse(repository, new Date('2026-09-21T00:00:00.000Z')), {
    record: null,
    scannerEligible: false,
    reason: 'NO_SNAPSHOT',
  });
});

test('fresh persisted universe is scanner eligible', async () => {
  const record = makeRecord('2026-09-21T00:00:00.000Z');
  const repository: UpbitUniverseSnapshotRepository = {
    save: async () => undefined,
    latest: async () => record,
  };

  const result = await readLatestUpbitUniverse(repository, new Date('2026-09-21T00:04:59.000Z'));
  assert.equal(result.record, record);
  assert.equal(result.scannerEligible, true);
  assert.equal(result.reason, 'FRESH');
});

test('stale last-good universe remains auditable but is not scanner eligible', async () => {
  const record = makeRecord('2026-09-21T00:00:00.000Z');
  const repository: UpbitUniverseSnapshotRepository = {
    save: async () => undefined,
    latest: async () => record,
  };

  const result = await readLatestUpbitUniverse(repository, new Date('2026-09-21T00:05:01.000Z'));
  assert.equal(result.record, record);
  assert.equal(result.scannerEligible, false);
  assert.equal(result.reason, 'STALE');
});
