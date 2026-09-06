import assert from 'node:assert/strict';
import test from 'node:test';
import type { Candle } from '../../src/trading/types';
import { paginateMinuteCandleHistory, type MinuteCandlePageRequest, type MinuteCandlePageReader } from './upbitPublic';

const START = Date.parse('2026-01-01T00:00:00.000Z');
const STEP = 15 * 60_000;

const candle = (index: number): Candle => ({
  market: 'KRW-BTC',
  timeframeMinutes: 15,
  timestamp: START + index * STEP,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 10,
  quoteVolume: 1_000,
});

test('paginates 400 candles with the earliest candle as the next exclusive cursor', async () => {
  const source = Array.from({ length: 450 }, (_, index) => candle(index));
  const requests: MinuteCandlePageRequest[] = [];
  const reader: MinuteCandlePageReader = async (request) => {
    requests.push({ ...request });
    const cursor = request.to ? Date.parse(request.to) : Number.POSITIVE_INFINITY;
    return source.filter((item) => item.timestamp < cursor).slice(-request.count);
  };

  const result = await paginateMinuteCandleHistory({ market: 'KRW-BTC', unit: 15, count: 400 }, reader);

  assert.equal(result.length, 400);
  assert.equal(result[0].timestamp, source[50].timestamp);
  assert.equal(result.at(-1)?.timestamp, source.at(-1)?.timestamp);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].to, undefined);
  assert.equal(requests[1].to, new Date(source[250].timestamp).toISOString());
  assert.ok(result.every((item, index) => index === 0 || item.timestamp > result[index - 1].timestamp));
});

test('fails closed when an API page repeats a boundary candle', async () => {
  const page = Array.from({ length: 200 }, (_, index) => candle(index + 200));
  let call = 0;
  const reader: MinuteCandlePageReader = async () => {
    call += 1;
    return call === 1 ? page : page;
  };

  await assert.rejects(
    () => paginateMinuteCandleHistory({ market: 'KRW-BTC', unit: 15, count: 400 }, reader),
    /Duplicate candle timestamp/,
  );
});

test('bounds paginated history requests to the Sprint 7 research limit', async () => {
  const reader: MinuteCandlePageReader = async () => [];
  await assert.rejects(
    () => paginateMinuteCandleHistory({ market: 'KRW-BTC', unit: 15, count: 1_001 }, reader),
    /between 1 and 1000/,
  );
});
