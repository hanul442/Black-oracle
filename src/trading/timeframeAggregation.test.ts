import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateCandles, buildCanonicalTimeframeSet } from './timeframeAggregation';
import type { Candle } from './types';

const minuteSeries = (count: number): Candle[] => Array.from({ length: count }, (_, index) => ({
  market: 'KRX-000000',
  timeframeMinutes: 1,
  timestamp: Date.UTC(2026, 8, 10, 0, 0) + index * 60_000,
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100.5 + index,
  volume: 1000 + index,
}));

const dailySeries = (count: number): Candle[] => Array.from({ length: count }, (_, index) => ({
  market: 'KRX-000000',
  timeframeMinutes: 1440,
  timestamp: Date.UTC(2026, 0, 1 + index, 6, 30),
  open: 100 + index,
  high: 102 + index,
  low: 99 + index,
  close: 101 + index,
  volume: 1_000_000 + index,
}));

test('aggregates minute bars into larger OHLCV bars', () => {
  const bars = aggregateCandles(minuteSeries(15), { timeframeMinutes: 5 }, 540);
  assert.equal(bars.length, 3);
  assert.equal(bars[0].open, 100);
  assert.equal(bars[0].close, 104.5);
  assert.equal(bars[0].high, 105);
  assert.equal(bars[0].low, 99);
});

test('builds intraday, daily, weekly and monthly canonical frames when history exists', () => {
  const set = buildCanonicalTimeframeSet({ oneMinute: minuteSeries(240), daily: dailySeries(90) });
  assert.ok(set.frames['5M']?.length);
  assert.ok(set.frames['15M']?.length);
  assert.ok(set.frames['1H']?.length);
  assert.ok(set.frames['4H']?.length);
  assert.ok(set.frames['1D']?.length);
  assert.ok(set.frames['1W']?.length);
  assert.ok(set.frames['1MO']?.length);
});

test('does not fabricate unavailable long frames', () => {
  const set = buildCanonicalTimeframeSet({ daily: dailySeries(5) });
  assert.ok(set.unavailable.includes('1W'));
  assert.ok(set.unavailable.includes('1MO'));
});
