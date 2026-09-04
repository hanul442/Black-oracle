import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonteCarloValidation } from './monteCarlo';

test('marginal stressed outcomes are WATCH rather than false PASS', () => {
  const result = buildMonteCarloValidation(Array(30).fill(0.001), {
    seed: 11,
    scenarioCount: 500,
  });

  assert.equal(result.verdict, 'WATCH');
  assert.equal(result.survivalProbability, 1);
  assert.ok((result.terminalReturn.p05 ?? 0) < -0.02);
  assert.ok((result.terminalReturn.p05 ?? -1) >= -0.05);
});
