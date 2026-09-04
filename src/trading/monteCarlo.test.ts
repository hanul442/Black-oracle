import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonteCarloValidation } from './monteCarlo';

test('returns INSUFFICIENT_DATA instead of fabricating Monte Carlo confidence', () => {
  const result = buildMonteCarloValidation([0.01, -0.005, 0.003]);
  assert.equal(result.verdict, 'INSUFFICIENT_DATA');
  assert.equal(result.available, false);
  assert.equal(result.survivalProbability, null);
  assert.equal(result.tradeCount, 3);
});

test('Monte Carlo validation is deterministic for the same seed and inputs', () => {
  const returns = Array.from({ length: 30 }, (_, index) => index % 3 === 0 ? -0.003 : 0.006);
  const first = buildMonteCarloValidation(returns, { seed: 42, scenarioCount: 500 });
  const second = buildMonteCarloValidation(returns, { seed: 42, scenarioCount: 500 });
  assert.deepEqual(first, second);
});

test('stable positive stressed returns can pass validation', () => {
  const result = buildMonteCarloValidation(Array(30).fill(0.004), {
    seed: 7,
    scenarioCount: 500,
  });
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.survivalProbability, 1);
  assert.equal(result.ruinProbability, 0);
  assert.ok((result.terminalReturn.p05 ?? 0) > 0);
});

test('persistent negative returns are rejected under stress', () => {
  const result = buildMonteCarloValidation(Array(30).fill(-0.01), {
    seed: 7,
    scenarioCount: 500,
  });
  assert.equal(result.verdict, 'REJECT');
  assert.ok((result.ruinProbability ?? 0) > 0.9);
  assert.ok((result.maxDrawdown.p95 ?? 0) > result.thresholds.drawdownLimitPct);
});

test('higher execution cost worsens the terminal-return distribution', () => {
  const returns = Array.from({ length: 40 }, (_, index) => index % 4 === 0 ? -0.004 : 0.006);
  const lowCost = buildMonteCarloValidation(returns, {
    seed: 99,
    scenarioCount: 500,
    costInflationBps: 0,
    adverseShockPct: 0,
    winnerHaircut: 1,
    loserAmplification: 1,
  });
  const highCost = buildMonteCarloValidation(returns, {
    seed: 99,
    scenarioCount: 500,
    costInflationBps: 30,
    adverseShockPct: 0,
    winnerHaircut: 1,
    loserAmplification: 1,
  });
  assert.ok((highCost.terminalReturn.median ?? 0) < (lowCost.terminalReturn.median ?? 0));
  assert.ok((highCost.maxDrawdown.p95 ?? 0) >= (lowCost.maxDrawdown.p95 ?? 0));
});
