import type { TradingEvidence } from './evidence';

export type QualificationWindowStatus = 'ARMED' | 'COLLECTING' | 'INVALIDATED';

export interface QualificationWindowConfig {
  id: string;
  armedAt: number;
  sourceRevision: string;
}

export interface QualificationCycleLike {
  startedAt: number;
  finishedAt: number;
  scanned: number;
  errors: Array<unknown>;
  markets: Array<{ evidenceIds?: string[] }>;
}

export interface QualificationWindowCheckpoint {
  schemaVersion: 1;
  id: string;
  armedAt: number;
  startedAt: number | null;
  sourceRevision: string;
  startCycleStartedAt: number | null;
  startCycleFinishedAt: number | null;
  startEvidenceIds: string[];
  status: QualificationWindowStatus;
  invalidationReasons: string[];
  executionAuthority: false;
  promotionAuthority: false;
}

const validTimestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const clean = (value: unknown) => String(value ?? '').trim();
const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();

export const normalizeQualificationWindowConfig = (input: Partial<QualificationWindowConfig> | null | undefined): QualificationWindowConfig | null => {
  if (!input) return null;
  const id = clean(input.id);
  const sourceRevision = clean(input.sourceRevision);
  const armedAt = Number(input.armedAt);
  if (!id && !sourceRevision && !validTimestamp(armedAt)) return null;
  if (!id || !sourceRevision || !validTimestamp(armedAt)) {
    throw new Error('Qualification window config requires id, armedAt and sourceRevision together.');
  }
  return Object.freeze({ id, armedAt, sourceRevision });
};

export const qualificationWindowConfigFromEnv = (env: NodeJS.ProcessEnv = process.env): QualificationWindowConfig | null => {
  const id = clean(env.PAPER_QUALIFICATION_WINDOW_ID);
  const sourceRevision = clean(env.PAPER_QUALIFICATION_SOURCE_REVISION);
  const armedAtRaw = clean(env.PAPER_QUALIFICATION_ARMED_AT);
  if (!id && !sourceRevision && !armedAtRaw) return null;
  const parsed = armedAtRaw ? Date.parse(armedAtRaw) : Number.NaN;
  return normalizeQualificationWindowConfig({ id, sourceRevision, armedAt: parsed });
};

export const normalizeQualificationWindow = (input: unknown): QualificationWindowCheckpoint | null => {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<QualificationWindowCheckpoint>;
  if (candidate.schemaVersion !== 1) throw new Error('Unsupported qualification window schema.');
  const id = clean(candidate.id);
  const sourceRevision = clean(candidate.sourceRevision);
  if (!id || !sourceRevision || !validTimestamp(candidate.armedAt)) throw new Error('Qualification window checkpoint is incomplete.');
  const startedAt = validTimestamp(candidate.startedAt) ? candidate.startedAt : null;
  const startCycleStartedAt = validTimestamp(candidate.startCycleStartedAt) ? candidate.startCycleStartedAt : null;
  const startCycleFinishedAt = validTimestamp(candidate.startCycleFinishedAt) ? candidate.startCycleFinishedAt : null;
  const status: QualificationWindowStatus = candidate.status === 'COLLECTING' || candidate.status === 'INVALIDATED' ? candidate.status : 'ARMED';
  return {
    schemaVersion: 1,
    id,
    armedAt: candidate.armedAt,
    startedAt,
    sourceRevision,
    startCycleStartedAt,
    startCycleFinishedAt,
    startEvidenceIds: unique(Array.isArray(candidate.startEvidenceIds) ? candidate.startEvidenceIds.map(String) : []),
    status,
    invalidationReasons: unique(Array.isArray(candidate.invalidationReasons) ? candidate.invalidationReasons.map(String) : []),
    executionAuthority: false,
    promotionAuthority: false,
  };
};

export const createQualificationWindow = (config: QualificationWindowConfig): QualificationWindowCheckpoint => ({
  schemaVersion: 1,
  id: config.id,
  armedAt: config.armedAt,
  startedAt: null,
  sourceRevision: config.sourceRevision,
  startCycleStartedAt: null,
  startCycleFinishedAt: null,
  startEvidenceIds: [],
  status: 'ARMED',
  invalidationReasons: [],
  executionAuthority: false,
  promotionAuthority: false,
});

const sourceBacked = (evidence: TradingEvidence, armedAt: number, cycleFinishedAt: number) =>
  evidence.sourceType !== 'SYSTEM'
  && Boolean(evidence.sourceUrl?.trim())
  && evidence.observedAt >= armedAt
  && evidence.observedAt <= cycleFinishedAt;

export const advanceQualificationWindow = (input: {
  existing?: QualificationWindowCheckpoint | null;
  config?: QualificationWindowConfig | null;
  latestCycle?: QualificationCycleLike | null;
  evidence?: TradingEvidence[];
}): QualificationWindowCheckpoint | null => {
  const config = input.config ?? null;
  const existing = normalizeQualificationWindow(input.existing);
  if (!config) return existing;

  const current = existing ?? createQualificationWindow(config);
  if (current.id !== config.id || current.sourceRevision !== config.sourceRevision || current.armedAt !== config.armedAt) {
    return {
      ...current,
      status: 'INVALIDATED',
      invalidationReasons: unique([
        ...current.invalidationReasons,
        `Persisted qualification window ${current.id}@${current.sourceRevision} does not match configured ${config.id}@${config.sourceRevision}; qualification credit is frozen until a deliberate new window is created.`,
      ]),
      executionAuthority: false,
      promotionAuthority: false,
    };
  }
  if (current.status === 'INVALIDATED' || current.startedAt !== null) return { ...current, startEvidenceIds: current.startEvidenceIds.slice(), invalidationReasons: current.invalidationReasons.slice() };

  const cycle = input.latestCycle ?? null;
  if (!cycle || !validTimestamp(cycle.startedAt) || !validTimestamp(cycle.finishedAt)) return current;
  if (cycle.startedAt < current.armedAt || cycle.finishedAt < current.armedAt || cycle.scanned <= 0 || (cycle.errors?.length ?? 0) > 0) return current;

  const referenced = new Set(cycle.markets.flatMap((market) => Array.isArray(market.evidenceIds) ? market.evidenceIds : []));
  const qualifyingEvidence = (input.evidence ?? []).filter((item) => referenced.has(item.id) && sourceBacked(item, current.armedAt, cycle.finishedAt));
  if (!qualifyingEvidence.length) return current;

  return {
    ...current,
    startedAt: cycle.startedAt,
    startCycleStartedAt: cycle.startedAt,
    startCycleFinishedAt: cycle.finishedAt,
    startEvidenceIds: unique(qualifyingEvidence.map((item) => item.id)),
    status: 'COLLECTING',
    invalidationReasons: [],
    executionAuthority: false,
    promotionAuthority: false,
  };
};

export const qualificationWindowSummary = (window: QualificationWindowCheckpoint | null | undefined) => {
  const normalized = normalizeQualificationWindow(window);
  return normalized ? {
    id: normalized.id,
    status: normalized.status,
    armedAt: normalized.armedAt,
    startedAt: normalized.startedAt,
    sourceRevision: normalized.sourceRevision,
    startEvidenceIds: normalized.startEvidenceIds.slice(),
    invalidationReasons: normalized.invalidationReasons.slice(),
    executionAuthority: false as const,
    promotionAuthority: false as const,
  } : {
    id: null,
    status: 'NOT_CONFIGURED' as const,
    armedAt: null,
    startedAt: null,
    sourceRevision: null,
    startEvidenceIds: [] as string[],
    invalidationReasons: [] as string[],
    executionAuthority: false as const,
    promotionAuthority: false as const,
  };
};
