export type SchedulerStageResult = {
  status: number | null;
  ok: boolean;
  error: string | null;
};

export type SchedulerPipelineOutcome = {
  success: boolean;
  pipelineOk: boolean;
  degraded: boolean;
  telemetryOk: boolean;
  telemetryError: string | null;
};

export const isEvidenceRefreshHttpSuccess = (status: number | null, responseOk: boolean) =>
  responseOk && status !== null && status >= 200 && status < 300;

export const isPaperCycleHttpSuccess = (status: number | null, responseOk: boolean) =>
  (responseOk && status !== null && status >= 200 && status < 300) || status === 409;

/**
 * Evidence collection must never suppress deterministic protective exits.
 * A refresh failure therefore degrades the pipeline but the Paper cycle still runs;
 * Sprint 5 governance will fail-close new ENTER decisions when fresh Evidence is absent.
 */
export const shouldRunPaperCycleAfterEvidenceRefresh = (_evidence: SchedulerStageResult) => true;

const stageError = (label: string, stage: SchedulerStageResult) => {
  if (stage.ok) return null;
  const status = stage.status === null ? 'NO_HTTP_STATUS' : `HTTP_${stage.status}`;
  return `${label} ${status}: ${stage.error || 'unknown failure'}`;
};

export const buildSchedulerPipelineOutcome = (
  evidence: SchedulerStageResult,
  cycle: SchedulerStageResult,
): SchedulerPipelineOutcome => {
  const evidenceError = stageError('EVIDENCE_REFRESH', evidence);
  const cycleError = stageError('PAPER_CYCLE', cycle);
  const pipelineOk = evidence.ok && cycle.ok;
  const success = cycle.ok;

  return {
    success,
    pipelineOk,
    degraded: success && !evidence.ok,
    telemetryOk: pipelineOk,
    telemetryError: [evidenceError, cycleError].filter(Boolean).join(' | ') || null,
  };
};
