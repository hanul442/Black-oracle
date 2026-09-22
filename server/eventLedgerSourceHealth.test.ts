import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalSourceHealth } from './canonicalSourceHealth';

test('healthy empty source is explicitly verified-empty', () => {
  assert.deepEqual(canonicalSourceHealth({ now: 10_000, observedAt: 9_500, staleAfterMs: 1_000, itemCount: 0 }), {
    state: 'OK', observedAt: 9_500, stale: false, verifiedEmpty: true, error: null,
  });
});

test('stale retained source degrades and cannot claim verified-empty', () => {
  assert.deepEqual(canonicalSourceHealth({ now: 10_000, observedAt: 8_000, staleAfterMs: 1_000, itemCount: 0 }), {
    state: 'DEGRADED', observedAt: 8_000, stale: true, verifiedEmpty: false, error: null,
  });
});

test('source error degrades even with retained rows', () => {
  const result = canonicalSourceHealth({ now: 10_000, observedAt: 9_900, itemCount: 4, error: 'health read unavailable' });
  assert.equal(result.state, 'DEGRADED');
  assert.equal(result.verifiedEmpty, false);
  assert.equal(result.error, 'health read unavailable');
});

test('unavailable source fails closed', () => {
  const result = canonicalSourceHealth({ now: 10_000, itemCount: 0, unavailable: true, error: 'upstream unavailable' });
  assert.equal(result.state, 'UNAVAILABLE');
  assert.equal(result.verifiedEmpty, false);
});
