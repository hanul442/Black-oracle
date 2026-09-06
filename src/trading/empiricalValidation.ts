export type EmpiricalDisposition = 'HEALTHY' | 'COLLECTING' | 'DEGRADED' | 'STALLED' | 'INSUFFICIENT_DATA';
export type EmpiricalGateStatus = 'PASS' | 'WAIT' | 'FAIL';

export interface EmpiricalCycleLike {
  startedAt: number;
  finishedAt: number;
  scanned: number;
  entered: number;
  exited: number;
  held: number;
  noTrade: number;
  errors: Array<unknown>;
  markets?: Array<{ evidenceIds?: string[] }>;
}

export interface EmpiricalValidationSampleLike { decisionTimestamp?: number; targetTimestamp?: number; }
export interface EmpiricalCouncilLike { generatedAt: number; resolvedAt: number | null; }
export interface EmpiricalStrategyObservationLike { generatedAt: number; resolvedAt: number | null; }
export interface EmpiricalExperimentEventLike { timestamp: number; type: string; }
export interface EmpiricalGradeSnapshotLike { timestamp: number; rating: { grade: string; rawScore: number; appliedGateKeys?: string[] } }
export interface EmpiricalClosedTradeLike { closedAt: number; returnPct: number; netPnl: number; }

export interface EmpiricalGate {
  key: string;
  status: EmpiricalGateStatus;
  value: number | null;
  target: number | null;
  reason: string;
}

export interface EmpiricalAccumulationInput {
  now?: number;
  intervalMs: number;
  cycleHistory: EmpiricalCycleLike[];
  validationSamples: EmpiricalValidationSampleLike[];
  councilComparisons: EmpiricalCouncilLike[];
  strategyObservations: EmpiricalStrategyObservationLike[];
  strategyAlignedObservations: number;
  minimumPboObservations?: number;
  experimentEvents: EmpiricalExperimentEventLike[];
  gradeHistory: EmpiricalGradeSnapshotLike[];
  closedTrades: EmpiricalClosedTradeLike[];
  timezoneOffsetMinutes?: number;
}

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const TARGET_COUNCIL_RESOLVED = 30;
const TARGET_CLOSED_TRADES = 60;
const TARGET_GRADE_SNAPSHOTS = 24;
const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const safeRatio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : 0;
const finiteTimestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const inWindow = (timestamp: number | null | undefined, start: number, end: number) => finiteTimestamp(timestamp) && timestamp >= start && timestamp <= end;
const localDayKey = (timestamp: number, offsetMinutes: number) => new Date(timestamp + offsetMinutes * 60_000).toISOString().slice(0, 10);

const observationRatePerHour = (timestamps: number[], now: number) => {
  const recent = timestamps.filter((timestamp) => inWindow(timestamp, now - DAY, now));
  if (!recent.length) return 0;
  const oldest = Math.min(...recent);
  const observedHours = Math.max(1, Math.min(24, (now - oldest) / HOUR));
  return recent.length / observedHours;
};

const buildEtaHours = (current: number, target: number, ratePerHour: number) => {
  if (current >= target) return 0;
  if (!Number.isFinite(ratePerHour) || ratePerHour <= 0) return null;
  return Math.max(0, (target - current) / ratePerHour);
};

export const buildEmpiricalAccumulationHealth = (input: EmpiricalAccumulationInput) => {
  const now = input.now ?? Date.now();
  const intervalMs = Math.max(5 * 60_000, input.intervalMs);
  const cycles = input.cycleHistory
    .filter((cycle) => finiteTimestamp(cycle.finishedAt))
    .slice()
    .sort((a, b) => a.finishedAt - b.finishedAt);
  const firstCycleAt = cycles[0]?.startedAt ?? null;
  const lastCycleAt = cycles.at(-1)?.finishedAt ?? null;
  const windowStart = now - DAY;
  const cycles24h = cycles.filter((cycle) => inWindow(cycle.finishedAt, windowStart, now));
  const observedWindowMs = firstCycleAt == null ? 0 : Math.max(0, Math.min(DAY, now - firstCycleAt));
  const expectedCycles = firstCycleAt == null ? 0 : Math.max(1, Math.floor(observedWindowMs / intervalMs));
  const cycleCoverage = expectedCycles > 0 ? Math.min(1, cycles24h.length / expectedCycles) : 0;
  const errorCycles = cycles24h.filter((cycle) => (cycle.errors?.length ?? 0) > 0).length;
  const cycleErrorRate = safeRatio(errorCycles, cycles24h.length);
  const latestCycleAgeMs = lastCycleAt == null ? null : Math.max(0, now - lastCycleAt);
  const strategyResolved = input.strategyObservations.filter((item) => finiteTimestamp(item.resolvedAt)).length;
  const strategyResolved24hTimestamps = input.strategyObservations
    .map((item) => item.resolvedAt)
    .filter((timestamp): timestamp is number => inWindow(timestamp, windowStart, now));
  const strategyRatePerHour = observationRatePerHour(strategyResolved24hTimestamps, now);
  const pboTarget = Math.max(1, input.minimumPboObservations ?? 60);
  const aligned = Math.max(0, Math.trunc(input.strategyAlignedObservations));
  const councilResolved = input.councilComparisons.filter((item) => finiteTimestamp(item.resolvedAt)).length;
  const gradeSnapshots = input.gradeHistory.filter((item) => finiteTimestamp(item.timestamp)).length;
  const experimentStarted = input.experimentEvents.filter((item) => item.type === 'EXPERIMENT_STARTED' || item.type === 'EXPERIMENT_COMPLETED').length;
  const operationalGates: EmpiricalGate[] = [
    {
      key: 'RUNTIME_RECENCY',
      status: latestCycleAgeMs == null ? 'FAIL' : latestCycleAgeMs <= intervalMs * 2.5 ? 'PASS' : 'FAIL',
      value: latestCycleAgeMs,
      target: intervalMs * 2.5,
      reason: latestCycleAgeMs == null ? 'No persisted PAPER cycle exists.' : latestCycleAgeMs <= intervalMs * 2.5 ? 'Latest PAPER cycle is recent.' : 'PAPER cycle accumulation appears stalled.',
    },
    {
      key: 'CYCLE_COVERAGE_24H',
      status: expectedCycles === 0 ? 'WAIT' : cycleCoverage >= 0.85 ? 'PASS' : cycleCoverage >= 0.7 ? 'WAIT' : 'FAIL',
      value: cycleCoverage,
      target: 0.85,
      reason: expectedCycles === 0 ? 'Insufficient runtime history for cadence assessment.' : `Observed ${cycles24h.length}/${expectedCycles} expected cycles in the available 24h window.`,
    },
    {
      key: 'CYCLE_ERROR_RATE_24H',
      status: cycles24h.length === 0 ? 'WAIT' : cycleErrorRate <= 0.03 ? 'PASS' : cycleErrorRate <= 0.10 ? 'WAIT' : 'FAIL',
      value: cycleErrorRate,
      target: 0.03,
      reason: cycles24h.length === 0 ? 'No cycles in the current 24h window.' : `${errorCycles}/${cycles24h.length} recent cycles contained one or more market errors.`,
    },
  ];
  const sampleGates: EmpiricalGate[] = [
    {
      key: 'PBO_ALIGNED_OBSERVATIONS', status: aligned >= pboTarget ? 'PASS' : 'WAIT', value: aligned, target: pboTarget,
      reason: aligned >= pboTarget ? 'Prospective Strategy Factory PBO sample gate is satisfied.' : `Collecting aligned prospective Strategy Factory observations (${aligned}/${pboTarget}).`,
    },
    {
      key: 'COUNCIL_RESOLVED_COMPARISONS', status: councilResolved >= TARGET_COUNCIL_RESOLVED ? 'PASS' : 'WAIT', value: councilResolved, target: TARGET_COUNCIL_RESOLVED,
      reason: councilResolved >= TARGET_COUNCIL_RESOLVED ? 'Council challenger comparison has a minimum review sample.' : `Council v1/v2 comparison is still accumulating (${councilResolved}/${TARGET_COUNCIL_RESOLVED}).`,
    },
    {
      key: 'CLOSED_TRADES', status: input.closedTrades.length >= TARGET_CLOSED_TRADES ? 'PASS' : 'WAIT', value: input.closedTrades.length, target: TARGET_CLOSED_TRADES,
      reason: input.closedTrades.length >= TARGET_CLOSED_TRADES ? 'Minimum closed-trade sample gate is satisfied.' : `Closed PAPER trades remain below the empirical qualification target (${input.closedTrades.length}/${TARGET_CLOSED_TRADES}).`,
    },
    {
      key: 'GRADE_HISTORY', status: gradeSnapshots >= TARGET_GRADE_SNAPSHOTS ? 'PASS' : 'WAIT', value: gradeSnapshots, target: TARGET_GRADE_SNAPSHOTS,
      reason: gradeSnapshots >= TARGET_GRADE_SNAPSHOTS ? 'Grade Surveillance history is established.' : `Grade Surveillance is still accumulating (${gradeSnapshots}/${TARGET_GRADE_SNAPSHOTS}).`,
    },
    {
      key: 'EXPERIMENT_LINEAGE', status: experimentStarted > 0 ? 'PASS' : 'WAIT', value: experimentStarted, target: 1,
      reason: experimentStarted > 0 ? 'At least one persisted experiment has actually started or completed.' : 'No started/completed Strategy-bound experiment exists yet.',
    },
  ];

  const operationalFailure = operationalGates.some((gate) => gate.status === 'FAIL');
  const operationalWaiting = operationalGates.some((gate) => gate.status === 'WAIT');
  const sampleWaiting = sampleGates.some((gate) => gate.status !== 'PASS');
  const disposition: EmpiricalDisposition = cycles.length === 0
    ? 'INSUFFICIENT_DATA'
    : operationalGates[0].status === 'FAIL'
      ? 'STALLED'
      : operationalFailure
        ? 'DEGRADED'
        : operationalWaiting || sampleWaiting
          ? 'COLLECTING'
          : 'HEALTHY';

  return {
    disposition,
    now,
    runtime: {
      firstCycleAt,
      lastCycleAt,
      latestCycleAgeMs,
      cycles24h: cycles24h.length,
      expectedCycles24hWindow: expectedCycles,
      cycleCoverage24h: cycleCoverage,
      errorCycles24h: errorCycles,
      cycleErrorRate24h: cycleErrorRate,
    },
    samples: {
      blindValidation: input.validationSamples.length,
      councilComparisons: input.councilComparisons.length,
      councilResolved,
      strategyObservations: input.strategyObservations.length,
      strategyResolved,
      strategyAligned: aligned,
      pboTarget,
      pboProgress: clamp01(aligned / pboTarget),
      strategyResolvedRatePerHour24h: strategyRatePerHour,
      pboEtaHours: buildEtaHours(aligned, pboTarget, strategyRatePerHour),
      closedTrades: input.closedTrades.length,
      gradeSnapshots,
      experimentTriedEvents: experimentStarted,
    },
    operationalGates,
    sampleGates,
    executionAuthority: false as const,
    promotionAuthority: false as const,
  };
};

export const buildDailyEmpiricalPaperReport = (input: EmpiricalAccumulationInput) => {
  const now = input.now ?? Date.now();
  const offset = input.timezoneOffsetMinutes ?? 540;
  const date = localDayKey(now, offset);
  const sameDay = (timestamp: number | null | undefined) => finiteTimestamp(timestamp) && localDayKey(timestamp, offset) === date;
  const cycles = input.cycleHistory.filter((cycle) => sameDay(cycle.finishedAt));
  const decisions = cycles.flatMap((cycle) => cycle.markets ?? []);
  const evidenceLinked = decisions.filter((item) => Array.isArray(item.evidenceIds) && item.evidenceIds.length > 0).length;
  const closedTrades = input.closedTrades.filter((trade) => sameDay(trade.closedAt));
  const gradeToday = input.gradeHistory.filter((item) => sameDay(item.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
  const experimentToday = input.experimentEvents.filter((item) => sameDay(item.timestamp));
  const netPnl = closedTrades.reduce((sum, trade) => sum + (Number.isFinite(trade.netPnl) ? trade.netPnl : 0), 0);
  const winners = closedTrades.filter((trade) => Number.isFinite(trade.netPnl) && trade.netPnl > 0).length;

  return {
    date,
    timezoneOffsetMinutes: offset,
    generatedAt: now,
    cycles: {
      count: cycles.length,
      scanned: cycles.reduce((sum, cycle) => sum + Math.max(0, cycle.scanned || 0), 0),
      entered: cycles.reduce((sum, cycle) => sum + Math.max(0, cycle.entered || 0), 0),
      exited: cycles.reduce((sum, cycle) => sum + Math.max(0, cycle.exited || 0), 0),
      held: cycles.reduce((sum, cycle) => sum + Math.max(0, cycle.held || 0), 0),
      noTrade: cycles.reduce((sum, cycle) => sum + Math.max(0, cycle.noTrade || 0), 0),
      marketErrors: cycles.reduce((sum, cycle) => sum + (cycle.errors?.length ?? 0), 0),
    },
    evidence: {
      decisions: decisions.length,
      linkedDecisions: evidenceLinked,
      linkRate: safeRatio(evidenceLinked, decisions.length),
    },
    outcomes: {
      closedTrades: closedTrades.length,
      winners,
      winRate: safeRatio(winners, closedTrades.length),
      netPnl,
    },
    research: {
      blindValidationSamplesCreated: input.validationSamples.filter((item) => sameDay(item.targetTimestamp ?? item.decisionTimestamp)).length,
      councilObservationsCreated: input.councilComparisons.filter((item) => sameDay(item.generatedAt)).length,
      councilResolved: input.councilComparisons.filter((item) => sameDay(item.resolvedAt)).length,
      strategyObservationsCreated: input.strategyObservations.filter((item) => sameDay(item.generatedAt)).length,
      strategyResolved: input.strategyObservations.filter((item) => sameDay(item.resolvedAt)).length,
      experimentsStarted: experimentToday.filter((item) => item.type === 'EXPERIMENT_STARTED').length,
      experimentsCompleted: experimentToday.filter((item) => item.type === 'EXPERIMENT_COMPLETED').length,
    },
    grade: {
      snapshots: gradeToday.length,
      opening: gradeToday[0]?.rating.grade ?? null,
      closing: gradeToday.at(-1)?.rating.grade ?? null,
      closingRawScore: gradeToday.at(-1)?.rating.rawScore ?? null,
      activeGates: gradeToday.at(-1)?.rating.appliedGateKeys?.slice() ?? [],
    },
    executionAuthority: false as const,
    promotionAuthority: false as const,
  };
};
