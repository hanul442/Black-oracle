import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTradingSessionDeltaCanonicalEvents } from '../eventLedgerTradeProjection';

test('projects new paper order and fill events from session ledger delta', () => {
  const before = { ledger: [{ id: 'old', sequence: 1, timestamp: 100, type: 'MARKET_SNAPSHOT', strategyVersion: 'v1', payload: {} }], closedTrades: [] };
  const after = { ledger: [
    ...before.ledger,
    { id: 'ord-1', sequence: 2, timestamp: 200, type: 'ORDER_SUBMITTED', strategyVersion: 'v2', payload: { orderId: 'paper-1', market: 'KRW-BTC', side: 'BUY', notional: 100000, reason: 'Risk approved.' } },
    { id: 'fill-1', sequence: 3, timestamp: 201, type: 'ORDER_FILLED', strategyVersion: 'v2', payload: { orderId: 'paper-1', market: 'KRW-BTC', side: 'BUY', price: 100, quantity: 10, fee: 50 } },
  ], closedTrades: [] };

  const events = buildTradingSessionDeltaCanonicalEvents(before, after, 'black-oracle-paper');
  assert.equal(events.filter((event) => event.eventType === 'ORDER').length, 1);
  assert.equal(events.filter((event) => event.eventType === 'TRADE').length, 1);
  assert.equal(events.every((event) => event.executionAuthority === true), true);
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
    ledger: [{ id: 'fill-1', sequence: 3, timestamp: 201, type: 'ORDER_FILLED', strategyVersion: 'v2', payload: { market: 'KRW-BTC', side: 'BUY' } }],
    closedTrades: [{ id: 'trade-1', market: 'KRW-BTC', closedAt: 300 }],
  };
  const events = buildTradingSessionDeltaCanonicalEvents(before, before, 'black-oracle-paper');
  assert.equal(events.length, 0);
});
