import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalEventInput } from './eventLedger';
import { attachDecisionReplayLineage, buildCanonicalDecisionTraceId } from './eventLedgerLineage';

const runtimeId = 'black-oracle-paper-s2-shadow';
const decisionTimestamp = 1_788_930_000_000;
const entryTimestamp = 1_788_920_000_000;

const cycle = {
  markets: [{
    market: 'KRW-BTC',
    timestamp: decisionTimestamp,
    evidenceIds: ['EV-1'],
  }],
};

test('Decision Replay attaches one trace identity across decision and execution projections', () => {
  const events: CanonicalEventInput[] = [
    {
      eventKey: 'strategy',
      occurredAt: decisionTimestamp,
      runtimeId,
      eventType: 'STRATEGY',
      eventName: 'STRATEGY_ROUTED',
      market: 'KRW-BTC',
      summary: 'Strategy routed.',
      source: 'paper_runtime',
    },
    {
      eventKey: 'order',
      occurredAt: decisionTimestamp + 937,
      runtimeId,
      eventType: 'ORDER',
      eventName: 'ORDER_SUBMITTED',
      market: 'KRW-BTC',
      summary: 'Order submitted.',
      source: 'paper_trading_ledger',
      links: { orderId: 'ORDER-1' },
    },
    {
      eventKey: 'outcome',
      occurredAt: decisionTimestamp + 60_000,
      runtimeId,
      eventType: 'OUTCOME',
      eventName: 'PAPER_TRADE_CLOSED_OUTCOME',
      market: 'KRW-BTC',
      summary: 'Trade closed.',
      source: 'paper_closed_trades',
      trace: { entryAudit: { timestamp: entryTimestamp } },
      links: { tradeId: 'TRADE-1' },
    },
  ];

  const projected = attachDecisionReplayLineage(events, cycle, runtimeId);
  const expectedTraceId = buildCanonicalDecisionTraceId(runtimeId, 'KRW-BTC', decisionTimestamp);
  const expectedDecisionId = `${expectedTraceId}:decision`;

  for (const event of projected) {
    assert.equal(event.trace?.traceId, expectedTraceId);
    assert.equal(event.links?.decisionId, expectedDecisionId);
    assert.deepEqual(event.links?.evidenceIds, ['EV-1']);
  }

  assert.equal(projected[1]?.links?.orderId, 'ORDER-1');
  assert.equal(projected[2]?.links?.tradeId, 'TRADE-1');
  assert.equal(
    projected[2]?.links?.entryTraceId,
    buildCanonicalDecisionTraceId(runtimeId, 'KRW-BTC', entryTimestamp),
  );
});

test('Decision Replay preserves explicit evidence links and leaves non-market system events untouched', () => {
  const events: CanonicalEventInput[] = [
    {
      eventKey: 'evidence',
      occurredAt: decisionTimestamp,
      runtimeId,
      eventType: 'EVIDENCE',
      eventName: 'EVIDENCE_LINKED',
      market: 'KRW-BTC',
      summary: 'Evidence linked.',
      source: 'paper_runtime',
      links: { evidenceIds: ['EXPLICIT-EV'] },
    },
    {
      eventKey: 'system',
      occurredAt: decisionTimestamp,
      runtimeId,
      eventType: 'SYSTEM',
      eventName: 'PAPER_CYCLE_COMPLETED',
      summary: 'Cycle complete.',
      source: 'paper_runtime',
    },
  ];

  const projected = attachDecisionReplayLineage(events, cycle, runtimeId);
  assert.deepEqual(projected[0]?.links?.evidenceIds, ['EXPLICIT-EV']);
  assert.equal(projected[1]?.trace, undefined);
  assert.equal(projected[1]?.links, undefined);
});
