import type { ExperimentSpec } from './experiment';
import type { ExperimentLedgerEvent } from './experimentLedger';
import { buildDeflatedSharpe, type DeflatedSharpeResult } from './researchValidation';

export type ResearchTrialLineageSource =
  | 'MISSING'
  | 'STRATEGY_FACTORY_OBSERVED'
  | 'EXPERIMENT_LEDGER_OBSERVED'
  | 'COMBINED_CONSERVATIVE';

export type ResearchTrialLineageIntegrity = 'PASS' | 'CONSERVATIVE' | 'MISSING';

export interface ResearchTrialLineageSummary {
  available: boolean;
  trialCount: number;
  lowerBoundTrialCount: number;
  strategyFactoryTrials: number;
  experimentTrials: number;
  source: ResearchTrialLineageSource;
  integrity: ResearchTrialLineageIntegrity;
  strategyFingerprints: string[];
  experimentFingerprints: string[];
  incompleteStrategyTrials: number;
  incompleteExperimentTrials: number;
  reasons: string[];
  executionAuthority: false;
  promotionAuthority: false;
}

export interface LineageAwareDeflatedSharpeResult extends DeflatedSharpeResult {
  trialCountSource: ResearchTrialLineageSource;
  lineage: ResearchTrialLineageSummary;
}

const stableValue = (value: unknown): string | number | boolean | null => {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

const sortedStrings = (items: unknown, upper = false) => Array.isArray(items)
  ? [...new Set(items.map((item) => String(item ?? '').trim()).filter(Boolean).map((item) => upper ? item.toUpperCase() : item))].sort()
  : [];

const canonicalExperimentConfig = (spec: Partial<ExperimentSpec>) => {
  const variables = Array.isArray(spec.variables)
    ? spec.variables.map((variable) => ({
      name: String(variable?.name ?? '').trim(),
      baseline: stableValue(variable?.baseline),
      candidate: stableValue(variable?.candidate),
    })).filter((variable) => variable.name).sort((a, b) => {
      const name = a.name.localeCompare(b.name);
      return name || JSON.stringify(a).localeCompare(JSON.stringify(b));
    })
    : [];
  return JSON.stringify({
    strategyVersion: String(spec.strategyVersion ?? '').trim(),
    modelVersion: String(spec.modelVersion ?? '').trim() || null,
    markets: sortedStrings(spec.markets, true),
    regimes: sortedStrings(spec.regimes, true),
    variables,
  });
};

const fnv1a = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const eventPayload = (event: ExperimentLedgerEvent) => event?.payload && typeof event.payload === 'object'
  ? event.payload as Record<string, unknown>
  : {};

const collectStrategyTrials = (value: unknown) => {
  const fingerprints = new Set<string>();
  let incomplete = 0;
  const panel = value as { observations?: unknown[] } | null;
  if (!panel || !Array.isArray(panel.observations)) return { fingerprints, incomplete };
  for (const observation of panel.observations) {
    const predictions = (observation as { predictions?: unknown[] } | null)?.predictions;
    if (!Array.isArray(predictions)) continue;
    for (const prediction of predictions) {
      const item = prediction as { fingerprint?: unknown; candidateId?: unknown } | null;
      const fingerprint = String(item?.fingerprint ?? '').trim();
      if (fingerprint) {
        fingerprints.add(`strategy:${fingerprint}`);
        continue;
      }
      const candidateId = String(item?.candidateId ?? '').trim();
      if (candidateId) {
        fingerprints.add(`strategy-candidate:${candidateId}`);
        incomplete += 1;
      }
    }
  }
  return { fingerprints, incomplete };
};

const collectExperimentTrials = (events: readonly ExperimentLedgerEvent[]) => {
  const planned = new Map<string, Partial<ExperimentSpec>>();
  const triedIds = new Set<string>();
  for (const event of events.slice().sort((a, b) => a.sequence - b.sequence || a.timestamp - b.timestamp)) {
    if (!event?.experimentId) continue;
    const id = String(event.experimentId).trim();
    if (!id) continue;
    if (event.type === 'EXPERIMENT_PLANNED') {
      const spec = eventPayload(event).spec;
      if (spec && typeof spec === 'object') planned.set(id, spec as Partial<ExperimentSpec>);
    }
    if (event.type === 'EXPERIMENT_STARTED' || event.type === 'EXPERIMENT_COMPLETED') triedIds.add(id);
  }
  const fingerprints = new Set<string>();
  let incomplete = 0;
  for (const id of triedIds) {
    const spec = planned.get(id);
    if (!spec) {
      fingerprints.add(`experiment-id:${id}`);
      incomplete += 1;
      continue;
    }
    const canonical = canonicalExperimentConfig(spec);
    fingerprints.add(`experiment-config:${fnv1a(canonical)}`);
  }
  return { fingerprints, incomplete };
};

export const buildResearchTrialLineage = (input: {
  strategyReturnPanel?: unknown | null;
  experimentLedgerEvents?: readonly ExperimentLedgerEvent[] | null;
}): ResearchTrialLineageSummary => {
  const strategy = collectStrategyTrials(input.strategyReturnPanel ?? null);
  const experiments = collectExperimentTrials(Array.isArray(input.experimentLedgerEvents) ? input.experimentLedgerEvents : []);
  const strategyFactoryTrials = strategy.fingerprints.size;
  const experimentTrials = experiments.fingerprints.size;
  const hasStrategy = strategyFactoryTrials > 0;
  const hasExperiments = experimentTrials > 0;
  const reasons: string[] = [];

  if (!hasStrategy && !hasExperiments) {
    reasons.push('No persisted, actually tried Strategy Factory or Experiment Ledger configurations are available; DSR selection-bias correction is fail-closed.');
    return {
      available: false,
      trialCount: 0,
      lowerBoundTrialCount: 0,
      strategyFactoryTrials,
      experimentTrials,
      source: 'MISSING',
      integrity: 'MISSING',
      strategyFingerprints: [],
      experimentFingerprints: [],
      incompleteStrategyTrials: strategy.incomplete,
      incompleteExperimentTrials: experiments.incomplete,
      reasons,
      executionAuthority: false,
      promotionAuthority: false,
    };
  }

  let source: ResearchTrialLineageSource;
  let integrity: ResearchTrialLineageIntegrity = 'PASS';
  let trialCount: number;
  let lowerBoundTrialCount: number;

  if (hasStrategy && hasExperiments) {
    source = 'COMBINED_CONSERVATIVE';
    trialCount = strategyFactoryTrials + experimentTrials;
    lowerBoundTrialCount = Math.max(strategyFactoryTrials, experimentTrials);
    integrity = 'CONSERVATIVE';
    reasons.push(`Strategy Factory and Experiment Ledger lineages are both present. ${trialCount} is used as a conservative upper trial count because cross-source configuration identity is not yet proven; the deduplicated lower bound is ${lowerBoundTrialCount}.`);
  } else if (hasStrategy) {
    source = 'STRATEGY_FACTORY_OBSERVED';
    trialCount = strategyFactoryTrials;
    lowerBoundTrialCount = trialCount;
    reasons.push(`${trialCount} unique Strategy Factory fingerprint(s) were observed in persisted PAPER shadow evaluations.`);
  } else {
    source = 'EXPERIMENT_LEDGER_OBSERVED';
    trialCount = experimentTrials;
    lowerBoundTrialCount = trialCount;
    reasons.push(`${trialCount} unique started/completed Experiment Ledger configuration(s) were observed.`);
  }

  if (strategy.incomplete > 0 || experiments.incomplete > 0) {
    integrity = 'CONSERVATIVE';
    if (strategy.incomplete > 0) reasons.push(`${strategy.incomplete} Strategy Factory trial reference(s) lacked a fingerprint and were conservatively identified by candidate id.`);
    if (experiments.incomplete > 0) reasons.push(`${experiments.incomplete} tried experiment(s) lacked a matching planned specification and were conservatively identified by experiment id.`);
  }

  return {
    available: true,
    trialCount,
    lowerBoundTrialCount,
    strategyFactoryTrials,
    experimentTrials,
    source,
    integrity,
    strategyFingerprints: [...strategy.fingerprints].sort(),
    experimentFingerprints: [...experiments.fingerprints].sort(),
    incompleteStrategyTrials: strategy.incomplete,
    incompleteExperimentTrials: experiments.incomplete,
    reasons,
    executionAuthority: false,
    promotionAuthority: false,
  };
};

export const buildLineageAwareDeflatedSharpe = (
  returns: number[],
  lineage: ResearchTrialLineageSummary,
): LineageAwareDeflatedSharpeResult => {
  if (!lineage.available || lineage.trialCount < 1) {
    const descriptive = buildDeflatedSharpe(returns, 1);
    const enoughForDescription = descriptive.sampleCount >= 30 && descriptive.sharpePerObservation != null;
    return {
      ...descriptive,
      available: false,
      trialCount: 0,
      expectedMaxNullSharpe: null,
      probability: null,
      verdict: 'INSUFFICIENT_DATA',
      reasons: [
        ...lineage.reasons,
        ...(enoughForDescription ? [`Raw per-observation Sharpe ${descriptive.sharpePerObservation!.toFixed(4)} is descriptive only until tried-configuration lineage exists.`] : descriptive.reasons),
      ],
      trialCountSource: lineage.source,
      lineage,
    };
  }
  const result = buildDeflatedSharpe(returns, lineage.trialCount);
  return {
    ...result,
    reasons: [...result.reasons, ...lineage.reasons],
    trialCountSource: lineage.source,
    lineage,
  };
};
