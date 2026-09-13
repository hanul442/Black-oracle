import {
  resolveConservativeLongProtectionReferencePrice,
  type LongProtectionTrigger,
} from './paperProtectionFill';

export interface PaperProtectionCounterfactualInput {
  trigger: LongProtectionTrigger;
  observedPrice: number;
  triggerPrice: number;
  quantity: number;
  sellSlippageBps?: number;
}

export interface PaperProtectionCounterfactualResult {
  trigger: LongProtectionTrigger;
  observedReferencePrice: number;
  conservativeReferencePrice: number;
  observedFillPrice: number;
  conservativeFillPrice: number;
  quantity: number;
  referencePriceDelta: number;
  grossExitValueDelta: number;
  favorableOvershootRemoved: number;
  changed: boolean;
}

export interface PaperProtectionCounterfactualSummary {
  observations: number;
  changedObservations: number;
  grossExitValueDelta: number;
  favorableOvershootRemoved: number;
  byTrigger: Record<LongProtectionTrigger, number>;
}

const assertPositiveFinite = (value: number, field: string) => {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new Error(`${field} must be positive and finite.`);
  }
};

/**
 * Shadow-only comparison between the active discrete-snapshot Paper reference
 * price and the conservative protective reference price.
 *
 * This function never mutates a session, portfolio, ledger, or broker. It only
 * reproduces the broker's SELL slippage arithmetic so historical/synthetic
 * observations can be compared before any runtime cutover is considered.
 */
export const replayLongProtectionCounterfactual = (
  input: PaperProtectionCounterfactualInput,
): PaperProtectionCounterfactualResult => {
  const sellSlippageBps = input.sellSlippageBps ?? 8;
  assertPositiveFinite(input.quantity, 'quantity');
  if (!Number.isFinite(sellSlippageBps) || sellSlippageBps < 0 || sellSlippageBps >= 10_000) {
    throw new Error('sellSlippageBps must be finite and in [0, 10000).');
  }

  const conservativeReferencePrice = resolveConservativeLongProtectionReferencePrice({
    trigger: input.trigger,
    observedPrice: input.observedPrice,
    triggerPrice: input.triggerPrice,
  });
  const slippageMultiplier = 1 - sellSlippageBps / 10_000;
  const observedFillPrice = input.observedPrice * slippageMultiplier;
  const conservativeFillPrice = conservativeReferencePrice * slippageMultiplier;
  const referencePriceDelta = conservativeReferencePrice - input.observedPrice;
  const grossExitValueDelta = (conservativeFillPrice - observedFillPrice) * input.quantity;
  const favorableOvershootRemoved = input.trigger === 'STOP_LOSS'
    ? 0
    : Math.max(0, input.observedPrice - conservativeReferencePrice) * input.quantity;

  return {
    trigger: input.trigger,
    observedReferencePrice: input.observedPrice,
    conservativeReferencePrice,
    observedFillPrice,
    conservativeFillPrice,
    quantity: input.quantity,
    referencePriceDelta,
    grossExitValueDelta,
    favorableOvershootRemoved,
    changed: Math.abs(referencePriceDelta) > Number.EPSILON,
  };
};

export const summarizeLongProtectionCounterfactuals = (
  observations: PaperProtectionCounterfactualInput[],
): PaperProtectionCounterfactualSummary => {
  const byTrigger: Record<LongProtectionTrigger, number> = {
    STOP_LOSS: 0,
    TAKE_PROFIT_1: 0,
    TAKE_PROFIT_2: 0,
  };

  let changedObservations = 0;
  let grossExitValueDelta = 0;
  let favorableOvershootRemoved = 0;

  for (const observation of observations) {
    const replay = replayLongProtectionCounterfactual(observation);
    byTrigger[replay.trigger] += 1;
    if (replay.changed) changedObservations += 1;
    grossExitValueDelta += replay.grossExitValueDelta;
    favorableOvershootRemoved += replay.favorableOvershootRemoved;
  }

  return {
    observations: observations.length,
    changedObservations,
    grossExitValueDelta,
    favorableOvershootRemoved,
    byTrigger,
  };
};
