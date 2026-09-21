import assert from 'node:assert/strict';
import test from 'node:test';

import {
  runUpbitKrwScannerFlow,
  type UpbitScannerFlowResult,
} from './upbitScannerFlow';
import { buildUpbitKrwUniverse } from './upbitKrwUniverse';
import type { UpbitUniverseSnapshotRepository } from './upbitUniverseRepository';
import { toUpbitUniverseSnapshotRecord } from './upbitUniverseSnapshotRecord';

const NOW = new Date('2026-09-21T06:00:00.000Z');

function memoryRepository(initial = null as ReturnType<typeof toUpbitUniverseSnapshotRecord> | null) {
  let record = initial;
  let saves = 0;
  const repository: UpbitUniverseSnapshotRepository = {
    async save(next) {
      record = next;
      saves += 1;
    },
    async latest() {
      return record;
    },
  };
  return {
    repository,
    get record() { return record; },
    get saves() { return saves; },
  };
}

function successfulFetch(markets: unknown[]) {
  return async () => ({
    ok: true,
    status: 200,
    async json() { return markets; },
  });
}

function assertNoAuthority(result: UpbitScannerFlowResult) {
  assert.equal(result.executionAuthority, false);
  assert.equal(result.capitalAuthority, false);
  assert.equal(result.liveAuthority, false);
}

test('persists public Upbit universe, reads it back, and derives scanner markets only from persisted state', async () => {
  const memory = memoryRepository();

  const result = await runUpbitKrwScannerFlow(successfulFetch([
    { market: 'KRW-XRP', market_event: { warning: true } },
    { market: 'BTC-ETH' },
    { market: 'KRW-BTC', korean_name: '비트코인' },
    { market: 'KRW-ETH', korean_name: '이더리움' },
  ]), memory.repository, NOW);

  assert.equal(result.status, 'READY');
  assert.equal(result.reason, 'READY');
  assert.equal(memory.saves, 1);
  assert.deepEqual(result.eligibleMarkets, ['KRW-BTC', 'KRW-ETH']);
  assert.equal(result.eligibleCount, 2);
  assert.equal(result.excludedCount, 1);
  assert.equal(result.record, memory.record);
  assertNoAuthority(result);
});

test('collector failure keeps prior record auditable but never makes failed cycle scanner-ready', async () => {
  const previous = toUpbitUniverseSnapshotRecord(
    buildUpbitKrwUniverse([{ market: 'KRW-BTC' }], new Date('2026-09-21T05:59:00.000Z')),
    new Date('2026-09-21T05:59:00.000Z'),
  );
  const memory = memoryRepository(previous);

  const result = await runUpbitKrwScannerFlow(async () => ({
    ok: false,
    status: 503,
    async json() { return []; },
  }), memory.repository, NOW);

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'COLLECTOR_ERROR');
  assert.equal(result.collectorError, 'UPBIT_HTTP_503');
  assert.equal(result.record, previous);
  assert.deepEqual(result.eligibleMarkets, []);
  assert.equal(memory.saves, 0);
  assertNoAuthority(result);
});

test('persistence write failure fails closed', async () => {
  const repository: UpbitUniverseSnapshotRepository = {
    async save() { throw new Error('db unavailable'); },
    async latest() { return null; },
  };

  const result = await runUpbitKrwScannerFlow(
    successfulFetch([{ market: 'KRW-BTC' }]),
    repository,
    NOW,
  );

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'PERSISTENCE_WRITE_FAILED');
  assert.deepEqual(result.eligibleMarkets, []);
  assertNoAuthority(result);
});

test('fresh but different repository read-back fails lineage check', async () => {
  const different = toUpbitUniverseSnapshotRecord(
    buildUpbitKrwUniverse([{ market: 'KRW-ETH' }], new Date('2026-09-21T05:59:30.000Z')),
    new Date('2026-09-21T05:59:30.000Z'),
  );
  const repository: UpbitUniverseSnapshotRepository = {
    async save() { /* intentionally ignored */ },
    async latest() { return different; },
  };

  const result = await runUpbitKrwScannerFlow(
    successfulFetch([{ market: 'KRW-BTC' }]),
    repository,
    NOW,
  );

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'PERSISTENCE_READBACK_MISMATCH');
  assert.deepEqual(result.eligibleMarkets, []);
  assertNoAuthority(result);
});

test('stale persisted read-back fails closed before lineage can be consumed', async () => {
  const stale = toUpbitUniverseSnapshotRecord(
    buildUpbitKrwUniverse([{ market: 'KRW-BTC' }], new Date('2026-09-21T05:50:00.000Z')),
    new Date('2026-09-21T05:50:00.000Z'),
  );
  const repository: UpbitUniverseSnapshotRepository = {
    async save() { /* intentionally ignored */ },
    async latest() { return stale; },
  };

  const result = await runUpbitKrwScannerFlow(
    successfulFetch([{ market: 'KRW-ETH' }]),
    repository,
    NOW,
  );

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'STALE');
  assert.deepEqual(result.eligibleMarkets, []);
  assertNoAuthority(result);
});

test('zero eligible KRW markets is explicit and blocked', async () => {
  const memory = memoryRepository();
  const result = await runUpbitKrwScannerFlow(successfulFetch([
    { market: 'BTC-ETH' },
    { market: 'KRW-XRP', market_event: { warning: true } },
  ]), memory.repository, NOW);

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'NO_ELIGIBLE_MARKETS');
  assert.equal(result.record?.snapshot.krwObserved, 1);
  assert.equal(result.record?.snapshot.excludedCount, 1);
  assert.deepEqual(result.eligibleMarkets, []);
  assertNoAuthority(result);
});

test('repository read failure after successful persistence fails closed', async () => {
  const repository: UpbitUniverseSnapshotRepository = {
    async save() { /* accepted */ },
    async latest() { throw new Error('read unavailable'); },
  };

  const result = await runUpbitKrwScannerFlow(
    successfulFetch([{ market: 'KRW-BTC' }]),
    repository,
    NOW,
  );

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'REPOSITORY_READ_FAILED');
  assert.deepEqual(result.eligibleMarkets, []);
  assertNoAuthority(result);
});
