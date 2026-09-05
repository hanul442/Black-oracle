import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildSchedulerPipelineOutcome,
  isEvidenceRefreshHttpSuccess,
  isPaperCycleHttpSuccess,
  shouldRunPaperCycleAfterEvidenceRefresh,
} from '../../supabase/functions/_shared/paperSchedulerPolicy.ts';

const stage = (status: number | null, ok: boolean, error: string | null = null) => ({ status, ok, error });

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
  assert.match(source, /last_ok:\s*outcome\.telemetryOk/);
  assert.match(source, /telemetryUpdate\.enabled\s*=\s*false/);
  assert.match(source, /telemetryUpdate\.target_base_url\s*=\s*PRODUCTION_TARGET/);
});
