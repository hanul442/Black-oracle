import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCandleIntegrity, assertCandleIntegrity } from './validationIntegrity';
import type { Candle } from './types';

const candles = (count = 200, start = 1_000_000, spacing = 60_000): Candle[] => Array.from({ length: count }, (_, index) => {
  const close = 100 + index * 0.1;
  return {
    market: 'KRW-TEST',
    timeframeMinutes: 1,
    timestamp: start + index * spacing,
    open: close - 0.05,
    high: close + 0.1,
    low: close - 0.1,
    close,
    volume: 100 + index,
    quoteVolume: (100 + index) * close,
  };
});

test('clean chronological candles pass the pre-strategy integrity gate', () => {
  const input = candles();
  const result = assessCandleIntegrity(input, { asOf: input[input.length - 1].timestamp });
  assert.equal(result.disposition, 'PASS');
  assert.equal(result.sampleCount, 200);
  assert.equal(result.issues.length, 0);
  assert.equal(result.provenance.futureCandlesBlocked, true);
  assert.equal(result.provenance.chronologyCheckedOnSuppliedOrder, true);
});

test('future candles are rejected instead of being silently sorted or consumed', () => {
  const input = candles();
  const asOf = input[input.length - 2].timestamp;
  const result = assessCandleIntegrity(input, { asOf });
  assert.equal(result.disposition, 'REJECT');
  assert.ok(result.issues.some((issue) => issue.code === 'LOOKAHEAD_CANDLE' && issue.severity === 'BLOCK'));
  assert.throws(() => assertCandleIntegrity(input, { asOf }), /LOOKAHEAD_CANDLE/);
});

test('invalid timestamps are a distinct blocker from lookahead data', () => {
  const input = candles();
  input[50] = { ...input[50], timestamp: Number.NaN };
  const result = assessCandleIntegrity(input, { asOf: input[input.length - 1].timestamp });
  assert.equal(result.disposition, 'REJECT');
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_TIMESTAMP'));
  assert.ok(!result.issues.some((issue) => issue.code === 'LOOKAHEAD_CANDLE' && issue.candleIndex === 50));
});

test('duplicate and non-monotonic timestamps are blocking provenance failures', () => {
  const input = candles();
  input[100] = { ...input[100], timestamp: input[99].timestamp };
  const result = assessCandleIntegrity(input, { asOf: input[input.length - 1].timestamp });
  assert.equal(result.disposition, 'REJECT');
  assert.ok(result.issues.some((issue) => issue.code === 'DUPLICATE_TIMESTAMP'));
  assert.ok(result.issues.some((issue) => issue.code === 'NON_MONOTONIC_TIMESTAMP'));
});

test('insufficient warm-up blocks evaluation and large data gaps remain visible as warnings', () => {
  const short = candles(199);
  const shortResult = assessCandleIntegrity(short, { asOf: short[short.length - 1].timestamp });
  assert.equal(shortResult.disposition, 'REJECT');
  assert.ok(shortResult.issues.some((issue) => issue.code === 'INSUFFICIENT_WARMUP'));

  const gapped = candles();
  const shift = 3 * 60_000;
  for (let index = 100; index < gapped.length; index += 1) gapped[index] = { ...gapped[index], timestamp: gapped[index].timestamp + shift };
  const gapResult = assessCandleIntegrity(gapped, { asOf: gapped[gapped.length - 1].timestamp });
  assert.equal(gapResult.disposition, 'WATCH');
  assert.ok(gapResult.issues.some((issue) => issue.code === 'UNEXPECTED_GAP' && issue.severity === 'WARN'));
});

test('invalid OHLC and volume values fail closed', () => {
  const input = candles();
  input[20] = { ...input[20], high: input[20].low - 1, volume: -1 };
  const result = assessCandleIntegrity(input, { asOf: input[input.length - 1].timestamp });
  assert.equal(result.disposition, 'REJECT');
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_OHLC'));
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_VOLUME'));
});
