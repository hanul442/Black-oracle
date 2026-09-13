import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveConservativeLongProtectionReferencePrice } from './paperProtectionFill';

test('caps favorable TP1 overshoot at the trigger price', () => {
  assert.equal(resolveConservativeLongProtectionReferencePrice({
    trigger: 'TAKE_PROFIT_1',
    observedPrice: 112,
    triggerPrice: 105,
  }), 105);
});

test('caps favorable TP2 overshoot at the trigger price', () => {
  assert.equal(resolveConservativeLongProtectionReferencePrice({
    trigger: 'TAKE_PROFIT_2',
    observedPrice: 118,
    triggerPrice: 110,
  }), 110);
});

test('retains adverse stop polling lag instead of improving it to the trigger', () => {
  assert.equal(resolveConservativeLongProtectionReferencePrice({
    trigger: 'STOP_LOSS',
    observedPrice: 91,
    triggerPrice: 95,
  }), 91);
});

test('preserves an exact trigger touch', () => {
  assert.equal(resolveConservativeLongProtectionReferencePrice({
    trigger: 'TAKE_PROFIT_2',
    observedPrice: 110,
    triggerPrice: 110,
  }), 110);
  assert.equal(resolveConservativeLongProtectionReferencePrice({
    trigger: 'STOP_LOSS',
    observedPrice: 95,
    triggerPrice: 95,
  }), 95);
});

test('rejects snapshots that do not actually cross the declared protection trigger', () => {
  assert.throws(() => resolveConservativeLongProtectionReferencePrice({
    trigger: 'STOP_LOSS',
    observedPrice: 96,
    triggerPrice: 95,
  }));
  assert.throws(() => resolveConservativeLongProtectionReferencePrice({
    trigger: 'TAKE_PROFIT_1',
    observedPrice: 104,
    triggerPrice: 105,
  }));
});

test('rejects non-positive or non-finite prices', () => {
  assert.throws(() => resolveConservativeLongProtectionReferencePrice({
    trigger: 'TAKE_PROFIT_1',
    observedPrice: Number.NaN,
    triggerPrice: 105,
  }));
  assert.throws(() => resolveConservativeLongProtectionReferencePrice({
    trigger: 'STOP_LOSS',
    observedPrice: 95,
    triggerPrice: 0,
  }));
});
