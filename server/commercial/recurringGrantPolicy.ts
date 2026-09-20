import { PLAN_RECURRING_CREDITS, type PlanTier } from '../../src/commercial/creditContracts';

export const RECURRING_GRANT_POLICY_VERSION = 1 as const;
export const RECURRING_GRANT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type RecurringGrantInput = {
  plan: Exclude<PlanTier, 'ENTERPRISE'>;
  currentRecurringBalance: number;
  lastGrantAt: number | null;
  now: number;
};

export type RecurringGrantDecision = {
  grantCredits: number;
  intervalsDue: number;
  nextGrantAt: number;
  resultingBalance: number;
  cap: number;
  dailyGrant: number;
};

export const decideRecurringGrant = (input: RecurringGrantInput): RecurringGrantDecision => {
  const config = PLAN_RECURRING_CREDITS[input.plan];
  const base = input.lastGrantAt ?? input.now - RECURRING_GRANT_INTERVAL_MS;
  const elapsed = Math.max(0, input.now - base);
  const intervalsDue = Math.max(0, Math.floor(elapsed / RECURRING_GRANT_INTERVAL_MS));
  const room = Math.max(0, config.recurringBalanceCap - Math.max(0, input.currentRecurringBalance));
  const rawGrant = intervalsDue * config.dailyGrant;
  const grantCredits = Math.min(room, rawGrant);
  const resultingBalance = Math.min(
    config.recurringBalanceCap,
    Math.max(0, input.currentRecurringBalance) + grantCredits,
  );
  const consumedIntervals = intervalsDue > 0 ? intervalsDue : 0;
  const nextGrantAt = base + (consumedIntervals + 1) * RECURRING_GRANT_INTERVAL_MS;

  return {
    grantCredits,
    intervalsDue,
    nextGrantAt,
    resultingBalance,
    cap: config.recurringBalanceCap,
    dailyGrant: config.dailyGrant,
  };
};
