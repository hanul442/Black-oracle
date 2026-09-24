import type { CanonicalEventRow } from '../eventLedger';
import {
  projectLegacyCanonicalEventTemporal,
  type LegacyTemporalProjection,
} from './canonicalData';
import {
  projectLegacyDecisionTrace,
  type LegacyDecisionRunProjection,
} from './decisionRunVersionRegistry';
import {
  projectLegacyEvidenceEvent,
  type LegacyEvidenceProjection,
} from './eventEvidenceLineage';

export const LEGACY_FOUNDATION_ADAPTER_VERSION='bo.legacy-foundation-adapter.v1' as const;

export interface LegacyCanonicalEventAssessment {
  adapterVersion:typeof LEGACY_FOUNDATION_ADAPTER_VERSION;
  eventKey:string;
  eventType:CanonicalEventRow['eventType'];
  temporal:LegacyTemporalProjection;
  decisionRun:LegacyDecisionRunProjection|null;
  evidence:LegacyEvidenceProjection|null;
  frozenV1Status:'LEGACY_REFERENCE_ONLY'|'PIT_METADATA_PRESENT';
}

export interface LegacyFoundationCoverage {
  adapterVersion:typeof LEGACY_FOUNDATION_ADAPTER_VERSION;
  totalEvents:number;
  pointInTimeMetadataPresent:number;
  temporalIncomplete:number;
  eventsWithLegacyDecisionTrace:number;
  eventsWithEvidenceReferences:number;
  canonicalDecisionRunsCreated:0;
}

export interface NarsEvidencePackageV1Like {
  schema_version:'nars.evidence.v1';
  event_id:string;
  event_title?:string;
  summary?:string;
  published_at?:string|null;
  last_updated_at?:string|null;
  entities?:unknown[];
  topics?:unknown[];
  sources?:Array<{
    source_id?:string|null;
    url?:string|null;
    published_at?:string|null;
    content_hash?:string|null;
  }>;
  provenance?:{
    run_id?:string|null;
    ranking_config_version?:string|null;
  };
}

export interface NarsFoundationProjection {
  status:'FOUNDATION_INGRESS_REQUIRED';
  eventId:string;
  sourceIds:string[];
  contentHashes:string[];
  sourcePublishedAt:string[];
  narsRunId:string|null;
  rankingConfigVersion:string|null;
  preservedFields:{
    originalEventId:true;
    sourceIdentity:true;
    sourceHashes:true;
    rankingMetadataIsNotTradeConviction:true;
  };
  missingForPitEvidence:Array<
    | 'observedAt'
    | 'ingestedAt'
    | 'canonicalRevisionId'
    | 'originGroupId'
  >;
  executionAuthority:false;
}

export interface BorAlphaReadModelLike {
  schemaVersion:string;
  projectionId:string;
  reportId:string;
  seriesId:string;
  reportVersion:number;
  asOf:string;
  contentFingerprint:string;
  citationEvidenceIds:readonly string[];
  executionAuthority?:boolean;
  reportPublicationAuthority?:boolean;
  botDependency?:boolean;
}

export interface BorFoundationProjection {
  status:'LEGACY_REPORT_ARTIFACT_REUSABLE';
  reportId:string;
  seriesId:string;
  reportVersion:number;
  projectionId:string;
  asOf:string;
  contentFingerprint:string;
  evidenceIds:string[];
  missingForFrozenV1Trace:Array<
    | 'decisionRunIds'
    | 'canonicalDataSnapshotIds'
    | 'versionRegistryRef'
  >;
  executionAuthority:false;
  reportPublicationAuthority:false;
}

const nonEmpty=(value:unknown):value is string =>
  typeof value==='string'&&value.trim().length>0;

const unique=(values:readonly string[]):string[] =>
  Array.from(new Set(values.map(value=>String(value).trim()).filter(Boolean))).sort();

const traceIdOf=(event:CanonicalEventRow)=>
  nonEmpty(event.trace?.traceId)?event.trace.traceId.trim():null;

const decisionIdOf=(event:CanonicalEventRow)=>
  nonEmpty(event.links?.decisionId)?event.links.decisionId.trim():null;

const evidenceIdsOf=(event:CanonicalEventRow)=>
  Array.isArray(event.links?.evidenceIds)
    ? unique(event.links.evidenceIds.map(String))
    : [];

export const assessLegacyCanonicalEvent=(
  event:CanonicalEventRow,
):LegacyCanonicalEventAssessment=>{
  const temporal=projectLegacyCanonicalEventTemporal(event);
  const traceId=traceIdOf(event);
  const decisionId=decisionIdOf(event);
  const evidenceIds=evidenceIdsOf(event);

  const decisionRun=traceId||decisionId
    ?projectLegacyDecisionTrace({
        runtimeId:event.runtimeId,
        market:event.market,
        occurredAt:event.occurredAt,
        traceId,
        decisionId,
        strategyVersion:event.strategyVersion,
        evidenceIds,
      })
    :null;

  const evidence=(event.eventType==='EVIDENCE'||evidenceIds.length)
    ?projectLegacyEvidenceEvent({
        eventType:event.eventType,
        eventKey:event.eventKey,
        links:event.links,
      })
    :null;

  return {
    adapterVersion:LEGACY_FOUNDATION_ADAPTER_VERSION,
    eventKey:event.eventKey,
    eventType:event.eventType,
    temporal,
    decisionRun,
    evidence,
    frozenV1Status:temporal.status==='POINT_IN_TIME_COMPLETE'
      ?'PIT_METADATA_PRESENT'
      :'LEGACY_REFERENCE_ONLY',
  };
};

export const summarizeLegacyFoundationCoverage=(
  events:readonly CanonicalEventRow[],
):LegacyFoundationCoverage=>{
  const assessments=events.map(assessLegacyCanonicalEvent);
  return {
    adapterVersion:LEGACY_FOUNDATION_ADAPTER_VERSION,
    totalEvents:assessments.length,
    pointInTimeMetadataPresent:assessments.filter(item=>item.temporal.status==='POINT_IN_TIME_COMPLETE').length,
    temporalIncomplete:assessments.filter(item=>item.temporal.status==='LEGACY_INCOMPLETE').length,
    eventsWithLegacyDecisionTrace:assessments.filter(item=>item.decisionRun!==null).length,
    eventsWithEvidenceReferences:assessments.filter(item=>item.evidence!==null&&item.evidence.evidenceIds.length>0).length,
    canonicalDecisionRunsCreated:0,
  };
};

export const projectNarsEvidencePackageV1=(
  pkg:NarsEvidencePackageV1Like,
):NarsFoundationProjection=>{
  if(pkg.schema_version!=='nars.evidence.v1') throw new Error('unsupported NARS Evidence Package');
  if(!nonEmpty(pkg.event_id)) throw new Error('NARS Evidence Package requires event_id');

  const sources=Array.isArray(pkg.sources)?pkg.sources:[];
  return {
    status:'FOUNDATION_INGRESS_REQUIRED',
    eventId:pkg.event_id.trim(),
    sourceIds:unique(sources.map(source=>source.source_id??'')),
    contentHashes:unique(sources.map(source=>source.content_hash??'')),
    sourcePublishedAt:unique(sources.map(source=>source.published_at??'')),
    narsRunId:nonEmpty(pkg.provenance?.run_id)?pkg.provenance!.run_id!.trim():null,
    rankingConfigVersion:nonEmpty(pkg.provenance?.ranking_config_version)
      ?pkg.provenance!.ranking_config_version!.trim()
      :null,
    preservedFields:{
      originalEventId:true,
      sourceIdentity:true,
      sourceHashes:true,
      rankingMetadataIsNotTradeConviction:true,
    },
    missingForPitEvidence:[
      'observedAt',
      'ingestedAt',
      'canonicalRevisionId',
      'originGroupId',
    ],
    executionAuthority:false,
  };
};

export const projectBorAlphaReadModel=(
  model:BorAlphaReadModelLike,
):BorFoundationProjection=>{
  if(!nonEmpty(model.reportId)||!nonEmpty(model.seriesId)||!nonEmpty(model.projectionId)){
    throw new Error('BOR read model requires canonical report identity');
  }
  if(!nonEmpty(model.contentFingerprint)) throw new Error('BOR read model requires contentFingerprint');
  if(!Number.isInteger(model.reportVersion)||model.reportVersion<1) throw new Error('BOR read model requires positive reportVersion');
  if(!Number.isFinite(Date.parse(model.asOf))) throw new Error('BOR read model requires valid asOf');
  if(model.executionAuthority||model.reportPublicationAuthority){
    throw new Error('BOR legacy artifact cannot cross Foundation boundary with authority');
  }

  return {
    status:'LEGACY_REPORT_ARTIFACT_REUSABLE',
    reportId:model.reportId.trim(),
    seriesId:model.seriesId.trim(),
    reportVersion:model.reportVersion,
    projectionId:model.projectionId.trim(),
    asOf:new Date(Date.parse(model.asOf)).toISOString(),
    contentFingerprint:model.contentFingerprint.trim(),
    evidenceIds:unique(model.citationEvidenceIds.map(String)),
    missingForFrozenV1Trace:[
      'decisionRunIds',
      'canonicalDataSnapshotIds',
      'versionRegistryRef',
    ],
    executionAuthority:false,
    reportPublicationAuthority:false,
  };
};
