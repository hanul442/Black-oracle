import test from 'node:test';
import assert from 'node:assert/strict';
import { collectUpbitPublicMarketUniverse, UPBIT_MARKET_ALL_URL } from './upbitPublicMarketCollector';
import { buildUpbitKrwUniverse } from './upbitKrwUniverse';

const now = new Date('2026-09-20T16:30:00.000Z');

test('collects only a fresh public KRW universe and keeps it as last-good', async () => {
  let requested = '';
  const result = await collectUpbitPublicMarketUniverse(async (url) => {
    requested = url;
    return {
      ok: true,
      status: 200,
      async json() {
        return [
          { market: 'KRW-BTC', korean_name: '비트코인' },
          { market: 'BTC-ETH', korean_name: '이더리움' },
          { market: 'KRW-XRP', market_event: { warning: true } },
        ];
      },
    };
  }, now);

  assert.equal(requested, UPBIT_MARKET_ALL_URL);
  assert.equal(result.error, null);
  assert.equal(result.scannerEligible, true);
  assert.deepEqual(result.snapshot?.entries.map((entry) => [entry.market, entry.eligible]), [
    ['KRW-BTC', true],
    ['KRW-XRP', false],
  ]);
  assert.equal(result.lastGoodSnapshot, result.snapshot);
});

test('fails closed on HTTP failure while retaining last-good only for audit', async () => {
  const lastGood = buildUpbitKrwUniverse([{ market: 'KRW-BTC' }], new Date('2026-09-20T16:20:00.000Z'));
  const result = await collectUpbitPublicMarketUniverse(async () => ({
    ok: false,
    status: 503,
    async json() { return []; },
  }), now, lastGood);

  assert.equal(result.snapshot, null);
  assert.equal(result.lastGoodSnapshot, lastGood);
  assert.equal(result.scannerEligible, false);
  assert.equal(result.freshness?.reason, 'STALE');
  assert.equal(result.error, 'UPBIT_HTTP_503');
});

test('fails closed on malformed public payload', async () => {
  const result = await collectUpbitPublicMarketUniverse(async () => ({
    ok: true,
    status: 200,
    async json() { return { market: 'KRW-BTC' }; },
  }), now);

  assert.equal(result.snapshot, null);
  assert.equal(result.lastGoodSnapshot, null);
  assert.equal(result.scannerEligible, false);
  assert.equal(result.error, 'UPBIT_INVALID_MARKET_PAYLOAD');
});
