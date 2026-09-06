import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketStructure } from './marketStructure';
import type { Candle } from './types';

const highs = [10, 11, 12, 13, 14, 15, 14, 13, 14, 16.5, 17, 18, 17.5, 17, 16.5, 16];
const lows = [8.5, 9, 9.5, 10, 10.5, 11, 11.5, 11, 11.5, 12.5, 14.5, 15.5, 15, 14.5, 14, 13.5];
const closes = [9.5, 10.5, 11, 12, 13, 14, 13, 12.5, 13.5, 16, 16.5, 17.5, 16.5, 15.5, 15, 14.5];

const candles: Candle[] = highs.map((high, index) => ({
  market: 'KRW-BTC',
  timeframeMinutes: 60,
  timestamp: 1_700_000_000_000 + index * 60 * 60 * 1000,
  open: index === 0 ? closes[index] : closes[index - 1],
  high,
  low: lows[index],
  close: closes[index],
  volume: 100 + index,
}));

test('market structure only uses pivots after right-side confirmation and emits close-confirmed BOS', () => {
  const result = buildMarketStructure(candles, { leftBars: 2, rightBars: 2 });
  assert.ok(result.lastSwingHigh);
  assert.ok(result.lastSwingHigh.confirmedAt > result.lastSwingHigh.timestamp);
  assert.ok(result.lastEvent);
  assert.equal(result.lastEvent.direction, 'BULLISH');
  assert.equal(result.lastEvent.type, 'BOS');
  assert.ok(result.lastEvent.confirmedAt > result.lastEvent.brokenSwingTimestamp);
  assert.ok(result.lastEvent.breakPrice > result.lastEvent.brokenSwingPrice);
});

test('intrabar sweep without a close beyond the swing is not promoted to BOS', () => {
  const base = candles.slice(0, 12);
  const snapshot = buildMarketStructure(base, { leftBars: 2, rightBars: 2 });
  const high = snapshot.lastSwingHigh?.price;
  assert.ok(high);

  const sweep: Candle = {
    ...base[base.length - 1],
    timestamp: base[base.length - 1].timestamp + 60 * 60 * 1000,
    open: high - 0.5,
    high: high + 1,
    low: high - 1.5,
    close: high - 0.25,
  };
  const extended = [...base, sweep, { ...sweep, timestamp: sweep.timestamp + 60 * 60 * 1000, high: high - 0.1, low: high - 2, close: high - 1 }];
  const result = buildMarketStructure(extended, { leftBars: 2, rightBars: 2 });
  assert.notEqual(result.lastEvent?.confirmedAt, sweep.timestamp);
});
