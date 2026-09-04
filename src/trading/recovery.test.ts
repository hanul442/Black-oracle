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
  const state = restored.snapshot({ 'KRW-BTC': 105 }, 63_000);

  assert.equal(state.positions.length, 1);
  assert.equal(state.positions[0].stopLossPrice, 95);
  assert.equal(state.positions[0].takeProfitPrice, 110);
  assert.ok(state.equityCurve.length >= 2);
  assert.ok(state.cash < 1_000_000);
});

test('paper equity history restores in timestamp order and deduplicates equal timestamps', () => {
  const portfolio = new PaperPortfolio(1_000_000);
  const state = portfolio.exportState();
  state.equityCurve = [
    { timestamp: 3_000, equity: 1_000_000 },
    { timestamp: 1_000, equity: 1_000_000 },
    { timestamp: 3_000, equity: 999_000 },
  ];

  const restored = PaperPortfolio.restore(state).exportState();
  assert.deepEqual(restored.equityCurve.map((point) => point.timestamp), [1_000, 3_000]);
  assert.equal(restored.equityCurve[1].equity, 999_000);
});

test('paper equity snapshots never move backward and suppress flat high-frequency points', () => {
  const portfolio = new PaperPortfolio(1_000_000);
  portfolio.snapshot({}, 2_000);
  portfolio.snapshot({}, 1_500);
  portfolio.snapshot({}, 2_100);
  portfolio.snapshot({}, 62_000);

  const curve = portfolio.exportState().equityCurve;
  assert.deepEqual(curve.map((point) => point.timestamp), [2_000, 62_000]);
  assert.ok(curve.every((point, index) => index === 0 || point.timestamp >= curve[index - 1].timestamp));
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