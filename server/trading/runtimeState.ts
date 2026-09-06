import { appendGradeSnapshot, normalizeGradeSurveillance, summarizeGradeSurveillance, type GradeSurveillanceCheckpoint } from '../../src/trading/gradeSurveillance';
import {
  advanceQualificationWindow,
  normalizeQualificationWindow,
  qualificationWindowConfigFromEnv,
  qualificationWindowSummary,
  type QualificationWindowCheckpoint,
} from '../../src/trading/qualificationWindow';
import { tradingEvidenceStore } from './evidenceStore';
import { runtimeExperimentLedgerStore } from './experimentLedgerStore';
import { runtimeIntegrityStore } from './integrityStore';
import { paperLoopController } from './paperLoop';
import { buildPaperReadinessSnapshotFromCheckpoint } from './paperReadinessSnapshot';
import { paperTradingSession } from './paperSession';
import { tradingCheckpointStore, type TradingRuntimeCheckpoint } from './persistence';
import { runtimeStrategyVaultStore } from './strategyVaultStore';
import { tradeCaseStore } from './tradeCaseStore';

let autosaveTimer: NodeJS.Timeout | null = null;
let gradeSurveillance: GradeSurveillanceCheckpoint = normalizeGradeSurveillance(null);
let qualificationWindow: QualificationWindowCheckpoint | null = null;
let qualificationConfigError: string | null = null;
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

const safeQualificationConfig = () => {
  try {
    const config = qualificationWindowConfigFromEnv();
    qualificationConfigError = null;
    return config;
  } catch (error) {
    qualificationConfigError = error instanceof Error ? error.message : 'Invalid qualification window configuration.';
    return null;
  }
};

const advanceRuntimeQualificationWindow = () => {
  const config = safeQualificationConfig();
  qualificationWindow = advanceQualificationWindow({
    existing: qualificationWindow,
    config,
    latestCycle: paperLoopController.checkpoint().lastCycle,
    evidence: tradingEvidenceStore.list(undefined, true),
  });
  return qualificationWindow;
};

export const buildRuntimeCheckpoint = (reason = 'manual'): TradingRuntimeCheckpoint => {
  runtimeIntegrityStore.ensureStarted();
  const savedAt = Date.now();
  const nextQualificationWindow = advanceRuntimeQualificationWindow();
  const base: TradingRuntimeCheckpoint = {
    schemaVersion: 1 as const,
    savedAt,
    reason,
    session: paperTradingSession.checkpoint(),
    evidence: tradingEvidenceStore.list(undefined, true),
    loop: paperLoopController.checkpoint(),
    tradeCases: tradeCaseStore.list(),
    // Optional schema-v1 extensions keep old checkpoints readable while adding auditable runtime history.
    integrity: runtimeIntegrityStore.snapshot(),
    experimentLedger: runtimeExperimentLedgerStore.snapshot(),
    strategyVault: runtimeStrategyVaultStore.snapshot(),
    ...(nextQualificationWindow ? { qualificationWindow: nextQualificationWindow } : {}),
  };
  const readiness = buildPaperReadinessSnapshotFromCheckpoint(base, savedAt);
  gradeSurveillance = appendGradeSnapshot(gradeSurveillance, readiness.snapshot);
  return { ...base, gradeSurveillance };
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
    runtimeExperimentLedgerStore.restore([]);
    runtimeStrategyVaultStore.restore(null);
    gradeSurveillance = normalizeGradeSurveillance(null);
    qualificationWindow = null;
    safeQualificationConfig();
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
  runtimeIntegrityStore.restore(checkpoint.integrity ?? null);
  runtimeIntegrityStore.ensureStarted();
  runtimeExperimentLedgerStore.restore(checkpoint.experimentLedger ?? []);
  runtimeStrategyVaultStore.restore(checkpoint.strategyVault ?? null);
  gradeSurveillance = normalizeGradeSurveillance(checkpoint.gradeSurveillance);
  qualificationWindow = normalizeQualificationWindow(checkpoint.qualificationWindow);
  advanceRuntimeQualificationWindow();

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
  gradeSurveillance: summarizeGradeSurveillance(gradeSurveillance),
  experimentLedger: runtimeExperimentLedgerStore.summary(),
  strategyVault: runtimeStrategyVaultStore.summary(),
  qualificationWindow: {
    ...qualificationWindowSummary(qualificationWindow),
    configError: qualificationConfigError,
  },
});
