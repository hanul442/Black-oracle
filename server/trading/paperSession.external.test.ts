import test from 'node:test';
import assert from 'node:assert/strict';
import { PaperTradingSession } from './paperSession';

test('KRX external Paper entry uses the shared 100m portfolio and supports staged exits', () => {
  const session = new PaperTradingSession(100_000_000);
  const entry = session.executeApprovedExternalEntry({
    market: 'KRX-005930',
    referencePrice: 100_000,
    notional: 10_000_000,
    oracleTradeScore: 78,
    stopLossPrice: 95_000,
    takeProfit1Price: 106_000,
    takeProfit2Price: 115_000,
    takeProfit1Fraction: 0.4,
    protectionBasis: 'STRUCTURE_ATR',
    riskApproved: true,
    timestamp: 1_700_000_000_000,
    reason: 'test evidence-first equity entry',
  });

  assert.ok(entry.position);
  assert.equal(entry.portfolio.initialEquity, 100_000_000);
  assert.equal(entry.portfolio.positions.length, 1);
  assert.ok(entry.portfolio.cash < 100_000_000);
  const initialQuantity = entry.position!.quantity;

  const partial = session.executeApprovedExternalExit({
    market: 'KRX-005930',
    referencePrice: 106_000,
    oracleTradeScore: 80,
    quantity: initialQuantity * 0.4,
    riskApproved: true,
    markTakeProfit1: true,
    timestamp: 1_700_086_400_000,
    reason: 'test TP1',
  });
  assert.equal(partial.partial, true);
  assert.ok(partial.position);
  assert.ok(partial.position!.quantity < initialQuantity);
  assert.equal(partial.position!.takeProfit1Taken, true);
  assert.ok((partial.position!.stopLossPrice ?? 0) >= partial.position!.entryPrice);

  const final = session.executeApprovedExternalExit({
    market: 'KRX-005930',
    referencePrice: 115_000,
    oracleTradeScore: 82,
    riskApproved: true,
    timestamp: 1_700_172_800_000,
    reason: 'test TP2',
  });
  assert.equal(final.partial, false);
  assert.equal(final.position, null);
  assert.ok(final.closedTrade);
  assert.equal(final.closedTrade!.market, 'KRX-005930');
  assert.ok(final.closedTrade!.netPnl > 0);
  assert.equal(session.state().portfolio.positions.length, 0);
});

test('external Paper execution rejects unapproved new risk', () => {
  const session = new PaperTradingSession(100_000_000);
  assert.throws(() => session.executeApprovedExternalEntry({
    market: 'KRX-000660',
    referencePrice: 250_000,
    notional: 10_000_000,
    oracleTradeScore: 70,
    stopLossPrice: 240_000,
    takeProfit1Price: 265_000,
    takeProfit2Price: 280_000,
    takeProfit1Fraction: 0.4,
    protectionBasis: 'ATR',
    riskApproved: false as true,
    reason: 'must reject',
  }), /risk approval/i);
});
