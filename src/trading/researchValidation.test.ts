import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBlockRegimeMonteCarlo,
  buildCalibration,
  buildDeflatedSharpe,
  buildExpectedShortfall,
  buildProbabilityBacktestOverfitting,
} from './researchValidation.ts';

test('expected shortfall reports lower-tail loss', () => {
  const result = buildExpectedShortfall([-0.08, -0.04, -0.02, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07], 0.9);
  assert.equal(result.available, true);
  assert.ok((result.expectedShortfall ?? 0) <= (result.valueAtRisk ?? 0));
});

test('deflated sharpe refuses shallow samples', () => {
  const result = buildDeflatedSharpe(Array.from({ length: 10 }, () => 0.01), 20);
  assert.equal(result.verdict, 'INSUFFICIENT_DATA');
  assert.equal(result.available, false);
});

test('deflated sharpe penalizes many tried configurations', () => {
  const returns = Array.from({ length: 120 }, (_, index) => 0.003 + ((index % 7) - 3) * 0.0015);
  const oneTrial = buildDeflatedSharpe(returns, 1);
  const manyTrials = buildDeflatedSharpe(returns, 100);
  assert.ok((manyTrials.expectedMaxNullSharpe ?? 0) >= (oneTrial.expectedMaxNullSharpe ?? 0));
  assert.ok((manyTrials.probability ?? 1) <= (oneTrial.probability ?? 1));
});

test('PBO requires multiple aligned strategies', () => {
  const result = buildProbabilityBacktestOverfitting([{ id: 'only', returns: Array(100).fill(0.01) }]);
  assert.equal(result.available, false);
  assert.equal(result.verdict, 'INSUFFICIENT_DATA');
});

test('PBO computes combinatorial overfit estimate for comparable candidates', () => {
  const strategies = [
    { id: 'stable', returns: Array.from({ length: 120 }, (_, i) => 0.003 + ((i % 5) - 2) * 0.001) },
    { id: 'noisy', returns: Array.from({ length: 120 }, (_, i) => ((i * 17) % 11 - 5) * 0.002) },
    { id: 'weak', returns: Array.from({ length: 120 }, (_, i) => -0.001 + ((i % 7) - 3) * 0.001) },
  ];
  const result = buildProbabilityBacktestOverfitting(strategies, 6, 100);
  assert.equal(result.available, true);
  assert.ok((result.pbo ?? -1) >= 0 && (result.pbo ?? 2) <= 1);
  assert.ok(result.combinations > 0);
});

test('calibration returns Brier, log loss and ECE after enough observations', () => {
  const observations = Array.from({ length: 100 }, (_, i) => ({ probability: i % 2 ? 0.98 : 0.02, outcome: Boolean(i % 2) }));
  const result = buildCalibration(observations);
  assert.equal(result.available, true);
  assert.ok((result.brierScore ?? 1) < 0.01);
  assert.ok((result.logLoss ?? 1) < 0.05);
  assert.ok((result.expectedCalibrationError ?? 1) < 0.05);
});

test('block regime Monte Carlo retains zero authority and produces stress distribution', () => {
  const samples = Array.from({ length: 100 }, (_, i) => ({
    regime: i < 50 ? 'TREND' : 'RANGE',
    returnPct: 0.004 + ((i % 9) - 4) * 0.001,
  }));
  const result = buildBlockRegimeMonteCarlo(samples, { scenarioCount: 200, minSamples: 40, blockSize: 4, horizonSamples: 60 });
  assert.equal(result.available, true);
  assert.equal(result.assumptions.movingBlockBootstrap, true);
  assert.equal(result.assumptions.regimeStratified, true);
  assert.ok((result.survivalProbability ?? -1) >= 0 && (result.survivalProbability ?? 2) <= 1);
});
