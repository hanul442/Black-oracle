import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateUniverseFreshness } from './upbitUniverseFreshness';

const now = new Date('2026-09-20T14:00:00.000Z');

test('accepts a snapshot within the allowed age', () => {
  assert.deepEqual(evaluateUniverseFreshness({ observedAt: '2026-09-20T13:56:00.000Z' }, now), {
    usable: true,
    reason: 'FRESH',
    ageMs: 240_000,
  });
});

test('fails closed when the snapshot is stale', () => {
  assert.equal(
    evaluateUniverseFreshness({ observedAt: '2026-09-20T13:54:59.999Z' }, now).reason,
    'STALE',
  );
});

test('fails closed for timestamps beyond allowed future skew', () => {
  assert.equal(
    evaluateUniverseFreshness({ observedAt: '2026-09-20T14:00:31.000Z' }, now).reason,
    'FUTURE_TIMESTAMP',
  );
});

test('fails closed for invalid timestamps', () => {
  assert.deepEqual(evaluateUniverseFreshness({ observedAt: 'not-a-date' }, now), {
    usable: false,
    reason: 'INVALID_TIMESTAMP',
    ageMs: null,
  });
});

test('rejects invalid freshness policy and evaluation clocks', () => {
  assert.throws(
    () => evaluateUniverseFreshness({ observedAt: now.toISOString() }, now, { maxAgeMs: -1 }),
    /maxAgeMs must be a finite non-negative number/,
  );
  assert.throws(
    () => evaluateUniverseFreshness({ observedAt: now.toISOString() }, new Date('invalid')),
    /now must be a valid Date/,
  );
});
