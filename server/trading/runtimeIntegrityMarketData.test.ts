import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRuntimeIntegrityReadModel } from './runtimeIntegrity';

const base = {
  status: 'OK',
  now: 1_000_000,
  persistence: { configured: true, lastError: null, fault: false },
  loop: { running: true, cycleCount: 3, intervalMs: 900_000, lastCycleFinishedAt: 990_000, lastCycleErrors: 0, stale: false },
};

const ledger = {
  status: 'HEALTHY',
  checkedAt: 1_000_000,
  scheduler: { status: 'HEALTHY', enabled: true, lastInvokedAt: 990_000, lastHttpStatus: 200, lastOk: true, ageMs: 10_000, reason: 'healthy' },
  producers: [],
  reasons: [],
};

const profile = { runtimeId: 'test', qualificationMode: false };

const build = (marketData: any) => buildRuntimeIntegrityReadModel({
  runtimeHealth: { ...base, marketData },
  ledgerHealth: ledger,
  profile,
  gatewayObserved: true,
  deploymentRevision: 'abc',
  now: 1_000_000,
});

test('fresh live liquidity removes UNKNOWN but cannot make Market Data green before candle freshness is instrumented', () => {
  const model = build({
    status: 'FRESH', checkedAt: 1_000_000, cycleFinishedAt: 990_000,
    observedMarketCount: 6, timestampedMarketCount: 6, coverage: 1,
    newestTimestamp: 989_000, oldestTimestamp: 988_000, maxAgeMs: 12_000,
    warnAfterMs: 1_350_000, criticalAfterMs: 2_250_000, futureTimestampCount: 0,
    historicalTimeframesObserved: false, unobservedTimeframes: ['15m', '1h', '4h'],
    reason: 'all live timestamps fresh',
  });
  const subsystem = model.subsystems.find((item) => item.id === 'MARKET_DATA');
  assert.equal(subsystem?.status, 'DEGRADED');
  assert.equal(model.visibilityGaps.includes('MARKET_DATA'), false);
  assert.match(subsystem?.reason ?? '', /cannot be green yet/i);
});

test('critically stale live liquidity escalates Market Data to critical', () => {
  const model = build({
    status: 'CRITICAL', checkedAt: 1_000_000, cycleFinishedAt: 900_000,
    observedMarketCount: 6, timestampedMarketCount: 6, coverage: 1,
    newestTimestamp: 100_000, oldestTimestamp: 50_000, maxAgeMs: 950_000,
    warnAfterMs: 400_000, criticalAfterMs: 800_000, futureTimestampCount: 0,
    historicalTimeframesObserved: false, unobservedTimeframes: ['15m', '1h', '4h'],
    reason: 'live liquidity critically stale',
  });
  const subsystem = model.subsystems.find((item) => item.id === 'MARKET_DATA');
  assert.equal(subsystem?.status, 'CRITICAL');
  assert.ok(model.criticalSubsystems.includes('MARKET_DATA'));
});

test('no source-timestamp sample remains unknown', () => {
  const model = build({
    status: 'NO_SAMPLE', checkedAt: 1_000_000, cycleFinishedAt: null,
    observedMarketCount: 0, timestampedMarketCount: 0, coverage: null,
    newestTimestamp: null, oldestTimestamp: null, maxAgeMs: null,
    warnAfterMs: 1_350_000, criticalAfterMs: 2_250_000, futureTimestampCount: 0,
    historicalTimeframesObserved: false, unobservedTimeframes: ['15m', '1h', '4h'],
    reason: 'no sample',
  });
  assert.equal(model.subsystems.find((item) => item.id === 'MARKET_DATA')?.status, 'UNKNOWN');
  assert.ok(model.visibilityGaps.includes('MARKET_DATA'));
});
