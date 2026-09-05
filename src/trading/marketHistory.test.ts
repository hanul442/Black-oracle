import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAlignedMarketReturnSeries, type MarketPriceSnapshot } from './marketHistory';

const snapshots: MarketPriceSnapshot[] = Array.from({ length: 12 }, (_, index) => ({
  timestamp: 1_000 + index * 900_000,
  prices: [
    ['KRW-BTC', 100 + index * 2],
    ['KRW-ETH', 50 + index],
  ],
}));

test('builds equal-length return series from shared cycle timestamps', () => {
  const series = buildAlignedMarketReturnSeries(snapshots, ['KRW-BTC', 'KRW-ETH']);
  assert.equal(series.length, 2);
  assert.equal(series[0].returns.length, 11);
  assert.equal(series[1].returns.length, 11);
});

test('drops snapshots missing any requested market rather than misaligning returns', () => {
  const withGap = snapshots.map((snapshot, index) => index === 5
    ? { ...snapshot, prices: snapshot.prices.filter(([market]) => market !== 'KRW-ETH') }
    : snapshot);
  const series = buildAlignedMarketReturnSeries(withGap, ['KRW-BTC', 'KRW-ETH']);
  assert.equal(series[0].returns.length, 10);
  assert.equal(series[1].returns.length, 10);
});

test('invalid or empty market requests do not fabricate correlation inputs', () => {
  assert.deepEqual(buildAlignedMarketReturnSeries(snapshots, []), []);
});
