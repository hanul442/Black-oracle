import type { HistoricalValidationVerdict } from './blindValidation';
import { fingerprintStrategyGenome, normalizeStrategyGenome, type StrategyGenome, type StrategyGenomeMutation } from './strategyGenome';

export type StrategyFactoryState = 'GENERATED' | 'REJECTED' | 'INCUBATING' | 'CHALLENGER';

export interface StrategyFactoryValidationEvidence {
  blindVerdict: HistoricalValidationVerdict;
  walkForwardVerdict: HistoricalValidationVerdict;
  monteCarloVerdict: 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';
  closedTrades: number;
  observationDays: number;
  expectancyR: number;
  payoffRatio: number;
  maxDrawdownPct: number;
  favorableRate: number;
  evidenceCoverage: number;
  auditCoverage: number;
  regimeRobustnessPass: boolean;
  costStressPass: boolean;
}

export interface StrategyFactoryCandidate {
  id: string;
  genome: StrategyGenome;
  fingerprint: string;
  state: StrategyFactoryState;
  validation: StrategyFactoryValidationEvidence | null;
  tournamentScore: number | null;
  rejectionReasons: string[];
  executionAuthority: false;
}

export interface StrategyFactoryGeneration {
  id: string;
  generation: number;
  parentGenomeId: string;
  candidates: StrategyFactoryCandidate[];
  executionAuthority: false;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 6) => Number(value.toFixed(digits));

const seeded = (seed: number) => {
  let state = (seed >>> 0) || 1;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
};

const hash = (text: string) => {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) { value ^= text.charCodeAt(index); value = Math.imul(value, 0x01000193); }
  return (value >>> 0).toString(36);
};

const mutation = (type: StrategyGenomeMutation['type'], field: string, from: number, to: number): StrategyGenomeMutation => ({ type, field, from, to });

export const generateStrategyCandidates = (
  parent: StrategyGenome,
  options: { count?: number; seed?: number; createdAt?: number } = {},
): StrategyFactoryGeneration => {
  const normalized = normalizeStrategyGenome(parent);
  const count = Math.max(2, Math.min(24, Math.trunc(options.count ?? 8)));
  const seed = Math.trunc(options.seed ?? 20260905);
  const random = seeded(seed);
  const createdAt = options.createdAt ?? Date.now();
  const nextGeneration = normalized.generation + 1;
  const candidates: StrategyFactoryCandidate[] = [];
  const seen = new Set<string>();

  for (let index = 0; candidates.length < count && index < count * 6; index += 1) {
    const weightShift = (random() - 0.5) * 0.18;
    const momentumShift = (random() - 0.5) * 0.16;
    const entryShift = Math.round((random() - 0.5) * 12);
    const confidenceShift = (random() - 0.5) * 0.08;
    const riskMultiplier = 0.7 + random() * 0.3;
    const rawWeights = {
      eventNews: Math.max(0.01, normalized.weights.eventNews + weightShift),
      trendMomentum: Math.max(0.01, normalized.weights.trendMomentum + momentumShift),
      meanReversion: Math.max(0.01, normalized.weights.meanReversion - weightShift - momentumShift),
    };
    const mutations: StrategyGenomeMutation[] = [
      mutation('WEIGHT', 'eventNews', normalized.weights.eventNews, rawWeights.eventNews),
      mutation('WEIGHT', 'trendMomentum', normalized.weights.trendMomentum, rawWeights.trendMomentum),
      mutation('THRESHOLD', 'entryScore', normalized.thresholds.entryScore, clamp(normalized.thresholds.entryScore + entryShift, 50, 90)),
      mutation('THRESHOLD', 'minConfidence', normalized.thresholds.minConfidence, clamp(normalized.thresholds.minConfidence + confidenceShift, 0.55, 0.85)),
      mutation('RISK', 'maxPositionPct', normalized.risk.maxPositionPct, normalized.risk.maxPositionPct * riskMultiplier),
    ];
    const genome = normalizeStrategyGenome({
      ...normalized,
      id: `genome-g${nextGeneration}-${index + 1}-${hash(`${normalized.id}|${seed}|${index}`)}`,
      generation: nextGeneration,
      createdAt,
      parentGenomeIds: [normalized.id],
      weights: rawWeights,
      thresholds: {
        ...normalized.thresholds,
        entryScore: clamp(normalized.thresholds.entryScore + entryShift, 50, 90),
        minConfidence: round(clamp(normalized.thresholds.minConfidence + confidenceShift, 0.55, 0.85)),
      },
      risk: {
        maxPositionPct: round(normalized.risk.maxPositionPct * riskMultiplier),
        maxDailyLossPct: normalized.risk.maxDailyLossPct,
        maxTotalDrawdownPct: normalized.risk.maxTotalDrawdownPct,
      },
      mutations,
      executionAuthority: false,
    });
    const fingerprint = fingerprintStrategyGenome(genome);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    candidates.push({ id: `candidate-${fingerprint}`, genome, fingerprint, state: 'GENERATED', validation: null, tournamentScore: null, rejectionReasons: [], executionAuthority: false });
  }

  return {
    id: `factory-${hash(`${normalized.id}|${nextGeneration}|${seed}|${createdAt}`)}`,
    generation: nextGeneration,
    parentGenomeId: normalized.id,
    candidates,
    executionAuthority: false,
  };
};

const rejectionReasons = (candidate: StrategyFactoryCandidate, validation: StrategyFactoryValidationEvidence) => {
  const reasons: string[] = [];
  if (validation.blindVerdict !== 'PASS') reasons.push(`Blind validation is ${validation.blindVerdict}.`);
  if (validation.walkForwardVerdict !== 'PASS') reasons.push(`Walk-forward validation is ${validation.walkForwardVerdict}.`);
  if (validation.monteCarloVerdict === 'REJECT' || validation.monteCarloVerdict === 'INSUFFICIENT_DATA') reasons.push(`Monte Carlo is ${validation.monteCarloVerdict}.`);
  if (validation.closedTrades < 60) reasons.push('Fewer than 60 closed trades.');
  if (validation.observationDays < 14) reasons.push('Fewer than 14 observation days.');
  if (validation.maxDrawdownPct > candidate.genome.risk.maxTotalDrawdownPct) reasons.push('Observed max drawdown exceeds Genome risk limit.');
  if (validation.expectancyR <= 0) reasons.push('Expectancy is not positive.');
  if (validation.payoffRatio <= 1) reasons.push('Payoff ratio is not asymmetric in favor of winners.');
  if (validation.evidenceCoverage < 0.95) reasons.push('Evidence coverage is below 95%.');
  if (validation.auditCoverage < 0.90) reasons.push('Audit coverage is below 90%.');
  if (!validation.regimeRobustnessPass) reasons.push('Regime robustness failed.');
  if (!validation.costStressPass) reasons.push('Cost stress failed.');
  return reasons;
};

const score = (validation: StrategyFactoryValidationEvidence) => round(clamp(
  50
    + clamp(validation.expectancyR, -1, 2) * 14
    + clamp(validation.payoffRatio - 1, -1, 3) * 8
    + (validation.favorableRate - 0.5) * 35
    - clamp(validation.maxDrawdownPct / 0.05, 0, 3) * 12
    + validation.evidenceCoverage * 5
    + validation.auditCoverage * 5,
  0,
  100,
));

export const attachFactoryValidation = (
  candidate: StrategyFactoryCandidate,
  validation: StrategyFactoryValidationEvidence,
): StrategyFactoryCandidate => {
  const reasons = rejectionReasons(candidate, validation);
  return {
    ...candidate,
    validation: { ...validation },
    state: reasons.length ? 'REJECTED' : 'INCUBATING',
    tournamentScore: reasons.length ? null : score(validation),
    rejectionReasons: reasons,
    executionAuthority: false,
  };
};

export const runStrategyTournament = (
  candidates: StrategyFactoryCandidate[],
  maxChallengers = 3,
): StrategyFactoryCandidate[] => {
  const eligible = candidates
    .filter((candidate) => candidate.state === 'INCUBATING' && candidate.validation && candidate.tournamentScore != null)
    .sort((a, b) => (b.tournamentScore ?? 0) - (a.tournamentScore ?? 0) || a.fingerprint.localeCompare(b.fingerprint));
  const challengerIds = new Set(eligible.slice(0, Math.max(1, Math.min(5, maxChallengers))).map((candidate) => candidate.id));
  return candidates.map((candidate) => challengerIds.has(candidate.id)
    ? { ...candidate, state: 'CHALLENGER' as const, executionAuthority: false as const }
    : { ...candidate, executionAuthority: false as const });
};
