import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProducerHealth } from './eventLedgerHealth';

const MINUTE = 60_000;

test('required producer is healthy inside cadence window and stale after warning threshold', () => {
  const policy = { source: 'paper_runtime', mode: 'REQUIRED' as const, warnAfterMs: 35 * MINUTE, criticalAfterMs: 60 * MINUTE };
  const now = 1_788_937_200_000;
  const fresh = classifyProducerHealth(policy, now - 20 * MINUTE, now);
  const stale = classifyProducerHealth(policy, now - 40 * MINUTE, now);
  assert.equal(fresh.status, 'HEALTHY');
  assert.equal(stale.status, 'STALE');
});

test('conditional producer silence never becomes an outage by itself', () => {
  const policy = { source: 'ai_council', mode: 'CONDITIONAL' as const, warnAfterMs: null, criticalAfterMs: null };
  const never = classifyProducerHealth(policy, null, 1_788_937_200_000);
  const old = classifyProducerHealth(policy, 1_788_000_000_000, 1_788_937_200_000);
  assert.equal(never.status, 'NEVER_SEEN');
  assert.equal(old.status, 'IDLE');
});

test('daily strategy factory does not become stale on an hourly clock', () => {
  const policy = { source: 'strategy_factory', mode: 'REQUIRED' as const, warnAfterMs: 36 * 60 * MINUTE, criticalAfterMs: 60 * 60 * MINUTE };
  const now = 1_788_937_200_000;
  assert.equal(classifyProducerHealth(policy, now - 10 * 60 * MINUTE, now).status, 'HEALTHY');
  assert.equal(classifyProducerHealth(policy, now - 37 * 60 * MINUTE, now).status, 'STALE');
});
