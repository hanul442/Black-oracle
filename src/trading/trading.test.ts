import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutionDecision } from './executionPolicy';
import { TradingLedger } from './ledger';
import { evaluateLiquidity } from './liquidity';
import { buildMeanReversionSignal } from './meanReversion';
import { buildMultiTimeframeConsensus } from './multiTimeframe';
import { PaperBroker } from './paperBroker';
import { PaperPortfolio } from './paperPortfolio';
import { evaluateRisk } from './risk';
import { buildSignalFusion } from './signalFusion';
import { buildMomentumSignal, buildTrendSignal } from './trendMomentum';
import type { IndicatorSnapshot, RegimeSnapshot, TradingSnapshot } from './types';

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

const snapshotWithScore = (directionalScore: number, timeframeMinutes: number, confidence = 0.75): TradingSnapshot => ({
  market: 'KRW-BTC',
  timeframeMinutes,
  candleCount: 200,
  asOf: 1_000,
  indicators: { ...baseIndicators },
  regime: { ...rangeRegime },
  trend: {
    action: directionalScore >= 25 ? 'BUY' : directionalScore <= -25 ? 'SELL' : 'WAIT',
    directionalScore,
    strength: Math.abs(directionalScore),
    confidence,
    reasons: [],
  },
  momentum: {
    action: directionalScore >= 25 ? 'BUY' : directionalScore <= -25 ? 'SELL' : 'WAIT',
    directionalScore,
    strength: Math.abs(directionalScore),
    confidence,
    reasons: [],
  },
  meanReversion: {
    action: 'WAIT',
    state: 'NEUTRAL',
    score: 0,
    confidence: 0.5,
    rawExtremeScore: 0,
    trendPenalty: 1,
    reasons: [],
  },
  fusion: {
    action: directionalScore >= 25 ? 'BUY' : directionalScore <= -25 ? 'SELL' : 'WAIT',
    directionalScore,
    oracleTradeScore: Math.round((directionalScore + 100) / 2),
    confidence,
    positionRiskMultiplier: 1,
    weights: { trend: 0.4, momentum: 0.3, meanReversion: 0.2, event: 0.1 },
    components: { trend: directionalScore, momentum: directionalScore, meanReversion: 0, event: 0 },
    reasons: [],
  },
});

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

test('multi-timeframe consensus gives higher timeframes authority', () => {
  const consensus = buildMultiTimeframeConsensus(
    snapshotWithScore(-45, 240),
    snapshotWithScore(55, 60),
    snapshotWithScore(80, 15),
  );

  assert.equal(consensus.action, 'WAIT');
  assert.match(consensus.reasons.join(' '), /higher timeframe/i);
});

test('aligned bullish timeframes produce a buy consensus', () => {
  const consensus = buildMultiTimeframeConsensus(
    snapshotWithScore(60, 240),
    snapshotWithScore(55, 60),
    snapshotWithScore(45, 15),
  );

  assert.equal(consensus.action, 'BUY');
  assert.equal(consensus.aligned, true);
  assert.ok(consensus.confidence > 0.75);
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

test('paper portfolio marks positions and realizes P&L on quantity exit', () => {
  const portfolio = new PaperPortfolio(100_000);
  const broker = new PaperBroker({ feeBps: 5, slippageBps: 0 });
  const buy = broker.executeMarketOrder({
    id: 'buy-1',
    market: 'KRW-BTC',
    side: 'BUY',
    notional: 10_000,
    referencePrice: 100,
    timestamp: 1,
    strategyVersion: 'test',
  });
  portfolio.applyFill(buy);
  portfolio.setProtection('KRW-BTC', 95, 110, 1);

  const marked = portfolio.snapshot({ 'KRW-BTC': 110 }, 2);
  assert.ok(marked.unrealizedPnl > 0);
  assert.equal(marked.positions.length, 1);

  const position = portfolio.getPosition('KRW-BTC');
  assert.ok(position);
  const sell = broker.executeMarketOrder({
    id: 'sell-1',
    market: 'KRW-BTC',
    side: 'SELL',
    quantity: position!.quantity,
    referencePrice: 110,
    timestamp: 3,
    strategyVersion: 'test',
  });
  portfolio.applyFill(sell);
  const closed = portfolio.snapshot({}, 3);
  assert.equal(closed.positions.length, 0);
  assert.ok(closed.realizedPnl > 0);
});

test('execution policy sizes a valid entry below the 2 percent hard cap', () => {
  const portfolio = new PaperPortfolio(1_000_000);
  const liquidity = evaluateLiquidity({
    market: 'KRW-BTC',
    tradePrice: 100_000_000,
    accTradePrice24h: 800_000_000_000,
    signedChangeRate: 0.02,
    bestBid: 99_990_000,
    bestAsk: 100_010_000,
    top5BidDepthKrw: 500_000_000,
    top5AskDepthKrw: 450_000_000,
    warning: false,
  });
  const mtf = buildMultiTimeframeConsensus(
    snapshotWithScore(75, 240, 0.82),
    snapshotWithScore(70, 60, 0.8),
    snapshotWithScore(60, 15, 0.78),
  );
  const decision = buildExecutionDecision({
    liquidity,
    multiTimeframe: mtf,
    oneHour: mtf.frames.oneHour,
    portfolio: portfolio.snapshot({}),
    position: null,
  });

  assert.equal(decision.action, 'ENTER');
  assert.equal(decision.side, 'BUY');
  assert.ok(decision.notional > 0 && decision.notional <= 20_000);
  assert.ok((decision.stopLossPrice ?? 0) < liquidity.tradePrice);
  assert.ok((decision.takeProfitPrice ?? 0) > liquidity.tradePrice);
});

test('execution policy exits immediately when protective stop is breached', () => {
  const portfolio = new PaperPortfolio(1_000_000);
  const broker = new PaperBroker({ feeBps: 0, slippageBps: 0 });
  const fill = broker.executeMarketOrder({
    id: 'protect-buy',
    market: 'KRW-BTC',
    side: 'BUY',
    notional: 10_000,
    referencePrice: 100,
    timestamp: 1,
    strategyVersion: 'test',
  });
  portfolio.applyFill(fill);
  portfolio.setProtection('KRW-BTC', 95, 110, 1);
  const liquidity = evaluateLiquidity({
    market: 'KRW-BTC',
    tradePrice: 94,
    accTradePrice24h: 800_000_000_000,
    signedChangeRate: -0.06,
    bestBid: 93.99,
    bestAsk: 94.01,
    top5BidDepthKrw: 500_000_000,
    top5AskDepthKrw: 450_000_000,
    warning: false,
  });
  const mtf = buildMultiTimeframeConsensus(
    snapshotWithScore(10, 240),
    snapshotWithScore(5, 60),
    snapshotWithScore(-5, 15),
  );
  const decision = buildExecutionDecision({
    liquidity,
    multiTimeframe: mtf,
    oneHour: mtf.frames.oneHour,
    portfolio: portfolio.snapshot({ 'KRW-BTC': 94 }),
    position: portfolio.getPosition('KRW-BTC'),
  });

  assert.equal(decision.action, 'EXIT');
  assert.equal(decision.side, 'SELL');
  assert.match(decision.reasons.join(' '), /stop-loss/i);
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
