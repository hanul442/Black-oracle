export type LongProtectionTrigger = 'STOP_LOSS' | 'TAKE_PROFIT_1' | 'TAKE_PROFIT_2';

export interface ConservativeProtectionReferenceInput {
  trigger: LongProtectionTrigger;
  observedPrice: number;
  triggerPrice: number;
}

/**
 * Resolves the reference price used for a long Paper protective exit when the
 * runtime only observes discrete market snapshots.
 *
 * Take-profit exits are capped at the trigger price so a slow protection clock
 * cannot manufacture favorable overshoot after the target was already crossed.
 * Stop-loss exits retain the observed breached price, preserving adverse gap /
 * polling-lag slippage rather than pretending the stop filled at its trigger.
 *
 * Broker fees/slippage are applied after this resolver. This primitive is kept
 * separate from the active qualification runtime until shadow validation proves
 * the accounting change is safe to activate.
 */
export const resolveConservativeLongProtectionReferencePrice = (
  input: ConservativeProtectionReferenceInput,
): number => {
  const { trigger, observedPrice, triggerPrice } = input;
  if (!(observedPrice > 0) || !Number.isFinite(observedPrice)) {
    throw new Error('Protection fill observedPrice must be positive and finite.');
  }
  if (!(triggerPrice > 0) || !Number.isFinite(triggerPrice)) {
    throw new Error('Protection fill triggerPrice must be positive and finite.');
  }

  if (trigger === 'STOP_LOSS') {
    if (observedPrice > triggerPrice) {
      throw new Error('STOP_LOSS resolver requires an observed price at or below the stop trigger.');
    }
    return Math.min(observedPrice, triggerPrice);
  }

  if (observedPrice < triggerPrice) {
    throw new Error(`${trigger} resolver requires an observed price at or above the take-profit trigger.`);
  }
  return Math.min(observedPrice, triggerPrice);
};
