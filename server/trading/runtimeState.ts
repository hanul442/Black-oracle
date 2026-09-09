import { tradingEvidenceStore } from './evidenceStore';
import { paperLoopController } from './paperLoop';
import { paperTradingSession } from './paperSession';
import { tradingCheckpointStore } from './persistence';
import {
  assessRuntimeCheckpointCompatibility,
  checkpointIdentityFromProfile,
  tradingRuntimeProfile,
  type RuntimeCompatibilityAssessment,
} from './runtimeProfile';

let autosaveTimer: NodeJS.Timeout | null = null;
let runtimeCompatibility: RuntimeCompatibilityAssessment | null = null;
let restoreSummary: {
  restored: boolean;
  savedAt: number | null;
  reason: string | null;
  resumedLoop: boolean;
  compatibility: RuntimeCompatibilityAssessment | null;
} = {
  restored: false,
  savedAt: null,
  reason: null,
  resumedLoop: false,
  compatibility: null,
};

export const buildRuntimeCheckpoint = (reason = 'manual') => ({
  schemaVersion: 1 as const,
  savedAt: Date.now(),
  reason,
  runtime: checkpointIdentityFromProfile(tradingRuntimeProfile),
  session: paperTradingSession.checkpoint(),
  evidence: tradingEvidenceStore.list(undefined, true),
  loop: paperLoopController.checkpoint(),
});

export const saveRuntimeCheckpoint = async (reason = 'manual') => {
  const checkpoint = buildRuntimeCheckpoint(reason);
  const persistence = await tradingCheckpointStore.save(checkpoint);
  runtimeCompatibility = assessRuntimeCheckpointCompatibility(
    tradingRuntimeProfile,
    checkpoint.runtime,
    checkpoint.session.portfolio.initialEquity,
  );
  return { checkpoint, persistence, compatibility: runtimeCompatibility };
};

export const restoreRuntimeCheckpoint = async (resumeLoop = true) => {
  const checkpoint = await tradingCheckpointStore.load();
  if (!checkpoint) {
    runtimeCompatibility = null;
    restoreSummary = {
      restored: false,
      savedAt: null,
      reason: null,
      resumedLoop: false,
      compatibility: null,
    };
    return {
      ...restoreSummary,
      profile: checkpointIdentityFromProfile(tradingRuntimeProfile),
      persistence: tradingCheckpointStore.status(),
    };
  }

  runtimeCompatibility = assessRuntimeCheckpointCompatibility(
    tradingRuntimeProfile,
    checkpoint.runtime,
    checkpoint.session.portfolio.initialEquity,
  );
  if (!runtimeCompatibility.compatible) {
    restoreSummary = {
      restored: false,
      savedAt: checkpoint.savedAt,
      reason: checkpoint.reason,
      resumedLoop: false,
      compatibility: runtimeCompatibility,
    };
    throw new Error(`Paper runtime checkpoint is incompatible with the configured qualification profile: ${runtimeCompatibility.reasons.join(' ')}`);
  }

  paperTradingSession.restore(checkpoint.session);
  tradingEvidenceStore.replaceAll(checkpoint.evidence);
  paperLoopController.restore(checkpoint.loop, resumeLoop);

  restoreSummary = {
    restored: true,
    savedAt: checkpoint.savedAt,
    reason: checkpoint.reason,
    resumedLoop: checkpoint.loop.running && resumeLoop,
    compatibility: runtimeCompatibility,
  };
  return {
    ...restoreSummary,
    profile: checkpointIdentityFromProfile(tradingRuntimeProfile),
    persistence: tradingCheckpointStore.status(),
  };
};

export const initializeFreshQualificationRuntime = async () => {
  if (!tradingRuntimeProfile.qualificationMode || !tradingRuntimeProfile.qualificationId) {
    throw new Error('Fresh runtime initialization is restricted to an explicitly armed qualification profile.');
  }

  const existing = await tradingCheckpointStore.load();
  if (existing) {
    const compatibility = assessRuntimeCheckpointCompatibility(
      tradingRuntimeProfile,
      existing.runtime,
      existing.session.portfolio.initialEquity,
    );
    if (!compatibility.compatible) {
      throw new Error(`Existing qualification checkpoint is incompatible: ${compatibility.reasons.join(' ')}`);
    }
    runtimeCompatibility = compatibility;
    return {
      initialized: false,
      existing: true,
      checkpoint: existing,
      persistence: tradingCheckpointStore.status(),
      compatibility,
    };
  }

  const session = paperTradingSession.state();
  const loop = paperLoopController.checkpoint();
  const evidence = tradingEvidenceStore.list(undefined, true);
  const pristine = session.portfolio.initialEquity === tradingRuntimeProfile.initialEquityKrw
    && session.portfolio.cash === tradingRuntimeProfile.initialEquityKrw
    && session.portfolio.positions.length === 0
    && session.closedTrades.length === 0
    && session.ledger.length === 0
    && loop.cycleCount === 0
    && loop.lastCycle === null
    && loop.running === false
    && evidence.length === 0;

  if (!pristine) {
    throw new Error('Qualification runtime bootstrap refused because the in-memory Paper state is not pristine.');
  }

  const saved = await saveRuntimeCheckpoint('qualification-runtime-initialized');
  return {
    initialized: true,
    existing: false,
    ...saved,
  };
};

export const runtimeRestoreSummary = () => ({ ...restoreSummary });

export const runtimeProfileStatus = () => ({
  ...checkpointIdentityFromProfile(tradingRuntimeProfile),
  qualificationMode: tradingRuntimeProfile.qualificationMode,
  compatibility: runtimeCompatibility,
});

export const startRuntimeAutosave = (intervalMs = 60_000) => {
  if (!Number.isInteger(intervalMs) || intervalMs < 15_000) {
    throw new Error('Trading autosave interval must be at least 15000 ms.');
  }
  if (autosaveTimer) return;
  autosaveTimer = setInterval(() => {
    void saveRuntimeCheckpoint('autosave').catch((error) => {
      console.error('Black Oracle trading autosave failed:', error);
    });
  }, intervalMs);
  autosaveTimer.unref?.();
};

export const stopRuntimeAutosave = () => {
  if (autosaveTimer) clearInterval(autosaveTimer);
  autosaveTimer = null;
};

export const runtimePersistenceStatus = () => ({
  ...tradingCheckpointStore.status(),
  autosaveRunning: autosaveTimer !== null,
  profile: runtimeProfileStatus(),
  restore: runtimeRestoreSummary(),
});