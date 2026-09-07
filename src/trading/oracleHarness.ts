import {
  DEFAULT_PROMOTION_HARD_GATE_POLICY,
  buildStrategyPromotionEligibility,
  type PromotionGateCheck,
  type PromotionHardGateInput,
  type PromotionHardGatePolicy,
  type StrategyPromotionEligibility,
} from './promotionHardGate';
import type { OracleGrade } from './rating';

export const ORACLE_HARNESS_VERSION = 'BO_ORACLE_HARNESS_V1' as const;

export type OracleHarnessDisposition = 'KEEP' | 'DISCARD' | 'CRASH';
export type OracleHarnessAxis = 'PERFORMANCE' | 'RISK' | 'ROBUSTNESS' | 'EXECUTION' | 'EVIDENCE';
export type OracleHarnessAxisStatus = 'PASS' | 'INSUFFICIENT_DATA' | 'FAIL';
export type OracleHarnessNextAction =
  | 'REQUEST_PROMOTION_REVIEW'
  | 'EXTEND_VALIDATION'
  | 'ARCHIVE_REJECTED_CANDIDATE'
  | 'INVESTIGATE_HARNESS_FAILURE';

export interface OracleHarnessRunInput {
  experimentId: string;
  genomeId: string;
  promotion: PromotionHardGateInput;
  evaluatedAt?: number;
}

export interface OracleHarnessAxisResult {
  axis: OracleHarnessAxis;
  status: OracleHarnessAxisStatus;
  passedChecks: number;
  totalChecks: number;
  passRate: number;
  blockerKeys: string[];
  insufficientKeys: string[];
  reasons: string[];
}

export interface OracleHarnessCrash {
  phase: 'INPUT_VALIDATION' | 'PROMOTION_EVALUATION';
  message: string;
}

export interface OracleHarnessResult {
  schemaVersion: 1;
  harnessVersion: typeof ORACLE_HARNESS_VERSION;
  experimentId: string;
  genomeId: string;
  evaluatedAt: number;
  stage: PromotionHardGateInput['stage'] | null;
  disposition: OracleHarnessDisposition;
  nextAction: OracleHarnessNextAction;
  grade: OracleGrade | null;
  rawScore: number | null;
  policyVersion: string;
  hardGateVerdict: StrategyPromotionEligibility['verdict'] | null;
  axes: OracleHarnessAxisResult[];
  blockers: string[];
  insufficientEvidence: string[];
  reasons: string[];
  eligibility: StrategyPromotionEligibility | null;
  crash: OracleHarnessCrash | null;
  /** KEEP is research retention, never automatic lifecycle promotion. */
  autoTransition: false;
  requiresHumanApproval: boolean;
  promotionAuthority: false;
  executionAuthority: false;
  capitalAuthority: false;
  liveDeploymentAuthority: false;
}

export type OracleHarnessPromotionEvaluator = (
  input: PromotionHardGateInput,
  policy?: PromotionHardGatePolicy,
) => StrategyPromotionEligibility;

const AXIS_ORDER: OracleHarnessAxis[] = ['PERFORMANCE', 'RISK', 'ROBUSTNESS', 'EXECUTION', 'EVIDENCE'];

const AXIS_BY_CHECK: Record<string, OracleHarnessAxis> = {
  INPUT_INTEGRITY: 'EVIDENCE',
  WARMUP_STABILITY: 'ROBUSTNESS',
  REPRODUCIBLE_LINEAGE: 'EVIDENCE',
  BLIND_OOS: 'PERFORMANCE',
  WALK_FORWARD: 'ROBUSTNESS',
  MONTE_CARLO_SURVIVAL: 'RISK',
  COST_STRESS: 'EXECUTION',
  AUDIT_COVERAGE: 'EVIDENCE',
  RATING_HARD_GATE: 'PERFORMANCE',
  POLICY_PARITY: 'EXECUTION',
  TARGET_PARITY: 'EXECUTION',
  ADAPTER_PARITY: 'EXECUTION',
};

const emptyAxis = (axis: OracleHarnessAxis): OracleHarnessAxisResult => ({
  axis,
  status: 'INSUFFICIENT_DATA',
  passedChecks: 0,
  totalChecks: 0,
  passRate: 0,
  blockerKeys: [],
  insufficientKeys: [],
  reasons: [],
});

const clampRate = (passed: number, total: number) => total > 0 ? Math.max(0, Math.min(1, passed / total)) : 0;

/**
 * Converts the existing S7 hard-gate checks into an operator-facing five-axis harness view.
 * The axes are descriptive only: the hard-gate verdict remains authoritative.
 */
export const summarizeOracleHarnessAxes = (checks: readonly PromotionGateCheck[]): OracleHarnessAxisResult[] => {
  const grouped = new Map<OracleHarnessAxis, PromotionGateCheck[]>(AXIS_ORDER.map((axis) => [axis, []]));

  for (const check of checks ?? []) {
    const axis = AXIS_BY_CHECK[check.key] ?? 'EVIDENCE';
    grouped.get(axis)?.push(check);
  }

  return AXIS_ORDER.map((axis) => {
    const axisChecks = grouped.get(axis) ?? [];
    if (!axisChecks.length) return emptyAxis(axis);

    const blockers = axisChecks.filter((check) => !check.passed && !check.insufficient);
    const insufficient = axisChecks.filter((check) => !check.passed && check.insufficient);
    const passedChecks = axisChecks.filter((check) => check.passed).length;
    const status: OracleHarnessAxisStatus = blockers.length
      ? 'FAIL'
      : insufficient.length
        ? 'INSUFFICIENT_DATA'
        : 'PASS';

    return {
      axis,
      status,
      passedChecks,
      totalChecks: axisChecks.length,
      passRate: clampRate(passedChecks, axisChecks.length),
      blockerKeys: blockers.map((check) => check.key),
      insufficientKeys: insufficient.map((check) => check.key),
      reasons: axisChecks.map((check) => check.reason),
    };
  });
};

const safeTimestamp = (value: number | undefined) => Number.isFinite(value) && (value as number) > 0 ? Math.trunc(value as number) : Date.now();
const failureMessage = (error: unknown) => error instanceof Error ? error.message : String(error ?? 'Unknown Oracle Harness failure.');

const crashResult = (
  input: OracleHarnessRunInput,
  policy: PromotionHardGatePolicy,
  evaluatedAt: number,
  phase: OracleHarnessCrash['phase'],
  message: string,
): OracleHarnessResult => ({
  schemaVersion: 1,
  harnessVersion: ORACLE_HARNESS_VERSION,
  experimentId: input.experimentId?.trim() || 'UNKNOWN_EXPERIMENT',
  genomeId: input.genomeId?.trim() || 'UNKNOWN_GENOME',
  evaluatedAt,
  stage: input.promotion?.stage ?? null,
  disposition: 'CRASH',
  nextAction: 'INVESTIGATE_HARNESS_FAILURE',
  grade: input.promotion?.rating?.grade ?? null,
  rawScore: input.promotion?.rating?.rawScore ?? null,
  policyVersion: policy.version,
  hardGateVerdict: null,
  axes: AXIS_ORDER.map(emptyAxis),
  blockers: [],
  insufficientEvidence: [],
  reasons: [`Oracle Harness failed closed during ${phase}.`, message],
  eligibility: null,
  crash: { phase, message },
  autoTransition: false,
  requiresHumanApproval: true,
  promotionAuthority: false,
  executionAuthority: false,
  capitalAuthority: false,
  liveDeploymentAuthority: false,
});

/**
 * Research-only orchestration layer around the existing promotion hard gate.
 *
 * PASS              -> KEEP + request human promotion review
 * INSUFFICIENT_DATA -> KEEP + extend validation
 * BLOCKED           -> DISCARD + archive rejected candidate
 * evaluator failure -> CRASH + fail closed
 *
 * The harness never changes Strategy Vault state, sends an order, allocates capital,
 * or grants LIVE deployment authority.
 */
export const runOracleHarness = (
  input: OracleHarnessRunInput,
  policy: PromotionHardGatePolicy = DEFAULT_PROMOTION_HARD_GATE_POLICY,
  evaluator: OracleHarnessPromotionEvaluator = buildStrategyPromotionEligibility,
): OracleHarnessResult => {
  const evaluatedAt = safeTimestamp(input.evaluatedAt);
  const experimentId = input.experimentId?.trim();
  const genomeId = input.genomeId?.trim();

  if (!experimentId || !genomeId || !input.promotion?.stage) {
    return crashResult(input, policy, evaluatedAt, 'INPUT_VALIDATION', 'Experiment ID, Genome ID, and promotion stage are required.');
  }

  try {
    const eligibility = evaluator(input.promotion, policy);
    const axes = summarizeOracleHarnessAxes(eligibility.checks);
    const grade = input.promotion.rating?.grade ?? null;
    const rawScore = input.promotion.rating?.rawScore ?? null;

    if (eligibility.verdict === 'PASS') {
      return {
        schemaVersion: 1,
        harnessVersion: ORACLE_HARNESS_VERSION,
        experimentId,
        genomeId,
        evaluatedAt,
        stage: input.promotion.stage,
        disposition: 'KEEP',
        nextAction: 'REQUEST_PROMOTION_REVIEW',
        grade,
        rawScore,
        policyVersion: eligibility.policyVersion,
        hardGateVerdict: eligibility.verdict,
        axes,
        blockers: [...eligibility.blockers],
        insufficientEvidence: [...eligibility.insufficientEvidence],
        reasons: [...eligibility.reasons, 'KEEP retains the candidate for explicit promotion review; it does not promote automatically.'],
        eligibility,
        crash: null,
        autoTransition: false,
        requiresHumanApproval: true,
        promotionAuthority: false,
        executionAuthority: false,
        capitalAuthority: false,
        liveDeploymentAuthority: false,
      };
    }

    if (eligibility.verdict === 'INSUFFICIENT_DATA') {
      return {
        schemaVersion: 1,
        harnessVersion: ORACLE_HARNESS_VERSION,
        experimentId,
        genomeId,
        evaluatedAt,
        stage: input.promotion.stage,
        disposition: 'KEEP',
        nextAction: 'EXTEND_VALIDATION',
        grade,
        rawScore,
        policyVersion: eligibility.policyVersion,
        hardGateVerdict: eligibility.verdict,
        axes,
        blockers: [...eligibility.blockers],
        insufficientEvidence: [...eligibility.insufficientEvidence],
        reasons: [...eligibility.reasons, 'Candidate remains research-only until the missing evidence is collected.'],
        eligibility,
        crash: null,
        autoTransition: false,
        requiresHumanApproval: false,
        promotionAuthority: false,
        executionAuthority: false,
        capitalAuthority: false,
        liveDeploymentAuthority: false,
      };
    }

    return {
      schemaVersion: 1,
      harnessVersion: ORACLE_HARNESS_VERSION,
      experimentId,
      genomeId,
      evaluatedAt,
      stage: input.promotion.stage,
      disposition: 'DISCARD',
      nextAction: 'ARCHIVE_REJECTED_CANDIDATE',
      grade,
      rawScore,
      policyVersion: eligibility.policyVersion,
      hardGateVerdict: eligibility.verdict,
      axes,
      blockers: [...eligibility.blockers],
      insufficientEvidence: [...eligibility.insufficientEvidence],
      reasons: [...eligibility.reasons, 'Blocking evidence failed; the candidate is not eligible for lifecycle promotion.'],
      eligibility,
      crash: null,
      autoTransition: false,
      requiresHumanApproval: false,
      promotionAuthority: false,
      executionAuthority: false,
      capitalAuthority: false,
      liveDeploymentAuthority: false,
    };
  } catch (error) {
    return crashResult(input, policy, evaluatedAt, 'PROMOTION_EVALUATION', failureMessage(error));
  }
};
