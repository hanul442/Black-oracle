import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTradingSessionDeltaCanonicalEvents,
  buildTradingSessionRetryCanonicalEvents,
} from '../eventLedgerTradeProjection';

test('projects every supported new Paper session ledger event into canonical audit history', () => {
  const before = {
    ledger: [{ id: 'old', sequence: 1, timestamp: 100, type: 'MARKET_SNAPSHOT', strategyVersion: 'v1', payload: {} }],
    closedTrades: [],
  };
  const after = {
    ledger: [
      ...before.ledger,
      { id: 'snap-1', sequence: 2, timestamp: 200, type: 'MARKET_SNAPSHOT', strategyVersion: 'v2', payload: { market: 'KRW-BTC', price: 100, liquidityScore: 77 } },
      { id: 'sig-1', sequence: 3, timestamp: 201, type: 'SIGNAL', strategyVersion: 'v2', payload: { market: 'KRW-BTC', action: 'ENTER', side: 'BUY', confidence: 0.8 } },
      { id: 'risk-1', sequence: 4, timestamp: 202, type: 'RISK_REJECT', strategyVersion: 'v2', payload: { market: 'KRW-BTC', reasons: ['Drawdown limit.'] } },
      { id: 'ord-1', sequence: 5, timestamp: 203, type: 'ORDER_SUBMITTED', strategyVersion: 'v2', payload: { orderId: 'paper-1', market: 'KRW-BTC', side: 'BUY', notional: 100000, reason: 'Risk approved.' } },
      { id: 'fill-1', sequence: 6, timestamp: 204, type: 'ORDER_FILLED', strategyVersion: 'v2', payload: { orderId: 'paper-1', market: 'KRW-BTC', side: 'BUY', fillPrice: 100, quantity: 10, fee: 50 } },
      { id: 'pos-1', sequence: 7, timestamp: 205, type: 'POSITION_UPDATED', strategyVersion: 'v2', payload: { market: 'KRW-BTC', position: { quantity: 10 } } },
      { id: 'halt-1', sequence: 8, timestamp: 206, type: 'SYSTEM_HALT', strategyVersion: 'v2', payload: { reason: 'Data feed unavailable.' } },
    ],
    closedTrades: [],
  };

  const events = buildTradingSessionDeltaCanonicalEvents(before, after, 'black-oracle-paper');
  assert.equal(events.length, 7);

  const snapshot = events.find((event) => event.eventName === 'MARKET_SNAPSHOT');
  assert.equal(snapshot?.eventType, 'EVIDENCE');
  assert.equal(snapshot?.executionAuthority, false);
  assert.equal(snapshot?.market, 'KRW-BTC');
  assert.equal((snapshot?.trace as any)?.payload?.price, 100);
  assert.equal(snapshot?.eventKey, 'black-oracle-paper:paper-ledger:snap-1');

  const signal = events.find((event) => event.eventName === 'SIGNAL');
  assert.equal(signal?.eventType, 'STRATEGY');
  assert.equal(signal?.executionAuthority, false);
  assert.equal(signal?.action, 'BUY');

  const risk = events.find((event) => event.eventName === 'RISK_REJECT');
  assert.equal(risk?.eventType, 'RISK');
  assert.equal(risk?.executionAuthority, true);
  assert.equal(risk?.severity, 'WARN');
  assert.equal(risk?.reason, 'Drawdown limit.');

  const order = events.find((event) => event.eventName === 'ORDER_SUBMITTED');
  assert.equal(order?.eventType, 'ORDER');
  assert.equal(order?.executionAuthority, true);
  assert.equal(order?.authority, 'paper_execution');
  assert.equal(order?.reason, 'Risk approved.');

  const fill = events.find((event) => event.eventName === 'ORDER_FILLED');
  assert.equal(fill?.eventType, 'TRADE');
  assert.equal(fill?.executionAuthority, true);
  assert.equal((fill?.links as any)?.orderId, 'paper-1');

  const position = events.find((event) => event.eventName === 'POSITION_UPDATED');
  assert.equal(position?.eventType, 'TRADE');
  assert.equal(position?.executionAuthority, true);
  assert.equal((position?.trace as any)?.payload?.position?.quantity, 10);

  const halt = events.find((event) => event.eventName === 'SYSTEM_HALT');
  assert.equal(halt?.eventType, 'SYSTEM');
  assert.equal(halt?.executionAuthority, true);
  assert.equal(halt?.severity, 'CRITICAL');
  assert.equal(halt?.reason, 'Data feed unavailable.');
});

test('preserves existing paper order and fill projection semantics', () => {
  const before = { ledger: [], closedTrades: [] };
  const after = { ledger: [
    { id: 'ord-1', sequence: 2, timestamp: 200, type: 'ORDER_SUBMITTED', strategyVersion: 'v2', payload: { orderId: 'paper-1', market: 'KRW-BTC', side: 'BUY', notional: 100000, reason: 'Risk approved.' } },
    { id: 'fill-1', sequence: 3, timestamp: 201, type: 'ORDER_FILLED', strategyVersion: 'v2', payload: { orderId: 'paper-1', market: 'KRW-BTC', side: 'BUY', fillPrice: 100, quantity: 10, fee: 50 } },
  ], closedTrades: [] };

  const events = buildTradingSessionDeltaCanonicalEvents(before, after, 'black-oracle-paper');
  assert.equal(events.filter((event) => event.eventType === 'ORDER').length, 1);
  assert.equal(events.filter((event) => event.eventType === 'TRADE').length, 1);
  assert.equal(events.every((event) => event.executionAuthority === true), true);
  assert.equal(events[0]?.eventKey, 'black-oracle-paper:paper-ledger:ord-1');
  assert.equal(events[1]?.eventKey, 'black-oracle-paper:paper-ledger:fill-1');
});

test('projects exact closed trade outcome with pnl and audit context', () => {
  const trade = {
    id: 'trade-1', market: 'KRW-ETH', openedAt: 100, closedAt: 300, entryPrice: 1000, exitPrice: 1100,
    quantity: 2, grossPnl: 200, fees: 10, netPnl: 190, returnPct: 0.095, exitReason: 'TAKE_PROFIT',
    strategyVersion: 'BO-CRYPTO-v0.2', entryOracleTradeScore: 74, exitOracleTradeScore: 61,
    entryAudit: { regime: 'UPTREND' },
  };
  const events = buildTradingSessionDeltaCanonicalEvents({ ledger: [], closedTrades: [] }, { ledger: [], closedTrades: [trade] }, 'black-oracle-paper');
  const outcome = events.find((event) => event.eventType === 'OUTCOME');
  assert.equal(outcome?.market, 'KRW-ETH');
  assert.equal(outcome?.executionAuthority, false);
  assert.equal((outcome?.trace as any)?.netPnl, 190);
  assert.deepEqual(outcome?.links, { tradeId: 'trade-1' });
});

test('does not duplicate ledger or closed-trade events already present before cycle', () => {
  const before = {
    ledger: [
      { id: 'snap-1', sequence: 2, timestamp: 200, type: 'MARKET_SNAPSHOT', strategyVersion: 'v2', payload: { market: 'KRW-BTC' } },
      { id: 'fill-1', sequence: 3, timestamp: 201, type: 'ORDER_FILLED', strategyVersion: 'v2', payload: { market: 'KRW-BTC', side: 'BUY' } },
    ],
    closedTrades: [{ id: 'trade-1', market: 'KRW-BTC', closedAt: 300 }],
  };
  const events = buildTradingSessionDeltaCanonicalEvents(before, before, 'black-oracle-paper');
  assert.equal(events.length, 0);
});

test('replays bounded retained ledger and outcome windows with stable idempotent keys', () => {
  const ledger = Array.from({ length: 300 }, (_, index) => ({
    id: `event-${index + 1}`,
    sequence: index + 1,
    timestamp: 1_000 + index,
    type: index % 2 === 0 ? 'MARKET_SNAPSHOT' : 'SIGNAL',
    strategyVersion: 'v2',
    payload: { market: 'KRW-BTC', action: 'WAIT', marker: index + 1 },
  }));
  const closedTrades = Array.from({ length: 140 }, (_, index) => ({
    id: `trade-${index + 1}`,
    market: 'KRW-BTC',
    closedAt: 2_000 + index,
    netPnl: index,
    returnPct: 0.001,
  }));

  const events = buildTradingSessionRetryCanonicalEvents({ ledger, closedTrades }, 'black-oracle-paper', 256, 128);
  const ledgerEvents = events.filter((event) => event.source === 'paper_trading_ledger');
  const outcomes = events.filter((event) => event.eventType === 'OUTCOME');

  assert.equal(ledgerEvents.length, 256);
  assert.equal(outcomes.length, 128);
  assert.equal(ledgerEvents[0]?.eventKey, 'black-oracle-paper:paper-ledger:event-45');
  assert.equal(ledgerEvents.at(-1)?.eventKey, 'black-oracle-paper:paper-ledger:event-300');
  assert.equal(outcomes[0]?.eventKey, 'black-oracle-paper:paper-outcome:trade-13');
  assert.equal(outcomes.at(-1)?.eventKey, 'black-oracle-paper:paper-outcome:trade-140');
  assert.equal((ledgerEvents[0]?.trace as any)?.payload?.marker, 45);
});
