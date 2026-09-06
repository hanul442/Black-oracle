import assert from 'node:assert/strict';
import test from 'node:test';
import type { Candle } from './types';
import { buildCandleDatasetIdentity, buildInputValidationRecord } from './validationDataset';
import { mergeInputValidationRecords } from './validationLedger';

const START = Date.parse('2026-01-01T00:00:00.000Z');
const STEP = 15 * 60_000;

const buildCandles = (count = 400): Candle[] => Array.from({ length: count }, (_, index) => ({
  market: 'KRW-BTC',
  timeframeMinutes: 15,
  timestamp: START + index * STEP,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 10,
  quoteVolume: 1_000,
}));

test('stable candle datasets reproduce the same SHA-256 identity', async () => {
  const candles = buildCandles();
  const first = await buildCandleDatasetIdentity(candles);
  const second = await buildCandleDatasetIdentity(candles.map((item) => ({ ...item })));

  assert.equal(first.datasetId, second.datasetId);
  assert.equal(first.checksum, second.checksum);
  assert.match(first.checksum, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.candleCount, 400);
  assert.equal(first.market, 'KRW-BTC');
  assert.equal(first.timeframeMinutes, 15);
});

test('a material candle change produces a different dataset checksum', async () => {
  const original = buildCandles();
  const changed = buildCandles();
  changed[399] = { ...changed[399], close: 100.5, high: 101.5 };

  const [left, right] = await Promise.all([
    buildCandleDatasetIdentity(original),
    buildCandleDatasetIdentity(changed),
  ]);
  assert.notEqual(left.checksum, right.checksum);
  assert.notEqual(left.datasetId, right.datasetId);
});

test('400-candle input validation records bind integrity and recursive warm-up evidence without execution authority', async () => {
  const candles = buildCandles();
  const evaluationCutoff = candles.at(-1)!.timestamp;
  const record = await buildInputValidationRecord(candles, evaluationCutoff);

  assert.equal(record.dataset.candleCount, 400);
  assert.equal(record.integrity.disposition, 'PASS');
  assert.equal(record.warmup?.baselineCandles, 400);
  assert.equal(record.warmup?.disposition, 'PASS');
  assert.equal(record.disposition, 'PASS');
  assert.equal(record.executionAuthority, false);
  assert.match(record.id, /^input-validation:[0-9a-f]{24}$/);

  const merged = mergeInputValidationRecords([record], [{ ...record }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].dataset.checksum, record.dataset.checksum);
});

test('insufficient history fails closed before recursive warm-up execution', async () => {
  const candles = buildCandles(300);
  const record = await buildInputValidationRecord(candles, candles.at(-1)!.timestamp);

  assert.equal(record.integrity.disposition, 'REJECT');
  assert.ok(record.integrity.issues.some((issue) => issue.code === 'INSUFFICIENT_WARMUP'));
  assert.equal(record.warmup, null);
  assert.equal(record.disposition, 'REJECT');
});
