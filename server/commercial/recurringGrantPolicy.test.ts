import assert from 'node:assert/strict';
import test from 'node:test';

import { decideRecurringGrant, RECURRING_GRANT_INTERVAL_MS } from './recurringGrantPolicy';

test('Plus receives 500 Credits per elapsed grant interval', () => {
  const now = 10 * RECURRING_GRANT_INTERVAL_MS;
  const result = decideRecurringGrant({
    plan: 'PLUS',
    currentRecurringBalance: 0,
    lastGrantAt: now - 2 * RECURRING_GRANT_INTERVAL_MS,
    now,
  });

  assert.equal(result.intervalsDue, 2);
  assert.equal(result.grantCredits, 1000);
  assert.equal(result.resultingBalance, 1000);
});

test('recurring grants stop at the Plan balance cap', () => {
  const now = 20 * RECURRING_GRANT_INTERVAL_MS;
  const result = decideRecurringGrant({
    plan: 'PLUS',
    currentRecurringBalance: 14_800,
    lastGrantAt: now - 3 * RECURRING_GRANT_INTERVAL_MS,
    now,
  });

  assert.equal(result.grantCredits, 200);
  assert.equal(result.resultingBalance, 15_000);
});

test('Core never accrues recurring Credits', () => {
  const now = 5 * RECURRING_GRANT_INTERVAL_MS;
  const result = decideRecurringGrant({
    plan: 'CORE',
    currentRecurringBalance: 0,
    lastGrantAt: now - 5 * RECURRING_GRANT_INTERVAL_MS,
    now,
  });

  assert.equal(result.grantCredits, 0);
  assert.equal(result.resultingBalance, 0);
});
