import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpbitKrwUniverse, eligibleUpbitKrwMarkets } from './upbitKrwUniverse';

test('builds a deterministic KRW-only universe without granting execution authority', () => {
  const snapshot = buildUpbitKrwUniverse([
    { market: 'BTC-ETH', korean_name: '이더리움', english_name: 'Ethereum' },
    { market: 'krw-xrp', korean_name: '리플', english_name: 'XRP' },
    { market: 'KRW-BTC', korean_name: '비트코인', english_name: 'Bitcoin' },
  ], new Date('2026-09-20T12:00:00.000Z'));

  assert.equal(snapshot.source, 'UPBIT_MARKET_ALL');
  assert.equal(snapshot.totalObserved, 3);
  assert.equal(snapshot.krwObserved, 2);
  assert.deepEqual(snapshot.entries.map((entry) => entry.market), ['KRW-BTC', 'KRW-XRP']);
  assert.deepEqual(eligibleUpbitKrwMarkets(snapshot), ['KRW-BTC', 'KRW-XRP']);
});

test('warning and caution markets fail closed but remain visible for audit', () => {
  const snapshot = buildUpbitKrwUniverse([
    {
      market: 'KRW-AAA',
      market_event: { warning: true, caution: { PRICE_FLUCTUATIONS: false } },
    },
    {
      market: 'KRW-BBB',
      market_event: { warning: false, caution: { TRADING_VOLUME_SOARING: true, DEPOSIT_AMOUNT_SOARING: true } },
    },
    { market: 'KRW-CCC', market_event: { warning: false, caution: {} } },
  ]);

  assert.equal(snapshot.eligibleCount, 1);
  assert.equal(snapshot.excludedCount, 2);
  assert.deepEqual(eligibleUpbitKrwMarkets(snapshot), ['KRW-CCC']);
  assert.deepEqual(snapshot.entries.find((entry) => entry.market === 'KRW-AAA')?.exclusionReasons, ['UPBIT_WARNING']);
  assert.deepEqual(snapshot.entries.find((entry) => entry.market === 'KRW-BBB')?.exclusionReasons, ['UPBIT_CAUTION']);
  assert.deepEqual(
    snapshot.entries.find((entry) => entry.market === 'KRW-BBB')?.cautionReasons,
    ['DEPOSIT_AMOUNT_SOARING', 'TRADING_VOLUME_SOARING'],
  );
});

test('duplicate market rows resolve conservatively to the restricted observation', () => {
  const snapshot = buildUpbitKrwUniverse([
    { market: 'KRW-BTC', market_event: { warning: false } },
    { market: 'KRW-BTC', market_event: { warning: true } },
  ]);

  assert.equal(snapshot.krwObserved, 1);
  assert.equal(snapshot.eligibleCount, 0);
  assert.deepEqual(snapshot.entries[0]?.exclusionReasons, ['UPBIT_WARNING']);
});

test('rejects invalid observation timestamps', () => {
  assert.throws(() => buildUpbitKrwUniverse([], new Date('invalid')), /observedAt must be a valid Date/);
});
