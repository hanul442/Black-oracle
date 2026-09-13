import { HORIZON_ORDER, type TradingHorizon } from './horizonPolicy';

export type InvestmentCycleStageId =
  | 'EVIDENCE'
  | 'MARKET_STATE'
  | 'SECTOR_STATE'
  | 'UNIVERSE_GATE'
  | 'NOMINATION'
  | 'CROSS_REVIEW'
  | 'RED_TEAM'
  | 'HEAD_COUNCIL'
  | 'HORIZON_PLAN'
  | 'RISK'
  | 'EXECUTION'
  | 'OUTCOME';

export type InvestmentCycleStageStatus = 'LIVE' | 'STALE' | 'WAITING';

export interface CanonicalCycleEventLike {
  eventType: string;
  eventName: string;
  occurredAt: number;
  recordedAt?: number;
  runtimeId?: string | null;
  market?: string | null;
  action?: string | null;
  summary?: string | null;
  reason?: string | null;
  severity?: string | null;
  trace?: Record<string, unknown> | null;
  links?: Record<string, unknown> | null;
}

export interface InvestmentCycleStageProjection {
  id: InvestmentCycleStageId;
  label: string;
  status: InvestmentCycleStageStatus;
  count: number;
  latestAt: number | null;
  markets: number;
  runtimeIds: string[];
}

export interface InvestmentCycleReadModel {
  asOf: number;
  latestEventAt: number | null;
  stages: InvestmentCycleStageProjection[];
  funnel: {
    universeObserved: number;
    nominated: number;
    crossReviewed: number;
    survived: number;
    executablePlan: number;
    trades: number;
    outcomes: number;
  };
  horizons: Array<{ horizon: TradingHorizon; count: number; latestAt: number | null }>;
  runtimeBreakdown: Record<string, number>;
  blockers: string[];
  latestActivity: CanonicalCycleEventLike[];
}

const STAGES: Array<{ id: InvestmentCycleStageId; label: string }> = [
  { id: 'EVIDENCE', label: 'News & Evidence' },
  { id: 'MARKET_STATE', label: 'Market State' },
  { id: 'SECTOR_STATE', label: 'Sector Strength' },
  { id: 'UNIVERSE_GATE', label: 'Equity Universe' },
  { id: 'NOMINATION', label: 'Committee Nominations' },
  { id: 'CROSS_REVIEW', label: 'Cross Review & Debate' },
  { id: 'RED_TEAM', label: 'Red Team' },
  { id: 'HEAD_COUNCIL', label: 'Head Council' },
  { id: 'HORIZON_PLAN', label: 'Horizon Trade Plan' },
  { id: 'RISK', label: 'Risk Check' },
  { id: 'EXECUTION', label: 'Paper Execution' },
  { id: 'OUTCOME', label: 'Outcome & Learning' },
];

const normalized = (value: unknown) => String(value ?? '').trim().toUpperCase();
const finiteTime = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};
const unique = <T>(values: T[]) => Array.from(new Set(values));
const horizonSet = new Set<string>(HORIZON_ORDER);

export const stageForCanonicalCycleEvent = (event: CanonicalCycleEventLike): InvestmentCycleStageId | null => {
  const type = normalized(event.eventType);
  const name = normalized(event.eventName);

  if (name.includes('MARKET_STATE')) return 'MARKET_STATE';
  if (name.includes('SECTOR_STATE') || name.includes('SECTOR_STRENGTH')) return 'SECTOR_STATE';
  if (name.includes('UNIVERSE_') || name === 'EQUITY_RESEARCH_DECISION') return 'UNIVERSE_GATE';
  if (name.includes('NOMINATION')) return 'NOMINATION';
  if (name.includes('CROSS_REVIEW') || name.includes('INVESTMENT_COMMITTEE_DEBATE')) return 'CROSS_REVIEW';
  if (name.includes('RED_TEAM')) return 'RED_TEAM';
  if (name.includes('HEAD_COUNCIL')) return 'HEAD_COUNCIL';
  if (name.includes('HORIZON_PLAN') || name.includes('HORIZON_TRADE_PLAN')) return 'HORIZON_PLAN';

  // Legacy deterministic Council is intentionally excluded from the V10 Investment Committee stages.
  if (type === 'RISK') return 'RISK';
  if (type === 'ORDER' || type === 'TRADE') return 'EXECUTION';
  if (type === 'OUTCOME') return 'OUTCOME';
  if (type === 'EVIDENCE' || name.startsWith('NARS_') || name.includes('EVIDENCE')) return 'EVIDENCE';
  return null;
};

const horizonOf = (event: CanonicalCycleEventLike): TradingHorizon | null => {
  const value = normalized(event.trace?.horizon);
  return horizonSet.has(value) ? value as TradingHorizon : null;
};

const candidateKey = (event: CanonicalCycleEventLike) => {
  const horizon = horizonOf(event) ?? 'UNSCOPED';
  return `${normalized(event.market) || 'UNKNOWN'}::${horizon}`;
};

const latest = (events: CanonicalCycleEventLike[]) => events.reduce<number | null>((max, event) => {
  const time = finiteTime(event.occurredAt);
  if (time == null) return max;
  return max == null ? time : Math.max(max, time);
}, null);

const eventContainsDataGap = (event: CanonicalCycleEventLike) => {
  const reason = normalized(event.reason);
  const summary = normalized(event.summary);
  const dataGaps = Array.isArray(event.trace?.dataGaps) ? event.trace?.dataGaps : [];
  return reason.includes('DATA_GAP') || summary.includes('DATA_GAP') || dataGaps.length > 0;
};

export const projectInvestmentCycleEvents = (
  input: CanonicalCycleEventLike[],
  options: { now?: number; liveWindowMs?: number; activityLimit?: number } = {},
): InvestmentCycleReadModel => {
  const now = finiteTime(options.now) ?? Date.now();
  const liveWindowMs = Math.max(60_000, Number(options.liveWindowMs ?? 6 * 60 * 60_000));
  const events = input
    .filter((event) => finiteTime(event.occurredAt) != null)
    .slice()
    .sort((a, b) => Number(b.occurredAt) - Number(a.occurredAt));

  const stageEvents = new Map<InvestmentCycleStageId, CanonicalCycleEventLike[]>();
  for (const stage of STAGES) stageEvents.set(stage.id, []);
  for (const event of events) {
    const stage = stageForCanonicalCycleEvent(event);
    if (stage) stageEvents.get(stage)?.push(event);
  }

  const stages = STAGES.map(({ id, label }): InvestmentCycleStageProjection => {
    const matched = stageEvents.get(id) ?? [];
    const latestAt = latest(matched);
    const status: InvestmentCycleStageStatus = latestAt == null
      ? 'WAITING'
      : now - latestAt <= liveWindowMs
        ? 'LIVE'
        : 'STALE';
    return {
      id,
      label,
      status,
      count: matched.length,
      latestAt,
      markets: unique(matched.map((event) => normalized(event.market)).filter(Boolean)).length,
      runtimeIds: unique(matched.map((event) => String(event.runtimeId ?? '').trim()).filter(Boolean)).sort(),
    };
  });

  const eventsFor = (stage: InvestmentCycleStageId) => stageEvents.get(stage) ?? [];
  const universeObserved = unique(eventsFor('UNIVERSE_GATE').map(candidateKey)).length;
  const nominated = unique(eventsFor('NOMINATION').map(candidateKey)).length;
  const crossReviewed = unique(eventsFor('CROSS_REVIEW').map(candidateKey)).length;
  const survived = unique(eventsFor('HEAD_COUNCIL')
    .filter((event) => normalized(event.action).includes('SURVIV') || event.trace?.survived === true)
    .map(candidateKey)).length;
  const executablePlan = unique(eventsFor('HORIZON_PLAN')
    .filter((event) => normalized(event.action).includes('EXECUT') || event.trace?.executableCandidate === true)
    .map(candidateKey)).length;

  const horizons = HORIZON_ORDER.map((horizon) => {
    const matched = events.filter((event) => horizonOf(event) === horizon);
    return { horizon, count: matched.length, latestAt: latest(matched) };
  });

  const runtimeBreakdown = events.reduce<Record<string, number>>((acc, event) => {
    const key = String(event.runtimeId ?? 'UNSCOPED');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const requiredV10Stages: Array<[InvestmentCycleStageId, string]> = [
    ['MARKET_STATE', 'Market State producer has not emitted a canonical V10 event yet.'],
    ['SECTOR_STATE', 'Sector Strength producer has not emitted a canonical V10 event yet.'],
    ['NOMINATION', 'Investment Committee nomination producer is not live yet.'],
    ['CROSS_REVIEW', 'Investment Committee cross-review/debate producer is not live yet.'],
    ['RED_TEAM', 'V10 Red Team producer is not live yet.'],
    ['HEAD_COUNCIL', 'Head Council ranking/cut producer is not live yet.'],
    ['HORIZON_PLAN', 'Horizon Trade Plan producer is not live yet.'],
  ];
  const blockers = requiredV10Stages
    .filter(([id]) => (stageEvents.get(id) ?? []).length === 0)
    .map(([, message]) => message);
  const dataGapReasons = events
    .filter(eventContainsDataGap)
    .map((event) => String(event.reason || event.summary || 'Canonical event reports DATA_GAP.').trim())
    .filter(Boolean)
    .slice(0, 6);
  blockers.push(...dataGapReasons);

  return {
    asOf: now,
    latestEventAt: latest(events),
    stages,
    funnel: {
      universeObserved,
      nominated,
      crossReviewed,
      survived,
      executablePlan,
      trades: eventsFor('EXECUTION').length,
      outcomes: eventsFor('OUTCOME').length,
    },
    horizons,
    runtimeBreakdown,
    blockers: unique(blockers),
    latestActivity: events.slice(0, Math.max(1, Math.min(30, Number(options.activityLimit ?? 8)))),
  };
};
