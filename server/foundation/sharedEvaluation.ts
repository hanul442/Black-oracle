import {
  assessPointInTime,
  type CanonicalDataEnvelope,
  type CanonicalRevisionIdentity,
} from './canonicalData';
import {
  DECISION_RUN_CONTRACT_VERSION,
  createDecisionRunIdentity,
  fingerprintCanonicalValue,
  type DecisionRunIdentity,
} from './decisionRunVersionRegistry';

export const SHARED_EVALUATION_CONTRACT_VERSION='bo.shared-evaluation.v1' as const;

export type EvaluationSubjectType=
  | 'FORECAST'
  | 'STRATEGY'
  | 'CHAMPION'
  | 'EXPERIMENT'
  | 'RISK'
  | 'EXECUTION';

export type EvaluationMode=
  | 'HISTORICAL'
  | 'OOS'
  | 'PAPER'
  | 'SHADOW';

export type EvaluationMetricUnit=
  | 'RATIO'
  | 'PERCENT'
  | 'CURRENCY'
  | 'BPS'
  | 'COUNT'
  | 'SCORE'
  | 'SECONDS'
  | 'OTHER';

export interface EvaluationMetric {
  metricId:string;
  value:number;
  sampleCount:number;
  unit:EvaluationMetricUnit;
}

export type CriterionOperator='GT'|'GTE'|'LT'|'LTE';

export interface EvaluationCriterion {
  criterionId:string;
  metricId:string;
  operator:CriterionOperator;
  threshold:number;
  minSamples:number;
  required:boolean;
}

export type CriterionStatus='PASS'|'FAIL'|'INSUFFICIENT_DATA'|'MISSING_METRIC';

export interface CriterionResult extends EvaluationCriterion {
  status:CriterionStatus;
  observedValue:number|null;
  observedSamples:number;
}

export interface EvaluationPointInTimeInput {
  canonicalData:CanonicalDataEnvelope;
  asOf:string;
  canonicalDataRef:Pick<CanonicalRevisionIdentity,'logicalRecordId'|'revisionId'>;
  dataSnapshotId:string;
  decisionRun:DecisionRunIdentity;
}

export interface EvaluationInput {
  subjectType:EvaluationSubjectType;
  subjectId:string;
  subjectVersionId:string;
  mode:EvaluationMode;
  evaluatedAt:string;
  window:{
    startAt:string;
    endAt:string;
  };
  pointInTimeComplete:boolean;
  pointInTimeInputs:readonly EvaluationPointInTimeInput[];
  dataSnapshotIds:readonly string[];
  decisionRunIds:readonly string[];
  regimeIds?:readonly string[];
  benchmarkIds?:readonly string[];
  metrics:readonly EvaluationMetric[];
  criteria:readonly EvaluationCriterion[];
  costModel:{
    feeBps:number;
    slippageBps:number;
    fundingBps?:number;
    otherCostBps?:number;
  };
}

export interface SharedEvaluationRecord {
  contractVersion:typeof SHARED_EVALUATION_CONTRACT_VERSION;
  evaluationId:string;
  subjectType:EvaluationSubjectType;
  subjectId:string;
  subjectVersionId:string;
  mode:EvaluationMode;
  evaluatedAt:string;
  window:{
    startAt:string;
    endAt:string;
  };
  pointInTimeComplete:true;
  dataSnapshotIds:string[];
  decisionRunIds:string[];
  regimeIds:string[];
  benchmarkIds:string[];
  metrics:EvaluationMetric[];
  criteria:CriterionResult[];
  costModel:{
    feeBps:number;
    slippageBps:number;
    fundingBps:number;
    otherCostBps:number;
  };
  validationVerdict:'PASS'|'FAIL'|'INSUFFICIENT_DATA';
  executionAuthority:false;
  liveAuthority:false;
  productionActivationAuthority:false;
  /**
   * Champion promotion is a separate governed consumer of Evaluation results.
   */
  promotionAuthority:false;
}

export interface LegacyEvaluationProjection {
  status:'LEGACY_EVALUATION_ONLY';
  subjectId:string|null;
  subjectVersionId:string|null;
  metrics:EvaluationMetric[];
  missingForSharedEvaluation:Array<
    | 'pointInTimeComplete'
    | 'dataSnapshotIds'
    | 'decisionRunIds'
    | 'explicitCostModel'
  >;
}

const nonEmpty=(value:unknown):value is string =>
  typeof value==='string'&&value.trim().length>0;

const parseTime=(value:unknown):number|null=>{
  if(!nonEmpty(value)) return null;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?parsed:null;
};

const uniqueStrings=(values:readonly string[]):string[] =>
  Array.from(new Set(values.map(value=>String(value).trim()).filter(Boolean))).sort();

const finiteNonNegative=(value:number,label:string):number=>{
  if(!Number.isFinite(value)||value<0) throw new Error(`${label} must be finite and non-negative`);
  return value;
};

const validatePointInTimeInputs=(
  inputs:readonly EvaluationPointInTimeInput[],
  dataSnapshotIds:readonly string[],
  decisionRunIds:readonly string[],
):void=>{
  if(!inputs.length) throw new Error('Evaluation requires point-in-time input proofs');

  const evaluationSnapshotIds=new Set(dataSnapshotIds);
  const evaluationRunIds=new Set(decisionRunIds);
  const provedSnapshotIds=new Set<string>();
  const provedRunIds=new Set<string>();

  for(const input of inputs){
    const expectedLogicalRecordId=input.canonicalDataRef.logicalRecordId?.trim();
    const expectedRevisionId=input.canonicalDataRef.revisionId?.trim();
    if(
      !expectedLogicalRecordId
      ||!expectedRevisionId
      ||input.canonicalData.revision.logicalRecordId!==expectedLogicalRecordId
      ||input.canonicalData.revision.revisionId!==expectedRevisionId
    ){
      throw new Error('Evaluation point-in-time revision mismatch');
    }

    const dataSnapshotId=input.dataSnapshotId?.trim();
    if(!dataSnapshotId){
      throw new Error('Evaluation point-in-time proof requires dataSnapshotId');
    }

    const run=input.decisionRun;
    if(!run||run.contractVersion!==DECISION_RUN_CONTRACT_VERSION){
      throw new Error('Evaluation point-in-time proof requires canonical Decision Run');
    }
    const canonicalRun=createDecisionRunIdentity({
      runtimeId:run.runtimeId,
      market:run.market,
      asOf:run.asOf,
      decisionKey:run.decisionKey,
      componentVersions:run.componentVersions,
      dataSnapshotIds:run.dataSnapshotIds,
      evidenceIds:run.evidenceIds,
      researchArtifactIds:run.researchArtifactIds,
      forecastArtifactIds:run.forecastArtifactIds,
      portfolioSnapshotId:run.portfolioSnapshotId,
      legacyTraceId:run.legacyTraceId,
      legacyDecisionId:run.legacyDecisionId,
    });
    if(canonicalRun.decisionRunId!==run.decisionRunId){
      throw new Error('Evaluation point-in-time Decision Run identity mismatch');
    }
    if(!evaluationRunIds.has(canonicalRun.decisionRunId)){
      throw new Error('Evaluation point-in-time Decision Run lineage mismatch');
    }
    if(!evaluationSnapshotIds.has(dataSnapshotId)){
      throw new Error('Evaluation point-in-time data snapshot lineage mismatch');
    }
    if(!canonicalRun.dataSnapshotIds.includes(dataSnapshotId)){
      throw new Error('Evaluation point-in-time data snapshot is not bound to Decision Run');
    }

    const proofAsOfMs=parseTime(input.asOf);
    const runAsOfMs=parseTime(canonicalRun.asOf);
    if(proofAsOfMs==null||runAsOfMs==null||proofAsOfMs!==runAsOfMs){
      throw new Error('Evaluation point-in-time asOf must equal Decision Run cutoff');
    }

    const assessment=assessPointInTime(input.canonicalData,canonicalRun.asOf);
    if(!assessment.eligible){
      throw new Error(`Evaluation point-in-time input rejected: ${assessment.reason}`);
    }

    provedSnapshotIds.add(dataSnapshotId);
    provedRunIds.add(canonicalRun.decisionRunId);
  }

  for(const decisionRunId of decisionRunIds){
    if(!provedRunIds.has(decisionRunId)){
      throw new Error('Evaluation decisionRunIds require point-in-time proof lineage');
    }
  }
  for(const dataSnapshotId of dataSnapshotIds){
    if(!provedSnapshotIds.has(dataSnapshotId)){
      throw new Error('Evaluation dataSnapshotIds require point-in-time proof lineage');
    }
  }
};

const normalizeMetrics=(metrics:readonly EvaluationMetric[]):EvaluationMetric[]=>{
  const seen=new Set<string>();
  return metrics.map(metric=>{
    if(!nonEmpty(metric.metricId)) throw new Error('Evaluation metric requires metricId');
    if(seen.has(metric.metricId.trim())) throw new Error(`duplicate Evaluation metric: ${metric.metricId.trim()}`);
    seen.add(metric.metricId.trim());
    if(!Number.isFinite(metric.value)) throw new Error(`Evaluation metric ${metric.metricId} requires finite value`);
    if(!Number.isInteger(metric.sampleCount)||metric.sampleCount<0) throw new Error(`Evaluation metric ${metric.metricId} requires non-negative integer sampleCount`);
    return {...metric,metricId:metric.metricId.trim()};
  }).sort((a,b)=>a.metricId.localeCompare(b.metricId));
};

const compare=(value:number,operator:CriterionOperator,threshold:number):boolean=>{
  switch(operator){
    case 'GT': return value>threshold;
    case 'GTE': return value>=threshold;
    case 'LT': return value<threshold;
    case 'LTE': return value<=threshold;
  }
};

export const evaluateCriteria=(
  metrics:readonly EvaluationMetric[],
  criteria:readonly EvaluationCriterion[],
):CriterionResult[]=>{
  const metricById=new Map(metrics.map(metric=>[metric.metricId,metric]));
  const seen=new Set<string>();

  return criteria.map(criterion=>{
    if(!nonEmpty(criterion.criterionId)) throw new Error('Evaluation criterion requires criterionId');
    if(!nonEmpty(criterion.metricId)) throw new Error('Evaluation criterion requires metricId');
    if(seen.has(criterion.criterionId.trim())) throw new Error(`duplicate Evaluation criterion: ${criterion.criterionId.trim()}`);
    seen.add(criterion.criterionId.trim());
    if(!Number.isFinite(criterion.threshold)) throw new Error(`criterion ${criterion.criterionId} requires finite threshold`);
    if(!Number.isInteger(criterion.minSamples)||criterion.minSamples<0) throw new Error(`criterion ${criterion.criterionId} requires non-negative integer minSamples`);

    const metric=metricById.get(criterion.metricId);
    if(!metric){
      return {...criterion,status:'MISSING_METRIC' as const,observedValue:null,observedSamples:0};
    }
    if(metric.sampleCount<criterion.minSamples){
      return {...criterion,status:'INSUFFICIENT_DATA' as const,observedValue:metric.value,observedSamples:metric.sampleCount};
    }
    return {
      ...criterion,
      status:compare(metric.value,criterion.operator,criterion.threshold)?'PASS' as const:'FAIL' as const,
      observedValue:metric.value,
      observedSamples:metric.sampleCount,
    };
  }).sort((a,b)=>a.criterionId.localeCompare(b.criterionId));
};

export const createSharedEvaluation=(
  input:EvaluationInput,
):SharedEvaluationRecord=>{
  if(!nonEmpty(input.subjectId)) throw new Error('Evaluation requires subjectId');
  if(!nonEmpty(input.subjectVersionId)) throw new Error('Evaluation requires subjectVersionId');
  if(!input.pointInTimeComplete) throw new Error('Evaluation requires point-in-time complete inputs');

  const dataSnapshotIds=uniqueStrings(input.dataSnapshotIds);
  if(!dataSnapshotIds.length) throw new Error('Evaluation requires dataSnapshotIds');
  const decisionRunIds=uniqueStrings(input.decisionRunIds);
  if(!decisionRunIds.length) throw new Error('Evaluation requires decisionRunIds');
  validatePointInTimeInputs(input.pointInTimeInputs,dataSnapshotIds,decisionRunIds);

  const evaluatedAtMs=parseTime(input.evaluatedAt);
  const startAtMs=parseTime(input.window.startAt);
  const endAtMs=parseTime(input.window.endAt);
  if(evaluatedAtMs==null||startAtMs==null||endAtMs==null) throw new Error('Evaluation requires valid timestamps');
  if(endAtMs<startAtMs) throw new Error('Evaluation window end cannot precede start');
  if(evaluatedAtMs<endAtMs) throw new Error('Evaluation cannot be finalized before its observation window ends');

  const metrics=normalizeMetrics(input.metrics);
  if(!metrics.length) throw new Error('Evaluation requires at least one metric');

  const criteria=evaluateCriteria(metrics,input.criteria);
  const required=criteria.filter(criterion=>criterion.required);
  const validationVerdict:SharedEvaluationRecord['validationVerdict']=
    !required.length
      ?'INSUFFICIENT_DATA'
      :required.some(criterion=>criterion.status==='FAIL')
        ?'FAIL'
        :required.some(criterion=>criterion.status==='INSUFFICIENT_DATA'||criterion.status==='MISSING_METRIC')
          ?'INSUFFICIENT_DATA'
          :'PASS';

  const costModel={
    feeBps:finiteNonNegative(input.costModel.feeBps,'feeBps'),
    slippageBps:finiteNonNegative(input.costModel.slippageBps,'slippageBps'),
    fundingBps:finiteNonNegative(input.costModel.fundingBps??0,'fundingBps'),
    otherCostBps:finiteNonNegative(input.costModel.otherCostBps??0,'otherCostBps'),
  };

  const normalized={
    subjectType:input.subjectType,
    subjectId:input.subjectId.trim(),
    subjectVersionId:input.subjectVersionId.trim(),
    mode:input.mode,
    evaluatedAt:new Date(evaluatedAtMs).toISOString(),
    window:{
      startAt:new Date(startAtMs).toISOString(),
      endAt:new Date(endAtMs).toISOString(),
    },
    dataSnapshotIds,
    decisionRunIds,
    regimeIds:uniqueStrings(input.regimeIds??[]),
    benchmarkIds:uniqueStrings(input.benchmarkIds??[]),
    metrics,
    criteria,
    costModel,
  };

  return {
    contractVersion:SHARED_EVALUATION_CONTRACT_VERSION,
    evaluationId:`bo-eval-v1-${fingerprintCanonicalValue(normalized).slice(0,32)}`,
    ...normalized,
    pointInTimeComplete:true,
    validationVerdict,
    executionAuthority:false,
    liveAuthority:false,
    productionActivationAuthority:false,
    promotionAuthority:false,
  };
};

export const projectLegacyEvaluation=(
  input:{
    subjectId?:string|null;
    subjectVersionId?:string|null;
    metrics?:readonly EvaluationMetric[];
  },
):LegacyEvaluationProjection=>({
  status:'LEGACY_EVALUATION_ONLY',
  subjectId:nonEmpty(input.subjectId)?input.subjectId.trim():null,
  subjectVersionId:nonEmpty(input.subjectVersionId)?input.subjectVersionId.trim():null,
  metrics:input.metrics?normalizeMetrics(input.metrics):[],
  missingForSharedEvaluation:[
    'pointInTimeComplete',
    'dataSnapshotIds',
    'decisionRunIds',
    'explicitCostModel',
  ],
});
