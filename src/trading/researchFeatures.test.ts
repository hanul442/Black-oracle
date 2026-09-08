import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutionDecision } from './executionPolicy';
import type { EvidenceGateDecision } from './evidenceGate';
import { PaperPortfolio } from './paperPortfolio';
import {
  buildAdxShadow,
  buildBreakoutShadow,
  buildRealizedVolatilityShadow,
  buildRelativeStrengthShadow,
  buildTechnicalFeatureShadowSnapshot,
  buildVwapShadow,
  type RelativeStrengthPointInTime,
} from './research/shadowFeatures';
import type { Candle } from './types';

const candles = (count: number, closeAt: (index: number) => number, volumeAt = (_index: number) => 1): Candle[] =>
  Array.from({ length: count }, (_, index) => {
    const close = closeAt(index);
    return {
      market: 'KRW-TEST',
      timeframeMinutes: 60,
      timestamp: index * 60_000,
      open: close,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: volumeAt(index),
      quoteVolume: close * volumeAt(index),
    };
  });

const passGate: EvidenceGateDecision = {
  status: 'PASS',
  eligibleForNewRisk: true,
  score: 70,
  confidence: 0.8,
  activeCount: 2,
  uniqueEvidenceCount: 2,
  sourceDiversity: 2,
  sourceTypeDiversity: 2,
  weightedQuality: 0.75,
  freshness: 0.8,
  contradictionSeverity: 0,
  evidenceIds: ['e1', 'e2'],
  reasons: ['PASS'],
};

test('ADX rises in a persistent synthetic trend and stays low in a flat range', () => {
  const trend = candles(80, (index) => 100 + index * 1.2);
  const flat = candles(80, () => 100);
  const trendAdx = buildAdxShadow(trend);
  const flatAdx = buildAdxShadow(flat);
  assert.equal(trendAdx.available, true);
  assert.equal(flatAdx.available, true);
  assert.ok((trendAdx.value ?? 0) > (flatAdx.value ?? 0));
  assert.ok((trendAdx.value ?? 0) >= 25);
});

test('Donchian shadow detects a clean upside breakout', () => {
  const series = candles(60, () => 100);
  series[series.length - 1] = {
    ...series[series.length - 1],
    open: 100,
    high: 121,
    low: 99.5,
    close: 120,
    volume: 5,
  };
  const feature = buildBreakoutShadow(series);
  assert.equal(feature.state, 'BREAKOUT_UP');
  assert.ok((feature.metadata.breakoutStrength as number) > 0);
});

test('Donchian shadow marks an intrabar failed breakout', () => {
  const series = candles(60, () => 100);
  series[series.length - 1] = {
    ...series[series.length - 1],
    open: 100,
    high: 110,
    low: 99.5,
    close: 100,
  };
  const feature = buildBreakoutShadow(series);
  assert.equal(feature.state, 'FALSE_BREAK');
  assert.equal(feature.metadata.falseBreak, true);
});

test('rolling VWAP equals the known constant price-volume series', () => {
  const series = candles(60, () => 100, () => 2);
  const feature = buildVwapShadow(series);
  assert.equal(feature.available, true);
  assert.equal(feature.metadata.rollingVWAP20, 100);
  assert.equal(feature.metadata.rollingVWAP50, 100);
  assert.equal(feature.metadata.vwapDistanceAtr20, 0);
});

test('realized volatility identifies a shock versus a constant series', () => {
  const constant = candles(80, () => 100);
  const shocked = candles(80, (index) => index === 79 ? 135 : 100);
  const low = buildRealizedVolatilityShadow(constant);
  const high = buildRealizedVolatilityShadow(shocked);
  assert.equal(low.available, true);
  assert.equal(high.available, true);
  assert.ok((high.metadata.rv20 as number) > (low.metadata.rv20 as number));
  assert.ok(['VOL_EXPANSION', 'VOL_SHOCK'].includes(high.state));
});

test('relative-strength shadow preserves a known point-in-time percentile', () => {
  const context: RelativeStrengthPointInTime = {
    universeAt: 1_000,
    universeMarkets: ['A', 'B', 'C', 'D', 'E'],
    returns: { return15m: 0.01, return1h: 0.02, return4h: 0.04, return24h: 0.1 },
    percentiles: { percentileRank15m: 0.75, percentileRank1h: 0.8, percentileRank4h: 1, percentileRank24h: 0.9 },
    relativeReturns: { relativeReturn15m: 0.005, relativeReturn1h: 0.01, relativeReturn4h: 0.03, relativeReturn24h: 0.07 },
    liquidityAdjustedPercentile: 0.85,
  };
  const feature = buildRelativeStrengthShadow('4H', context);
  assert.equal(feature.available, true);
  assert.equal(feature.state, 'TOP_QUINTILE');
  assert.equal(feature.metadata.percentileRank, 1);
  assert.equal(feature.normalizedValue, 1);
});

test('calculating all shadow features cannot alter an execution decision', () => {
  const oneHour = {
    market: 'KRW-TEST',
    timeframeMinutes: 60,
    candleCount: 200,
    asOf: 1_000,
    indicators: { atrPct: 0.02 },
    regime: { regime: 'UPTREND', confidence: 0.8, trendStrength: 0.6, highVolatility: false, reasons: [] },
    trend: { action: 'BUY', directionalScore: 70, strength: 70, confidence: 0.8, reasons: [] },
    momentum: { action: 'BUY', directionalScore: 65, strength: 65, confidence: 0.78, reasons: [] },
    meanReversion: { action: 'WAIT', state: 'NEUTRAL', score: 0, confidence: 0.5, rawExtremeScore: 0, trendPenalty: 1, reasons: [] },
  };
  const multiTimeframe = {
    market: 'KRW-TEST',
    asOf: 1_000,
    action: 'BUY',
    directionalScore: 70,
    oracleTradeScore: 85,
    confidence: 0.82,
    aligned: true,
    positionRiskMultiplier: 1,
    frames: { fourHour: oneHour, oneHour, fifteenMinute: oneHour },
    reasons: [],
  };
  const liquidity = {
    market: 'KRW-TEST',
    tradePrice: 100,
    accTradePrice24h: 1_000_000_000,
    signedChangeRate: 0.01,
    spreadBps: 2,
    top5BidDepthKrw: 100_000_000,
    top5AskDepthKrw: 100_000_000,
    orderbookImbalance: 0,
    warning: false,
    score: 90,
    eligible: true,
    reasons: [],
  };
  const portfolio = new PaperPortfolio(1_000_000);
  const input = {
    liquidity: liquidity as any,
    multiTimeframe: multiTimeframe as any,
    oneHour: oneHour as any,
    portfolio: portfolio.snapshot({}),
    position: null,
    evidenceGate: passGate,
  };
  const before = buildExecutionDecision(input);
  const researchSeries = candles(80, (index) => 100 + index * 0.2, (index) => index + 1);
  buildTechnicalFeatureShadowSnapshot(researchSeries, '1H', null);
  const after = buildExecutionDecision(input);

  assert.deepEqual(
    {
      action: before.action,
      side: before.side,
      notional: before.notional,
      riskDisposition: before.riskDisposition,
      stop: before.stopLossPrice,
      takeProfit: before.takeProfitPrice,
    },
    {
      action: after.action,
      side: after.side,
      notional: after.notional,
      riskDisposition: after.riskDisposition,
      stop: after.stopLossPrice,
      takeProfit: after.takeProfitPrice,
    },
  );
});
