import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArbiterCanonicalEvents } from './eventLedgerArbiterProjection';

test('projects only traces that contain a shadow Arbiter recommendation', () => {
  const events = buildArbiterCanonicalEvents({
    finishedAt: 2_000,
    markets: [
      {
        timestamp: 1_000,
        market: 'KRW-ETH',
        decision: 'ENTER',
        oracleTradeScore: 65,
        confidence: 0.81,
        strategyDisposition: 'BLENDED',
        evidenceIds: ['ev-1'],
        arbiter: {
          mode: 'SHADOW',
          executionAuthority: false,
          recommendation: 'REVIEW',
          reasons: ['Council is conditional.'],
          councilVerdict: 'CONDITIONAL',
          cycleTiming: 'NO_EDGE',
          challengerAlignment: 'CONFLICTS',
        },
      },
      { timestamp: 1_100, market: 'KRW-BTC', decision: 'NO_TRADE' },
    ],
  }, 'runtime-test');

  assert.equal(events.length, 1);
  assert.equal(events[0].eventName, 'ARBITER_RECOMMENDED');
  assert.equal(events[0].action, 'REVIEW');
  assert.equal(events[0].authority, 'shadow_arbiter');
  assert.equal(events[0].executionAuthority, false);
  assert.equal(events[0].trace?.cycleTiming, 'NO_EDGE');
  assert.deepEqual(events[0].links?.evidenceIds, ['ev-1']);
});

test('marks BLOCK recommendations as warning without granting authority', () => {
  const [event] = buildArbiterCanonicalEvents({
    markets: [{
      timestamp: 3_000,
      market: 'KRW-XRP',
      decision: 'ENTER',
      arbiter: {
        mode: 'SHADOW',
        executionAuthority: false,
        recommendation: 'BLOCK',
        reasons: ['Council rejected candidate.'],
        councilVerdict: 'REJECT',
        cycleTiming: 'READY',
        challengerAlignment: 'NEUTRAL',
      },
    }],
  }, 'runtime-test');

  assert.equal(event.severity, 'WARN');
  assert.equal(event.executionAuthority, false);
});
