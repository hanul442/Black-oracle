import { normalizeExperimentSpec, type ExperimentSpec } from './experiment';
import { normalizeStrategyGenome, type StrategyGenome } from './strategyGenome';

export type ResearchConfigurationId = `rcfg-v1-${string}`;

export interface ResearchConfigurationDescriptorV1 {
  schemaVersion: 1;
  strategyVersion: string;
  modelVersion: string | null;
  markets: string[];
  regimes: string[];
  timeframesMinutes: number[];
  weights: {
    eventNews: number;
    trendMomentum: number;
    meanReversion: number;
  };
  thresholds: {
    entryScore: number;
    exitScore: number;
    minConfidence: number;
  };
  risk: {
    maxPositionPct: number;
    maxDailyLossPct: number;
    maxTotalDrawdownPct: number;
  };
}

const fnv1a32 = (text: string, seed = 0x811c9dc5) => {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

const digest64 = (text: string) => {
  const left = fnv1a32(text);
  const right = fnv1a32(`black-oracle:research-configuration:v1|${text}`, 0x9e3779b9);
  return `${left.toString(16).padStart(8, '0')}${right.toString(16).padStart(8, '0')}`;
};

export const normalizeResearchConfigurationId = (value: unknown): ResearchConfigurationId | null => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return /^rcfg-v1-[0-9a-f]{16}$/.test(normalized) ? normalized as ResearchConfigurationId : null;
};

export const buildResearchConfigurationDescriptorFromGenome = (genome: StrategyGenome): ResearchConfigurationDescriptorV1 => {
  const normalized = normalizeStrategyGenome(genome);
  return Object.freeze({
    schemaVersion: 1 as const,
    strategyVersion: normalized.strategyVersion,
    modelVersion: normalized.modelVersion,
    markets: Object.freeze(normalized.markets.slice()) as string[],
    regimes: Object.freeze(normalized.regimes.slice()) as string[],
    timeframesMinutes: Object.freeze(normalized.timeframesMinutes.slice()) as number[],
    weights: Object.freeze({ ...normalized.weights }),
    thresholds: Object.freeze({ ...normalized.thresholds }),
    risk: Object.freeze({ ...normalized.risk }),
  });
};

export const buildResearchConfigurationIdFromGenome = (genome: StrategyGenome): ResearchConfigurationId => {
  const descriptor = buildResearchConfigurationDescriptorFromGenome(genome);
  return `rcfg-v1-${digest64(JSON.stringify(descriptor))}` as ResearchConfigurationId;
};

export const bindExperimentSpecToStrategyGenome = (
  spec: ExperimentSpec,
  genome: StrategyGenome,
): ExperimentSpec => {
  const normalizedSpec = normalizeExperimentSpec(spec);
  const normalizedGenome = normalizeStrategyGenome(genome);
  if (normalizedSpec.strategyVersion !== normalizedGenome.strategyVersion) {
    throw new Error('Experiment strategyVersion must match the bound Strategy Genome.');
  }
  if ((normalizedSpec.modelVersion ?? null) !== (normalizedGenome.modelVersion ?? null)) {
    throw new Error('Experiment modelVersion must match the bound Strategy Genome.');
  }
  return normalizeExperimentSpec({
    ...normalizedSpec,
    researchConfigurationId: buildResearchConfigurationIdFromGenome(normalizedGenome),
  });
};
