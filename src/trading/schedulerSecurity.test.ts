import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSchedulerPipelineOutcome,
  isAllowedProductionSchedulerTarget,
  shouldRunPaperCycleAfterEvidenceRefresh,
} from '../../supabase/functions/_shared/paperSchedulerPolicy.ts';

test('scheduled PAPER target is pinned to the exact canonical production origin', () => {
  assert.equal(isAllowedProductionSchedulerTarget('https://black-oracle.vercel.app'), true);
  assert.equal(isAllowedProductionSchedulerTarget('https://black-oracle.vercel.app/'), true);
  assert.equal(isAllowedProductionSchedulerTarget('https://black-oracle-feature.vercel.app'), false);
  assert.equal(isAllowedProductionSchedulerTarget('https://attacker.vercel.app'), false);
  assert.equal(isAllowedProductionSchedulerTarget('http://black-oracle.vercel.app'), false);
  assert.equal(isAllowedProductionSchedulerTarget('https://black-oracle.vercel.app/other'), false);
  assert.equal(isAllowedProductionSchedulerTarget('https://black-oracle.vercel.app?x=1'), false);
  assert.equal(isAllowedProductionSchedulerTarget('https://user:pass@black-oracle.vercel.app'), false);
});

test('Evidence refresh failure never suppresses the PAPER cycle protective path', () => {
  const failedEvidence = { status: 502, ok: false, error: 'refresh failed' };
  assert.equal(shouldRunPaperCycleAfterEvidenceRefresh(failedEvidence), true);

  const outcome = buildSchedulerPipelineOutcome(
    failedEvidence,
    { status: 200, ok: true, error: null },
  );
  assert.equal(outcome.success, true);
  assert.equal(outcome.pipelineOk, false);
  assert.equal(outcome.degraded, true);
  assert.match(outcome.telemetryError ?? '', /EVIDENCE_REFRESH/);
});
