import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProducerHealth, classifySchedulerHealth } from './eventLedgerHealth';

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

test('recent successful scheduler is not green when source-of-truth contradicts preserved disabled intent', () => {
  const now = Date.parse('2026-09-12T04:20:00.000Z');
  const health = classifySchedulerHealth({
    enabled: true,
    last_invoked_at: '2026-09-12T04:15:00.000Z',
    last_http_status: 200,
    last_ok: true,
    last_error: 'CONTROLLED_SINGLE_CYCLE_COMPLETE_20260910: recurring S2 scheduler remains intentionally disabled pending lineage review.',
    target_base_url: 'https://example.invalid',
  }, now);

  assert.equal(health.status, 'DEGRADED');
  assert.equal(health.controlPlaneDrift, true);
  assert.match(health.reason, /control-plane drift/i);
});

test('old recovered scheduler error does not degrade a recent successful heartbeat without a control marker', () => {
  const now = Date.parse('2026-09-12T04:20:00.000Z');
  const health = classifySchedulerHealth({
    enabled: true,
    last_invoked_at: '2026-09-12T04:15:00.000Z',
    last_http_status: 200,
    last_ok: true,
    last_error: 'previous upstream 504 recovered on retry',
    target_base_url: 'https://example.invalid',
  }, now);

  assert.equal(health.status, 'HEALTHY');
  assert.equal(health.controlPlaneDrift, false);
});

test('failed or stale scheduler remains critical regardless of control marker', () => {
  const now = Date.parse('2026-09-12T04:20:00.000Z');
  const failed = classifySchedulerHealth({
    enabled: true,
    last_invoked_at: '2026-09-12T04:15:00.000Z',
    last_http_status: 504,
    last_ok: false,
    last_error: 'upstream timeout',
  }, now);
  const stale = classifySchedulerHealth({
    enabled: true,
    last_invoked_at: '2026-09-12T02:00:00.000Z',
    last_http_status: 200,
    last_ok: true,
    last_error: null,
  }, now);

  assert.equal(failed.status, 'CRITICAL');
  assert.equal(stale.status, 'CRITICAL');
});
