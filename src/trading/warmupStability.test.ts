import test from 'node:test';
import assert from 'node:assert/strict';
import { assessIndicatorWarmupStability } from './warmupStability';
import type { Candle } from './types';

const series = (count: number, closeAt: (index: number) => number): Candle[] => Array.from({ length: count }, (_, index) => {
  const close = closeAt(index);
  return {
    market: 'KRW-TEST',
    timeframeMinutes: 60,
    timestamp: 1_700_000_000_000 + index * 3_600_000,
    open: close,
    high: close + 1,
    low: Math.max(0.01, close - 1),
    close,
    volume: 1_000,
  };
});

test('constant-price history is stable across recursive warmup windows', () => {
  const result = assessIndicatorWarmupStability(series(400, () => 100));
  assert.equal(result.disposition, 'PASS');
  assert.equal(result.baselineCandles, 400);
  assert.equal(result.comparedWindows.length, 3);
  assert.equal(result.maxNormalizedDrift, 0);
  assert.equal(result.provenance.terminalTimestampHeldConstant, true);
});

test('large initialization sensitivity can be rejected with an explicit governance threshold', () => {
  const input = series(400, (index) => index < 180 ? 250 : 100 + (index - 180) * 0.03);
  const result = assessIndicatorWarmupStability(input, { windows: [200, 400], watchThreshold: 0.00001, rejectThreshold: 0.0001 });
  assert.equal(result.disposition, 'REJECT');
  assert.ok((result.maxNormalizedDrift ?? 0) > 0.0001);
  assert.equal(result.comparedWindows[0].candles, 200);
});

test('fewer than two eligible windows returns insufficient data instead of false confidence', () => {
  const result = assessIndicatorWarmupStability(series(220, () => 100));
  assert.equal(result.disposition, 'INSUFFICIENT_DATA');
  assert.equal(result.maxNormalizedDrift, null);
});
