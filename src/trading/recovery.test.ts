import test from 'node:test';
import assert from 'node:assert/strict';
import { TradingEvidenceStore } from './evidence';
import { TradingLedger } from './ledger';
import { PaperBroker } from './paperBroker';
import { PaperPortfolio } from './paperPortfolio';

test('paper portfolio restore preserves cash, positions, protection and equity history', () => {
  const portfolio = new PaperPortfolio(1_000_000);
  const broker = new PaperBroker({ feeBps: 5, slippageBps: 0 });
  const fill = broker.executeMarketOrder({
    id: 'recovery-buy',
    market: 'KRW-BTC',
    side: 'BUY',
    notional: 10_000,
    referencePrice: 100,
    timestamp: 1000,
    strategyVersion: 'test',
  });
  portfolio.applyFill(fill);
  portfolio.setProtection('KRW-BTC', 95, 110, 1000);
  portfolio.snapshot({ 'KRW-BTC': 105 }, 2000);

  const restored = PaperPortfolio.restore(portfolio.exportState());
  const state = restored.snapshot({ 'KRW-BTC': 105 }, 3000);

  assert.equal(state.positions.length, 1);
  assert.equal(state.positions[0].stopLossPrice, 95);
  assert.equal(state.positions[0].takeProfitPrice, 110);
  assert.ok(state.equityCurve.length >= 2);
  assert.ok(state.cash < 1_000_000);
});

test('trading ledger restore continues sequence numbering', () => {
  const ledger = new TradingLedger();
  ledger.append('SIGNAL', { market: 'KRW-BTC' }, 'test', 1000);
  const restored = TradingLedger.restore([...ledger.snapshot()]);
  const event = restored.append('RISK_PASS', { market: 'KRW-BTC' }, 'test', 2000);
  assert.equal(event.sequence, 2);
  assert.equal(restored.size, 2);
});

test('evidence replaceAll restores active evidence safely', () => {
  const store = new TradingEvidenceStore();
  const now = Date.now();
  store.replaceAll([{
    id: 'e1',
    market: 'KRW-BTC',
    title: 'Recovery evidence',
    direction: 'BULLISH',
    strength: 70,
    reliability: 0.8,
    sourceType: 'SYSTEM',
    observedAt: now - 1000,
    expiresAt: now + 60_000,
  }]);

  assert.equal(store.list('KRW-BTC').length, 1);
  assert.ok(store.aggregate('KRW-BTC').score > 0);
});
