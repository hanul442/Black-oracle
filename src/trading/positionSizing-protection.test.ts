import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPositionSizingDecision } from './positionSizing';
import { buildDynamicProtectionUpdate } from './protectionManager';

const oneHour = (regime: string, momentum = 50, trend = 60, swingLow = 104) => ({
  market: 'KRW-TEST',
  timeframeMinutes: 60,
  candleCount: 200,
  asOf: 1_000,
  indicators: { atr14: 2, atrPct: 0.02 },
  regime: { regime, confidence: 0.8, trendStrength: 0.7, highVolatility: false, reasons: [] },
  trend: { action: 'BUY', directionalScore: trend, strength: Math.abs(trend), confidence: 0.8, reasons: [] },
  momentum: { action: 'BUY', directionalScore: momentum, strength: Math.abs(momentum), confidence: 0.8, reasons: [] },
  meanReversion: { action: 'WAIT', state: 'NEUTRAL', score: 0, confidence: 0.5, rawExtremeScore: 0, trendPenalty: 1, reasons: [] },
  structure: { lastSwingLow: { price: swingLow } },
});

test('equal-notional sizing ignores model confidence and targets 10% of 100m KRW equity', () => {
  const sizing = buildPositionSizingDecision({
    equity: 100_000_000,
    cash: 100_000_000,
    stopDistancePct: 0.02,
  });
  assert.equal(sizing.requestedNotional, 10_000_000);
  assert.equal(sizing.expectedLossAtStop, 200_000);
  assert.equal(sizing.confidenceScaled, false);
});

test('wide stop reduces notional through risk-at-stop cap rather than confidence', () => {
  const sizing = buildPositionSizingDecision({
    equity: 100_000_000,
    cash: 100_000_000,
    stopDistancePct: 0.08,
  });
  assert.equal(sizing.requestedNotional, 6_250_000);
  assert.equal(sizing.expectedLossAtStop, 500_000);
});

test('dynamic protection never lowers an existing long stop', () => {
  const update = buildDynamicProtectionUpdate({
    market: 'KRW-TEST',
    quantity: 1,
    averageCost: 100,
    entryPrice: 100,
    openedAt: 1,
    updatedAt: 1,
    stopLossPrice: 98,
    takeProfitPrice: 112,
    initialStopLossPrice: 95,
    initialRiskPerUnit: 5,
    highestPriceSinceEntry: 108,
    takeProfit2Price: 112,
    takeProfit1Taken: true,
    protectionRevision: 2,
  }, oneHour('UPTREND') as any, 110);

  assert.ok(update.stopLossPrice >= 98);
  assert.ok(update.highestPriceSinceEntry >= 110);
});

test('a breached stop is preserved so the exit cannot be recalculated away', () => {
  const update = buildDynamicProtectionUpdate({
    market: 'KRW-TEST',
    quantity: 1,
    averageCost: 100,
    entryPrice: 100,
    openedAt: 1,
    updatedAt: 1,
    stopLossPrice: 98,
    takeProfitPrice: 112,
    initialStopLossPrice: 95,
    initialRiskPerUnit: 5,
    highestPriceSinceEntry: 108,
    takeProfit2Price: 112,
    takeProfit1Taken: false,
    protectionRevision: 2,
  }, oneHour('UPTREND') as any, 97.5);

  assert.equal(update.stopLossPrice, 98);
  assert.equal(update.changed, false);
  assert.match(update.reasons.join(' '), /breached/i);
});

test('TP2 extension is capped when a strong trend persists', () => {
  const update = buildDynamicProtectionUpdate({
    market: 'KRW-TEST',
    quantity: 1,
    averageCost: 100,
    entryPrice: 100,
    openedAt: 1,
    updatedAt: 1,
    stopLossPrice: 100,
    takeProfitPrice: 115,
    initialStopLossPrice: 95,
    initialRiskPerUnit: 5,
    highestPriceSinceEntry: 112,
    takeProfit2Price: 115,
    takeProfit1Taken: true,
    protectionRevision: 3,
  }, oneHour('STRONG_UPTREND', 60, 70, 108) as any, 114);

  assert.ok((update.takeProfit2Price ?? 0) >= 115);
  assert.ok((update.takeProfit2Price ?? 0) <= 122.5); // 4.5R cap from entry.
});
