import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalEventRow } from '../eventLedger';
import {
  assessLegacyCanonicalEvent,
  projectBorAlphaReadModel,
  projectNarsEvidencePackageV1,
  summarizeLegacyFoundationCoverage,
} from './legacyFoundationAdapters';

const event=(overrides:Partial<CanonicalEventRow>={}):CanonicalEventRow=>({
  id:'row-1',
  eventKey:'legacy-event-1',
  occurredAt:Date.parse('2026-09-24T09:00:00Z'),
  recordedAt:Date.parse('2026-09-24T09:00:05Z'),
  runtimeId:'paper-vnext',
  eventType:'EVIDENCE',
  eventName:'EVIDENCE_LINKED',
  market:'KRW-BTC',
  strategyId:null,
  strategyVersion:'strategy-v1',
  action:null,
  summary:'legacy',
  reason:null,
  severity:'INFO',
  authority:'evidence_only',
  executionAuthority:false,
  source:'paper_runtime',
  trace:{traceId:'paper-vnext:KRW-BTC:1'},
  links:{decisionId:'paper-vnext:KRW-BTC:1:decision',evidenceIds:['EV-2','EV-1']},
  schemaVersion:1,
  ...overrides,
});

test('legacy BOT event keeps lineage but is not silently upgraded to Frozen v1',()=>{
  const assessed=assessLegacyCanonicalEvent(event());
  assert.equal(assessed.frozenV1Status,'LEGACY_REFERENCE_ONLY');
  assert.equal(assessed.temporal.status,'LEGACY_INCOMPLETE');
  assert.equal(assessed.decisionRun?.status,'LEGACY_TRACE_ONLY');
  assert.equal(assessed.decisionRun?.decisionRunId,null);
  assert.deepEqual(assessed.evidence?.evidenceIds,['EV-1','EV-2']);
});

test('coverage report never claims canonical Decision Runs were created from legacy history',()=>{
  const completeTemporal=event({
    id:'row-2',
    eventKey:'newer-event',
    trace:{
      traceId:'trace-2',
      observedAt:'2026-09-24T09:00:01Z',
      revisionId:'rev-2',
    },
  });
  const coverage=summarizeLegacyFoundationCoverage([event(),completeTemporal]);
  assert.equal(coverage.totalEvents,2);
  assert.equal(coverage.pointInTimeMetadataPresent,1);
  assert.equal(coverage.temporalIncomplete,1);
  assert.equal(coverage.canonicalDecisionRunsCreated,0);
});

test('NARS v1 preserves provenance fields but explicitly requires PIT ingress metadata',()=>{
  const projected=projectNarsEvidencePackageV1({
    schema_version:'nars.evidence.v1',
    event_id:'evt_123',
    published_at:'2026-09-24T08:00:00Z',
    last_updated_at:'2026-09-24T08:05:00Z',
    sources:[
      {source_id:'wire-1',url:'https://example.com/1',published_at:'2026-09-24T08:00:00Z',content_hash:'hash-1'},
      {source_id:'publisher-2',url:'https://example.com/2',published_at:'2026-09-24T08:01:00Z',content_hash:'hash-2'},
    ],
    provenance:{run_id:'nars-run-1',ranking_config_version:'v1'},
  });

  assert.equal(projected.status,'FOUNDATION_INGRESS_REQUIRED');
  assert.equal(projected.executionAuthority,false);
  assert.deepEqual(projected.sourceIds,['publisher-2','wire-1']);
  assert.ok(projected.missingForPitEvidence.includes('observedAt'));
  assert.ok(projected.missingForPitEvidence.includes('originGroupId'));
});

test('BOR read model remains reusable as a no-authority report artifact',()=>{
  const projected=projectBorAlphaReadModel({
    schemaVersion:'bor.alpha-read-model.v1',
    projectionId:'projection-1',
    reportId:'report-1',
    seriesId:'series-1',
    reportVersion:3,
    asOf:'2026-09-24T08:00:00Z',
    contentFingerprint:'abc123',
    citationEvidenceIds:['EV-2','EV-1'],
    executionAuthority:false,
    reportPublicationAuthority:false,
    botDependency:false,
  });

  assert.equal(projected.status,'LEGACY_REPORT_ARTIFACT_REUSABLE');
  assert.equal(projected.executionAuthority,false);
  assert.deepEqual(projected.evidenceIds,['EV-1','EV-2']);
  assert.ok(projected.missingForFrozenV1Trace.includes('decisionRunIds'));
});

test('BOR artifact carrying authority fails closed at the Foundation boundary',()=>{
  assert.throws(()=>projectBorAlphaReadModel({
    schemaVersion:'bor.alpha-read-model.v1',
    projectionId:'projection-1',
    reportId:'report-1',
    seriesId:'series-1',
    reportVersion:1,
    asOf:'2026-09-24T08:00:00Z',
    contentFingerprint:'abc123',
    citationEvidenceIds:[],
    executionAuthority:true,
    reportPublicationAuthority:false,
  }),/cannot cross Foundation boundary with authority/);
});
