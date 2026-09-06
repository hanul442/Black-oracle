import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupportedUpbitMinuteUnit } from '../../src/trading/config';
import type { Candle } from '../../src/trading/types';
import { buildMarketInputValidationEvidence, REQUIRED_PROMOTION_TIMEFRAMES, type HistoricalCandleReader } from './inputValidationEvidence';

const CUTOFF = Date.parse('2026-09-06T10:00:00.000Z');

const candlesFor = (unit: SupportedUpbitMinuteUnit, count = 400): Candle[] => {
  const step = unit * 60_000;
  const start = CUTOFF - step * count;
  return Array.from({ length: count }, (_, index) => ({
    market: 'KRW-BTC',
    timeframeMinutes: unit,
    timestamp: start + step * index,
    open: 100 + index * 0.01,
    high: 101 + index * 0.01,
    low: 99 + index * 0.01,
    close: 100.5 + index * 0.01,
    volume: 10 + index * 0.001,
    quoteVolume: 1_000 + index,
  }));
};

test('builds PASS provenance for all three strategy timeframes', async () => {
  const calls: Array<{ market: string; unit: SupportedUpbitMinuteUnit; count: number }> = [];
  const reader: HistoricalCandleReader = async (market, unit, count) => {
    calls.push({ market, unit, count });
    return candlesFor(unit, count);
  };

  const evidence = await buildMarketInputValidationEvidence('krw-btc', { evaluationCutoff: CUTOFF, reader });

  assert.equal(evidence.market, 'KRW-BTC');
  assert.deepEqual(evidence.requiredTimeframes, [15, 60, 240]);
  assert.equal(evidence.records.length, 3);
  assert.equal(evidence.disposition, 'PASS');
  assert.equal(evidence.records.every((record) => record.disposition === 'PASS'), true);
  assert.deepEqual(calls.map((call) => call.unit), [...REQUIRED_PROMOTION_TIMEFRAMES]);
  assert.equal(calls.every((call) => call.count === 400), true);
  assert.equal(new Set(evidence.records.map((record) => record.dataset.datasetId)).size, 3);
  assert.equal(evidence.executionAuthority, false);
  assert.equal(evidence.promotionAuthority, false);
});

test('one insufficient timeframe rejects the multi-timeframe evidence bundle', async () => {
  const reader: HistoricalCandleReader = async (_market, unit, count) => unit === 60 ? candlesFor(unit, 300) : candlesFor(unit, count);
  const evidence = await buildMarketInputValidationEvidence('KRW-BTC', { evaluationCutoff: CUTOFF, reader });

  assert.equal(evidence.disposition, 'REJECT');
  const oneHour = evidence.records.find((record) => record.dataset.timeframeMinutes === 60);
  assert.equal(oneHour?.integrity.disposition, 'REJECT');
  assert.ok(oneHour?.integrity.issues.some((issue) => issue.code === 'INSUFFICIENT_WARMUP'));
});

test('requests are clamped to the bounded historical research limit', async () => {
  const counts: number[] = [];
  const reader: HistoricalCandleReader = async (_market, unit, count) => {
    counts.push(count);
    return candlesFor(unit, count);
  };
  const evidence = await buildMarketInputValidationEvidence('KRW-BTC', { evaluationCutoff: CUTOFF, candlesPerTimeframe: 9_999, reader });
  assert.equal(evidence.requestedCandlesPerTimeframe, 1_000);
  assert.deepEqual(counts, [1_000, 1_000, 1_000]);
});
