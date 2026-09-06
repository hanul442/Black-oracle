import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCostStressValidation } from './costStress';

test('healthy positive trade returns survive the full incremental cost ladder', () => {
  const result = buildCostStressValidation(Array.from({ length: 30 }, () => 0.01));
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.available, true);
  assert.equal(result.scenarios.length, 4);
  assert.equal(result.worstScenario?.additionalRoundTripCostBps, 30);
  assert.ok((result.worstScenario?.meanReturn ?? 0) > 0);
  assert.equal(result.executionAuthority, false);
  assert.equal(result.promotionAuthority, false);
});

test('cost stress remains insufficient before the minimum closed-trade depth', () => {
  const result = buildCostStressValidation(Array.from({ length: 10 }, () => 0.01));
  assert.equal(result.verdict, 'INSUFFICIENT_DATA');
  assert.equal(result.available, false);
  assert.equal(result.scenarios.length, 0);
});

test('fragile expectancy is rejected when incremental costs erase the edge', () => {
  const returns = Array.from({ length: 30 }, (_, index) => index % 2 === 0 ? 0.002 : -0.001);
  const result = buildCostStressValidation(returns);
  assert.equal(result.verdict, 'REJECT');
  assert.ok((result.worstScenario?.meanReturn ?? 1) <= 0);
});

test('custom cost ladder is normalized, sorted and bounded', () => {
  const result = buildCostStressValidation(Array.from({ length: 30 }, () => 0.02), {
    additionalRoundTripCostBps: [30, 5, 30, 600, -10],
  });
  assert.deepEqual(result.scenarios.map((scenario) => scenario.additionalRoundTripCostBps), [0, 5, 30, 500]);
});
