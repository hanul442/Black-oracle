export type PaperRolloutState = 'BLOCKED' | 'READY_FOR_HUMAN_APPROVAL' | 'APPROVED_FOR_PAPER_ROLLOUT';

export type PaperRolloutGateId =
  | 'STACK_LINEAGE'
  | 'CORE_CI'
  | 'SECURITY_GATE'
  | 'LOCAL_DEVICE_QA'
  | 'PREVIEW_ACCESS'
  | 'PREVIEW_REVISION'
  | 'PREVIEW_OPERATOR_QA'
  | 'READINESS_ENDPOINT'
  | 'PRODUCTION_PREFLIGHT'
  | 'SCHEDULER_REVIEW'
  | 'RISK_LIMIT_FREEZE';

export interface PaperRolloutInput {
  stackLineageAccepted: boolean;
  coreCiPassed: boolean;
  securityGatePassed: boolean;
  localDeviceQaPassed: boolean;
  previewAccessible: boolean;
  previewRevisionVerified: boolean;
  previewOperatorQaPassed: boolean;
  readinessEndpointReachable: boolean;
  productionPreflightReady: boolean;
  schedulerChangeReviewed: boolean;
  productionRiskLimitsUnchanged: boolean;
  humanApproval: boolean;
}

export interface PaperRolloutGate {
  id: PaperRolloutGateId;
  passed: boolean;
  actual: 'PASS' | 'BLOCKED';
  required: string;
  blocking: true;
}

export interface PaperRolloutAssessment {
  state: PaperRolloutState;
  deploymentAuthority: false;
  gates: PaperRolloutGate[];
  blockers: PaperRolloutGateId[];
  reasons: string[];
}

const gate = (
  id: PaperRolloutGateId,
  passed: boolean,
  required: string,
): PaperRolloutGate => ({
  id,
  passed,
  actual: passed ? 'PASS' : 'BLOCKED',
  required,
  blocking: true,
});

/**
 * Pre-deployment gate for moving the Evidence-governed runtime into production PAPER.
 *
 * This is intentionally separate from LiveEligibility. Paper rollout verifies that the
 * release candidate itself is safe to deploy; LiveEligibility evaluates the fresh,
 * post-deployment performance window before any small-live candidate can be considered.
 *
 * The evaluator never deploys code and never grants exchange execution authority.
 */
export const assessPaperRollout = (input: PaperRolloutInput): PaperRolloutAssessment => {
  const gates: PaperRolloutGate[] = [
    gate('STACK_LINEAGE', input.stackLineageAccepted, 'Parent/stacked PR lineage explicitly accepted'),
    gate('CORE_CI', input.coreCiPassed, 'Typecheck, tests, bundles and production build PASS on the exact rollout revision'),
    gate('SECURITY_GATE', input.securityGatePassed, 'High/critical dependency and authentication boundary checks PASS'),
    gate('LOCAL_DEVICE_QA', input.localDeviceQaPassed, 'Desktop/mobile Monitor, Positions, Audit and Lab QA PASS'),
    gate('PREVIEW_ACCESS', input.previewAccessible, 'Current deployed Preview is accessible to the authorized QA runner'),
    gate('PREVIEW_REVISION', input.previewRevisionVerified, 'Deployed Preview commit SHA matches the candidate head'),
    gate('PREVIEW_OPERATOR_QA', input.previewOperatorQaPassed, 'Authenticated deployed desktop/mobile operator QA PASS'),
    gate('READINESS_ENDPOINT', input.readinessEndpointReachable, 'Deployed /api/trading-readiness returns a safe JSON response'),
    gate('PRODUCTION_PREFLIGHT', input.productionPreflightReady, 'Read-only Supabase/runtime/scheduler production preflight READY'),
    gate('SCHEDULER_REVIEW', input.schedulerChangeReviewed, 'Evidence-refresh → Paper-cycle scheduler sequence reviewed for rollout'),
    gate('RISK_LIMIT_FREEZE', input.productionRiskLimitsUnchanged, 'Production risk limits remain unchanged for the rollout'),
  ];

  const blockers = gates.filter((item) => !item.passed).map((item) => item.id);
  let state: PaperRolloutState = blockers.length ? 'BLOCKED' : 'READY_FOR_HUMAN_APPROVAL';
  if (!blockers.length && input.humanApproval) state = 'APPROVED_FOR_PAPER_ROLLOUT';

  return {
    state,
    deploymentAuthority: false,
    gates,
    blockers,
    reasons: blockers.length
      ? [
          `${blockers.length} PAPER rollout gate(s) remain blocked.`,
          'Unknown or inaccessible release evidence is treated as BLOCKED, never as an assumed pass.',
          'Keep production on the pre-rollout PAPER runtime until every blocking gate is closed.',
        ]
      : input.humanApproval
        ? [
            'All deterministic PAPER rollout gates passed and explicit human approval is recorded.',
            'This assessment still does not deploy code, change scheduler configuration, or grant live exchange authority.',
          ]
        : [
            'All deterministic PAPER rollout gates passed.',
            'Explicit human approval is still required before the production PAPER rollout may begin.',
          ],
  };
};
