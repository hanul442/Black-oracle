import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSharedEvaluation,
  evaluateCriteria,
  projectLegacyEvaluation,
  type EvaluationInput,
} from './sharedEvaluation';
import {
  CANONICAL_DATA_CONTRACT_VERSION,
  type CanonicalDataEnvelope,
} from './canonicalData';
import { createDecisionRunIdentity } from './decisionRunVersionRegistry';

const pointInTimeData=(logicalRecordId:string):CanonicalDataEnvelope=>({
  contractVersion:CANONICAL_DATA_CONTRACT_VERSION,
  source:'test-source',
  revision:{logicalRecordId,revisionId:'rev-1'},
  temporal:{
    eventTime:'2026-09-01T00:00:00Z',
    observedAt:'2026-09-01T00:00:01Z',
    ingestedAt:'2026-09-01T00:00:02Z',
  },
  payload:{},
});

const decisionRunFor=(decisionKey:string,dataSnapshotId:string)=>createDecisionRunIdentity({
  runtimeId:'paper',
  market:'KRW-BTC',
  asOf:'2026-09-01T00:00:10Z',
  decisionKey,
  componentVersions:[{
    componentType:'STRATEGY',
    componentId:'krw-btc-swing',
    versionId:'strategy-v7',
    contentFingerprint:'sha256:strategy-v7',
  }],
  dataSnapshotIds:[dataSnapshotId],
  evidenceIds:[],
});

const dataA=pointInTimeData('eval-input-1');
const dataB=pointInTimeData('eval-input-2');
const runA=decisionRunFor('decision-a','snapshot-1');
const runB=decisionRunFor('decision-b','snapshot-2');

const base=():EvaluationInput=>({
  subjectType:'STRATEGY',
  subjectId:'krw-btc-swing',
  subjectVersionId:'strategy-v7',
  mode:'PAPER',
  evaluatedAt:'2026-09-24T11:00:00Z',
  window:{
    startAt:'2026-09-01T00:00:00Z',
    endAt:'2026-09-24T10:00:00Z',
  },
  pointInTimeComplete:true,
  pointInTimeInputs:[
    {
      canonicalData:dataA,
      asOf:runA.asOf,
      canonicalDataRef:dataA.revision,
      dataSnapshotId:'snapshot-1',
      decisionRun:runA,
    },
    {
      canonicalData:dataB,
      asOf:runB.asOf,
      canonicalDataRef:dataB.revision,
      dataSnapshotId:'snapshot-2',
      decisionRun:runB,
    },
  ],
  dataSnapshotIds:['snapshot-2','snapshot-1'],
  decisionRunIds:[runB.decisionRunId,runA.decisionRunId],
  regimeIds:['risk-on'],
  benchmarkIds:['buy-hold'],
  metrics:[
    {metricId:'WIN_RATE',value:0.55,sampleCount:40,unit:'RATIO'},
    {metricId:'MAX_DRAWDOWN',value:0.08,sampleCount:40,unit:'RATIO'},
  ],
  criteria:[
    {criterionId:'win-rate-gate',metricId:'WIN_RATE',operator:'GTE',threshold:0.5,minSamples:30,required:true},
    {criterionId:'mdd-gate',metricId:'MAX_DRAWDOWN',operator:'LTE',threshold:0.1,minSamples:30,required:true},
  ],
  costModel:{feeBps:5,slippageBps:8},
});

test('shared Evaluation is deterministic and carries no execution/promotion authority',()=>{
  const a=createSharedEvaluation(base());
  const b=createSharedEvaluation({
    ...base(),
    dataSnapshotIds:['snapshot-1','snapshot-2'],
    decisionRunIds:['bo-run-v1-a','bo-run-v1-b'],
    metrics:[...base().metrics].reverse(),
    criteria:[...base().criteria].reverse(),
  });

  assert.equal(a.evaluationId,b.evaluationId);
  assert.equal(a.validationVerdict,'PASS');
  assert.equal(a.executionAuthority,false);
  assert.equal(a.liveAuthority,false);
  assert.equal(a.productionActivationAuthority,false);
  assert.equal(a.promotionAuthority,false);
});

test('thresholds are supplied externally and insufficient samples remain explicit',()=>{
  const result=evaluateCriteria(
    [{metricId:'WIN_RATE',value:0.9,sampleCount:4,unit:'RATIO'}],
    [{criterionId:'external-gate',metricId:'WIN_RATE',operator:'GTE',threshold:0.8,minSamples:10,required:true}],
  );
  assert.equal(result[0]?.status,'INSUFFICIENT_DATA');
  assert.equal(result[0]?.observedValue,0.9);
});

test('required failed criteria produce FAIL while optional failure does not decide the verdict',()=>{
  const optionalFail=createSharedEvaluation({
    ...base(),
    criteria:[
      {criterionId:'required-win',metricId:'WIN_RATE',operator:'GTE',threshold:0.5,minSamples:30,required:true},
      {criterionId:'optional-mdd',metricId:'MAX_DRAWDOWN',operator:'LTE',threshold:0.01,minSamples:30,required:false},
    ],
  });
  assert.equal(optionalFail.validationVerdict,'PASS');

  const requiredFail=createSharedEvaluation({
    ...base(),
    criteria:[
      {criterionId:'required-mdd',metricId:'MAX_DRAWDOWN',operator:'LTE',threshold:0.01,minSamples:30,required:true},
    ],
  });
  assert.equal(requiredFail.validationVerdict,'FAIL');
});

test('shared Evaluation rejects non-PIT inputs and missing canonical lineage',()=>{
  assert.throws(()=>createSharedEvaluation({...base(),pointInTimeComplete:false}),/point-in-time/);
  assert.throws(()=>createSharedEvaluation({...base(),dataSnapshotIds:[]}),/dataSnapshotIds/);
  assert.throws(()=>createSharedEvaluation({...base(),decisionRunIds:[]}),/decisionRunIds/);
});

test('shared Evaluation requires explicit non-negative trading cost assumptions',()=>{
  assert.throws(()=>createSharedEvaluation({
    ...base(),
    costModel:{feeBps:5,slippageBps:-1},
  }),/slippageBps/);
});

test('legacy metrics remain usable evidence but are not upgraded to shared Evaluation',()=>{
  const projected=projectLegacyEvaluation({
    subjectId:'legacy-strategy',
    subjectVersionId:'v1',
    metrics:[{metricId:'WIN_RATE',value:0.6,sampleCount:20,unit:'RATIO'}],
  });
  assert.equal(projected.status,'LEGACY_EVALUATION_ONLY');
  assert.ok(projected.missingForSharedEvaluation.includes('pointInTimeComplete'));
  assert.ok(projected.missingForSharedEvaluation.includes('explicitCostModel'));
});
