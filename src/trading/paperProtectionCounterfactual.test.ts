import assert from 'node:assert/strict';
import test from 'node:test';
import {
  replayLongProtectionCounterfactual,
  summarizeLongProtectionCounterfactuals,
} from './paperProtectionCounterfactual';

test('removes favorable TP1 overshoot while retaining broker SELL slippage', () => {
  const replay = replayLongProtectionCounterfactual({
    trigger: 'TAKE_PROFIT_1',
    observedPrice: 110,
    triggerPrice: 105,
    quantity: 10,
    sellSlippageBps: 8,
  });

  assert.equal(replay.conservativeReferencePrice, 105);
  assert.ok(Math.abs(replay.observedFillPrice - 109.912) < 1e-10);
  assert.ok(Math.abs(replay.conservativeFillPrice - 104.916) < 1e-10);
  assert.ok(Math.abs(replay.grossExitValueDelta - (-49.96)) < 1e-10);
  assert.equal(replay.favorableOvershootRemoved, 50);
  assert.equal(replay.changed, true);
});

test('keeps an adverse stop-loss lag price unchanged', () => {
  const replay = replayLongProtectionCounterfactual({
    trigger: 'STOP_LOSS',
    observedPrice: 92,
    triggerPrice: 95,
    quantity: 10,
  });

  assert.equal(replay.conservativeReferencePrice, 92);
  assert.equal(replay.referencePriceDelta, 0);
  assert.equal(replay.grossExitValueDelta, 0);
  assert.equal(replay.favorableOvershootRemoved, 0);
  assert.equal(replay.changed, false);
});

test('keeps an exact TP2 touch unchanged', () => {
  const replay = replayLongProtectionCounterfactual({
    trigger: 'TAKE_PROFIT_2',
    observedPrice: 120,
    triggerPrice: 120,
    quantity: 2,
  });

  assert.equal(replay.conservativeReferencePrice, 120);
  assert.equal(replay.changed, false);
});

test('summarizes changed observations without mutating runtime state', () => {
  const summary = summarizeLongProtectionCounterfactuals([
    { trigger: 'TAKE_PROFIT_1', observedPrice: 110, triggerPrice: 105, quantity: 10 },
    { trigger: 'STOP_LOSS', observedPrice: 92, triggerPrice: 95, quantity: 10 },
    { trigger: 'TAKE_PROFIT_2', observedPrice: 125, triggerPrice: 120, quantity: 4 },
  ]);

  assert.equal(summary.observations, 3);
  assert.equal(summary.changedObservations, 2);
  assert.deepEqual(summary.byTrigger, { STOP_LOSS: 1, TAKE_PROFIT_1: 1, TAKE_PROFIT_2: 1 });
  assert.equal(summary.favorableOvershootRemoved, 70);
  assert.ok(Math.abs(summary.grossExitValueDelta - (-69.944)) < 1e-10);
});

test('rejects invalid quantity and slippage assumptions', () => {
  assert.throws(() => replayLongProtectionCounterfactual({
    trigger: 'TAKE_PROFIT_1', observedPrice: 110, triggerPrice: 105, quantity: 0,
  }), /quantity/);
  assert.throws(() => replayLongProtectionCounterfactual({
    trigger: 'TAKE_PROFIT_1', observedPrice: 110, triggerPrice: 105, quantity: 1, sellSlippageBps: 10_000,
  }), /sellSlippageBps/);
});
