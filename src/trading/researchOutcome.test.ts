import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFeatureOutcome, sampleSufficiency, type ResearchFeatureObservation } from './research/featureOutcome';
import type { Candle } from './types';

const observation: ResearchFeatureObservation = {
  id: 'obs-1',
  cycleId: 'cycle-1',
  timestamp: 1_000_000,
  market: 'KRW-TEST',
  timeframe: '15M',
  featureFamily: 'BREAKOUT',
  featureName: 'breakout.donchian.v1',
  featureVersion: '1.0.0',
  rawValue: 1,
  normalizedValue: 0.5,
  direction: 'BULLISH',
  confidence: 1,
  status: 'SHADOW',
  strategyVersion: 'test',
  codeCommit: 'test',
  configVersion: 'test',
  provenance: 'PROSPECTIVE',
  referencePrice: 100,
  executionDecision: 'NO_TRADE',
  evidenceScore: null,
  evidenceConfidence: 0,
  oracleTradeScore: 60,
  metadata: {},
};

const candle = (timestamp: number, close: number, high = close, low = close): Candle => ({
  market: 'KRW-TEST',
  timeframeMinutes: 15,
  timestamp,
  open: close,
  high,
  low,
  close,
  volume: 1,
});

const assertClose = (actual: number, expected: number, tolerance = 1e-12) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
};

test('outcome resolver refuses to resolve before the requested horizon', () => {
  const future = candle(observation.timestamp + 15 * 60_000, 102, 103, 99);
  const outcome = resolveFeatureOutcome(observation, '15M', [future], observation.timestamp + 14 * 60_000);
  assert.equal(outcome, null);
});

test('outcome resolver ignores candles at or before the decision timestamp', () => {
  const contaminated = candle(observation.timestamp, 999, 1_000, 1);
  const resolved = candle(observation.timestamp + 15 * 60_000, 102, 103, 99);
  const outcome = resolveFeatureOutcome(observation, '15M', [contaminated, resolved], resolved.timestamp);
  assert.ok(outcome);
  assertClose(outcome!.futureReturn, 0.02);
  assertClose(outcome!.mfe, 0.03);
  assertClose(outcome!.mae, -0.01);
});

test('outcome resolver never reads a candle later than now', () => {
  const first = candle(observation.timestamp + 15 * 60_000, 102);
  const leaked = candle(observation.timestamp + 30 * 60_000, 200, 220, 50);
  const outcome = resolveFeatureOutcome(observation, '15M', [first, leaked], first.timestamp);
  assert.ok(outcome);
  assertClose(outcome!.futureReturn, 0.02);
  assertClose(outcome!.mfe, 0.02);
  assertClose(outcome!.mae, 0.02);
});

test('sample sufficiency uses the sprint observation bands exactly', () => {
  assert.equal(sampleSufficiency(99), 'INSUFFICIENT');
  assert.equal(sampleSufficiency(100), 'EXPLORATORY');
  assert.equal(sampleSufficiency(499), 'EXPLORATORY');
  assert.equal(sampleSufficiency(500), 'PRELIMINARY');
  assert.equal(sampleSufficiency(1_999), 'PRELIMINARY');
  assert.equal(sampleSufficiency(2_000), 'INTERMEDIATE');
  assert.equal(sampleSufficiency(4_999), 'INTERMEDIATE');
  assert.equal(sampleSufficiency(5_000), 'PRIMARY_FEATURE_EVALUATION');
});