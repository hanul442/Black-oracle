import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMarketDataFreshness } from './marketDataFreshness';

const MINUTE = 60_000;
const INTERVAL = 15 * MINUTE;
const NOW = Date.parse('2026-09-12T06:45:00.000Z');

const cycle = (agesMinutes: Array<number | null>) => ({
  finishedAt: NOW - 2 * MINUTE,
  markets: agesMinutes.map((age, index) => ({
    market: `KRW-T${index}`,
    liquidity: age == null ? { marketDataTimestamp: null } : { marketDataTimestamp: NOW - age * MINUTE },
  })),
});

test('fresh probe requires explicit source timestamps for every latest-cycle market', () => {
  const result = buildMarketDataFreshness(cycle([2, 3, 4]), INTERVAL, NOW);
  assert.equal(result.status, 'FRESH');
  assert.equal(result.coverage, 1);
  assert.equal(result.maxAgeMs, 4 * MINUTE);
  assert.equal(result.historicalTimeframesObserved, false);
  assert.deepEqual(result.unobservedTimeframes, ['15m', '1h', '4h']);
});

test('partial source timestamp coverage never becomes fresh by cycle recency alone', () => {
  const result = buildMarketDataFreshness(cycle([2, null, 4]), INTERVAL, NOW);
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.timestampedMarketCount, 2);
  assert.equal(result.observedMarketCount, 3);
  assert.equal(result.coverage, 2 / 3);
});

test('cadence-aware warning and critical windows classify stale live liquidity', () => {
  const stale = buildMarketDataFreshness(cycle([23, 2]), INTERVAL, NOW);
  const critical = buildMarketDataFreshness(cycle([40, 2]), INTERVAL, NOW);
  assert.equal(stale.status, 'STALE');
  assert.equal(critical.status, 'CRITICAL');
  assert.equal(stale.warnAfterMs, Math.round(INTERVAL * 1.5));
  assert.equal(critical.criticalAfterMs, Math.round(INTERVAL * 2.5));
});

test('missing source timestamps remain explicit rather than becoming zero-age data', () => {
  const none = buildMarketDataFreshness(cycle([null, null]), INTERVAL, NOW);
  const noCycle = buildMarketDataFreshness(null, INTERVAL, NOW);
  assert.equal(none.status, 'PARTIAL');
  assert.equal(none.maxAgeMs, null);
  assert.equal(noCycle.status, 'NO_SAMPLE');
  assert.equal(noCycle.coverage, null);
});

test('implausible future timestamps are excluded and degrade the probe', () => {
  const result = buildMarketDataFreshness({
    finishedAt: NOW,
    markets: [
      { market: 'KRW-BTC', liquidity: { marketDataTimestamp: NOW - MINUTE } },
      { market: 'KRW-ETH', liquidity: { marketDataTimestamp: NOW + 2 * MINUTE } },
    ],
  }, INTERVAL, NOW);
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.futureTimestampCount, 1);
  assert.equal(result.timestampedMarketCount, 1);
});
