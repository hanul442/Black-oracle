import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaperCycleCanonicalEvents, buildStrategyFactoryCanonicalEvents } from '../eventLedger';

const council = {
  verdict: 'REJECT',
  approveCount: 1,
  cautionCount: 1,
  rejectCount: 1,
  abstainCount: 2,
  summary: 'Shadow Council REJECT.',
  members: [
    { role: 'RISK', vote: 'REJECT', confidence: 0.95, reasons: ['Position limit.'] },
  ],
};

test('Paper cycle projects strategy, council, risk and decision without inventing a trade', () => {
  const events = buildPaperCycleCanonicalEvents({
    finishedAt: 1_788_930_000_000,
    scanned: 1,
    entered: 0,
    exited: 0,
    held: 0,
    noTrade: 1,
    errors: [],
    markets: [{
      timestamp: 1_788_930_000_000,
      market: 'KRW-BTC',
      decision: 'NO_TRADE',
      action: 'NO_TRADE',
      strategyDisposition: 'NO_TRADE',
      router: { route: 'NO_TRADE', reasons: ['No edge.'] },
      council,
      riskDisposition: 'REJECT',
      riskReasons: ['Position limit.'],
      primaryReason: 'Position limit.',
      reasons: ['Position limit.'],
      evidenceIds: [],
      evidenceActiveCount: 0,
    }],
  }, 'black-oracle-paper', { reviews: [] });

  const names = events.map((event) => event.eventName);
  assert.ok(names.includes('PAPER_CYCLE_COMPLETED'));
  assert.ok(names.includes('STRATEGY_ROUTED'));
  assert.ok(names.includes('DETERMINISTIC_COUNCIL_REVIEWED'));
  assert.ok(names.includes('RISK_GATE_EVALUATED'));
  assert.ok(names.includes('DECISION_NO_TRADE'));
  assert.equal(names.some((name) => name.startsWith('PAPER_TRADE_')), false);
  assert.equal(new Set(events.map((event) => event.eventKey)).size, events.length);
});

test('completed ENTER projects an execution-authority Paper trade event', () => {
  const events = buildPaperCycleCanonicalEvents({
    finishedAt: 1_788_930_100_000,
    markets: [{
      timestamp: 1_788_930_100_000,
      market: 'KRW-ETH',
      decision: 'ENTER',
      action: 'ENTER',
      strategyDisposition: 'TREND_MOMENTUM',
      router: { route: 'TREND_MOMENTUM', reasons: ['Aligned trend.'] },
      council: { ...council, verdict: 'APPROVE', rejectCount: 0, summary: 'APPROVE' },
      riskDisposition: 'APPROVE',
      riskReasons: [],
      primaryReason: 'Entry authorized.',
      reasons: ['Entry authorized.'],
      evidenceIds: ['EV-1'],
      evidenceActiveCount: 1,
    }],
  }, 'black-oracle-paper', { reviews: [] });

  const trade = events.find((event) => event.eventName === 'PAPER_TRADE_ENTERED');
  assert.ok(trade);
  assert.equal(trade?.eventType, 'TRADE');
  assert.equal(trade?.executionAuthority, true);
  assert.deepEqual(trade?.links?.evidenceIds, ['EV-1']);
});

test('Strategy Factory projects research run and tested strategies without execution authority', () => {
  const events = buildStrategyFactoryCanonicalEvents({
    id: 'sf-run-1',
    finishedAt: 1_788_930_200_000,
    topResults: [{
      genome: { id: 'SF-TEST-1', indicators: ['EMA_STACK'] },
      evaluation: { status: 'BLOCKED', score: 22.5, fatalReasons: ['Monte Carlo survival below gate.'] },
      metrics: { oosSamples: 5 },
      tradeCount: 10,
    }],
  }, {
    market: 'KRW-BTC',
    unit: 60,
    seed: 123,
    seedSource: 'DAILY_DETERMINISTIC',
    aiResearch: null,
  });

  assert.ok(events.some((event) => event.eventName === 'STRATEGY_FACTORY_RUN_COMPLETED'));
  const strategy = events.find((event) => event.eventName === 'STRATEGY_TESTED');
  assert.equal(strategy?.strategyId, 'SF-TEST-1');
  assert.equal(strategy?.action, 'BLOCKED');
  assert.equal(strategy?.executionAuthority, false);
});
