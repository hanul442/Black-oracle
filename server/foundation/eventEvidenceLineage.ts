import { fingerprintCanonicalValue } from './decisionRunVersionRegistry';

export const EVENT_TRIGGER_CONTRACT_VERSION = 'bo.event-trigger.v1' as const;
export const EVIDENCE_LINEAGE_CONTRACT_VERSION = 'bo.evidence-lineage.v1' as const;

export type EntityType =
  | 'GLOBAL'
  | 'MARKET'
  | 'ASSET'
  | 'COMPANY'
  | 'SECTOR'
  | 'COUNTRY'
  | 'THEME'
  | 'TECHNOLOGY'
  | 'COMMODITY'
  | 'PERSON'
  | 'MACRO_EVENT';

export interface EntityRef {
  entityType: EntityType;
  entityId: string;
}

export type MaterialChangeKind =
  | 'CREATED'
  | 'REVISED'
  | 'INVALIDATED'
  | 'FRESHNESS_EXPIRED'
  | 'CONTRADICTION_CHANGED'
  | 'VERIFICATION_CHANGED'
  | 'RUNTIME_STATE_CHANGED';

export type Materiality = 'SILENT' | 'MATERIAL' | 'CRITICAL';

export type RecomputeTarget =
  | 'EVIDENCE'
  | 'RESEARCH'
  | 'FORECAST'
  | 'STRATEGY'
  | 'REPORT'
  | 'WATCHLIST'
  | 'ALERT'
  | 'ASSET_GRAPH';

export interface MaterialChangeEventInput {
  source: string;
  sourceRecordId: string;
  sourceRevisionId?: string | null;
  changeKind: MaterialChangeKind;
  materiality: Materiality;
  observedAt: string;
  emittedAt: string;
  affectedEntities: readonly EntityRef[];
  recomputeTargets: readonly RecomputeTarget[];
  reasonCodes: readonly string[];
}

export interface MaterialChangeEvent {
  contractVersion: typeof EVENT_TRIGGER_CONTRACT_VERSION;
  eventId: string;
  source: string;
  sourceRecordId: string;
  sourceRevisionId: string | null;
  changeKind: MaterialChangeKind;
  materiality: Materiality;
  observedAt: string;
  emittedAt: string;
  affectedEntities: EntityRef[];
  recomputeTargets: RecomputeTarget[];
  reasonCodes: string[];
  /**
   * Orchestration can request recomputation, never authorize an order.
   */
  executionAuthority: false;
}

export type EvidenceVerificationState =
  | 'UNVERIFIED'
  | 'URL_VERIFIED'
  | 'CONTENT_VERIFIED'
  | 'REVOKED';

export type EvidenceContradictionState =
  | 'NONE'
  | 'CONTESTED'
  | 'CONTRADICTED';

export type EvidenceRelation =
  | 'SUPPORTS'
  | 'CONTEXT'
  | 'CONTRADICTS'
  | 'REFUTES'
  | 'MENTIONS';

export interface EvidenceArtifact {
  contractVersion: typeof EVIDENCE_LINEAGE_CONTRACT_VERSION;
  evidenceId: string;
  sourceId: string;
  canonicalDataRef: {
    logicalRecordId: string;
    revisionId: string;
  };
  contentFingerprint: string;
  originGroupId: string;
  canonicalPublisherId?: string | null;
  verificationState: EvidenceVerificationState;
  contradictionState: EvidenceContradictionState;
  observedAt: string;
  ingestedAt: string;
  invalidatedAt?: string | null;
  affectedEntities: readonly EntityRef[];
}

export type EvidenceDependentType =
  | 'RESEARCH'
  | 'FORECAST'
  | 'REPORT'
  | 'DECISION_RUN';

export interface EvidenceDependency {
  evidenceId: string;
  dependentType: EvidenceDependentType;
  dependentId: string;
  relation: EvidenceRelation;
  linkedAt: string;
}

export interface EvidenceImpact {
  dependentType: EvidenceDependentType;
  dependentId: string;
  evidenceIds: string[];
  relations: EvidenceRelation[];
}

export interface LegacyEvidenceEventLike {
  eventType?: string | null;
  eventKey?: string | null;
  links?: Record<string, unknown> | null;
}

export interface LegacyEvidenceProjection {
  status: 'LEGACY_REFERENCE_ONLY';
  evidenceIds: string[];
  missingForEvidenceLineage: Array<
    | 'canonicalDataRef'
    | 'contentFingerprint'
    | 'originGroupId'
    | 'verificationState'
    | 'observedAt'
    | 'ingestedAt'
  >;
}

const nonEmpty=(value:unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const parseTime=(value:unknown): number | null => {
  if (!nonEmpty(value)) return null;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeEntity=(entity:EntityRef):EntityRef => {
  if (!nonEmpty(entity.entityId)) throw new Error('affected entity requires entityId');
  return {entityType:entity.entityType,entityId:entity.entityId.trim().toUpperCase()};
};

const uniqueEntities=(entities:readonly EntityRef[]):EntityRef[] => {
  const byKey=new Map<string,EntityRef>();
  for(const entity of entities){
    const normalized=normalizeEntity(entity);
    byKey.set(`${normalized.entityType}:${normalized.entityId}`,normalized);
  }
  return Array.from(byKey.values()).sort((a,b)=>
    a.entityType.localeCompare(b.entityType)||a.entityId.localeCompare(b.entityId));
};

const uniqueStrings=(values:readonly string[]):string[] =>
  Array.from(new Set(values.map(value=>String(value).trim()).filter(Boolean))).sort();

export const createMaterialChangeEvent=(
  input:MaterialChangeEventInput,
):MaterialChangeEvent => {
  if(!nonEmpty(input.source)) throw new Error('material change requires source');
  if(!nonEmpty(input.sourceRecordId)) throw new Error('material change requires sourceRecordId');

  const observedAtMs=parseTime(input.observedAt);
  const emittedAtMs=parseTime(input.emittedAt);
  if(observedAtMs==null||emittedAtMs==null) throw new Error('material change requires valid timestamps');
  if(emittedAtMs<observedAtMs) throw new Error('material change cannot be emitted before it was observed');

  const affectedEntities=uniqueEntities(input.affectedEntities);
  if(!affectedEntities.length) throw new Error('material change requires at least one affected entity');

  const recomputeTargets=uniqueStrings(input.recomputeTargets) as RecomputeTarget[];
  if(input.materiality==='SILENT'&&recomputeTargets.includes('ALERT')){
    throw new Error('silent material change cannot request ALERT');
  }

  const reasonCodes=uniqueStrings(input.reasonCodes);
  if(!reasonCodes.length) throw new Error('material change requires reasonCodes');

  const normalized={
    source:input.source.trim(),
    sourceRecordId:input.sourceRecordId.trim(),
    sourceRevisionId:input.sourceRevisionId?.trim()||null,
    changeKind:input.changeKind,
    materiality:input.materiality,
    observedAt:new Date(observedAtMs).toISOString(),
    emittedAt:new Date(emittedAtMs).toISOString(),
    affectedEntities,
    recomputeTargets,
    reasonCodes,
  };

  return {
    contractVersion:EVENT_TRIGGER_CONTRACT_VERSION,
    eventId:`bo-event-v1-${fingerprintCanonicalValue(normalized).slice(0,32)}`,
    ...normalized,
    executionAuthority:false,
  };
};

export const validateEvidenceArtifact=(artifact:EvidenceArtifact):EvidenceArtifact => {
  if(artifact.contractVersion!==EVIDENCE_LINEAGE_CONTRACT_VERSION){
    throw new Error('unsupported Evidence Lineage contract');
  }
  if(!nonEmpty(artifact.evidenceId)) throw new Error('Evidence requires evidenceId');
  if(!nonEmpty(artifact.sourceId)) throw new Error('Evidence requires sourceId');
  if(!nonEmpty(artifact.canonicalDataRef?.logicalRecordId)) throw new Error('Evidence requires canonical logicalRecordId');
  if(!nonEmpty(artifact.canonicalDataRef?.revisionId)) throw new Error('Evidence requires canonical revisionId');
  if(!nonEmpty(artifact.contentFingerprint)) throw new Error('Evidence requires contentFingerprint');
  if(!nonEmpty(artifact.originGroupId)) throw new Error('Evidence requires originGroupId');

  const observedAtMs=parseTime(artifact.observedAt);
  const ingestedAtMs=parseTime(artifact.ingestedAt);
  if(observedAtMs==null||ingestedAtMs==null) throw new Error('Evidence requires valid observedAt/ingestedAt');
  if(ingestedAtMs<observedAtMs) throw new Error('Evidence ingestedAt cannot precede observedAt');

  const invalidatedAtMs=artifact.invalidatedAt==null?null:parseTime(artifact.invalidatedAt);
  if(artifact.verificationState==='REVOKED'&&invalidatedAtMs==null){
    throw new Error('revoked Evidence requires invalidatedAt');
  }
  if(artifact.verificationState!=='REVOKED'&&artifact.invalidatedAt!=null){
    throw new Error('invalidatedAt is only valid for revoked Evidence');
  }
  if(invalidatedAtMs!=null&&invalidatedAtMs<observedAtMs){
    throw new Error('Evidence invalidatedAt cannot precede observedAt');
  }

  return {
    ...artifact,
    evidenceId:artifact.evidenceId.trim(),
    sourceId:artifact.sourceId.trim(),
    canonicalDataRef:{
      logicalRecordId:artifact.canonicalDataRef.logicalRecordId.trim(),
      revisionId:artifact.canonicalDataRef.revisionId.trim(),
    },
    contentFingerprint:artifact.contentFingerprint.trim(),
    originGroupId:artifact.originGroupId.trim(),
    canonicalPublisherId:artifact.canonicalPublisherId?.trim()||null,
    observedAt:new Date(observedAtMs).toISOString(),
    ingestedAt:new Date(ingestedAtMs).toISOString(),
    invalidatedAt:invalidatedAtMs==null?null:new Date(invalidatedAtMs).toISOString(),
    affectedEntities:uniqueEntities(artifact.affectedEntities),
  };
};

export const countIndependentEvidenceOrigins=(
  artifacts:readonly EvidenceArtifact[],
):number =>
  new Set(artifacts
    .filter(artifact=>artifact.verificationState!=='REVOKED')
    .map(artifact=>artifact.originGroupId.trim())
    .filter(Boolean))
    .size;

export const buildEvidenceImpact=(
  evidenceIds:readonly string[],
  dependencies:readonly EvidenceDependency[],
):EvidenceImpact[] => {
  const selected=new Set(uniqueStrings(evidenceIds));
  const grouped=new Map<string,EvidenceImpact>();

  for(const dependency of dependencies){
    if(!selected.has(dependency.evidenceId)) continue;
    if(!nonEmpty(dependency.dependentId)) continue;
    const key=`${dependency.dependentType}:${dependency.dependentId.trim()}`;
    const existing=grouped.get(key)??{
      dependentType:dependency.dependentType,
      dependentId:dependency.dependentId.trim(),
      evidenceIds:[],
      relations:[],
    };
    existing.evidenceIds.push(dependency.evidenceId);
    existing.relations.push(dependency.relation);
    grouped.set(key,existing);
  }

  return Array.from(grouped.values())
    .map(impact=>({
      ...impact,
      evidenceIds:uniqueStrings(impact.evidenceIds),
      relations:Array.from(new Set(impact.relations)).sort() as EvidenceRelation[],
    }))
    .sort((a,b)=>
      a.dependentType.localeCompare(b.dependentType)||a.dependentId.localeCompare(b.dependentId));
};

/**
 * Old Canonical Ledger EVIDENCE events preserve useful IDs but cannot prove
 * source independence, verification, exact canonical-data revision, or
 * observation/ingestion time. Never fabricate those fields during migration.
 */
export const projectLegacyEvidenceEvent=(
  event:LegacyEvidenceEventLike,
):LegacyEvidenceProjection => {
  const raw=Array.isArray(event.links?.evidenceIds)?event.links?.evidenceIds:[];
  return {
    status:'LEGACY_REFERENCE_ONLY',
    evidenceIds:uniqueStrings((raw??[]).map(String)),
    missingForEvidenceLineage:[
      'canonicalDataRef',
      'contentFingerprint',
      'originGroupId',
      'verificationState',
      'observedAt',
      'ingestedAt',
    ],
  };
};
