import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_LINEAGE_CONTRACT_VERSION,
  buildEvidenceImpact,
  countIndependentEvidenceOrigins,
  createMaterialChangeEvent,
  projectLegacyEvidenceEvent,
  validateEvidenceArtifact,
  type EvidenceArtifact,
} from './eventEvidenceLineage';

test('material-change event identity is deterministic across target/entity ordering',()=>{
  const base={
    source:'nars',
    sourceRecordId:'event-1',
    sourceRevisionId:'rev-2',
    changeKind:'REVISED' as const,
    materiality:'MATERIAL' as const,
    observedAt:'2026-09-24T10:00:00Z',
    emittedAt:'2026-09-24T10:00:02Z',
    reasonCodes:['SOURCE_REVISION','MATERIAL_FACT_CHANGED'],
  };

  const a=createMaterialChangeEvent({
    ...base,
    affectedEntities:[
      {entityType:'ASSET',entityId:'krw-btc'},
      {entityType:'COUNTRY',entityId:'kr'},
    ],
    recomputeTargets:['FORECAST','RESEARCH','REPORT'],
  });
  const b=createMaterialChangeEvent({
    ...base,
    affectedEntities:[
      {entityType:'COUNTRY',entityId:'KR'},
      {entityType:'ASSET',entityId:'KRW-BTC'},
    ],
    recomputeTargets:['REPORT','FORECAST','RESEARCH'],
  });

  assert.equal(a.eventId,b.eventId);
  assert.equal(a.executionAuthority,false);
});

test('silent changes can refresh state but cannot request a user alert',()=>{
  assert.throws(()=>createMaterialChangeEvent({
    source:'forecast',
    sourceRecordId:'forecast-1',
    changeKind:'REVISED',
    materiality:'SILENT',
    observedAt:'2026-09-24T10:00:00Z',
    emittedAt:'2026-09-24T10:00:01Z',
    affectedEntities:[{entityType:'ASSET',entityId:'KRW-BTC'}],
    recomputeTargets:['WATCHLIST','ALERT'],
    reasonCodes:['TINY_FORECAST_CHANGE'],
  }),/silent material change cannot request ALERT/);
});

const evidence=(overrides:Partial<EvidenceArtifact>={}):EvidenceArtifact=>({
  contractVersion:EVIDENCE_LINEAGE_CONTRACT_VERSION,
  evidenceId:'EV-1',
  sourceId:'source-1',
  canonicalDataRef:{logicalRecordId:'article-1',revisionId:'rev-1'},
  contentFingerprint:'sha256:content-1',
  originGroupId:'origin-wire-1',
  canonicalPublisherId:'publisher-1',
  verificationState:'CONTENT_VERIFIED',
  contradictionState:'NONE',
  observedAt:'2026-09-24T09:00:00Z',
  ingestedAt:'2026-09-24T09:00:03Z',
  affectedEntities:[{entityType:'ASSET',entityId:'KRW-BTC'}],
  ...overrides,
});

test('revoked Evidence requires explicit invalidation time',()=>{
  assert.throws(()=>validateEvidenceArtifact(evidence({
    verificationState:'REVOKED',
  })),/requires invalidatedAt/);

  const revoked=validateEvidenceArtifact(evidence({
    verificationState:'REVOKED',
    invalidatedAt:'2026-09-24T10:00:00Z',
  }));
  assert.equal(revoked.verificationState,'REVOKED');
  assert.equal(revoked.invalidatedAt,'2026-09-24T10:00:00.000Z');
});

test('independent-source counting uses origin lineage rather than article count',()=>{
  const sameWireA=validateEvidenceArtifact(evidence({evidenceId:'EV-A',sourceId:'publisher-a'}));
  const sameWireB=validateEvidenceArtifact(evidence({evidenceId:'EV-B',sourceId:'publisher-b'}));
  const independent=validateEvidenceArtifact(evidence({
    evidenceId:'EV-C',
    sourceId:'official-c',
    originGroupId:'origin-official-c',
  }));

  assert.equal(countIndependentEvidenceOrigins([sameWireA,sameWireB,independent]),2);
});

test('Evidence invalidation impact identifies every dependent artifact class',()=>{
  const impact=buildEvidenceImpact(['EV-1'],[
    {evidenceId:'EV-1',dependentType:'RESEARCH',dependentId:'research-1',relation:'SUPPORTS',linkedAt:'2026-09-24T09:01:00Z'},
    {evidenceId:'EV-1',dependentType:'FORECAST',dependentId:'forecast-1',relation:'SUPPORTS',linkedAt:'2026-09-24T09:02:00Z'},
    {evidenceId:'EV-1',dependentType:'REPORT',dependentId:'report-1',relation:'CONTEXT',linkedAt:'2026-09-24T09:03:00Z'},
    {evidenceId:'EV-1',dependentType:'DECISION_RUN',dependentId:'bo-run-v1-abc',relation:'SUPPORTS',linkedAt:'2026-09-24T09:04:00Z'},
    {evidenceId:'EV-X',dependentType:'REPORT',dependentId:'unrelated',relation:'CONTEXT',linkedAt:'2026-09-24T09:03:00Z'},
  ]);

  assert.deepEqual(
    impact.map(item=>`${item.dependentType}:${item.dependentId}`).sort(),
    [
      'DECISION_RUN:bo-run-v1-abc',
      'FORECAST:forecast-1',
      'REPORT:report-1',
      'RESEARCH:research-1',
    ],
  );
});

test('legacy Evidence event keeps IDs without inventing provenance',()=>{
  const projected=projectLegacyEvidenceEvent({
    eventType:'EVIDENCE',
    eventKey:'legacy-evidence-event',
    links:{evidenceIds:['EV-2','EV-1','EV-1']},
  });

  assert.equal(projected.status,'LEGACY_REFERENCE_ONLY');
  assert.deepEqual(projected.evidenceIds,['EV-1','EV-2']);
  assert.ok(projected.missingForEvidenceLineage.includes('originGroupId'));
  assert.ok(projected.missingForEvidenceLineage.includes('verificationState'));
});
