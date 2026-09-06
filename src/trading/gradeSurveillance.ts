import { ORACLE_GRADE_ORDER, type OracleGrade, type OracleRatingResult } from './rating.ts';

export interface OracleRatingSnapshot {
  timestamp: number;
  scope: 'PAPER_READINESS';
  rating: OracleRatingResult;
  sourceCheckpointSavedAt: number | null;
  executionAuthority: false;
}

export interface GradeSurveillanceCheckpoint {
  schemaVersion: 1;
  history: OracleRatingSnapshot[];
}

export interface GradeSurveillanceSummary {
  current: OracleRatingSnapshot | null;
  previous: OracleRatingSnapshot | null;
  trend: 'UP' | 'STABLE' | 'DOWN' | 'NEW';
  gradeStepChange: number;
  consecutiveDowngrades: number;
  downgradeEvents: number;
  lastChangedAt: number | null;
  executionAuthority: false;
}

const DEFAULT_MAX_HISTORY = 2016;
const DEFAULT_MIN_INTERVAL_MS = 15 * 60_000;
const gradeIndex = (grade: OracleGrade) => ORACLE_GRADE_ORDER.indexOf(grade);
const cloneRating = (rating: OracleRatingResult): OracleRatingResult => ({
  ...rating,
  appliedGateKeys: rating.appliedGateKeys.slice(),
  missingRequiredDimensions: rating.missingRequiredDimensions.slice(),
  reasons: rating.reasons.slice(),
});

const cloneSnapshot = (snapshot: OracleRatingSnapshot): OracleRatingSnapshot => ({
  ...snapshot,
  rating: cloneRating(snapshot.rating),
  executionAuthority: false,
});

const validSnapshot = (value: unknown): value is OracleRatingSnapshot => {
  const item = value as OracleRatingSnapshot;
  return Boolean(
    item
    && Number.isFinite(item.timestamp)
    && item.scope === 'PAPER_READINESS'
    && item.rating
    && ORACLE_GRADE_ORDER.includes(item.rating.grade)
    && Number.isFinite(item.rating.rawScore),
  );
};

const sameGateSet = (left: string[], right: string[]) => (
  left.slice().sort().join('|') === right.slice().sort().join('|')
);

export const normalizeGradeSurveillance = (value: unknown, maxHistory = DEFAULT_MAX_HISTORY): GradeSurveillanceCheckpoint => {
  const candidate = value as Partial<GradeSurveillanceCheckpoint> | null;
  const history = Array.isArray(candidate?.history)
    ? candidate!.history.filter(validSnapshot).map(cloneSnapshot).sort((a, b) => a.timestamp - b.timestamp).slice(-maxHistory)
    : [];
  return { schemaVersion: 1, history };
};

export const appendGradeSnapshot = (
  checkpoint: GradeSurveillanceCheckpoint | null | undefined,
  snapshot: OracleRatingSnapshot,
  maxHistory = DEFAULT_MAX_HISTORY,
  minimumIntervalMs = DEFAULT_MIN_INTERVAL_MS,
): GradeSurveillanceCheckpoint => {
  if (!validSnapshot(snapshot)) throw new Error('Invalid Oracle rating snapshot.');
  const normalized = normalizeGradeSurveillance(checkpoint, maxHistory);
  const history = normalized.history.filter((item) => item.timestamp !== snapshot.timestamp);
  const last = history.length ? history[history.length - 1] : null;
  const significant = !last
    || last.rating.grade !== snapshot.rating.grade
    || Math.abs(last.rating.rawScore - snapshot.rating.rawScore) >= 5
    || !sameGateSet(last.rating.appliedGateKeys, snapshot.rating.appliedGateKeys)
    || snapshot.timestamp - last.timestamp >= minimumIntervalMs;
  if (!significant) return { schemaVersion: 1, history };
  history.push(cloneSnapshot(snapshot));
  history.sort((a, b) => a.timestamp - b.timestamp);
  return { schemaVersion: 1, history: history.slice(-maxHistory) };
};

export const summarizeGradeSurveillance = (checkpoint: GradeSurveillanceCheckpoint | null | undefined): GradeSurveillanceSummary => {
  const history = normalizeGradeSurveillance(checkpoint).history;
  const current = history.length ? history[history.length - 1] : null;
  const previous = history.length > 1 ? history[history.length - 2] : null;
  const gradeStepChange = current && previous ? gradeIndex(current.rating.grade) - gradeIndex(previous.rating.grade) : 0;
  const trend = !current || !previous ? 'NEW' : gradeStepChange > 0 ? 'DOWN' : gradeStepChange < 0 ? 'UP' : 'STABLE';

  let consecutiveDowngrades = 0;
  for (let index = history.length - 1; index > 0; index -= 1) {
    const newer = gradeIndex(history[index].rating.grade);
    const older = gradeIndex(history[index - 1].rating.grade);
    if (newer > older) consecutiveDowngrades += 1;
    else break;
  }

  let downgradeEvents = 0;
  let lastChangedAt: number | null = null;
  for (let index = 1; index < history.length; index += 1) {
    const older = gradeIndex(history[index - 1].rating.grade);
    const newer = gradeIndex(history[index].rating.grade);
    if (newer > older) downgradeEvents += 1;
    if (newer !== older) lastChangedAt = history[index].timestamp;
  }

  return {
    current: current ? cloneSnapshot(current) : null,
    previous: previous ? cloneSnapshot(previous) : null,
    trend,
    gradeStepChange,
    consecutiveDowngrades,
    downgradeEvents,
    lastChangedAt,
    executionAuthority: false,
  };
};
