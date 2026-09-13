import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRiskReward, validateHorizonTradePlan, type HorizonTradePlan } from './horizonTradePlan';

const basePlan: HorizonTradePlan = {
  market: 'KRX-000001',
  horizon: 'SHORT',
  strategyId: 'S1',
  direction: 'LONG',
  entryPrice: 100,
  structuralInvalidationPrice: 94,
  stopLossPrice: 95,
  takeProfit1Price: 110,
  takeProfit2Price: 120,
  finalTargetPrice: 120,
  expectedHoldingPeriod: '1 to 10 trading days',
  riskReward1: 2,
  riskReward2: 4,
  forecast: {
    horizon: 'SHORT',
    asOf: Date.now(),
    currentPrice: 100,
    expectedPrice: 114,
    expectedPriceLow: 96,
    expectedPriceHigh: 122,
    probabilityBullish: 0.62,
    probabilityBearish: 0.23,
    probabilityNeutral: 0.15,
    evidenceIds: ['e1'],
    modelIds: ['m1'],
    assumptions: [],
    dataGaps: [],
  },
  reasons: ['test'],
  blockers: [],
  executionAuthority: false,
};

test('complete long trade plan becomes executable candidate only after contract validation', () => {
  const result = validateHorizonTradePlan(basePlan);
  assert.equal(result.executableCandidate, true);
  assert.equal(result.blockers.length, 0);
});

test('missing forecast or protection blocks candidate', () => {
  const result = validateHorizonTradePlan({
    ...basePlan,
    stopLossPrice: null,
    forecast: { ...basePlan.forecast, expectedPrice: null, dataGaps: ['forecast model unavailable'] },
  });
  assert.equal(result.executableCandidate, false);
  assert.ok(result.blockers.some((item) => item.includes('Stop-loss')));
  assert.ok(result.blockers.some((item) => item.includes('Expected future price')));
});

test('risk reward calculation rejects invalid asymmetry', () => {
  assert.equal(computeRiskReward(100, 95, 110), 2);
  assert.equal(computeRiskReward(100, 105, 110), null);
});
