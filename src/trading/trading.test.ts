import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMeanReversionSignal } from './meanReversion';
import { PaperBroker } from './paperBroker';
import { evaluateRisk } from './risk';
import { TradingLedger } from './ledger';
import type { IndicatorSnapshot, RegimeSnapshot } from './types';

const baseIndicators: IndicatorSnapshot = {
  close: 100,
  ema20: 100,
  ema50: 100,
  ema200: 100,
  rsi14: 50,
  stochRsi14: 50,
  atr14: 2,
  atrPct: 0.02,
  macd: 0,
  macdSignal: 0,
  macdHistogram: 0,
  bollingerMiddle: 100,
  bollingerUpper: 110,
  bollingerLower: 90,
  bollingerPercentB: 0.5,
  bollingerBandwidth: 0.2,
  volumeZScore: 0,
};

const rangeRegime: RegimeSnapshot = {
  regime: 'RANGE',
  confidence: 0.7,
  trendStrength: 0.2,
  highVolatility: false,
  reasons: [],
};

test('overbought is not an automatic sell in a strong uptrend', () => {
  const signal = buildMeanReversionSignal(
    {
      ...baseIndicators,
      rsi14: 82,
      stochRsi14: 96,
      bollingerPercentB: 1.12,
      macdHistogram: 2,
    },
    {
      ...rangeRegime,
      regime: 'STRONG_UPTREND',
      trendStrength: 0.9,
    },
  );

  assert.equal(signal.state, 'OVERBOUGHT');
  assert.equal(signal.action, 'WAIT');
  assert.ok(signal.trendPenalty < 0.5);
});

test('oversold cluster can produce a range-regime buy signal with reversal confirmation', () => {
  const signal = buildMeanReversionSignal(
    {
      ...baseIndicators,
      rsi14: 18,
      stochRsi14: 4,
      bollingerPercentB: -0.12,
      macdHistogram: 1,
      volumeZScore: -0.8,
    },
    rangeRegime,
  );

  assert.equal(signal.state, 'OVERSOLD');
  assert.equal(signal.action, 'BUY');
  assert.ok(signal.score >= 60);
});

test('risk gate rejects a position above 2 percent of equity', () => {
  const decision = evaluateRisk({
    equity: 1_000_000,
    requestedNotional: 21_000,
    dailyPnlPct: 0,
    totalDrawdownPct: 0,
    estimatedSlippageBps: 5,
    marketDataAgeMs: 5_000,
    feedConnected: true,
    ledgerInSync: true,
    duplicateOrderDetected: false,
  });

  assert.equal(decision.status, 'REJECT');
  assert.equal(decision.approvedNotional, 0);
  assert.equal(decision.maxAllowedNotional, 20_000);
});

test('risk gate rejects after the daily loss circuit breaker is reached', () => {
  const decision = evaluateRisk({
    equity: 1_000_000,
    requestedNotional: 10_000,
    dailyPnlPct: -0.01,
    totalDrawdownPct: 0.01,
    estimatedSlippageBps: 5,
    marketDataAgeMs: 5_000,
    feedConnected: true,
    ledgerInSync: true,
    duplicateOrderDetected: false,
  });

  assert.equal(decision.status, 'REJECT');
  assert.match(decision.reasons.join(' '), /Daily loss limit/);
});

test('paper broker applies slippage and refuses duplicate order ids', () => {
  const broker = new PaperBroker({ feeBps: 5, slippageBps: 10 });
  const order = {
    id: 'order-1',
    market: 'KRW-BTC',
    side: 'BUY' as const,
    notional: 10_000,
    referencePrice: 100_000_000,
    timestamp: 1,
    strategyVersion: 'BO-CRYPTO-v0.1.0',
  };

  const fill = broker.executeMarketOrder(order);
  assert.ok(fill.fillPrice > order.referencePrice);
  assert.equal(fill.fee, 5);
  assert.throws(() => broker.executeMarketOrder(order), /Duplicate paper order id/);
});

test('trading ledger is append-only and sequence ordered', () => {
  const ledger = new TradingLedger();
  ledger.append('SIGNAL', { market: 'KRW-BTC', score: 71 }, 'BO-CRYPTO-v0.1.0', 1);
  ledger.append('RISK_PASS', { market: 'KRW-BTC' }, 'BO-CRYPTO-v0.1.0', 2);

  const events = ledger.snapshot();
  assert.equal(events.length, 2);
  assert.equal(events[0].sequence, 1);
  assert.equal(events[1].sequence, 2);
  assert.equal(ledger.latest()?.type, 'RISK_PASS');
});
