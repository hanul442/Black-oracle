import { strict as assert } from 'node:assert';
import { buildUpbitOrderDryRun, reconcileUpbitDryRun, type UpbitDryRunRequest } from './upbitDryRunReconciliation';

const base = (): UpbitDryRunRequest => ({
  adapter: 'UPBIT', operation: 'ORDER_DRY_RUN', idempotencyKey: 'idem-1', requestedAt: '2026-09-21T15:10:00.000Z',
  risk: {
    contractVersion: 'bot.risk-execution-boundary.v1', decision: 'APPROVE', mode: 'LIVE_SHADOW',
    intentId: 'intent-1', market: 'KRW-BTC', side: 'BUY', quantity: 0.001, referencePrice: 100000000,
    evaluatedAt: '2026-09-21T15:09:30.000Z', expiresAt: '2026-09-21T15:10:30.000Z',
    strategyId: 'strategy-1', routerDecisionId: 'router-1', governanceDecisionId: 'gov-1', riskDecisionId: 'risk-1',
    eventLedgerId: 'event-1', decisionReplayId: 'replay-1', killSwitchActive: false,
    executionAuthority: false, capitalAuthority: false, liveAuthority: false,
  },
});

{
  const preview = buildUpbitOrderDryRun(base());
  assert.equal(preview.status, 'DRY_RUN');
  assert.equal(preview.submissionAuthority, false);
  assert.equal(preview.executionAuthority, false);
  assert.equal(preview.liveAuthority, false);
  assert.equal(preview.notional, 100000);
  assert.equal(reconcileUpbitDryRun(preview, preview).status, 'MATCH');
}

{
  const req = base(); req.risk.decision = 'NO_TRADE';
  assert.equal(buildUpbitOrderDryRun(req).reason, 'RISK_NO_TRADE_TERMINAL');
}
{
  const req = base(); req.risk.killSwitchActive = true;
  assert.equal(buildUpbitOrderDryRun(req).reason, 'KILL_SWITCH_ACTIVE');
}
{
  const req = base(); req.requestedAt = '2026-09-21T15:11:00.000Z';
  assert.equal(buildUpbitOrderDryRun(req).reason, 'STALE_OR_FUTURE_RISK');
}
{
  const req = base();
  assert.equal(buildUpbitOrderDryRun(req, new Set(['idem-1'])).reason, 'IDEMPOTENCY_CONFLICT');
}
{
  const preview = buildUpbitOrderDryRun(base());
  const mismatch = { ...preview, quantity: preview.quantity + 1 };
  assert.equal(reconcileUpbitDryRun(preview, mismatch).status, 'NO_TRADE');
}
{
  const req = base();
  (req.risk as unknown as { mode: string }).mode = 'LIVE';
  assert.equal(buildUpbitOrderDryRun(req).reason, 'UNSUPPORTED_EXECUTION_MODE');
}

console.log('upbitDryRunReconciliation tests passed');
