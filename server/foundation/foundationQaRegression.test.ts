import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_DATA_CONTRACT_VERSION,
  assessPointInTime,
  projectLegacyCanonicalEventTemporal,
  selectRevisionAsOf,
  type CanonicalDataEnvelope,
} from './canonicalData';
import {
  buildImpactPathsAsOf,
  createGraphEdge,
  type CanonicalGraphEdge,
} from './marketAssetGraph';
import {
  createSharedEvaluation,
  type EvaluationInput,
} from './sharedEvaluation';
import {
  projectBorAlphaReadModel,
  projectNarsEvidencePackageV1,
} from './legacyFoundationAdapters';
import { createDecisionRunIdentity } from './decisionRunVersionRegistry';

const t={
  eventTime:'2026-09-24T09:00:00Z',
  observedAt:'2026-09-24T09:00:01Z',
  ingestedAt:'2026-09-24T09:00:02Z',
};

const evaluationBase=():EvaluationInput=>({
  subjectType:'STRATEGY',
  subjectId:'s1',
  subjectVersionId:'v1',
  mode:'HISTORICAL',
  evaluatedAt:'2026-09-24T12:00:00Z',
  window:{startAt:'2026-09-24T09:01:00Z',endAt:'2026-09-24T11:00:00Z'},
  pointInTimeComplete:true,
  pointInTimeInputs:[{
    canonicalData:{
      contractVersion:CANONICAL_DATA_CONTRACT_VERSION,
      source:'qa',
      revision:{logicalRecordId:'qa:eligible',revisionId:'r1'},
      temporal:t,
      payload:{},
    },
    asOf:'2026-09-24T09:01:00Z',
    canonicalDataRef:{logicalRecordId:'qa:eligible',revisionId:'r1'},
  }],
  dataSnapshotIds:['snapshot-1'],
  decisionRunIds:['bo-run-1'],
  metrics:[{metricId:'RETURN',value:-1,sampleCount:0,unit:'RATIO'}],
  criteria:[],
  costModel:{feeBps:0,slippageBps:0},
});

test('QA F-02 counterexample: temporal inversion remains legacy incomplete',()=>{
  const projection=projectLegacyCanonicalEventTemporal({
    eventKey:'event-1',
    occurredAt:t.eventTime,
    recordedAt:'2026-09-24T09:00:02Z',
    trace:{observedAt:'2026-09-24T10:00:00Z',revisionId:'r1'},
  });

  assert.equal(projection.status,'LEGACY_INCOMPLETE');
  assert.deepEqual(projection.invalid,['TEMPORAL_ORDER_INVALID']);

  const canonical=assessPointInTime({
    contractVersion:CANONICAL_DATA_CONTRACT_VERSION,
    source:'legacy',
    revision:{logicalRecordId:'event-1',revisionId:'r1'},
    temporal:{
      eventTime:t.eventTime,
      observedAt:'2026-09-24T10:00:00Z',
      ingestedAt:'2026-09-24T09:00:02Z',
    },
    payload:{},
  },'2026-09-24T11:00:00Z');
  assert.equal(canonical.reason,'TEMPORAL_ORDER_INVALID');
});

test('QA F-02 counterexample: missing legacy logical identity is explicit',()=>{
  const projection=projectLegacyCanonicalEventTemporal({
    occurredAt:t.eventTime,
    recordedAt:t.ingestedAt,
    trace:{observedAt:t.observedAt,revisionId:'r1'},
  });

  assert.equal(projection.status,'LEGACY_INCOMPLETE');
  assert.equal(projection.logicalRecordId,null);
  assert.ok(projection.missing.includes('logicalRecordId'));
});

test('QA F-03 counterexample: explicit supersession wins at the same timestamp',()=>{
  const edgeBase={
    source:'research',
    ...t,
    from:{entityType:'COMPANY' as const,entityId:'A'},
    to:{entityType:'ASSET' as const,entityId:'A-STOCK'},
    relationType:'ISSUER_OF' as const,
    direction:'DIRECTED' as const,
    sourceDataIds:['issuer-r1'],
  };
  const active=createGraphEdge({...edgeBase,revisionId:'r9',state:'ACTIVE'});
  const revoked=createGraphEdge({
    ...edgeBase,
    revisionId:'r10',
    supersedesRevisionId:'r9',
    state:'REVOKED',
  });
  const cutoff='2026-09-24T09:01:00Z';

  assert.equal(
    selectRevisionAsOf([active,revoked],active.revision.logicalRecordId,cutoff)?.revision.revisionId,
    'r10',
  );
  assert.equal(
    buildImpactPathsAsOf([active,revoked],edgeBase.from,cutoff).length,
    0,
  );
});

test('QA F-03 counterexample: conflicting duplicate revision identity fails closed regardless of order',()=>{
  const active=createGraphEdge({
    source:'research',
    revisionId:'r9',
    ...t,
    from:{entityType:'COMPANY',entityId:'A'},
    to:{entityType:'ASSET',entityId:'A-STOCK'},
    relationType:'ISSUER_OF',
    direction:'DIRECTED',
    state:'ACTIVE',
    sourceDataIds:['issuer-r1'],
  });
  const conflict:CanonicalGraphEdge={
    ...active,
    payload:{...active.payload,state:'REVOKED'},
  };
  const cutoff='2026-09-24T09:01:00Z';

  assert.throws(
    ()=>selectRevisionAsOf([active,conflict],active.revision.logicalRecordId,cutoff),
    /conflicting Canonical revision identity/,
  );
  assert.throws(
    ()=>selectRevisionAsOf([conflict,active],active.revision.logicalRecordId,cutoff),
    /conflicting Canonical revision identity/,
  );
});

test('QA F-04 counterexample: empty required criteria cannot produce PASS',()=>{
  const evaluation=createSharedEvaluation(evaluationBase());
  assert.equal(evaluation.validationVerdict,'INSUFFICIENT_DATA');
});

test('QA F-04 counterexample: optional-only criteria cannot produce overall PASS',()=>{
  const evaluation=createSharedEvaluation({
    ...evaluationBase(),
    criteria:[{
      criterionId:'optional-return',
      metricId:'RETURN',
      operator:'GTE',
      threshold:0,
      minSamples:0,
      required:false,
    }],
  });
  assert.equal(evaluation.criteria[0]?.status,'FAIL');
  assert.equal(evaluation.validationVerdict,'INSUFFICIENT_DATA');
});

test('QA F-05 counterexample: NARS preserves source/hash/publication bindings including shared hashes and missing values',()=>{
  const pkg={
    schema_version:'nars.evidence.v1' as const,
    event_id:'evt1',
    sources:[
      {source_id:'A',content_hash:'hash-a',published_at:t.eventTime},
      {source_id:'B',content_hash:'hash-b',published_at:t.observedAt},
      {source_id:'C',content_hash:'shared-hash',published_at:null},
      {source_id:'D',content_hash:'shared-hash'},
      {source_id:null,content_hash:null,published_at:null},
    ],
  };
  const swapped={
    ...pkg,
    sources:pkg.sources.map((source,index)=>
      index<2
        ?{...source,content_hash:pkg.sources[1-index]!.content_hash}
        :source),
  };

  const original=projectNarsEvidencePackageV1(pkg);
  const changed=projectNarsEvidencePackageV1(swapped);

  assert.notDeepEqual(original,changed);
  assert.ok(original.sourceBindings.some(binding=>
    binding.sourceId==='C'&&binding.contentHash==='shared-hash'&&binding.sourcePublishedAt===null));
  assert.ok(original.sourceBindings.some(binding=>
    binding.sourceId==='D'&&binding.contentHash==='shared-hash'&&binding.sourcePublishedAt===null));
  assert.ok(original.sourceBindings.some(binding=>
    binding.sourceId===null&&binding.contentHash===null&&binding.sourcePublishedAt===null));
  assert.equal(original.executionAuthority,false);
});

test('QA F-06 counterexample: BOR validates and preserves the supported schema version',()=>{
  assert.throws(()=>projectBorAlphaReadModel({
    schemaVersion:'unrelated.v999',
    projectionId:'p',
    reportId:'r',
    seriesId:'s',
    reportVersion:1,
    asOf:'2026-09-24T09:01:00Z',
    contentFingerprint:'h',
    citationEvidenceIds:[],
  }),/unsupported BOR read model schemaVersion/);

  const supported=projectBorAlphaReadModel({
    schemaVersion:'bor.alpha-read-model.v1',
    projectionId:'p',
    reportId:'r',
    seriesId:'s',
    reportVersion:1,
    asOf:'2026-09-24T09:01:00Z',
    contentFingerprint:'h',
    citationEvidenceIds:['EV-2','EV-1'],
  });
  assert.equal(supported.schemaVersion,'bor.alpha-read-model.v1');
  assert.deepEqual(supported.evidenceIds,['EV-1','EV-2']);
  assert.equal(supported.executionAuthority,false);
});

test('QA F-01 counterexample: Evaluation verifies canonical PIT input, revision binding, cutoff, and authority boundary',()=>{
  const cutoff='2026-09-24T09:01:00Z';
  const scheduled:CanonicalDataEnvelope={
    contractVersion:CANONICAL_DATA_CONTRACT_VERSION,
    source:'nars-ingress',
    revision:{logicalRecordId:'calendar:event-1',revisionId:'r1'},
    temporal:{
      eventTime:'2026-10-01T00:00:00Z',
      observedAt:'2026-09-24T09:00:00Z',
      ingestedAt:'2026-09-24T09:00:02Z',
    },
    payload:{},
  };
  const run=createDecisionRunIdentity({
    runtimeId:'paper',
    market:'KRW-BTC',
    asOf:cutoff,
    decisionKey:'d1',
    componentVersions:[{
      componentType:'STRATEGY',
      componentId:'s1',
      versionId:'v1',
      contentFingerprint:'h',
    }],
    dataSnapshotIds:['snapshot-scheduled'],
    evidenceIds:['ev-1'],
  });
  const validInput:EvaluationInput={
    ...evaluationBase(),
    dataSnapshotIds:run.dataSnapshotIds,
    decisionRunIds:[run.decisionRunId],
    metrics:[{metricId:'RETURN',value:1,sampleCount:10,unit:'RATIO'}],
    criteria:[{
      criterionId:'required-return',
      metricId:'RETURN',
      operator:'GTE',
      threshold:0,
      minSamples:1,
      required:true,
    }],
    pointInTimeInputs:[{
      canonicalData:scheduled,
      asOf:run.asOf,
      canonicalDataRef:scheduled.revision,
    }],
  };

  const valid=createSharedEvaluation(validInput);
  assert.equal(valid.validationVerdict,'PASS');
  assert.equal(valid.executionAuthority,false);
  assert.equal(valid.liveAuthority,false);
  assert.equal(valid.productionActivationAuthority,false);
  assert.equal(valid.promotionAuthority,false);

  const futureObserved:CanonicalDataEnvelope={
    ...scheduled,
    revision:{logicalRecordId:'article:future-observed',revisionId:'r1'},
    temporal:{
      ...scheduled.temporal,
      observedAt:'2026-09-24T10:00:00Z',
      ingestedAt:'2026-09-24T10:00:02Z',
    },
  };
  assert.throws(()=>createSharedEvaluation({
    ...validInput,
    pointInTimeInputs:[{
      canonicalData:futureObserved,
      asOf:run.asOf,
      canonicalDataRef:futureObserved.revision,
    }],
  }),/OBSERVED_AFTER_AS_OF/);

  const futureIngested:CanonicalDataEnvelope={
    ...scheduled,
    revision:{logicalRecordId:'article:future-ingested',revisionId:'r1'},
    temporal:{
      ...scheduled.temporal,
      observedAt:'2026-09-24T09:00:00Z',
      ingestedAt:'2026-09-24T10:00:00Z',
    },
  };
  assert.throws(()=>createSharedEvaluation({
    ...validInput,
    pointInTimeInputs:[{
      canonicalData:futureIngested,
      asOf:run.asOf,
      canonicalDataRef:futureIngested.revision,
    }],
  }),/INGESTED_AFTER_AS_OF/);

  assert.throws(()=>createSharedEvaluation({
    ...validInput,
    pointInTimeInputs:[{
      canonicalData:scheduled,
      asOf:run.asOf,
      canonicalDataRef:{logicalRecordId:scheduled.revision.logicalRecordId,revisionId:'r2'},
    }],
  }),/revision mismatch/);
});
