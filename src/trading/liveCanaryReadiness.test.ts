import { strict as assert } from 'node:assert';
import { evaluateLiveCanaryReadiness, type LiveCanaryReadinessRequest } from './liveCanaryReadiness';

const base = (): LiveCanaryReadinessRequest => ({
  mode: 'LIVE_SHADOW',
  evaluatedAt: '2026-09-21T15:20:00.000Z',
  killSwitchActive: false,
  adapterHealth: { adapter: 'UPBIT', status: 'HEALTHY', observedAt: '2026-09-21T15:19:30.000Z', expiresAt: '2026-09-21T15:20:30.000Z' },
  reconciliation: {
    contractVersion: 'bot.upbit-dry-run-reconciliation.v1', status: 'MATCH', reason: 'DETERMINISTIC_RECONCILIATION_MATCH',
    requestId: 'req-1', idempotencyKey: 'idem-1', eventLedgerId: 'event-1', decisionReplayId: 'replay-1',
    executionAuthority: false, liveAuthority: false,
  },
  expectedRequestId: 'req-1', expectedIdempotencyKey: 'idem-1', expectedEventLedgerId: 'event-1', expectedDecisionReplayId: 'replay-1',
});

{
  const r = evaluateLiveCanaryReadiness(base());
  assert.equal(r.status, 'READY');
  assert.equal(r.reason, 'EVIDENCE_COMPLETE_AUTHORITY_NOT_GRANTED');
  assert.equal(r.evidenceOnly, true);
  assert.equal(r.submissionAuthority, false);
  assert.equal(r.executionAuthority, false);
  assert.equal(r.capitalAuthority, false);
  assert.equal(r.liveAuthority, false);
}
{
  const x = base(); x.killSwitchActive = true;
  assert.equal(evaluateLiveCanaryReadiness(x).reason, 'KILL_SWITCH_ACTIVE');
}
{
  const x = base(); x.adapterHealth.status = 'DEGRADED';
  assert.equal(evaluateLiveCanaryReadiness(x).reason, 'ADAPTER_NOT_HEALTHY');
}
{
  const x = base(); x.adapterHealth.expiresAt = '2026-09-21T15:19:59.000Z';
  assert.equal(evaluateLiveCanaryReadiness(x).reason, 'STALE_OR_FUTURE_HEALTH');
}
{
  const x = base(); x.reconciliation.status = 'NO_TRADE';
  assert.equal(evaluateLiveCanaryReadiness(x).reason, 'RECONCILIATION_NOT_MATCHED');
}
{
  const x = base(); x.reconciliation.eventLedgerId = 'other-event';
  assert.equal(evaluateLiveCanaryReadiness(x).reason, 'LINEAGE_MISMATCH');
}
{
  const x = base(); (x as unknown as { mode: string }).mode = 'LIVE';
  assert.equal(evaluateLiveCanaryReadiness(x).reason, 'UNSUPPORTED_EXECUTION_MODE');
}

console.log('liveCanaryReadiness tests passed');
