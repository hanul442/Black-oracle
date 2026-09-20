import assert from 'node:assert/strict';
import test from 'node:test';

import { quoteAlert, quoteFixedCreditAction, validateCreditCatalog } from './creditPolicy';

test('credit catalog preserves 100-credit denomination', () => {
  const result = validateCreditCatalog();
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('Plus can quote a simple report question for 100 Credits', () => {
  const quote = quoteFixedCreditAction({
    accountId: 'u1',
    plan: 'PLUS',
    actionType: 'REPORT_SIMPLE_QUESTION',
    now: 1000,
    scopeSummary: 'Explain report.',
  });
  assert.equal(quote.credits, 100);
});

test('Plus cannot bypass Max-only report request with Credits', () => {
  assert.throws(() => quoteFixedCreditAction({
    accountId: 'u1',
    plan: 'PLUS',
    actionType: 'REPORT_NEW_SECURITY',
    now: 1000,
    scopeSummary: 'New report.',
  }));
});

test('30-day multi-condition semantic Alert becomes 100-credit rounded quote', () => {
  const quote = quoteAlert({
    accountId: 'u1',
    plan: 'PLUS',
    subjectCount: 1,
    durationMs: 30 * 24 * 60 * 60 * 1000,
    crossAsset: false,
    semanticAiRequired: true,
    now: 1000,
    rule: {
      kind: 'GROUP',
      operator: 'AND',
      children: [
        { kind: 'CONDITION', field: 'GRADE', operator: 'GTE', value: 'A' },
        { kind: 'CONDITION', field: 'PRICE', operator: 'LTE', value: 280000 },
      ],
    },
  });

  assert.equal(quote.credits % 100, 0);
  assert.equal(quote.credits, 1000);
});
