import type { ExperimentSpec } from './experiment';
import type { ExperimentLedgerEvent } from './experimentLedger';
import { buildResearchConfigurationIdFromGenome, normalizeResearchConfigurationId } from './researchConfiguration';
import { buildDeflatedSharpe, type DeflatedSharpeResult } from './researchValidation';
import type { StrategyGenome } from './strategyGenome';

export type ResearchTrialLineageSource =
  | 'MISSING'
  | 'STRATEGY_FACTORY_OBSERVED'
  | 'EXPERIMENT_LEDGER_OBSERVED'
  | 'COMBINED_CANONICAL'
  | 'COMBINED_CONSERVATIVE';

export type ResearchTrialLineageIntegrity = 'PASS' | 'CONSERVATIVE' | 'MISSING';

export interface ResearchTrialLineageSummary {
  available: boolean;
  trialCount: number;
  lowerBoundTrialCount: number;
  canonicalTrialCount: number;
  crossSourceOverlap: number;
  strategyFactoryTrials: number;
  experimentTrials: number;
  source: ResearchTrialLineageSource;
  integrity: ResearchTrialLineageIntegrity;
  strategyFingerprints: string[];
  experimentFingerprints: string[];
  configurationIds: string[];
  unmappedStrategyTrials: number;
  unmappedExperimentTrials: number;
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

interface CollectedTrials {
  identities: Set<string>;
  canonicalIds: Set<string>;
  fallbackIdentities: Set<string>;
  incomplete: number;
}

const collectStrategyTrials = (value: unknown): CollectedTrials => {
  const identities = new Set<string>();
  const canonicalIds = new Set<string>();
  const fallbackIdentities = new Set<string>();
  let incomplete = 0;
  const panel = value as {
    cohort?: { candidates?: Array<{ id?: unknown; genome?: unknown; researchConfigurationId?: unknown }> };
    observations?: unknown[];
  } | null;
  if (!panel || !Array.isArray(panel.observations)) return { identities, canonicalIds, fallbackIdentities, incomplete };

  const candidateConfigurationIds = new Map<string, string>();
  if (Array.isArray(panel.cohort?.candidates)) {
    for (const candidate of panel.cohort!.candidates!) {
      const candidateId = String(candidate?.id ?? '').trim();
      if (!candidateId) continue;
      const persisted = normalizeResearchConfigurationId(candidate?.researchConfigurationId);
      if (persisted) {
        candidateConfigurationIds.set(candidateId, persisted);
        continue;
      }
      if (candidate?.genome && typeof candidate.genome === 'object') {
        try {
          candidateConfigurationIds.set(candidateId, buildResearchConfigurationIdFromGenome(candidate.genome as StrategyGenome));
        } catch {
          // A malformed legacy candidate stays countable by fingerprint/candidate id below, but cannot claim canonical cross-source identity.
        }
      }
    }
  }

  for (const observation of panel.observations) {
    const predictions = (observation as { predictions?: unknown[] } | null)?.predictions;
    if (!Array.isArray(predictions)) continue;
    for (const prediction of predictions) {
      const item = prediction as { fingerprint?: unknown; candidateId?: unknown; researchConfigurationId?: unknown } | null;
      const candidateId = String(item?.candidateId ?? '').trim();
      const directConfigurationId = normalizeResearchConfigurationId(item?.researchConfigurationId);
      const configurationId = directConfigurationId || (candidateId ? candidateConfigurationIds.get(candidateId) ?? null : null);
      if (configurationId) {
        identities.add(configurationId);
        canonicalIds.add(configurationId);
        continue;
      }
      const fingerprint = String(item?.fingerprint ?? '').trim();
      if (fingerprint) {
        const fallback = `strategy:${fingerprint}`;
        identities.add(fallback);
        fallbackIdentities.add(fallback);
        continue;
      }
      if (candidateId) {
        const fallback = `strategy-candidate:${candidateId}`;
        identities.add(fallback);
        fallbackIdentities.add(fallback);
        incomplete += 1;
      }
    }
  }
  return { identities, canonicalIds, fallbackIdentities, incomplete };
};

const collectExperimentTrials = (events: readonly ExperimentLedgerEvent[]): CollectedTrials => {
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

  const identities = new Set<string>();
  const canonicalIds = new Set<string>();
  const fallbackIdentities = new Set<string>();
  let incomplete = 0;
  for (const id of triedIds) {
    const spec = planned.get(id);
    if (!spec) {
      const fallback = `experiment-id:${id}`;
      identities.add(fallback);
      fallbackIdentities.add(fallback);
      incomplete += 1;
      continue;
    }
    const configurationId = normalizeResearchConfigurationId(spec.researchConfigurationId);
    if (configurationId) {
      identities.add(configurationId);
      canonicalIds.add(configurationId);
      continue;
    }
    const fallback = `experiment-config:${fnv1a(canonicalExperimentConfig(spec))}`;
    identities.add(fallback);
    fallbackIdentities.add(fallback);
  }
  return { identities, canonicalIds, fallbackIdentities, incomplete };
};

const intersectionSize = (left: Set<string>, right: Set<string>) => {
  let count = 0;
  for (const value of left) if (right.has(value)) count += 1;
  return count;
};

export const buildResearchTrialLineage = (input: {
  strategyReturnPanel?: unknown | null;
  experimentLedgerEvents?: readonly ExperimentLedgerEvent[] | null;
}): ResearchTrialLineageSummary => {
  const strategy = collectStrategyTrials(input.strategyReturnPanel ?? null);
  const experiments = collectExperimentTrials(Array.isArray(input.experimentLedgerEvents) ? input.experimentLedgerEvents : []);
  const strategyFactoryTrials = strategy.identities.size;
  const experimentTrials = experiments.identities.size;
  const hasStrategy = strategyFactoryTrials > 0;
  const hasExperiments = experimentTrials > 0;
  const reasons: string[] = [];
  const canonicalIds = new Set([...strategy.canonicalIds, ...experiments.canonicalIds]);
  const crossSourceOverlap = intersectionSize(strategy.canonicalIds, experiments.canonicalIds);

  if (!hasStrategy && !hasExperiments) {
    reasons.push('No persisted, actually tried Strategy Factory or Experiment Ledger configurations are available; DSR selection-bias correction is fail-closed.');
    return {
      available: false,
      trialCount: 0,
      lowerBoundTrialCount: 0,
      canonicalTrialCount: 0,
      crossSourceOverlap: 0,
      strategyFactoryTrials,
      experimentTrials,
      source: 'MISSING',
      integrity: 'MISSING',
      strategyFingerprints: [],
      experimentFingerprints: [],
      configurationIds: [],
      unmappedStrategyTrials: 0,
      unmappedExperimentTrials: 0,
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
    const unmappedStrategy = strategy.fallbackIdentities.size;
    const unmappedExperiments = experiments.fallbackIdentities.size;
    if (unmappedStrategy === 0 && unmappedExperiments === 0) {
      source = 'COMBINED_CANONICAL';
      trialCount = canonicalIds.size;
      lowerBoundTrialCount = trialCount;
      reasons.push(`${trialCount} canonical Research Configuration(s) remain after deduplicating ${crossSourceOverlap} Strategy Factory / Experiment Ledger overlap(s).`);
    } else {
      source = 'COMBINED_CONSERVATIVE';
      trialCount = canonicalIds.size + unmappedStrategy + unmappedExperiments;
      lowerBoundTrialCount = Math.max(strategyFactoryTrials, experimentTrials, canonicalIds.size);
      integrity = 'CONSERVATIVE';
      reasons.push(`Canonical cross-source identity is incomplete. DSR uses conservative upper trial count ${trialCount}; the defensible lower bound is ${lowerBoundTrialCount}.`);
      if (unmappedStrategy > 0) reasons.push(`${unmappedStrategy} observed Strategy Factory trial(s) lack canonical Research Configuration identity.`);
      if (unmappedExperiments > 0) reasons.push(`${unmappedExperiments} tried Experiment Ledger configuration(s) were not bound to a Strategy Genome Research Configuration id.`);
    }
  } else if (hasStrategy) {
    source = 'STRATEGY_FACTORY_OBSERVED';
    trialCount = strategyFactoryTrials;
    lowerBoundTrialCount = trialCount;
    reasons.push(`${trialCount} unique Strategy Factory configuration(s) were observed in persisted PAPER shadow evaluations.`);
  } else {
    source = 'EXPERIMENT_LEDGER_OBSERVED';
    trialCount = experimentTrials;
    lowerBoundTrialCount = trialCount;
    reasons.push(`${trialCount} unique started/completed Experiment Ledger configuration(s) were observed.`);
  }

  if (strategy.incomplete > 0 || experiments.incomplete > 0) {
    integrity = 'CONSERVATIVE';
    if (strategy.incomplete > 0) reasons.push(`${strategy.incomplete} Strategy Factory trial reference(s) lacked both canonical configuration identity and fingerprint and were identified by candidate id.`);
    if (experiments.incomplete > 0) reasons.push(`${experiments.incomplete} tried experiment(s) lacked a matching planned specification and were identified by experiment id.`);
  }

  return {
    available: true,
    trialCount,
    lowerBoundTrialCount,
    canonicalTrialCount: canonicalIds.size,
    crossSourceOverlap,
    strategyFactoryTrials,
    experimentTrials,
    source,
    integrity,
    strategyFingerprints: [...strategy.identities].sort(),
    experimentFingerprints: [...experiments.identities].sort(),
    configurationIds: [...canonicalIds].sort(),
    unmappedStrategyTrials: strategy.fallbackIdentities.size,
    unmappedExperimentTrials: experiments.fallbackIdentities.size,
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
