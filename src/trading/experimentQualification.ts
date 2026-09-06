import type { ExperimentQualificationBinding } from './experiment';
import type { ExperimentLedgerEvent } from './experimentLedger';
import type { QualificationWindowCheckpoint } from './qualificationWindow';

const researchConfigurationIdPattern = /^rcfg-v1-[0-9a-f]{16}$/;

const readBinding = (event: ExperimentLedgerEvent): ExperimentQualificationBinding | null => {
  const value = event.payload.qualification;
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ExperimentQualificationBinding>;
  const windowId = String(candidate.windowId ?? '').trim();
  const sourceRevision = String(candidate.sourceRevision ?? '').trim();
  const windowStartedAt = Number(candidate.windowStartedAt);
  if (!windowId || !sourceRevision || !Number.isFinite(windowStartedAt) || windowStartedAt <= 0) return null;
  return { windowId, sourceRevision, windowStartedAt };
};

export const isExperimentEventQualifiedForWindow = (
  event: ExperimentLedgerEvent,
  window: QualificationWindowCheckpoint | null | undefined,
): boolean => {
  if (!window || window.status !== 'COLLECTING' || !Number.isFinite(window.startedAt) || (window.startedAt ?? 0) <= 0) return false;
  if (event.type !== 'EXPERIMENT_STARTED' && event.type !== 'EXPERIMENT_COMPLETED') return false;
  if (!Number.isFinite(event.timestamp) || event.timestamp < (window.startedAt as number)) return false;

  const binding = readBinding(event);
  if (!binding) return false;
  if (binding.windowId !== window.id) return false;
  if (binding.sourceRevision !== window.sourceRevision) return false;
  if (binding.windowStartedAt !== window.startedAt) return false;

  const researchConfigurationId = String(event.payload.researchConfigurationId ?? '').trim().toLowerCase();
  return researchConfigurationIdPattern.test(researchConfigurationId);
};

export const filterQualifiedExperimentEvents = (
  events: ExperimentLedgerEvent[],
  window: QualificationWindowCheckpoint | null | undefined,
): ExperimentLedgerEvent[] => events.filter((event) => isExperimentEventQualifiedForWindow(event, window));
