import assert from 'node:assert/strict';
import test from 'node:test';
import { RuntimeIntegrityStore } from './integrityStore';
import type { PaperLoopCycleResult } from './paperLoop';

const cycle = (trace: any, finishedAt = 2_000_000): PaperLoopCycleResult => ({
  startedAt: finishedAt - 10_000,
  finishedAt,
  scanned: 1,
  entered: trace.action === 'ENTER' ? 1 : 0,
  exited: trace.action === 'EXIT' ? 1 : 0,
  held: trace.action === 'HOLD' ? 1 : 0,
  noTrade: trace.action === 'NO_TRADE' ? 1 : 0,
  errors: [],
  markets: [{ ...trace, decision: trace.action }],
});

test('ENTER without deterministic risk approval opens a critical risk-bypass incident once', () => {
  const store = new RuntimeIntegrityStore();
  const item = cycle({
    timestamp: 1_990_000,
    market: 'KRW-BTC',
    action: 'ENTER',
    riskDisposition: 'NOT_EVALUATED',
    riskReasons: [],
  });
  store.inspectCycle(item, 12);
  store.inspectCycle(item, 12);
  const incidents = store.incidents();
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].kind, 'RISK_BYPASS');
  assert.equal(incidents[0].severity, 'CRITICAL');
});

test('daily loss circuit is deduplicated by UTC trading day', () => {
  const store = new RuntimeIntegrityStore();
  const day = Date.UTC(2026, 8, 5, 3, 0, 0);
  const makeTrace = (timestamp: number, market: string) => ({
    timestamp,
    market,
    action: 'NO_TRADE',
    riskDisposition: 'REJECT',
    riskReasons: ['Daily loss limit of 1.00% has been reached.'],
  });
  store.inspectCycle(cycle(makeTrace(day, 'KRW-BTC'), day + 1_000), 20);
  store.inspectCycle(cycle(makeTrace(day + 3_600_000, 'KRW-ETH'), day + 3_601_000), 21);
  assert.equal(store.incidents().filter((item) => item.kind === 'DAILY_RISK_BREACH').length, 1);
});

test('stale or duplicate integrity faults only become execution incidents if ENTER actually occurred', () => {
  const store = new RuntimeIntegrityStore();
  store.inspectCycle(cycle({
    timestamp: 3_000_000,
    market: 'KRW-BTC',
    action: 'NO_TRADE',
    riskDisposition: 'REJECT',
    riskReasons: ['Market data is stale.'],
  }, 3_001_000), 30);
  assert.equal(store.incidents().filter((item) => item.kind === 'EXECUTION_INTEGRITY').length, 0);

  store.inspectCycle(cycle({
    timestamp: 4_000_000,
    market: 'KRW-BTC',
    action: 'ENTER',
    riskDisposition: 'APPROVE',
    riskReasons: ['Duplicate order fingerprint detected.'],
  }, 4_001_000), 31);
  assert.equal(store.incidents().filter((item) => item.kind === 'EXECUTION_INTEGRITY').length, 1);
});
