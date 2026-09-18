export const PUBLIC_RUNTIME_IDS = [
  'black-oracle-paper',
  'black-oracle-paper-native-shadow',
] as const;

export type PublicRuntimeId = typeof PUBLIC_RUNTIME_IDS[number];
export type RuntimeReadinessState = 'RUNNING' | 'DEGRADED' | 'STALLED' | 'BLOCKED' | 'UNKNOWN';

export type SchedulerReadinessInput = {
  enabled: boolean | null;
  lastInvokedAt: number | null;
  lastHttpStatus: number | null;
  lastOk: boolean | null;
};

export type RuntimeReadinessInput = {
  runtimeId: PublicRuntimeId;
  now: number;
  staleAfterMs: number;
  checkpointSavedAt: number | null;
  scheduler: SchedulerReadinessInput | null;
  cycleErrors: number;
  attachmentAuditStatus: string | null;
};

export type RuntimeReadiness = {
  state: RuntimeReadinessState;
  ready: boolean;
  reason: string;
  checkpointAgeMs: number | null;
  schedulerAgeMs: number | null;
  evidence: {
    checkpointPersisted: boolean;
    checkpointFresh: boolean;
    schedulerRequired: boolean;
    schedulerAccepted: boolean | null;
  };
};

export const isPublicRuntimeId = (value: string): value is PublicRuntimeId =>
  (PUBLIC_RUNTIME_IDS as readonly string[]).includes(value);

const age = (now: number, timestamp: number | null) =>
  timestamp === null ? null : Math.max(0, now - timestamp);

const accepted2xx = (status: number | null) =>
  status !== null && status >= 200 && status < 300;

export const evaluateRuntimeReadiness = ({
  runtimeId,
  now,
  staleAfterMs,
  checkpointSavedAt,
  scheduler,
  cycleErrors,
  attachmentAuditStatus,
}: RuntimeReadinessInput): RuntimeReadiness => {
  const schedulerRequired = runtimeId === 'black-oracle-paper';
  const checkpointAgeMs = age(now, checkpointSavedAt);
  const schedulerAgeMs = age(now, scheduler?.lastInvokedAt ?? null);
  const checkpointPersisted = checkpointSavedAt !== null;
  const checkpointFresh = checkpointAgeMs !== null && checkpointAgeMs <= staleAfterMs;
  const schedulerAccepted = schedulerRequired
    ? Boolean(
      scheduler
      && scheduler.enabled === true
      && scheduler.lastOk === true
      && accepted2xx(scheduler.lastHttpStatus)
      && schedulerAgeMs !== null
      && schedulerAgeMs <= staleAfterMs
    )
    : null;

  const result = (state: RuntimeReadinessState, reason: string, ready = false): RuntimeReadiness => ({
    state,
    ready,
    reason,
    checkpointAgeMs,
    schedulerAgeMs,
    evidence: {
      checkpointPersisted,
      checkpointFresh,
      schedulerRequired,
      schedulerAccepted,
    },
  });

  if (!checkpointPersisted) {
    return result('UNKNOWN', 'No persisted PAPER checkpoint is available.');
  }
  if (!checkpointFresh) {
    return result('STALLED', `No persisted PAPER checkpoint within ${Math.round(staleAfterMs / 60_000)} minutes.`);
  }
  if (schedulerRequired && !scheduler) {
    return result('UNKNOWN', 'Scheduler source-of-truth is unavailable.');
  }
  if (schedulerRequired && scheduler?.enabled !== true) {
    return result('BLOCKED', 'Scheduled PAPER runtime is disabled.');
  }
  if (schedulerRequired && scheduler?.lastOk !== true) {
    return result('DEGRADED', 'Latest scheduler invocation is missing or reported a failure.');
  }
  if (schedulerRequired && !accepted2xx(scheduler?.lastHttpStatus ?? null)) {
    return result('DEGRADED', `Latest scheduler HTTP status ${scheduler?.lastHttpStatus ?? 'UNKNOWN'} does not prove a completed cycle.`);
  }
  if (schedulerRequired && (schedulerAgeMs === null || schedulerAgeMs > staleAfterMs)) {
    return result('STALLED', `No accepted scheduler invocation within ${Math.round(staleAfterMs / 60_000)} minutes.`);
  }
  if (attachmentAuditStatus === 'FAIL') {
    return result('DEGRADED', 'Evidence attachment invariant failed.');
  }
  if (cycleErrors > 0) {
    return result('DEGRADED', 'Latest PAPER cycle contains market errors.');
  }

  return result('RUNNING', 'Persisted PAPER checkpoint and required scheduler evidence are current.', true);
};
