import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLargeParticipantFootprint } from './largeParticipantFootprint';
import type { Candle } from './types';

const series = (last: Partial<Candle> = {}): Candle[] => {
  const rows: Candle[] = Array.from({ length: 21 }, (_, index) => ({
    market: 'KRX-000000',
    timeframeMinutes: 1440,
    timestamp: index * 86_400_000,
    open: 100 + index * 0.2,
    high: 102 + index * 0.2,
    low: 99 + index * 0.2,
    close: 101 + index * 0.2,
    volume: 1_000_000,
  }));
  rows[rows.length - 1] = { ...rows[rows.length - 1], ...last };
  return rows;
};

test('never attributes actor identity from volume alone', () => {
  const result = buildLargeParticipantFootprint(series({ volume: 3_000_000, close: 108, high: 108.2, low: 103 }));
  assert.equal(result.actorIdentity, null);
  assert.ok(result.warnings.some((item) => item.includes('not proof')));
});

test('flags strong upside participation when volume expands with breakout-like close', () => {
  const result = buildLargeParticipantFootprint(series({ volume: 3_000_000, open: 104, low: 103.8, high: 112, close: 111.5 }));
  assert.equal(result.available, true);
  assert.ok(result.score > 0);
  assert.ok(result.abnormalVolumeRatio != null && result.abnormalVolumeRatio >= 2.5);
});

test('returns unavailable on insufficient history', () => {
  const result = buildLargeParticipantFootprint(series().slice(0, 5));
  assert.equal(result.available, false);
  assert.equal(result.direction, 'NONE');
});
