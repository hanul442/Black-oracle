import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildSchedulerPipelineOutcome,
  EVIDENCE_REFRESH_TIMEOUT_MS,
  isEvidenceRefreshHttpSuccess,
  isPaperCycleHttpSuccess,
  MAX_SCHEDULER_DOWNSTREAM_BUDGET_MS,
  PAPER_CYCLE_TIMEOUT_MS,
  SCHEDULER_DOWNSTREAM_BUDGET_MS,
  shouldRunPaperCycleAfterEvidenceRefresh,
} from '../../supabase/functions/_shared/paperSchedulerPolicy.ts';

const stage = (status: number | null, ok: boolean, error: string | null = null) => ({ status, ok, error });

test('scheduler preserves material headroom below the hosted Edge request ceiling', () => {
  assert.equal(EVIDENCE_REFRESH_TIMEOUT_MS, 56_000);
  assert.equal(PAPER_CYCLE_TIMEOUT_MS, 58_000);
  assert.equal(SCHEDULER_DOWNSTREAM_BUDGET_MS, 114_000);
  assert.ok(
    EVIDENCE_REFRESH_TIMEOUT_MS > 53_000,
    'Evidence outer timeout must exceed the ~8s feed + 45s classifier internal timeout budget',
  );
  assert.ok(
    SCHEDULER_DOWNSTREAM_BUDGET_MS <= MAX_SCHEDULER_DOWNSTREAM_BUDGET_MS,
    'sequential downstream timeout budget must stay at or below the 115s internal ceiling',
  );
  assert.ok(
    150_000 - SCHEDULER_DOWNSTREAM_BUDGET_MS >= 35_000,
    'retain at least 35s for scheduler bookkeeping/telemetry beneath the 150s hosted Edge ceiling',
  );
});

test('evidence refresh failure degrades the pipeline but never suppresses the Paper cycle', () => {
  const evidence = stage(500, false, 'classifier unavailable');
  assert.equal(shouldRunPaperCycleAfterEvidenceRefresh(evidence), true);

  const outcome = buildSchedulerPipelineOutcome(evidence, stage(200, true));
  assert.equal(outcome.success, true);
  assert.equal(outcome.pipelineOk, false);
  assert.equal(outcome.degraded, true);
  assert.equal(outcome.telemetryOk, false);
  assert.match(outcome.telemetryError || '', /EVIDENCE_REFRESH HTTP_500/);
});

test('full evidence + Paper success is healthy and Paper lease conflict remains a safe skip', () => {
  assert.equal(isEvidenceRefreshHttpSuccess(200, true), true);
  assert.equal(isEvidenceRefreshHttpSuccess(409, false), false);
  assert.equal(isPaperCycleHttpSuccess(200, true), true);
  assert.equal(isPaperCycleHttpSuccess(409, false), true);

  const healthy = buildSchedulerPipelineOutcome(stage(200, true), stage(200, true));
  assert.deepEqual(healthy, {
    success: true,
    pipelineOk: true,
    degraded: false,
    telemetryOk: true,
    telemetryError: null,
  });
});

test('Paper cycle failure is a scheduler failure even when Evidence refresh succeeded', () => {
  const outcome = buildSchedulerPipelineOutcome(
    stage(200, true),
    stage(500, false, 'cycle failed'),
  );
  assert.equal(outcome.success, false);
  assert.equal(outcome.pipelineOk, false);
  assert.equal(outcome.degraded, false);
  assert.equal(outcome.telemetryOk, false);
  assert.match(outcome.telemetryError || '', /PAPER_CYCLE HTTP_500/);
});

test('Edge scheduler invokes Evidence refresh before Paper cycle and preserves production auto-disarm', async () => {
  const schedulerUrl = new URL('../../supabase/functions/black-oracle-paper-scheduler/index.ts', import.meta.url);
  const source = await readFile(schedulerUrl, 'utf-8');
  const evidenceIndex = source.indexOf('"/api/trading-evidence-refresh"');
  const cycleIndex = source.indexOf('"/api/trading-paper-cycle"');

  assert.ok(evidenceIndex >= 0, 'scheduler must call Evidence refresh');
  assert.ok(cycleIndex > evidenceIndex, 'Evidence refresh must complete before Paper cycle begins');
  assert.match(source, /EVIDENCE_REFRESH_TIMEOUT_MS/);
  assert.match(source, /PAPER_CYCLE_TIMEOUT_MS/);
  assert.match(source, /last_ok:\s*outcome\.telemetryOk/);
  assert.match(source, /telemetryUpdate\.enabled\s*=\s*false/);
  assert.match(source, /telemetryUpdate\.target_base_url\s*=\s*PRODUCTION_TARGET/);
});
