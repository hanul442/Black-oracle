import { describe, expect, it } from 'vitest';
import {
  replayLongProtectionCounterfactual,
  summarizeLongProtectionCounterfactuals,
} from './paperProtectionCounterfactual';

describe('paper protection counterfactual replay', () => {
  it('removes favorable TP1 overshoot while retaining broker SELL slippage', () => {
    const replay = replayLongProtectionCounterfactual({
      trigger: 'TAKE_PROFIT_1',
      observedPrice: 110,
      triggerPrice: 105,
      quantity: 10,
      sellSlippageBps: 8,
    });

    expect(replay.conservativeReferencePrice).toBe(105);
    expect(replay.observedFillPrice).toBeCloseTo(109.912, 10);
    expect(replay.conservativeFillPrice).toBeCloseTo(104.916, 10);
    expect(replay.grossExitValueDelta).toBeCloseTo(-49.96, 10);
    expect(replay.favorableOvershootRemoved).toBe(50);
    expect(replay.changed).toBe(true);
  });

  it('keeps an adverse stop-loss lag price unchanged', () => {
    const replay = replayLongProtectionCounterfactual({
      trigger: 'STOP_LOSS',
      observedPrice: 92,
      triggerPrice: 95,
      quantity: 10,
    });

    expect(replay.conservativeReferencePrice).toBe(92);
    expect(replay.referencePriceDelta).toBe(0);
    expect(replay.grossExitValueDelta).toBe(0);
    expect(replay.favorableOvershootRemoved).toBe(0);
    expect(replay.changed).toBe(false);
  });

  it('keeps an exact TP2 touch unchanged', () => {
    const replay = replayLongProtectionCounterfactual({
      trigger: 'TAKE_PROFIT_2',
      observedPrice: 120,
      triggerPrice: 120,
      quantity: 2,
    });

    expect(replay.conservativeReferencePrice).toBe(120);
    expect(replay.changed).toBe(false);
  });

  it('summarizes changed observations without mutating runtime state', () => {
    const summary = summarizeLongProtectionCounterfactuals([
      { trigger: 'TAKE_PROFIT_1', observedPrice: 110, triggerPrice: 105, quantity: 10 },
      { trigger: 'STOP_LOSS', observedPrice: 92, triggerPrice: 95, quantity: 10 },
      { trigger: 'TAKE_PROFIT_2', observedPrice: 125, triggerPrice: 120, quantity: 4 },
    ]);

    expect(summary.observations).toBe(3);
    expect(summary.changedObservations).toBe(2);
    expect(summary.byTrigger).toEqual({ STOP_LOSS: 1, TAKE_PROFIT_1: 1, TAKE_PROFIT_2: 1 });
    expect(summary.favorableOvershootRemoved).toBe(70);
    expect(summary.grossExitValueDelta).toBeCloseTo(-69.944, 10);
  });

  it('rejects invalid quantity and slippage assumptions', () => {
    expect(() => replayLongProtectionCounterfactual({
      trigger: 'TAKE_PROFIT_1', observedPrice: 110, triggerPrice: 105, quantity: 0,
    })).toThrow(/quantity/);
    expect(() => replayLongProtectionCounterfactual({
      trigger: 'TAKE_PROFIT_1', observedPrice: 110, triggerPrice: 105, quantity: 1, sellSlippageBps: 10_000,
    })).toThrow(/sellSlippageBps/);
  });
});
