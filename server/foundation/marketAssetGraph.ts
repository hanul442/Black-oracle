import {
  CANONICAL_DATA_CONTRACT_VERSION,
  selectRevisionAsOf,
  type CanonicalDataEnvelope,
} from './canonicalData';
import type { EntityRef } from './eventEvidenceLineage';
import { fingerprintCanonicalValue } from './decisionRunVersionRegistry';

export const MARKET_ASSET_GRAPH_CONTRACT_VERSION='bo.market-asset-graph.v1' as const;

export type GraphRelationType=
  | 'ISSUER_OF'
  | 'BELONGS_TO_SECTOR'
  | 'OPERATES_IN'
  | 'SUPPLIES'
  | 'CUSTOMER_OF'
  | 'COMPETES_WITH'
  | 'EXPOSED_TO'
  | 'USES_TECHNOLOGY'
  | 'PRODUCES'
  | 'CONSUMES'
  | 'AFFECTS'
  | 'ASSOCIATED_WITH';

export type GraphEdgeDirection='DIRECTED'|'UNDIRECTED';
export type GraphEdgeState='ACTIVE'|'CONTESTED'|'REVOKED';

export interface GraphEdgePayload {
  graphContractVersion:typeof MARKET_ASSET_GRAPH_CONTRACT_VERSION;
  from:EntityRef;
  to:EntityRef;
  relationType:GraphRelationType;
  direction:GraphEdgeDirection;
  state:GraphEdgeState;
  evidenceIds:string[];
  sourceDataIds:string[];
}

export type CanonicalGraphEdge=CanonicalDataEnvelope<GraphEdgePayload>;

export interface GraphEdgeInput {
  source:string;
  revisionId:string;
  supersedesRevisionId?:string|null;
  eventTime:string;
  observedAt:string;
  ingestedAt:string;
  sourcePublishedAt?:string|null;
  from:EntityRef;
  to:EntityRef;
  relationType:GraphRelationType;
  direction:GraphEdgeDirection;
  state:GraphEdgeState;
  evidenceIds?:readonly string[];
  sourceDataIds?:readonly string[];
}

export interface ImpactPath {
  depth:number;
  nodes:EntityRef[];
  edges:Array<{
    logicalEdgeId:string;
    revisionId:string;
    relationType:GraphRelationType;
    state:Exclude<GraphEdgeState,'REVOKED'>;
    evidenceIds:string[];
    sourceDataIds:string[];
  }>;
}

const nonEmpty=(value:unknown):value is string =>
  typeof value==='string'&&value.trim().length>0;

const normalizeEntity=(entity:EntityRef):EntityRef=>{
  if(!nonEmpty(entity.entityId)) throw new Error('graph entity requires entityId');
  return {entityType:entity.entityType,entityId:entity.entityId.trim().toUpperCase()};
};

const entityKey=(entity:EntityRef)=>`${entity.entityType}:${entity.entityId}`;

const uniqueStrings=(values:readonly string[]):string[] =>
  Array.from(new Set(values.map(value=>String(value).trim()).filter(Boolean))).sort();

const edgeLogicalIdentity=(
  from:EntityRef,
  relationType:GraphRelationType,
  to:EntityRef,
  direction:GraphEdgeDirection,
)=>{
  const left=entityKey(from);
  const right=entityKey(to);
  if(direction==='UNDIRECTED'&&right<left){
    return `${right}|${relationType}|${left}|UNDIRECTED`;
  }
  return `${left}|${relationType}|${right}|${direction}`;
};

export const createGraphEdge=(input:GraphEdgeInput):CanonicalGraphEdge=>{
  if(!nonEmpty(input.source)) throw new Error('graph edge requires source');
  if(!nonEmpty(input.revisionId)) throw new Error('graph edge requires revisionId');

  const from=normalizeEntity(input.from);
  const to=normalizeEntity(input.to);
  if(entityKey(from)===entityKey(to)) throw new Error('graph edge cannot self-link');

  const evidenceIds=uniqueStrings(input.evidenceIds??[]);
  const sourceDataIds=uniqueStrings(input.sourceDataIds??[]);
  if(!evidenceIds.length&&!sourceDataIds.length){
    throw new Error('graph edge requires Evidence or canonical source-data lineage');
  }

  const logicalIdentity=edgeLogicalIdentity(from,input.relationType,to,input.direction);
  const logicalRecordId=`graph-edge-v1-${fingerprintCanonicalValue(logicalIdentity).slice(0,32)}`;

  return {
    contractVersion:CANONICAL_DATA_CONTRACT_VERSION,
    source:input.source.trim(),
    revision:{
      logicalRecordId,
      revisionId:input.revisionId.trim(),
      supersedesRevisionId:input.supersedesRevisionId?.trim()||null,
    },
    temporal:{
      eventTime:input.eventTime,
      observedAt:input.observedAt,
      ingestedAt:input.ingestedAt,
      sourcePublishedAt:input.sourcePublishedAt??null,
    },
    payload:{
      graphContractVersion:MARKET_ASSET_GRAPH_CONTRACT_VERSION,
      from,
      to,
      relationType:input.relationType,
      direction:input.direction,
      state:input.state,
      evidenceIds,
      sourceDataIds,
    },
  };
};

export const selectGraphEdgesAsOf=(
  revisions:readonly CanonicalGraphEdge[],
  asOf:string,
):CanonicalGraphEdge[]=>{
  const ids=Array.from(new Set(revisions.map(edge=>edge.revision.logicalRecordId))).sort();
  const selected:CanonicalGraphEdge[]=[];
  for(const logicalRecordId of ids){
    const revision=selectRevisionAsOf(revisions,logicalRecordId,asOf);
    if(revision) selected.push(revision);
  }
  return selected.sort((a,b)=>
    a.revision.logicalRecordId.localeCompare(b.revision.logicalRecordId));
};

const traversalTargets=(
  edge:CanonicalGraphEdge,
  current:EntityRef,
):EntityRef[]=>{
  const currentKey=entityKey(current);
  const fromKey=entityKey(edge.payload.from);
  const toKey=entityKey(edge.payload.to);

  if(edge.payload.direction==='DIRECTED'){
    return currentKey===fromKey?[edge.payload.to]:[];
  }
  if(currentKey===fromKey) return [edge.payload.to];
  if(currentKey===toKey) return [edge.payload.from];
  return [];
};

export const buildImpactPathsAsOf=(
  revisions:readonly CanonicalGraphEdge[],
  start:EntityRef,
  asOf:string,
  maxDepth=3,
):ImpactPath[]=>{
  if(!Number.isInteger(maxDepth)||maxDepth<1||maxDepth>8){
    throw new Error('graph maxDepth must be an integer between 1 and 8');
  }

  const edges=selectGraphEdgesAsOf(revisions,asOf)
    .filter(edge=>edge.payload.state!=='REVOKED');
  const normalizedStart=normalizeEntity(start);
  const results:ImpactPath[]=[];
  const queue:Array<{node:EntityRef;nodes:EntityRef[];edges:ImpactPath['edges'];visited:Set<string>}>= [{
    node:normalizedStart,
    nodes:[normalizedStart],
    edges:[],
    visited:new Set([entityKey(normalizedStart)]),
  }];

  while(queue.length){
    const current=queue.shift()!;
    if(current.edges.length>=maxDepth) continue;

    for(const edge of edges){
      for(const next of traversalTargets(edge,current.node)){
        const nextKey=entityKey(next);
        if(current.visited.has(nextKey)) continue;

        const edgeRef:ImpactPath['edges'][number]={
          logicalEdgeId:edge.revision.logicalRecordId,
          revisionId:edge.revision.revisionId,
          relationType:edge.payload.relationType,
          state:edge.payload.state as Exclude<GraphEdgeState,'REVOKED'>,
          evidenceIds:edge.payload.evidenceIds,
          sourceDataIds:edge.payload.sourceDataIds,
        };
        const nodes=[...current.nodes,next];
        const pathEdges=[...current.edges,edgeRef];
        results.push({depth:pathEdges.length,nodes,edges:pathEdges});

        const visited=new Set(current.visited);
        visited.add(nextKey);
        queue.push({node:next,nodes,edges:pathEdges,visited});
      }
    }
  }

  return results.sort((a,b)=>{
    if(a.depth!==b.depth) return a.depth-b.depth;
    const aKey=a.nodes.map(entityKey).join('>');
    const bKey=b.nodes.map(entityKey).join('>');
    return aKey.localeCompare(bKey);
  });
};
