import assert from 'node:assert/strict';
import test from 'node:test';
import { HORIZON_ORDER, HORIZON_STRATEGY_POLICIES, requiredTimeframesForHorizon } from './horizonPolicy';

test('defines five independent trading horizons', () => {
  assert.deepEqual(HORIZON_ORDER, ['ULTRA_SHORT', 'SHORT', 'MEDIUM', 'MEDIUM_LONG', 'LONG']);
  assert.equal(Object.keys(HORIZON_STRATEGY_POLICIES).length, 5);
});

test('every horizon has normalized timeframe weights and at least one required frame', () => {
  for (const horizon of HORIZON_ORDER) {
    const policy = HORIZON_STRATEGY_POLICIES[horizon];
    const total = policy.timeframeRules.reduce((sum, rule) => sum + rule.weight, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `${horizon} weights must sum to 1`);
    assert.ok(requiredTimeframesForHorizon(horizon).length >= 1, `${horizon} needs a required timeframe`);
  }
});

test('long horizons give weekly/monthly structure authority', () => {
  assert.ok(requiredTimeframesForHorizon('MEDIUM_LONG').includes('1W'));
  assert.ok(requiredTimeframesForHorizon('MEDIUM_LONG').includes('1MO'));
  assert.ok(requiredTimeframesForHorizon('LONG').includes('1W'));
  assert.ok(requiredTimeframesForHorizon('LONG').includes('1MO'));
});
