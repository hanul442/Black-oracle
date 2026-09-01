import test from 'node:test';
import assert from 'node:assert/strict';
import { TradingLedger } from './ledger';
import { evaluateLiquidity } from './liquidity';
import { buildMeanReversionSignal } from './meanReversion';
import { PaperBroker } from './paperBroker';
import { evaluateRisk } from './risk';
import { buildSignalFusion } from './signalFusion';
import { buildMomentumSignal, buildTrendSignal } from './trendMomentum';
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
  roc20: 0,
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

test('trend engine recognizes aligned bullish EMA structure', () => {
  const signal = buildTrendSignal(
    {
      ...baseIndicators,
      close: 120,
      ema20: 115,
      ema50: 108,
      ema200: 96,
    },
    {
      ...rangeRegime,
      regime: 'STRONG_UPTREND',
      confidence: 0.86,
      trendStrength: 0.82,
    },
  );

  assert.equal(signal.action, 'BUY');
  assert.ok(signal.directionalScore >= 70);
});

test('momentum engine combines ROC MACD RSI and volume confirmation', () => {
  const signal = buildMomentumSignal({
    ...baseIndicators,
    rsi14: 67,
    macdHistogram: 1.5,
    roc20: 0.07,
    volumeZScore: 2.2,
  });

  assert.equal(signal.action, 'BUY');
  assert.ok(signal.directionalScore >= 50);
});

test('range regime gives mean reversion the largest fusion weight', () => {
  const fusion = buildSignalFusion(
    { action: 'WAIT', directionalScore: 10, strength: 10, confidence: 0.55, reasons: [] },
    { action: 'WAIT', directionalScore: 5, strength: 5, confidence: 0.55, reasons: [] },
    { action: 'BUY', state: 'OVERSOLD', score: 90, confidence: 0.8, rawExtremeScore: 95, trendPenalty: 1, reasons: [] },
    rangeRegime,
  );

  assert.ok(fusion.weights.meanReversion > fusion.weights.trend);
  assert.equal(fusion.action, 'BUY');
  assert.ok(fusion.oracleTradeScore > 60);
});

test('high volatility reduces fusion risk multiplier', () => {
  const fusion = buildSignalFusion(
    { action: 'BUY', directionalScore: 80, strength: 80, confidence: 0.8, reasons: [] },
    { action: 'BUY', directionalScore: 70, strength: 70, confidence: 0.75, reasons: [] },
    { action: 'WAIT', state: 'OVERBOUGHT', score: 50, confidence: 0.6, rawExtremeScore: 80, trendPenalty: 0.45, reasons: [] },
    { ...rangeRegime, regime: 'STRONG_UPTREND', highVolatility: true, trendStrength: 0.9 },
    30,
  );

  assert.equal(fusion.action, 'BUY');
  assert.equal(fusion.positionRiskMultiplier, 0.5);
});

test('liquidity filter rejects wide-spread markets even with strong turnover', () => {
  const liquidity = evaluateLiquidity({
    market: 'KRW-TEST',
    tradePrice: 100,
    accTradePrice24h: 500_000_000_000,
    signedChangeRate: 0.01,
    bestBid: 99,
    bestAsk: 101,
    top5BidDepthKrw: 100_000_000,
    top5AskDepthKrw: 100_000_000,
    warning: false,
  });

  assert.equal(liquidity.eligible, false);
  assert.ok(liquidity.spreadBps > 25);
});

test('liquidity filter passes deep tight high-turnover markets', () => {
  const liquidity = evaluateLiquidity({
    market: 'KRW-BTC',
    tradePrice: 100_000_000,
    accTradePrice24h: 800_000_000_000,
    signedChangeRate: 0.01,
    bestBid: 99_990_000,
    bestAsk: 100_010_000,
    top5BidDepthKrw: 500_000_000,
    top5AskDepthKrw: 450_000_000,
    warning: false,
  });

  assert.equal(liquidity.eligible, true);
  assert.ok(liquidity.score >= 70);
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
