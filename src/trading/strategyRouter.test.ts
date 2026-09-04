import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStrategyRouterDecision } from './strategyRouter';
import type { EvidenceForecast } from './evidenceForecast';
import type { MultiTimeframeSnapshot } from './types';

const forecast: EvidenceForecast = {
  available: true,
  direction: 'BULLISH',
  probabilityBullish: 0.7,
  probabilityBearish: 0.3,
  confidence: 0.7,
  uncertainty: 0.3,
  score: 60,
  asOf: 1_000,
  evidenceIds: ['ev-1'],
  activeCount: 1,
  contradictionCount: 0,
  reasons: [],
};

const makeSnapshot = (overrides: Partial<MultiTimeframeSnapshot> = {}) => ({
  market: 'KRW-BTC',
  asOf: 1_000,
  action: 'BUY',
  directionalScore: 35,
  oracleTradeScore: 68,
  confidence: 0.7,
  aligned: true,
  positionRiskMultiplier: 1,
  frames: {
    fourHour: {},
    oneHour: {
      regime: { regime: 'UPTREND', confidence: 0.7 },
      trend: { action: 'BUY' },
      momentum: { action: 'BUY' },
      meanReversion: { action: 'WAIT', confidence: 0.3 },
    },
    fifteenMinute: {},
  },
  reasons: [],
  ...overrides,
}) as unknown as MultiTimeframeSnapshot;

test('routes WAIT consensus to explicit NO_TRADE without new thresholds', () => {
  const routed = buildStrategyRouterDecision(makeSnapshot({ action: 'WAIT', confidence: 0.8 }), forecast);
  assert.equal(routed.route, 'NO_TRADE');
});

test('routes trend regime to TREND_MOMENTUM when an engine matches consensus', () => {
  const routed = buildStrategyRouterDecision(makeSnapshot(), forecast);
  assert.equal(routed.route, 'TREND_MOMENTUM');
  assert.equal(routed.forecastAlignment, 'ALIGNED');
});

test('routes a range regime to MEAN_REVERSION when the reversion engine aligns', () => {
  const snapshot = makeSnapshot();
  (snapshot.frames.oneHour as any).regime = { regime: 'RANGE', confidence: 0.7 };
  (snapshot.frames.oneHour as any).meanReversion = { action: 'BUY', confidence: 0.66 };
  const routed = buildStrategyRouterDecision(snapshot, forecast);
  assert.equal(routed.route, 'MEAN_REVERSION');
});

test('preserves evidence conflict for audit instead of changing execution authority', () => {
  const conflictForecast = { ...forecast, direction: 'BEARISH' as const, probabilityBullish: 0.3, probabilityBearish: 0.7 };
  const routed = buildStrategyRouterDecision(makeSnapshot(), conflictForecast);
  assert.equal(routed.route, 'TREND_MOMENTUM');
  assert.equal(routed.forecastAlignment, 'CONFLICT');
});