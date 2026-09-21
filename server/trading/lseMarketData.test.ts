import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLseUrl,
  lseTimeframeForMinutes,
  normalizeLseCandles,
} from '../market/lseMarketData';

test('LSE timeframe mapping covers BLACK ORACLE chart units', () => {
  assert.equal(lseTimeframeForMinutes(1), '1m');
  assert.equal(lseTimeframeForMinutes(60), '1h');
  assert.equal(lseTimeframeForMinutes(1_440), '1d');
  assert.equal(lseTimeframeForMinutes(10_080), '1w');
  assert.equal(lseTimeframeForMinutes(43_200), '1mo');
  assert.equal(lseTimeframeForMinutes(10), null);
});

test('LSE URL builder preserves slash symbols and filters empty params', () => {
  const previous = process.env.LSE_VAULT_URL;
  process.env.LSE_VAULT_URL = 'https://example.test/vault/';
  const url = buildLseUrl('/candles', {
    symbol: 'BTC/USD',
    timeframe: '1h',
    dataset: undefined,
  });
  assert.equal(url.origin, 'https://example.test');
  assert.equal(url.pathname, '/vault/candles');
  assert.equal(url.searchParams.get('symbol'), 'BTC/USD');
  assert.equal(url.searchParams.get('timeframe'), '1h');
  assert.equal(url.searchParams.has('dataset'), false);
  if (previous == null) delete process.env.LSE_VAULT_URL;
  else process.env.LSE_VAULT_URL = previous;
});

test('LSE candles normalize timestamps, numeric strings, ordering, and missing FX volume', () => {
  const rows = normalizeLseCandles([
    { ts: '2026-09-21T10:01:00Z', open: '101', high: '102', low: '100', close: '101.5' },
    { ts: '2026-09-21T10:00:00Z', open: 100, high: 101, low: 99, close: 100.5, volume: 12 },
    { ts: 'bad-date', open: 1, high: 1, low: 1, close: 1 },
  ], 1);

  assert.equal(rows.length, 2);
  assert.ok(rows[0]!.timestamp < rows[1]!.timestamp);
  assert.equal(rows[0]!.volume, 12);
  assert.equal(rows[1]!.volume, 0);
  assert.equal(rows[1]!.close, 101.5);
});
