import { DEFAULT_RISK_LIMITS } from './config';

export type StrategyGenomeMutationType = 'WEIGHT' | 'THRESHOLD' | 'RISK' | 'SCOPE' | 'CROSSOVER';

export interface StrategyGenomeMutation {
  type: StrategyGenomeMutationType;
  field: string;
  from: number | string | boolean | null;
  to: number | string | boolean | null;
}

export interface StrategyGenomeWeights {
  eventNews: number;
  trendMomentum: number;
  meanReversion: number;
}

export interface StrategyGenomeThresholds {
  entryScore: number;
  exitScore: number;
  minConfidence: number;
}

export interface StrategyGenomeRiskProfile {
  maxPositionPct: number;
  maxDailyLossPct: number;
  maxTotalDrawdownPct: number;
}

export interface StrategyGenome {
  id: string;
  generation: number;
  createdAt: number;
  parentGenomeIds: string[];
  strategyVersion: string;
  modelVersion: string | null;
  markets: string[];
  regimes: string[];
  timeframesMinutes: number[];
  weights: StrategyGenomeWeights;
  thresholds: StrategyGenomeThresholds;
  risk: StrategyGenomeRiskProfile;
  mutations: StrategyGenomeMutation[];
  executionAuthority: false;
}

const uniqueSortedStrings = (items: string[], upper = false) => [...new Set(
  items.map((item) => (upper ? item.trim().toUpperCase() : item.trim())).filter(Boolean),
)].sort();

const round12 = (value: number) => Math.round(value * 1e12) / 1e12;

const normalizeWeights = (weights: StrategyGenomeWeights): StrategyGenomeWeights => {
  const values = [weights.eventNews, weights.trendMomentum, weights.meanReversion];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('Strategy Genome weights must be finite and non-negative.');
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error('Strategy Genome requires at least one positive strategy weight.');
  return Object.freeze({
    eventNews: round12(weights.eventNews / total),
    trendMomentum: round12(weights.trendMomentum / total),
    meanReversion: round12(weights.meanReversion / total),
  });
};

const validateThresholds = (thresholds: StrategyGenomeThresholds) => {
  if (!Number.isFinite(thresholds.entryScore) || thresholds.entryScore < 0 || thresholds.entryScore > 100) throw new Error('Genome entryScore must be between 0 and 100.');
  if (!Number.isFinite(thresholds.exitScore) || thresholds.exitScore < 0 || thresholds.exitScore > 100) throw new Error('Genome exitScore must be between 0 and 100.');
  if (!Number.isFinite(thresholds.minConfidence) || thresholds.minConfidence < 0 || thresholds.minConfidence > 1) throw new Error('Genome minConfidence must be between 0 and 1.');
};

const validateRisk = (risk: StrategyGenomeRiskProfile) => {
  const values = [risk.maxPositionPct, risk.maxDailyLossPct, risk.maxTotalDrawdownPct];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Strategy Genome risk limits must be positive finite values.');
  if (risk.maxPositionPct > DEFAULT_RISK_LIMITS.maxPositionPct) throw new Error('Genome maxPositionPct cannot exceed the Black Oracle hard risk limit.');
  if (risk.maxDailyLossPct > DEFAULT_RISK_LIMITS.maxDailyLossPct) throw new Error('Genome maxDailyLossPct cannot exceed the Black Oracle hard risk limit.');
  if (risk.maxTotalDrawdownPct > DEFAULT_RISK_LIMITS.maxTotalDrawdownPct) throw new Error('Genome maxTotalDrawdownPct cannot exceed the Black Oracle hard risk limit.');
};

export const normalizeStrategyGenome = (genome: StrategyGenome): StrategyGenome => {
  if (!genome.id.trim()) throw new Error('Strategy Genome id is required.');
  if (!Number.isInteger(genome.generation) || genome.generation < 0) throw new Error('Strategy Genome generation must be a non-negative integer.');
  if (!Number.isFinite(genome.createdAt) || genome.createdAt <= 0) throw new Error('Strategy Genome createdAt must be a positive timestamp.');
  if (!genome.strategyVersion.trim()) throw new Error('Strategy Genome strategyVersion is required.');
  if (!genome.markets.length) throw new Error('Strategy Genome requires at least one market.');
  if (!genome.timeframesMinutes.length) throw new Error('Strategy Genome requires at least one timeframe.');
  if (genome.timeframesMinutes.some((value) => !Number.isInteger(value) || value <= 0)) throw new Error('Strategy Genome timeframes must be positive integer minutes.');

  validateThresholds(genome.thresholds);
  validateRisk(genome.risk);

  return Object.freeze({
    ...genome,
    id: genome.id.trim(),
    parentGenomeIds: Object.freeze(uniqueSortedStrings(genome.parentGenomeIds)) as string[],
    strategyVersion: genome.strategyVersion.trim(),
    modelVersion: genome.modelVersion?.trim() || null,
    markets: Object.freeze(uniqueSortedStrings(genome.markets, true)) as string[],
    regimes: Object.freeze(uniqueSortedStrings(genome.regimes, true)) as string[],
    timeframesMinutes: Object.freeze([...new Set(genome.timeframesMinutes)].sort((a, b) => a - b)) as number[],
    weights: normalizeWeights(genome.weights),
    thresholds: Object.freeze({ ...genome.thresholds }),
    risk: Object.freeze({ ...genome.risk }),
    mutations: Object.freeze(genome.mutations.map((mutation) => Object.freeze({ ...mutation, field: mutation.field.trim() }))) as StrategyGenomeMutation[],
    executionAuthority: false,
  });
};

const stableGenomePayload = (genome: StrategyGenome) => ({
  strategyVersion: genome.strategyVersion,
  modelVersion: genome.modelVersion,
  markets: genome.markets,
  regimes: genome.regimes,
  timeframesMinutes: genome.timeframesMinutes,
  weights: genome.weights,
  thresholds: genome.thresholds,
  risk: genome.risk,
});

const fnv1a32 = (text: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

export const fingerprintStrategyGenome = (genome: StrategyGenome) => {
  const normalized = normalizeStrategyGenome(genome);
  const hash = fnv1a32(JSON.stringify(stableGenomePayload(normalized)));
  return `sg-${hash.toString(16).padStart(8, '0')}`;
};
