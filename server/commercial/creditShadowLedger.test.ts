import assert from 'node:assert/strict';
import test from 'node:test';

import { projectCreditLedger } from './creditShadowLedger';
import type { CreditLedgerEntry } from '../../src/commercial/creditContracts';

const entry = (partial: Partial<CreditLedgerEntry> & Pick<CreditLedgerEntry, 'entryId' | 'kind' | 'credits'>): CreditLedgerEntry => ({
  accountId: 'u1',
  bucket: 'RECURRING_PLAN',
  occurredAt: 1,
  reason: 'test',
  ...partial,
});

test('reservation reduces available Credits without reducing wallet balance', () => {
  const snapshot = projectCreditLedger('u1', [
    entry({ entryId: 'grant', kind: 'GRANT', credits: 500, occurredAt: 1 }),
    entry({ entryId: 'reserve', kind: 'RESERVE', credits: 200, occurredAt: 2 }),
  ]);

  assert.equal(snapshot.recurringPlanCredits, 500);
  assert.equal(snapshot.reservedCredits, 200);
  assert.equal(snapshot.availableCredits, 300);
});

test('debit settles its related reservation exactly once', () => {
  const snapshot = projectCreditLedger('u1', [
    entry({ entryId: 'grant', kind: 'GRANT', credits: 500, occurredAt: 1 }),
    entry({ entryId: 'reserve', kind: 'RESERVE', credits: 200, occurredAt: 2 }),
    entry({ entryId: 'debit', kind: 'DEBIT', credits: 200, occurredAt: 3, relatedEntryId: 'reserve' }),
  ]);

  assert.equal(snapshot.recurringPlanCredits, 300);
  assert.equal(snapshot.reservedCredits, 0);
  assert.equal(snapshot.availableCredits, 300);
});

test('reversal restores a failed job debit', () => {
  const snapshot = projectCreditLedger('u1', [
    entry({ entryId: 'grant', kind: 'GRANT', credits: 500, occurredAt: 1 }),
    entry({ entryId: 'debit', kind: 'DEBIT', credits: 200, occurredAt: 2 }),
    entry({ entryId: 'reverse', kind: 'REVERSAL', credits: 200, occurredAt: 3, relatedEntryId: 'debit' }),
  ]);

  assert.equal(snapshot.availableCredits, 500);
});
