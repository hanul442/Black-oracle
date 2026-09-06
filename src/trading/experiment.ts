export type ExperimentStatus = 'PLANNED' | 'RUNNING' | 'PASSED' | 'REJECTED' | 'INVALID';

export interface ExperimentMetricCriterion {
  metric: string;
  operator: 'GTE' | 'LTE';
  threshold: number;
}

export interface ExperimentVariable {
  name: string;
  baseline: number | string | boolean;
  candidate: number | string | boolean;
}

export interface ExperimentSpec {
  id: string;
  createdAt: number;
  hypothesis: string;
  strategyVersion: string;
  modelVersion: string | null;
  researchConfigurationId?: string | null;
  markets: string[];
  regimes: string[];
  variables: ExperimentVariable[];
  criteria: ExperimentMetricCriterion[];
  parentExperimentIds: string[];
  evidenceIds: string[];
}

export interface ExperimentRun {
  id: string;
  experimentId: string;
  startedAt: number;
  finishedAt: number | null;
  seed: number | null;
  sampleSize: number;
  source: 'PAPER' | 'BACKTEST' | 'MONTE_CARLO';
  status: ExperimentStatus;
}

export interface ExperimentMetricResult {
  metric: string;
  value: number | null;
  passed: boolean | null;
}

export interface ExperimentResult {
  experimentId: string;
  runId: string;
  status: Extract<ExperimentStatus, 'PASSED' | 'REJECTED' | 'INVALID'>;
  finishedAt: number;
  metrics: ExperimentMetricResult[];
  rejectionReasons: string[];
  decisionTraceIds: string[];
  monteCarloSeed: number | null;
}

const freezeArray = <T>(items: T[]): readonly T[] => Object.freeze(items.slice());

const normalizeMarkets = (markets: string[]) => [...new Set(markets.map((market) => market.trim().toUpperCase()).filter(Boolean))].sort();
const normalizeStrings = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))].sort();
const researchConfigurationIdPattern = /^rcfg-v1-[0-9a-f]{16}$/;

export const validateExperimentSpec = (spec: ExperimentSpec) => {
  if (!spec.id.trim()) throw new Error('Experiment id is required.');
  if (!Number.isFinite(spec.createdAt) || spec.createdAt <= 0) throw new Error('Experiment createdAt must be a positive timestamp.');
  if (!spec.hypothesis.trim()) throw new Error('Experiment hypothesis is required.');
  if (!spec.strategyVersion.trim()) throw new Error('Experiment strategyVersion is required.');
  const configurationId = String(spec.researchConfigurationId ?? '').trim().toLowerCase();
  if (configurationId && !researchConfigurationIdPattern.test(configurationId)) throw new Error('Experiment researchConfigurationId is invalid.');
  if (!spec.markets.length) throw new Error('Experiment requires at least one market.');
  if (!spec.criteria.length) throw new Error('Experiment requires at least one acceptance criterion.');
  for (const criterion of spec.criteria) {
    if (!criterion.metric.trim() || !Number.isFinite(criterion.threshold)) throw new Error('Experiment criterion is invalid.');
  }
};

export const normalizeExperimentSpec = (spec: ExperimentSpec): ExperimentSpec => {
  validateExperimentSpec(spec);
  return Object.freeze({
    ...spec,
    id: spec.id.trim(),
    hypothesis: spec.hypothesis.trim(),
    strategyVersion: spec.strategyVersion.trim(),
    modelVersion: spec.modelVersion?.trim() || null,
    researchConfigurationId: String(spec.researchConfigurationId ?? '').trim().toLowerCase() || null,
    markets: freezeArray(normalizeMarkets(spec.markets)) as string[],
    regimes: freezeArray(normalizeStrings(spec.regimes)) as string[],
    variables: freezeArray(spec.variables.map((item) => Object.freeze({ ...item, name: item.name.trim() }))) as ExperimentVariable[],
    criteria: freezeArray(spec.criteria.map((item) => Object.freeze({ ...item, metric: item.metric.trim() }))) as ExperimentMetricCriterion[],
    parentExperimentIds: freezeArray(normalizeStrings(spec.parentExperimentIds)) as string[],
    evidenceIds: freezeArray(normalizeStrings(spec.evidenceIds)) as string[],
  });
};

export const evaluateExperimentCriteria = (
  spec: ExperimentSpec,
  metrics: Record<string, number | null | undefined>,
): ExperimentMetricResult[] => spec.criteria.map((criterion) => {
  const value = metrics[criterion.metric];
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const passed = numeric === null ? null : criterion.operator === 'GTE' ? numeric >= criterion.threshold : numeric <= criterion.threshold;
  return Object.freeze({ metric: criterion.metric, value: numeric, passed });
});
