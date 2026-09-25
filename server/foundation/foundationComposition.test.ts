import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_DATA_CONTRACT_VERSION,
  assessPointInTime,
  type CanonicalDataEnvelope,
} from './canonicalData';
import {
  EVIDENCE_LINEAGE_CONTRACT_VERSION,
  createMaterialChangeEvent,
  validateEvidenceArtifact,
} from './eventEvidenceLineage';
import {
  createDecisionRunIdentity,
  fingerprintCanonicalValue,
} from './decisionRunVersionRegistry';
import {
  buildImpactPathsAsOf,
  createGraphEdge,
} from './marketAssetGraph';
import { createSharedEvaluation } from './sharedEvaluation';

test('Frozen v1 Foundation contracts compose without granting execution authority',()=>{
  const data:CanonicalDataEnvelope<{headline:string}>={
    contractVersion:CANONICAL_DATA_CONTRACT_VERSION,
    source:'nars-ingress',
    revision:{logicalRecordId:'nars:evt-1',revisionId:'rev-1'},
    temporal:{
      eventTime:'2026-09-24T09:00:00Z',
      sourcePublishedAt:'2026-09-24T09:00:00Z',
      observedAt:'2026-09-24T09:00:03Z',
      ingestedAt:'2026-09-24T09:00:05Z',
    },
    payload:{headline:'Oil supply disruption'},
  };
  assert.equal(assessPointInTime(data,'2026-09-24T09:01:00Z').eligible,true);

  const evidence=validateEvidenceArtifact({
    contractVersion:EVIDENCE_LINEAGE_CONTRACT_VERSION,
    evidenceId:'EV-FOUNDATION-1',
    sourceId:'official-source',
    canonicalDataRef:{
      logicalRecordId:data.revision.logicalRecordId,
      revisionId:data.revision.revisionId,
    },
    contentFingerprint:fingerprintCanonicalValue(data.payload),
    originGroupId:'origin-official-source',
    verificationState:'CONTENT_VERIFIED',
    contradictionState:'NONE',
    observedAt:data.temporal.observedAt,
    ingestedAt:data.temporal.ingestedAt,
    affectedEntities:[
      {entityType:'EVENT',entityId:'OIL-SUPPLY-DISRUPTION'},
      {entityType:'COMMODITY',entityId:'OIL'},
    ],
  });

  const trigger=createMaterialChangeEvent({
    source:'evidence-store',
    sourceRecordId:evidence.evidenceId,
    sourceRevisionId:data.revision.revisionId,
    changeKind:'CREATED',
    materiality:'MATERIAL',
    observedAt:evidence.observedAt,
    emittedAt:'2026-09-24T09:00:06Z',
    affectedEntities:evidence.affectedEntities,
    recomputeTargets:['RESEARCH','FORECAST','STRATEGY','REPORT','ASSET_GRAPH'],
    reasonCodes:['NEW_VERIFIED_EVIDENCE'],
  });
  assert.equal(trigger.executionAuthority,false);

  const edge=createGraphEdge({
    source:'research',
    revisionId:'edge-r1',
    eventTime:data.temporal.eventTime,
    observedAt:data.temporal.observedAt,
    ingestedAt:data.temporal.ingestedAt,
    from:{entityType:'EVENT',entityId:'OIL-SUPPLY-DISRUPTION'},
    to:{entityType:'COMMODITY',entityId:'OIL'},
    relationType:'AFFECTS',
    direction:'DIRECTED',
    state:'ACTIVE',
    evidenceIds:[evidence.evidenceId],
  });
  assert.equal(
    buildImpactPathsAsOf([edge],{entityType:'EVENT',entityId:'OIL-SUPPLY-DISRUPTION'},'2026-09-24T09:01:00Z').length,
    1,
  );

  const dataSnapshotId=`snapshot-${fingerprintCanonicalValue(data).slice(0,16)}`;
  const run=createDecisionRunIdentity({
    runtimeId:'paper-vnext',
    market:'KRW-BTC',
    asOf:'2026-09-24T09:01:00Z',
    decisionKey:'decision-1',
    componentVersions:[
      {
        componentType:'STRATEGY',
        componentId:'router',
        versionId:'strategy-v1',
        contentFingerprint:'sha256:strategy-v1',
      },
      {
        componentType:'RISK',
        componentId:'hard-risk',
        versionId:'risk-v1',
        contentFingerprint:'sha256:risk-v1',
      },
    ],
    dataSnapshotIds:[dataSnapshotId],
    evidenceIds:[evidence.evidenceId],
  });

  const evaluation=createSharedEvaluation({
    subjectType:'STRATEGY',
    subjectId:'router',
    subjectVersionId:'strategy-v1',
    mode:'PAPER',
    evaluatedAt:'2026-09-24T10:00:00Z',
    window:{startAt:'2026-09-24T09:01:00Z',endAt:'2026-09-24T09:59:00Z'},
    pointInTimeComplete:true,
    pointInTimeInputs:[{
      canonicalData:data,
      asOf:run.asOf,
      canonicalDataRef:evidence.canonicalDataRef,
    }],
    dataSnapshotIds:[dataSnapshotId],
    decisionRunIds:[run.decisionRunId],
    metrics:[{metricId:'OBSERVED_RETURN',value:0.01,sampleCount:1,unit:'RATIO'}],
    criteria:[],
    costModel:{feeBps:0,slippageBps:0},
  });

  assert.equal(evaluation.executionAuthority,false);
  assert.equal(evaluation.liveAuthority,false);
  assert.equal(evaluation.productionActivationAuthority,false);
  assert.equal(evaluation.promotionAuthority,false);
});
