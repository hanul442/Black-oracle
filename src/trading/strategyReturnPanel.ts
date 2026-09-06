import { DEFAULT_RISK_LIMITS, TRADING_STRATEGY_VERSION } from './config.ts';
import type { EvidenceAggregate } from './evidence.ts';
import { generateStrategyCandidates } from './strategyFactory.ts';
import type { StrategyGenome } from './strategyGenome.ts';
import type { MarketPriceSnapshot } from './marketHistory.ts';
import type { LiquiditySnapshot, MultiTimeframeSnapshot, SignalAction } from './types.ts';

export interface StrategyShadowPrediction {
  candidateId: string;
  fingerprint: string;
  action: 'ENTER' | 'NO_TRADE';
  directionalScore: number;
  oracleTradeScore: number;
  confidence: number;
  reasons: string[];
  executionAuthority: false;
}

export interface StrategyShadowOutcome {
  candidateId: string;
  returnPct: number;
  favorable: boolean;
}

export interface StrategyReturnPanelObservation {
  id: string;
  cohortId: string;
  market: string;
  generatedAt: number;
  targetTimestamp: number;
  anchorPrice: number;
  predictions: StrategyShadowPrediction[];
  resolvedAt: number | null;
  targetPrice: number | null;
  rawReturn: number | null;
  outcomes: StrategyShadowOutcome[];
  noLookahead: true;
  executionAuthority: false;
  promotionAuthority: false;
}

export interface StrategyResearchCohort {
  id: string;
  evaluatorVersion: 'PROSPECTIVE_GENOME_PROXY_V1';
  parent: StrategyGenome;
  candidates: Array<{ id: string; fingerprint: string; genome: StrategyGenome }>;
  createdAt: number;
  executionAuthority: false;
  promotionAuthority: false;
}

export interface StrategyReturnPanelCheckpoint {
  schemaVersion: 1;
  cohort: StrategyResearchCohort;
  observations: StrategyReturnPanelObservation[];
}

export interface StrategyReturnPanelSummary {
  cohortId: string;
  candidateCount: number;
  observations: number;
  resolved: number;
  unresolved: number;
  alignedObservations: number;
  pboEligible: boolean;
  minimumPboObservations: number;
  evaluatorVersion: StrategyResearchCohort['evaluatorVersion'];
  executionAuthority: false;
  promotionAuthority: false;
}

const COHORT_CREATED_AT = Date.UTC(2026, 8, 6, 0, 0, 0);
const DEFAULT_CANDIDATE_COUNT = 8;
const DEFAULT_MAX_OBSERVATIONS = 5_000;
const DEFAULT_HORIZON_MS = 4 * 60 * 60_000;
const PBO_MIN_OBSERVATIONS = 60;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
const round = (value: number, digits = 8) => Number(value.toFixed(digits));
const signed = (action: SignalAction, score: number) => action === 'BUY' ? score : action === 'SELL' ? -score : 0;

const parentGenome = (): StrategyGenome => ({
  id: 'bo-research-parent-v1',
  generation: 0,
  createdAt: COHORT_CREATED_AT,
  parentGenomeIds: [],
  strategyVersion: TRADING_STRATEGY_VERSION,
  modelVersion: null,
  // Scope is enforced by the PAPER loop's eligible KRW universe; this genome records the asset family rather than an execution allow-list.
  markets: ['KRW-SPOT-UNIVERSE'],
  regimes: ['STRONG_UPTREND', 'UPTREND', 'RANGE', 'DOWNTREND', 'STRONG_DOWNTREND'],
  timeframesMinutes: [15, 60, 240],
  weights: { eventNews: 0.15, trendMomentum: 0.70, meanReversion: 0.15 },
  thresholds: { entryScore: 62, exitScore: 45, minConfidence: 0.62 },
  risk: {
    maxPositionPct: DEFAULT_RISK_LIMITS.maxPositionPct,
    maxDailyLossPct: DEFAULT_RISK_LIMITS.maxDailyLossPct,
    maxTotalDrawdownPct: DEFAULT_RISK_LIMITS.maxTotalDrawdownPct,
  },
  mutations: [],
  executionAuthority: false,
});

export const buildDefaultStrategyResearchCohort = (): StrategyResearchCohort => {
  const parent = parentGenome();
  const generated = generateStrategyCandidates(parent, { count: DEFAULT_CANDIDATE_COUNT, seed: 20260906, createdAt: COHORT_CREATED_AT });
  const controlFingerprint = `control:${TRADING_STRATEGY_VERSION}`;
  return {
    id: `prospective-cohort:${TRADING_STRATEGY_VERSION}:g${generated.generation}`,
    evaluatorVersion: 'PROSPECTIVE_GENOME_PROXY_V1',
    parent,
    candidates: [
      { id: 'candidate-control-v1', fingerprint: controlFingerprint, genome: parent },
      ...generated.candidates.map((candidate) => ({ id: candidate.id, fingerprint: candidate.fingerprint, genome: candidate.genome })),
    ],
    createdAt: COHORT_CREATED_AT,
    executionAuthority: false,
    promotionAuthority: false,
  };
};

export const createStrategyReturnPanelCheckpoint = (): StrategyReturnPanelCheckpoint => ({
  schemaVersion: 1,
  cohort: buildDefaultStrategyResearchCohort(),
  observations: [],
});

const cloneObservation = (item: StrategyReturnPanelObservation): StrategyReturnPanelObservation => ({
  ...item,
  predictions: item.predictions.map((prediction) => ({ ...prediction, reasons: prediction.reasons.slice(), executionAuthority: false })),
  outcomes: item.outcomes.map((outcome) => ({ ...outcome })),
  noLookahead: true,
  executionAuthority: false,
  promotionAuthority: false,
});

export const normalizeStrategyReturnPanel = (value: unknown): StrategyReturnPanelCheckpoint => {
  const fallback = createStrategyReturnPanelCheckpoint();
  const candidate = value as Partial<StrategyReturnPanelCheckpoint> | null;
  if (!candidate || candidate.schemaVersion !== 1 || !candidate.cohort || !Array.isArray(candidate.observations)) return fallback;
  const expectedIds = new Set(candidate.cohort.candidates?.map((item) => item.id) ?? []);
  if (expectedIds.size < 3) return fallback;
  const observations = candidate.observations.flatMap((item: any) => {
    if (!item || typeof item.id !== 'string' || typeof item.market !== 'string') return [];
    if (!Number.isFinite(item.generatedAt) || !Number.isFinite(item.targetTimestamp) || !Number.isFinite(item.anchorPrice) || item.anchorPrice <= 0) return [];
    if (!Array.isArray(item.predictions) || item.predictions.length !== expectedIds.size) return [];
    if (item.predictions.some((prediction: any) => !expectedIds.has(prediction?.candidateId))) return [];
    return [cloneObservation({
      ...item,
      market: String(item.market).toUpperCase(),
      resolvedAt: Number.isFinite(item.resolvedAt) ? Number(item.resolvedAt) : null,
      targetPrice: Number.isFinite(item.targetPrice) ? Number(item.targetPrice) : null,
      rawReturn: Number.isFinite(item.rawReturn) ? Number(item.rawReturn) : null,
      outcomes: Array.isArray(item.outcomes) ? item.outcomes.filter((outcome: any) => expectedIds.has(outcome?.candidateId) && Number.isFinite(outcome?.returnPct)).map((outcome: any) => ({ candidateId: String(outcome.candidateId), returnPct: Number(outcome.returnPct), favorable: Boolean(outcome.favorable) })) : [],
      noLookahead: true,
      executionAuthority: false,
      promotionAuthority: false,
    } as StrategyReturnPanelObservation)];
  }).sort((a, b) => a.generatedAt - b.generatedAt).slice(-DEFAULT_MAX_OBSERVATIONS);
  return {
    schemaVersion: 1,
    cohort: {
      ...candidate.cohort,
      candidates: candidate.cohort.candidates.map((item) => ({ ...item, genome: { ...item.genome, executionAuthority: false } })),
      executionAuthority: false,
      promotionAuthority: false,
    } as StrategyResearchCohort,
    observations,
  };
};

const evaluateGenome = (
  candidateId: string,
  fingerprint: string,
  genome: StrategyGenome,
  multiTimeframe: MultiTimeframeSnapshot,
  evidence: EvidenceAggregate,
  liquidity: LiquiditySnapshot,
): StrategyShadowPrediction => {
  const frame = multiTimeframe.frames.oneHour;
  const trendMomentum = clamp((frame.trend.directionalScore + frame.momentum.directionalScore) / 2, -100, 100);
  const meanReversion = clamp(signed(frame.meanReversion.action, frame.meanReversion.score), -100, 100);
  const event = evidence.activeCount > 0 ? clamp(evidence.score, -100, 100) : 0;
  const weights = genome.weights;
  const directionalScore = clamp(
    trendMomentum * weights.trendMomentum + meanReversion * weights.meanReversion + event * weights.eventNews,
    -100,
    100,
  );
  const oracleTradeScore = clamp((directionalScore + 100) / 2, 0, 100);
  const technicalConfidence = clamp((frame.trend.confidence + frame.momentum.confidence) / 2, 0, 1);
  const confidence = clamp(
    technicalConfidence * weights.trendMomentum
      + frame.meanReversion.confidence * weights.meanReversion
      + (evidence.activeCount > 0 ? evidence.confidence : 0) * weights.eventNews,
    0,
    1,
  );
  const reasons: string[] = [];
  if (evidence.activeCount === 0) reasons.push('Evidence gate blocks prospective entry for every research candidate.');
  if (!liquidity.eligible) reasons.push('Liquidity gate blocks prospective entry for every research candidate.');
  if (directionalScore < 25) reasons.push('Directional score is below the long-entry floor.');
  if (oracleTradeScore < genome.thresholds.entryScore) reasons.push(`Trade score ${oracleTradeScore.toFixed(1)} is below candidate threshold ${genome.thresholds.entryScore.toFixed(1)}.`);
  if (confidence < genome.thresholds.minConfidence) reasons.push(`Confidence ${confidence.toFixed(3)} is below candidate threshold ${genome.thresholds.minConfidence.toFixed(3)}.`);
  const action = evidence.activeCount > 0 && liquidity.eligible && directionalScore >= 25 && oracleTradeScore >= genome.thresholds.entryScore && confidence >= genome.thresholds.minConfidence
    ? 'ENTER' as const
    : 'NO_TRADE' as const;
  if (action === 'ENTER') reasons.push('Prospective research candidate clears score, confidence, Evidence and liquidity gates.');
  return {
    candidateId,
    fingerprint,
    action,
    directionalScore: round(directionalScore),
    oracleTradeScore: round(oracleTradeScore),
    confidence: round(confidence),
    reasons,
    executionAuthority: false,
  };
};

export const createStrategyReturnObservation = (
  checkpoint: StrategyReturnPanelCheckpoint,
  input: {
    market: string;
    generatedAt: number;
    anchorPrice: number;
    multiTimeframe: MultiTimeframeSnapshot;
    evidence: EvidenceAggregate;
    liquidity: LiquiditySnapshot;
    horizonMs?: number;
  },
): StrategyReturnPanelObservation | null => {
  const normalized = normalizeStrategyReturnPanel(checkpoint);
  if (!Number.isFinite(input.anchorPrice) || input.anchorPrice <= 0 || !Number.isFinite(input.generatedAt) || input.generatedAt <= 0) return null;
  const horizonMs = Math.max(15 * 60_000, input.horizonMs ?? DEFAULT_HORIZON_MS);
  const predictions = normalized.cohort.candidates.map((candidate) => evaluateGenome(candidate.id, candidate.fingerprint, candidate.genome, input.multiTimeframe, input.evidence, input.liquidity));
  return {
    id: `${normalized.cohort.id}:${input.market.toUpperCase()}:${input.generatedAt}`,
    cohortId: normalized.cohort.id,
    market: input.market.toUpperCase(),
    generatedAt: input.generatedAt,
    targetTimestamp: input.generatedAt + horizonMs,
    anchorPrice: input.anchorPrice,
    predictions,
    resolvedAt: null,
    targetPrice: null,
    rawReturn: null,
    outcomes: [],
    noLookahead: true,
    executionAuthority: false,
    promotionAuthority: false,
  };
};

export const appendStrategyReturnObservation = (
  checkpoint: StrategyReturnPanelCheckpoint,
  observation: StrategyReturnPanelObservation,
  maxObservations = DEFAULT_MAX_OBSERVATIONS,
): StrategyReturnPanelCheckpoint => {
  const normalized = normalizeStrategyReturnPanel(checkpoint);
  if (observation.cohortId !== normalized.cohort.id) return normalized;
  const observations = normalized.observations.filter((item) => item.id !== observation.id);
  observations.push(cloneObservation(observation));
  observations.sort((a, b) => a.generatedAt - b.generatedAt);
  return { ...normalized, observations: observations.slice(-Math.max(PBO_MIN_OBSERVATIONS, maxObservations)) };
};

const firstTarget = (history: MarketPriceSnapshot[], market: string, timestamp: number) => {
  for (const snapshot of history) {
    if (snapshot.timestamp < timestamp) continue;
    const row = snapshot.prices.find(([candidate]) => candidate === market);
    if (row && Number.isFinite(row[1]) && row[1] > 0) return { timestamp: snapshot.timestamp, price: row[1] };
  }
  return null;
};

export const resolveStrategyReturnPanel = (
  checkpoint: StrategyReturnPanelCheckpoint,
  history: MarketPriceSnapshot[],
): StrategyReturnPanelCheckpoint => {
  const normalized = normalizeStrategyReturnPanel(checkpoint);
  const orderedHistory = history.slice().sort((a, b) => a.timestamp - b.timestamp);
  const observations = normalized.observations.map((item) => {
    if (item.resolvedAt != null) return cloneObservation(item);
    const target = firstTarget(orderedHistory, item.market, item.targetTimestamp);
    if (!target) return cloneObservation(item);
    const rawReturn = target.price / item.anchorPrice - 1;
    const outcomes = item.predictions.map((prediction) => {
      const returnPct = prediction.action === 'ENTER' ? rawReturn : 0;
      return { candidateId: prediction.candidateId, returnPct: round(returnPct), favorable: returnPct > 0 };
    });
    return {
      ...cloneObservation(item),
      resolvedAt: target.timestamp,
      targetPrice: target.price,
      rawReturn: round(rawReturn),
      outcomes,
    };
  });
  return { ...normalized, observations };
};

export const buildAlignedStrategyReturnSeries = (checkpoint: StrategyReturnPanelCheckpoint) => {
  const normalized = normalizeStrategyReturnPanel(checkpoint);
  const candidateIds = normalized.cohort.candidates.map((item) => item.id);
  const rows = normalized.observations.filter((item) => item.resolvedAt != null && item.outcomes.length === candidateIds.length && candidateIds.every((id) => item.outcomes.some((outcome) => outcome.candidateId === id)));
  return normalized.cohort.candidates.map((candidate) => ({
    id: candidate.id,
    fingerprint: candidate.fingerprint,
    returns: rows.map((row) => row.outcomes.find((outcome) => outcome.candidateId === candidate.id)!.returnPct),
  }));
};

export const summarizeStrategyReturnPanel = (checkpoint: StrategyReturnPanelCheckpoint): StrategyReturnPanelSummary => {
  const normalized = normalizeStrategyReturnPanel(checkpoint);
  const series = buildAlignedStrategyReturnSeries(normalized);
  const alignedObservations = series.length ? Math.min(...series.map((item) => item.returns.length)) : 0;
  const resolved = normalized.observations.filter((item) => item.resolvedAt != null).length;
  return {
    cohortId: normalized.cohort.id,
    candidateCount: normalized.cohort.candidates.length,
    observations: normalized.observations.length,
    resolved,
    unresolved: normalized.observations.length - resolved,
    alignedObservations,
    pboEligible: normalized.cohort.candidates.length >= 3 && alignedObservations >= PBO_MIN_OBSERVATIONS,
    minimumPboObservations: PBO_MIN_OBSERVATIONS,
    evaluatorVersion: normalized.cohort.evaluatorVersion,
    executionAuthority: false,
    promotionAuthority: false,
  };
};
