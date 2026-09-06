import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTechnicalEvidence } from './technicalEvidence';
import type { IndicatorSnapshot, MarketStructureSnapshot, MomentumSignal, RegimeSnapshot, TrendSignal } from './types';

const indicators: IndicatorSnapshot = {
  close: 100,
  ema20: 102,
  ema50: 99,
  ema200: 90,
  rsi14: 61,
  stochRsi14: 70,
  atr14: 2,
  atrPct: 0.02,
  macd: 1.2,
  macdSignal: 0.8,
  macdHistogram: 0.4,
  roc20: 0.04,
  bollingerMiddle: 98,
  bollingerUpper: 104,
  bollingerLower: 92,
  bollingerPercentB: 0.67,
  bollingerBandwidth: 0.12,
  volumeZScore: 1.4,
};

const structure: MarketStructureSnapshot = {
  bias: 'BULLISH',
  confidence: 0.78,
  lastSwingHigh: { index: 10, timestamp: 10, confirmedAt: 12, price: 104, type: 'HIGH' },
  lastSwingLow: { index: 8, timestamp: 8, confirmedAt: 10, price: 94, type: 'LOW' },
  lastEvent: { type: 'BOS', direction: 'BULLISH', breakPrice: 101, brokenSwingPrice: 99, brokenSwingTimestamp: 7, confirmedAt: 13 },
  recentEvents: [],
  location: { zone: 'DISCOUNT', percentile: 0.35, rangeLow: 94, rangeHigh: 104 },
  liquiditySweep: null,
  reasons: [],
};

const trend: TrendSignal = { action: 'BUY', directionalScore: 72, strength: 72, confidence: 0.8, reasons: [] };
const momentum: MomentumSignal = { action: 'BUY', directionalScore: 64, strength: 64, confidence: 0.74, reasons: [] };
const regime: RegimeSnapshot = { regime: 'UPTREND', confidence: 0.76, trendStrength: 0.72, highVolatility: false, reasons: [] };

test('correlated indicators are collapsed into independent evidence families', () => {
  const result = buildTechnicalEvidence({
    market: 'KRW-BTC',
    timeframeMinutes: 60,
    asOf: 1_700_000_000_000,
    indicators,
    structure,
    trend,
    momentum,
    regime,
  });

  assert.equal(result.independentFamilyCount, 6);
  assert.ok(result.rawSignalCount > result.independentFamilyCount);
  assert.ok(result.correlatedSignalPenalty > 0.5);
  assert.ok(result.bullishFamilies >= 3);
  assert.ok(result.directionalScore > 0);
});

test('evidence ids expire after two bars and preserve family lineage', () => {
  const asOf = 1_700_000_000_000;
  const result = buildTechnicalEvidence({
    market: 'KRW-BTC',
    timeframeMinutes: 15,
    asOf,
    indicators,
    structure,
    trend,
    momentum,
    regime,
  });
  assert.ok(result.items.every((item) => item.expiresAt === asOf + 30 * 60 * 1000));
  assert.ok(result.items.every((item) => item.sourceFields.length > 0));
});
