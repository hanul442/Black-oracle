import { createHash } from 'node:crypto';

export const VERSION_REGISTRY_CONTRACT_VERSION = 'bo.version-registry.v1' as const;
export const DECISION_RUN_CONTRACT_VERSION = 'bo.decision-run.v1' as const;

export type ValidationState =
  | 'UNVALIDATED'
  | 'CANDIDATE'
  | 'CHALLENGER'
  | 'CHAMPION'
  | 'DORMANT'
  | 'RETIRED';

export type DeploymentState =
  | 'OFFLINE'
  | 'PAPER_SHADOW'
  | 'PRODUCTION';

export type VersionedComponentType =
  | 'PRODUCT'
  | 'DATA_CONTRACT'
  | 'EVIDENCE_PIPELINE'
  | 'RESEARCH'
  | 'FORECAST'
  | 'STRATEGY'
  | 'CHAMPION'
  | 'COUNCIL_CONFIG'
  | 'PROMPT'
  | 'MODEL'
  | 'RISK'
  | 'EXECUTION'
  | 'ORCHESTRATION'
  | 'OTHER';

export interface ComponentVersionRef {
  componentType: VersionedComponentType;
  componentId: string;
  versionId: string;
  contentFingerprint: string;
}

export interface VersionRegistryRecord extends ComponentVersionRef {
  contractVersion: typeof VERSION_REGISTRY_CONTRACT_VERSION;
  createdAt: string;
  validationState: ValidationState;
  deploymentState: DeploymentState;
  productionActivationId?: string | null;
  supersedesVersionId?: string | null;
  rollbackTargetVersionId?: string | null;
  provenance?: {
    source: 'HUMAN' | 'AI' | 'EXPERIMENT' | 'IMPORT' | 'SYSTEM';
    sourceId?: string | null;
  };
}

export interface DecisionRunInput {
  runtimeId: string;
  market: string;
  /**
   * Historical knowledge cutoff for this exact official decision cycle.
   */
  asOf: string;
  /**
   * Existing native decision identity or another caller-owned unique key.
   * It prevents two decisions at the same market/asOf from collapsing.
   */
  decisionKey: string;
  componentVersions: readonly ComponentVersionRef[];
  dataSnapshotIds: readonly string[];
  evidenceIds: readonly string[];
  researchArtifactIds?: readonly string[];
  forecastArtifactIds?: readonly string[];
  portfolioSnapshotId?: string | null;
  legacyTraceId?: string | null;
  legacyDecisionId?: string | null;
}

export interface DecisionRunIdentity {
  contractVersion: typeof DECISION_RUN_CONTRACT_VERSION;
  decisionRunId: string;
  runtimeId: string;
  market: string;
  asOf: string;
  decisionKey: string;
  componentVersions: ComponentVersionRef[];
  dataSnapshotIds: string[];
  evidenceIds: string[];
  researchArtifactIds: string[];
  forecastArtifactIds: string[];
  portfolioSnapshotId: string | null;
  legacyTraceId: string | null;
  legacyDecisionId: string | null;
}

export interface LegacyDecisionTraceLike {
  runtimeId?: string | null;
  market?: string | null;
  occurredAt?: number | string | null;
  traceId?: string | null;
  decisionId?: string | null;
  strategyVersion?: string | null;
  evidenceIds?: unknown;
}

export interface LegacyDecisionRunProjection {
  status: 'LEGACY_TRACE_ONLY';
  decisionRunId: null;
  runtimeId: string | null;
  market: string | null;
  asOfCandidate: string | null;
  legacyTraceId: string | null;
  legacyDecisionId: string | null;
  strategyVersion: string | null;
  evidenceIds: string[];
  missingForDecisionRun: Array<
    | 'runtimeId'
    | 'market'
    | 'asOf'
    | 'decisionKey'
    | 'componentVersions'
    | 'dataSnapshotIds'
  >;
}

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const parseTime = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (!nonEmpty(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const iso = (value: unknown): string | null => {
  const parsed = parseTime(value);
  return parsed == null ? null : new Date(parsed).toISOString();
};

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean))).sort();

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) result[key] = canonicalize(source[key]);
    return result;
  }
  return value;
};

export const fingerprintCanonicalValue = (value: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');

const normalizedVersionRef = (ref: ComponentVersionRef): ComponentVersionRef => {
  if (!nonEmpty(ref.componentId)) throw new Error('component version requires componentId');
  if (!nonEmpty(ref.versionId)) throw new Error('component version requires versionId');
  if (!nonEmpty(ref.contentFingerprint)) throw new Error('component version requires contentFingerprint');
  return {
    componentType: ref.componentType,
    componentId: ref.componentId.trim(),
    versionId: ref.versionId.trim(),
    contentFingerprint: ref.contentFingerprint.trim(),
  };
};

export const validateVersionRegistryRecord = (
  record: VersionRegistryRecord,
): VersionRegistryRecord => {
  if (record.contractVersion !== VERSION_REGISTRY_CONTRACT_VERSION) {
    throw new Error('unsupported Version Registry contract');
  }

  const createdAt = iso(record.createdAt);
  if (!createdAt) throw new Error('Version Registry record requires valid createdAt');

  const normalized = normalizedVersionRef(record);

  if (record.deploymentState === 'PRODUCTION' && !nonEmpty(record.productionActivationId)) {
    throw new Error('Production deployment requires explicit productionActivationId');
  }

  if (record.deploymentState !== 'PRODUCTION' && nonEmpty(record.productionActivationId)) {
    throw new Error('productionActivationId is only valid for Production deployment');
  }

  return {
    ...record,
    ...normalized,
    createdAt,
    productionActivationId: record.productionActivationId?.trim() || null,
    supersedesVersionId: record.supersedesVersionId?.trim() || null,
    rollbackTargetVersionId: record.rollbackTargetVersionId?.trim() || null,
  };
};

const normalizeVersions = (
  refs: readonly ComponentVersionRef[],
): ComponentVersionRef[] => {
  const seen = new Set<string>();
  const normalized = refs.map(normalizedVersionRef);

  for (const ref of normalized) {
    const key = `${ref.componentType}:${ref.componentId}`;
    if (seen.has(key)) {
      throw new Error(`Decision Run contains duplicate component identity: ${key}`);
    }
    seen.add(key);
  }

  return normalized.sort((a, b) =>
    a.componentType.localeCompare(b.componentType)
    || a.componentId.localeCompare(b.componentId)
    || a.versionId.localeCompare(b.versionId));
};

export const createDecisionRunIdentity = (
  input: DecisionRunInput,
): DecisionRunIdentity => {
  if (!nonEmpty(input.runtimeId)) throw new Error('Decision Run requires runtimeId');
  if (!nonEmpty(input.market)) throw new Error('Decision Run requires market');
  if (!nonEmpty(input.decisionKey)) throw new Error('Decision Run requires decisionKey');

  const asOf = iso(input.asOf);
  if (!asOf) throw new Error('Decision Run requires valid asOf');

  const componentVersions = normalizeVersions(input.componentVersions);
  if (!componentVersions.length) {
    throw new Error('Decision Run requires at least one explicit component version');
  }

  const dataSnapshotIds = uniqueStrings(input.dataSnapshotIds);
  if (!dataSnapshotIds.length) {
    throw new Error('Decision Run requires at least one dataSnapshotId');
  }

  const evidenceIds = uniqueStrings(input.evidenceIds);
  const researchArtifactIds = uniqueStrings(input.researchArtifactIds ?? []);
  const forecastArtifactIds = uniqueStrings(input.forecastArtifactIds ?? []);

  const canonicalIdentity = {
    runtimeId: input.runtimeId.trim(),
    market: input.market.trim().toUpperCase(),
    asOf,
    decisionKey: input.decisionKey.trim(),
    componentVersions,
    dataSnapshotIds,
    evidenceIds,
    researchArtifactIds,
    forecastArtifactIds,
    portfolioSnapshotId: input.portfolioSnapshotId?.trim() || null,
  };

  const decisionRunId = `bo-run-v1-${fingerprintCanonicalValue(canonicalIdentity).slice(0, 32)}`;

  return {
    contractVersion: DECISION_RUN_CONTRACT_VERSION,
    decisionRunId,
    ...canonicalIdentity,
    legacyTraceId: input.legacyTraceId?.trim() || null,
    legacyDecisionId: input.legacyDecisionId?.trim() || null,
  };
};

/**
 * Existing Decision Replay trace IDs are valuable lineage, but they do not by
 * themselves prove an as-of knowledge boundary, full component versions, or a
 * canonical data snapshot. This adapter preserves them without silently
 * upgrading them into a Frozen v1 Decision Run.
 */
export const projectLegacyDecisionTrace = (
  legacy: LegacyDecisionTraceLike,
): LegacyDecisionRunProjection => {
  const runtimeId = nonEmpty(legacy.runtimeId) ? legacy.runtimeId.trim() : null;
  const market = nonEmpty(legacy.market) ? legacy.market.trim().toUpperCase() : null;
  const asOfCandidate = iso(legacy.occurredAt);
  const legacyTraceId = nonEmpty(legacy.traceId) ? legacy.traceId.trim() : null;
  const legacyDecisionId = nonEmpty(legacy.decisionId) ? legacy.decisionId.trim() : null;
  const strategyVersion = nonEmpty(legacy.strategyVersion) ? legacy.strategyVersion.trim() : null;
  const evidenceIds = Array.isArray(legacy.evidenceIds)
    ? uniqueStrings(legacy.evidenceIds.map(String))
    : [];

  const missingForDecisionRun: LegacyDecisionRunProjection['missingForDecisionRun'] = [];
  if (!runtimeId) missingForDecisionRun.push('runtimeId');
  if (!market) missingForDecisionRun.push('market');
  if (!asOfCandidate) missingForDecisionRun.push('asOf');
  if (!legacyDecisionId && !legacyTraceId) missingForDecisionRun.push('decisionKey');

  // These are intentionally always missing from the old trace contract unless
  // a future explicit adapter can prove them from source records.
  missingForDecisionRun.push('componentVersions', 'dataSnapshotIds');

  return {
    status: 'LEGACY_TRACE_ONLY',
    decisionRunId: null,
    runtimeId,
    market,
    asOfCandidate,
    legacyTraceId,
    legacyDecisionId,
    strategyVersion,
    evidenceIds,
    missingForDecisionRun,
  };
};
