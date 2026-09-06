import type { BlindValidationResult, WalkForwardResult } from './blindValidation';
import type { MonteCarloValidation } from './monteCarlo';
import { ORACLE_GRADE_ORDER, type OracleGrade, type OracleRatingResult } from './rating';
import type { TradingLedgerEvent } from './types';
import type { InputValidationLedgerRecord } from './validationDataset';

export type StrategyPromotionStage =
  | 'EXPERIMENT_TO_INCUBATOR'
  | 'INCUBATOR_TO_CHALLENGER'
  | 'CHALLENGER_TO_CHAMPION_CANDIDATE';

export type PromotionGateVerdict = 'PASS' | 'BLOCKED' | 'INSUFFICIENT_DATA';
export type PromotionEvidenceVerdict = 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';

export interface PromotionParitySummary {
  policyObserved: number;
  policyRejected: number;
  targetObserved: number;
  targetRejected: number;
  adapterObserved: number;
  adapterRejected: number;
}

export interface PromotionHardGatePolicy {
  version: string;
  minimumBlindSamples: number;
  minimumObservationDays: number;
  minimumMonteCarloTrades: number;
  minimumAuditCoverage: number;
  minimumParityObservations: {
    policy: number;
    target: number;
    adapter: number;
  };
  requiredInputTimeframes: number[];
  allowWarmupWatch: boolean;
  minimumGradeByStage: Record<StrategyPromotionStage, OracleGrade>;
  minimumRatingConfidence: 'MEDIUM' | 'HIGH';
}

export interface PromotionHardGateInput {
  stage: StrategyPromotionStage;
  inputValidation: InputValidationLedgerRecord | InputValidationLedgerRecord[] | null;
  blindValidation: BlindValidationResult | null;
  walkForward: WalkForwardResult | null;
  monteCarlo: MonteCarloValidation | null;
  costStressVerdict: PromotionEvidenceVerdict | null;
  auditCoverage: number | null;
  rating: OracleRatingResult | null;
  researchConfigurationId: string | null;
  parity: PromotionParitySummary;
}

export interface PromotionGateCheck {
  key: string;
  passed: boolean;
  insufficient: boolean;
  reason: string;
}

export interface StrategyPromotionEligibility {
  schemaVersion: 1;
  policyVersion: string;
  stage: StrategyPromotionStage;
  verdict: PromotionGateVerdict;
  eligible: boolean;
  minimumGrade: OracleGrade;
  checks: PromotionGateCheck[];
  blockers: string[];
  insufficientEvidence: string[];
  reasons: string[];
  promotionAuthority: false;
  executionAuthority: false;
  liveDeploymentAuthority: false;
}

export const DEFAULT_PROMOTION_HARD_GATE_POLICY: PromotionHardGatePolicy = {
  version: 'S7_PROMOTION_HARD_GATE_V1',
  minimumBlindSamples: 60,
  minimumObservationDays: 14,
  minimumMonteCarloTrades: 20,
  minimumAuditCoverage: 0.9,
  minimumParityObservations: { policy: 20, target: 20, adapter: 5 },
  requiredInputTimeframes: [15, 60, 240],
  allowWarmupWatch: true,
  minimumGradeByStage: {
    EXPERIMENT_TO_INCUBATOR: 'BBB-',
    INCUBATOR_TO_CHALLENGER: 'A-',
    CHALLENGER_TO_CHAMPION_CANDIDATE: 'AA-',
  },
  minimumRatingConfidence: 'MEDIUM',
};

const asRecord = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' ? value as Record<string, unknown> : null;
const parityStatus = (value: unknown): string | null => {
  const record = asRecord(value);
  return typeof record?.status === 'string' ? record.status : null;
};
const inputRecords = (value: PromotionHardGateInput['inputValidation']): InputValidationLedgerRecord[] => value == null ? [] : Array.isArray(value) ? value : [value];

/** Summarize Sprint 7 shadow/runtime parity evidence from the immutable Trading Ledger. */
export const summarizePromotionParityFromLedger = (events: TradingLedgerEvent[]): PromotionParitySummary => {
  const summary: PromotionParitySummary = { policyObserved: 0, policyRejected: 0, targetObserved: 0, targetRejected: 0, adapterObserved: 0, adapterRejected: 0 };
  for (const event of events ?? []) {
    const payload = asRecord(event.payload);
    if (!payload) continue;
    if (event.type === 'SIGNAL') {
      const policyStatus = parityStatus(payload.independentPolicyParity);
      if (policyStatus) {
        summary.policyObserved += 1;
        if (policyStatus !== 'PASS') summary.policyRejected += 1;
      }
      const targetStatus = parityStatus(payload.targetPipelineParity);
      if (targetStatus) {
        summary.targetObserved += 1;
        if (targetStatus !== 'PASS') summary.targetRejected += 1;
      }
    }
    if (event.type === 'ORDER_FILLED') {
      const adapterStatus = parityStatus(payload.executionAdapterParity);
      if (adapterStatus) {
        summary.adapterObserved += 1;
        if (adapterStatus !== 'PASS') summary.adapterRejected += 1;
      }
    }
  }
  return summary;
};

const gradeAtLeast = (grade: OracleGrade, minimum: OracleGrade) => {
  const actual = ORACLE_GRADE_ORDER.indexOf(grade);
  const floor = ORACLE_GRADE_ORDER.indexOf(minimum);
  return actual >= 0 && floor >= 0 && actual <= floor;
};

const confidencePasses = (actual: OracleRatingResult['confidence'], minimum: 'MEDIUM' | 'HIGH') => {
  if (minimum === 'HIGH') return actual === 'HIGH';
  return actual === 'MEDIUM' || actual === 'HIGH';
};

const check = (key: string, passed: boolean, insufficient: boolean, reason: string): PromotionGateCheck => ({ key, passed, insufficient, reason });

export const buildStrategyPromotionEligibility = (
  input: PromotionHardGateInput,
  policy: PromotionHardGatePolicy = DEFAULT_PROMOTION_HARD_GATE_POLICY,
): StrategyPromotionEligibility => {
  const minimumGrade = policy.minimumGradeByStage[input.stage];
  const checks: PromotionGateCheck[] = [];
  const records = inputRecords(input.inputValidation);
  const requiredFrames = [...new Set(policy.requiredInputTimeframes.map((value) => Math.trunc(value)).filter((value) => value > 0))];
  const recordByFrame = new Map(records
    .filter((record) => Number.isFinite(record.dataset.timeframeMinutes))
    .map((record) => [record.dataset.timeframeMinutes as number, record] as [number, InputValidationLedgerRecord]));
  const missingFrames = requiredFrames.filter((frame) => !recordByFrame.has(frame));
  const requiredRecords = requiredFrames.flatMap((frame) => recordByFrame.get(frame) ? [recordByFrame.get(frame)!] : []);

  const integrityFailed = requiredRecords.filter((record) => record.integrity.disposition !== 'PASS');
  const integrityPassed = missingFrames.length === 0 && integrityFailed.length === 0 && requiredRecords.length === requiredFrames.length;
  checks.push(check(
    'INPUT_INTEGRITY',
    integrityPassed,
    missingFrames.length > 0 || records.length === 0,
    integrityPassed
      ? `Required input integrity passed for ${requiredFrames.join('/')} minute timeframes.`
      : missingFrames.length
        ? `Input-validation provenance is missing for timeframe(s): ${missingFrames.join(', ')}.`
        : `Input integrity failed for timeframe(s): ${integrityFailed.map((record) => record.dataset.timeframeMinutes).join(', ')}.`,
  ));

  const unstableWarmup = requiredRecords.filter((record) => {
    const disposition = record.warmup?.disposition ?? null;
    return disposition !== 'PASS' && !(policy.allowWarmupWatch && disposition === 'WATCH');
  });
  const warmupMissing = missingFrames.length > 0 || requiredRecords.some((record) => !record.warmup || record.warmup.disposition === 'INSUFFICIENT_DATA');
  const warmupPassed = missingFrames.length === 0 && unstableWarmup.length === 0 && requiredRecords.length === requiredFrames.length;
  checks.push(check(
    'WARMUP_STABILITY',
    warmupPassed,
    warmupMissing,
    warmupPassed
      ? `Recursive warm-up stability is inside policy for ${requiredFrames.join('/')} minute timeframes.`
      : warmupMissing
        ? 'Recursive warm-up evidence is incomplete for one or more required timeframes.'
        : `Recursive warm-up policy failed for timeframe(s): ${unstableWarmup.map((record) => `${record.dataset.timeframeMinutes}:${record.warmup?.disposition ?? 'MISSING'}`).join(', ')}.`,
  ));

  const researchConfigurationValid = /^rcfg-v1-[0-9a-f]{16}$/.test(String(input.researchConfigurationId ?? '').toLowerCase());
  const reproducibleRecords = requiredRecords.filter((record) => Boolean(record.dataset.datasetId) && /^sha256:[0-9a-f]{64}$/.test(record.dataset.checksum));
  const singleMarket = new Set(requiredRecords.map((record) => record.dataset.market).filter(Boolean)).size <= 1;
  const datasetReproducible = missingFrames.length === 0 && reproducibleRecords.length === requiredFrames.length && researchConfigurationValid && singleMarket;
  checks.push(check(
    'REPRODUCIBLE_LINEAGE',
    datasetReproducible,
    missingFrames.length > 0 || records.length === 0 || !input.researchConfigurationId,
    datasetReproducible
      ? `All required datasets and research configuration ${input.researchConfigurationId} are reproducibly identified.`
      : 'Required timeframe checksums, a consistent market, and/or research configuration ID are missing or invalid.',
  ));

  const blind = input.blindValidation;
  const blindDepth = Boolean(blind && blind.sampleCount >= policy.minimumBlindSamples && blind.observationDays >= policy.minimumObservationDays);
  checks.push(check(
    'BLIND_OOS',
    Boolean(blind && blind.verdict === 'PASS' && blindDepth),
    !blind || blind.verdict === 'INSUFFICIENT_DATA' || !blindDepth,
    blind ? `Blind/OOS verdict=${blind.verdict}; samples=${blind.sampleCount}/${policy.minimumBlindSamples}; days=${blind.observationDays.toFixed(2)}/${policy.minimumObservationDays}.` : 'Blind/OOS validation is missing.',
  ));

  const walkForward = input.walkForward;
  checks.push(check(
    'WALK_FORWARD',
    walkForward?.verdict === 'PASS',
    !walkForward || walkForward.verdict === 'INSUFFICIENT_DATA',
    walkForward ? `Walk-forward verdict is ${walkForward.verdict}.` : 'Walk-forward validation is missing.',
  ));

  const monteCarlo = input.monteCarlo;
  const monteCarloDepth = Boolean(monteCarlo && monteCarlo.tradeCount >= policy.minimumMonteCarloTrades);
  checks.push(check(
    'MONTE_CARLO_SURVIVAL',
    Boolean(monteCarlo && monteCarlo.verdict === 'PASS' && monteCarloDepth),
    !monteCarlo || monteCarlo.verdict === 'INSUFFICIENT_DATA' || !monteCarloDepth,
    monteCarlo ? `Monte Carlo verdict=${monteCarlo.verdict}; trades=${monteCarlo.tradeCount}/${policy.minimumMonteCarloTrades}; survival=${monteCarlo.survivalProbability ?? 'n/a'}.` : 'Monte Carlo validation is missing.',
  ));

  checks.push(check(
    'COST_STRESS',
    input.costStressVerdict === 'PASS',
    input.costStressVerdict == null || input.costStressVerdict === 'INSUFFICIENT_DATA',
    input.costStressVerdict ? `Cost/slippage stress verdict is ${input.costStressVerdict}.` : 'Cost/slippage stress evidence is missing.',
  ));

  const auditCoverage = Number.isFinite(input.auditCoverage) ? Math.max(0, Math.min(1, input.auditCoverage as number)) : null;
  checks.push(check(
    'AUDIT_COVERAGE',
    auditCoverage != null && auditCoverage >= policy.minimumAuditCoverage,
    auditCoverage == null,
    auditCoverage == null ? 'Audit/evidence coverage is missing.' : `Audit/evidence coverage ${(auditCoverage * 100).toFixed(1)}% vs ${(policy.minimumAuditCoverage * 100).toFixed(1)}% required.`,
  ));

  const rating = input.rating;
  const ratingPassed = Boolean(
    rating
    && rating.missingRequiredDimensions.length === 0
    && rating.appliedGateKeys.length === 0
    && confidencePasses(rating.confidence, policy.minimumRatingConfidence)
    && gradeAtLeast(rating.grade, minimumGrade),
  );
  checks.push(check(
    'RATING_HARD_GATE',
    ratingPassed,
    !rating || rating.confidence === 'INSUFFICIENT' || rating.missingRequiredDimensions.length > 0,
    rating ? `Rating=${rating.grade}; confidence=${rating.confidence}; minimum=${minimumGrade}; failed rating gates=${rating.appliedGateKeys.length}.` : 'Oracle rating is missing.',
  ));

  const parityRequirements = policy.minimumParityObservations;
  const parity = input.parity;
  const policyParityPass = parity.policyObserved >= parityRequirements.policy && parity.policyRejected === 0;
  const targetParityPass = parity.targetObserved >= parityRequirements.target && parity.targetRejected === 0;
  const adapterParityPass = parity.adapterObserved >= parityRequirements.adapter && parity.adapterRejected === 0;
  checks.push(check('POLICY_PARITY', policyParityPass, parity.policyObserved < parityRequirements.policy, `Policy parity ${parity.policyObserved}/${parityRequirements.policy} observation(s), ${parity.policyRejected} rejection(s).`));
  checks.push(check('TARGET_PARITY', targetParityPass, parity.targetObserved < parityRequirements.target, `Target parity ${parity.targetObserved}/${parityRequirements.target} observation(s), ${parity.targetRejected} rejection(s).`));
  checks.push(check('ADAPTER_PARITY', adapterParityPass, parity.adapterObserved < parityRequirements.adapter, `Adapter parity ${parity.adapterObserved}/${parityRequirements.adapter} fill(s), ${parity.adapterRejected} rejection(s).`));

  const blockers = checks.filter((item) => !item.passed && !item.insufficient).map((item) => item.key);
  const insufficientEvidence = checks.filter((item) => !item.passed && item.insufficient).map((item) => item.key);
  const verdict: PromotionGateVerdict = blockers.length ? 'BLOCKED' : insufficientEvidence.length ? 'INSUFFICIENT_DATA' : 'PASS';
  const reasons = [
    `${checks.filter((item) => item.passed).length}/${checks.length} promotion hard gates passed for ${input.stage}.`,
    `Minimum grade for this transition is ${minimumGrade}; ratings remain governance evidence and never grant execution authority.`,
  ];
  if (blockers.length) reasons.push(`Blocking gate(s): ${blockers.join(', ')}.`);
  if (insufficientEvidence.length) reasons.push(`Insufficient evidence gate(s): ${insufficientEvidence.join(', ')}.`);

  return {
    schemaVersion: 1,
    policyVersion: policy.version,
    stage: input.stage,
    verdict,
    eligible: verdict === 'PASS',
    minimumGrade,
    checks,
    blockers,
    insufficientEvidence,
    reasons,
    promotionAuthority: false,
    executionAuthority: false,
    liveDeploymentAuthority: false,
  };
};
