import { tradingEvidenceStore } from './evidenceStore';
import { runtimeIntegrityStore } from './integrityStore';
import { paperLoopController } from './paperLoop';
import { paperTradingSession } from './paperSession';
import { tradingCheckpointStore } from './persistence';
import { tradeCaseStore } from './tradeCaseStore';

let autosaveTimer: NodeJS.Timeout | null = null;
let restoreSummary: {
  restored: boolean;
  savedAt: number | null;
  reason: string | null;
  resumedLoop: boolean;
} = {
  restored: false,
  savedAt: null,
  reason: null,
  resumedLoop: false,
};

export const buildRuntimeCheckpoint = (reason = 'manual') => {
  runtimeIntegrityStore.ensureStarted();
  return {
    schemaVersion: 1 as const,
    savedAt: Date.now(),
    reason,
    session: paperTradingSession.checkpoint(),
    evidence: tradingEvidenceStore.list(undefined, true),
    loop: paperLoopController.checkpoint(),
    tradeCases: tradeCaseStore.list(),
    // Optional schema-v1 extension: old checkpoints remain readable and begin observability only after upgrade.
    integrity: runtimeIntegrityStore.snapshot(),
  };
};

export const saveRuntimeCheckpoint = async (reason = 'manual') => {
  const checkpoint = buildRuntimeCheckpoint(reason);
  const persistence = await tradingCheckpointStore.save(checkpoint);
  return { checkpoint, persistence };
};

export const restoreRuntimeCheckpoint = async (resumeLoop = true) => {
  const checkpoint = await tradingCheckpointStore.load();
  if (!checkpoint) {
    runtimeIntegrityStore.restore(null);
    runtimeIntegrityStore.ensureStarted();
    restoreSummary = {
      restored: false,
      savedAt: null,
      reason: null,
      resumedLoop: false,
    };
    return { ...restoreSummary, persistence: tradingCheckpointStore.status() };
  }

  paperTradingSession.restore(checkpoint.session);
  tradingEvidenceStore.replaceAll(checkpoint.evidence);
  tradeCaseStore.replaceAll(checkpoint.tradeCases ?? []);
  paperLoopController.restore(checkpoint.loop, resumeLoop);
  runtimeIntegrityStore.restore((checkpoint as any).integrity ?? null);
  runtimeIntegrityStore.ensureStarted();

  restoreSummary = {
    restored: true,
    savedAt: checkpoint.savedAt,
    reason: checkpoint.reason,
    resumedLoop: checkpoint.loop.running && resumeLoop,
  };
  return { ...restoreSummary, persistence: tradingCheckpointStore.status() };
};

export const runtimeRestoreSummary = () => ({ ...restoreSummary });

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
  restore: runtimeRestoreSummary(),
  integrity: runtimeIntegrityStore.summary(),
});
