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

test('Decision Replay attaches one trace to equity research decisions and their source-backed Evidence', () => {
  const equityTimestamp = decisionTimestamp + 5_000;
  const equityCycle = {
    markets: [],
    equityCycle: {
      finishedAt: equityTimestamp,
      decisions: [{
        market: 'KRX-039490',
        evidenceIds: ['nars:packet:KRX-039490'],
      }],
    },
  };
  const events: CanonicalEventInput[] = [
    {
      eventKey: 'equity-decision',
      occurredAt: equityTimestamp,
      runtimeId,
      eventType: 'DECISION',
      eventName: 'EQUITY_RESEARCH_DECISION',
      market: 'KRX-039490',
      summary: 'Equity research decision.',
      source: 'equity_paper_research',
    },
    {
      eventKey: 'equity-evidence',
      occurredAt: equityTimestamp,
      runtimeId,
      eventType: 'EVIDENCE',
      eventName: 'EQUITY_EVIDENCE_LINKED',
      market: 'KRX-039490',
      summary: 'Equity Evidence linked.',
      source: 'equity_paper_research',
      links: { evidenceIds: ['nars:packet:KRX-039490'] },
    },
  ];

  const projected = attachDecisionReplayLineage(events, equityCycle, runtimeId);
  const expectedTraceId = buildCanonicalDecisionTraceId(runtimeId, 'KRX-039490', equityTimestamp);
  const expectedDecisionId = `${expectedTraceId}:decision`;

  for (const event of projected) {
    assert.equal(event.trace?.traceId, expectedTraceId);
    assert.equal(event.links?.decisionId, expectedDecisionId);
    assert.deepEqual(event.links?.evidenceIds, ['nars:packet:KRX-039490']);
  }
});

test('Decision Replay does not relabel retained retry events with the current cycle lineage', () => {
  const retryEvent = {
    eventKey: 'retry-old-signal',
    occurredAt: decisionTimestamp - 900_000,
    runtimeId,
    eventType: 'STRATEGY',
    eventName: 'SIGNAL',
    market: 'KRW-BTC',
    summary: 'Historical signal retry.',
    source: 'paper_trading_ledger',
    trace: { ledgerEventId: 'old-signal' },
    __lineagePolicy: 'PRESERVE',
  } as CanonicalEventInput;

  const [projected] = attachDecisionReplayLineage([retryEvent], cycle, runtimeId);
  assert.equal(projected?.trace?.traceId, undefined);
  assert.equal(projected?.links?.decisionId, undefined);
  assert.equal((projected as any)?.__lineagePolicy, undefined);
  assert.equal(projected?.trace?.ledgerEventId, 'old-signal');
});
