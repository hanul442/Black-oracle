import assert from 'node:assert/strict';
import test from 'node:test';
import { runBlindValidation, runWalkForwardValidation } from './blindValidation';
import type { DecisionTrace } from './decisionTrace';
import type { MarketPriceSnapshot } from './marketHistory';

const trace = (timestamp: number, action: DecisionTrace['action'] = 'ENTER', regime = 'UPTREND'): DecisionTrace => ({
  timestamp,
  market: 'KRW-BTC',
  action,
  regime: regime as any,
  regimeConfidence: 0.8,
  oracleTradeScore: 75,
  confidence: 0.8,
  strategyDisposition: 'TREND_MOMENTUM',
  router: { route: 'TREND_MOMENTUM', confidence: 0.8, reasons: [] } as any,
  riskDisposition: 'APPROVE',
  eventScore: 30,
  forecast: { available: true, direction: 'UP', confidence: 0.7, uncertainty: 0.3, evidenceIds: ['e1'], reasons: [] },
  evidenceActiveCount: 1,
  evidenceContradictionCount: 0,
  evidenceIds: ['e1'],
  primaryReason: 'test',
  reasons: ['test'],
  riskReasons: [],
});

const history = (count: number): MarketPriceSnapshot[] => Array.from({ length: count }, (_, index) => ({
  timestamp: 1_000_000 + index * 3_600_000,
  prices: [['KRW-BTC', 100 + index * 2]],
}));

test('blind evaluator anchors at or after decision and target strictly after horizon', () => {
  const result = runBlindValidation([trace(1_000_001)], history(12), { horizonMs: 4 * 3_600_000, minSamples: 1, minObservationDays: 1 });
  assert.equal(result.sampleCount, 1);
  const sample = result.samples[0];
  assert.ok(sample.anchorTimestamp >= sample.decisionTimestamp);
  assert.ok(sample.targetTimestamp >= sample.anchorTimestamp + 4 * 3_600_000);
  assert.ok(sample.directionalReturn > 0);
  assert.equal(result.provenance.noLookahead, true);
});

test('insufficient sample and day requirements fail closed', () => {
  const result = runBlindValidation([trace(1_000_001)], history(12));
  assert.equal(result.verdict, 'INSUFFICIENT_DATA');
});

test('walk-forward uses test timestamps after each training boundary', () => {
  const decisions = Array.from({ length: 90 }, (_, index) => trace(1_000_000 + index * 86_400_000));
  const prices: MarketPriceSnapshot[] = Array.from({ length: 100 }, (_, index) => ({
    timestamp: 1_000_000 + index * 86_400_000,
    prices: [['KRW-BTC', 100 + index]],
  }));
  const blind = runBlindValidation(decisions, prices, { horizonMs: 86_400_000, minSamples: 20, minObservationDays: 14 });
  const wf = runWalkForwardValidation(blind.samples, { folds: 4, minimumTestSamples: 8 });
  assert.ok(wf.folds.length > 0);
  for (const fold of wf.folds) assert.ok(fold.testStartTimestamp > fold.trainEndTimestamp);
  assert.equal(wf.provenance.testDataAlwaysAfterTrainingData, true);
});
