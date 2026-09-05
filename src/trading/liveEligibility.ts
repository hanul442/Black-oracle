import type { HistoricalValidationVerdict } from './blindValidation';

export type LiveEligibilityState = 'BLOCKED' | 'PAPER_VERIFIED' | 'SMALL_LIVE_CANDIDATE' | 'APPROVED_STAGE_300K';

export interface LiveEligibilityInput {
  paperObservationDays: number;
  closedTrades: number;
  evidenceCoverage: number;
  evidenceLessEntries: number;
  auditAverage: number;
  weakExecutions: number;
  blindVerdict: HistoricalValidationVerdict;
  walkForwardVerdict: HistoricalValidationVerdict;
  monteCarloVerdict: 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';
  maxDrawdownPct: number;
  dailyRiskBreaches: number;
  riskBypasses: number;
  staleOrDuplicateExecutionViolations: number;
  fatalRuntimeIncidents: number;
  unresolvedCriticalIncidents: number;
  regimeRobustnessPass: boolean;
  costStressPass: boolean;
  humanApproval: boolean;
}

export interface LiveEligibilityGate {
  id: string;
  passed: boolean;
  actual: string;
  required: string;
  blocking: boolean;
}

export interface LiveEligibilityResult {
  state: LiveEligibilityState;
  eligibleForLiveExecution: false;
  stageNotionalKrw: 300_000 | null;
  gates: LiveEligibilityGate[];
  blockers: string[];
  reasons: string[];
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const assessLiveEligibility = (input: LiveEligibilityInput): LiveEligibilityResult => {
  const gates: LiveEligibilityGate[] = [
    { id: 'PAPER_DAYS', passed: input.paperObservationDays >= 14, actual: input.paperObservationDays.toFixed(1), required: '>= 14 days', blocking: true },
    { id: 'CLOSED_TRADES', passed: input.closedTrades >= 60, actual: String(input.closedTrades), required: '>= 60', blocking: true },
    { id: 'EVIDENCE_COVERAGE', passed: input.evidenceCoverage >= 0.95, actual: percent(input.evidenceCoverage), required: '>= 95%', blocking: true },
    { id: 'EVIDENCELESS_ENTER', passed: input.evidenceLessEntries === 0, actual: String(input.evidenceLessEntries), required: '= 0', blocking: true },
    { id: 'AUDIT_AVERAGE', passed: input.auditAverage >= 0.90, actual: percent(input.auditAverage), required: '>= 90%', blocking: true },
    { id: 'WEAK_EXECUTIONS', passed: input.weakExecutions === 0, actual: String(input.weakExecutions), required: '= 0', blocking: true },
    { id: 'BLIND_VALIDATION', passed: input.blindVerdict === 'PASS', actual: input.blindVerdict, required: 'PASS', blocking: true },
    { id: 'WALK_FORWARD', passed: input.walkForwardVerdict === 'PASS', actual: input.walkForwardVerdict, required: 'PASS', blocking: true },
    { id: 'MONTE_CARLO', passed: input.monteCarloVerdict === 'PASS' || input.monteCarloVerdict === 'WATCH', actual: input.monteCarloVerdict, required: 'PASS or WATCH; never REJECT/INSUFFICIENT', blocking: true },
    { id: 'MAX_DRAWDOWN', passed: input.maxDrawdownPct <= 0.05, actual: percent(input.maxDrawdownPct), required: '<= 5%', blocking: true },
    { id: 'DAILY_RISK_BREACH', passed: input.dailyRiskBreaches === 0, actual: String(input.dailyRiskBreaches), required: '= 0', blocking: true },
    { id: 'RISK_BYPASS', passed: input.riskBypasses === 0, actual: String(input.riskBypasses), required: '= 0', blocking: true },
    { id: 'EXECUTION_INTEGRITY', passed: input.staleOrDuplicateExecutionViolations === 0, actual: String(input.staleOrDuplicateExecutionViolations), required: '= 0', blocking: true },
    { id: 'RUNTIME_FATAL', passed: input.fatalRuntimeIncidents === 0, actual: String(input.fatalRuntimeIncidents), required: '= 0', blocking: true },
    { id: 'CRITICAL_INCIDENTS', passed: input.unresolvedCriticalIncidents === 0, actual: String(input.unresolvedCriticalIncidents), required: '= 0', blocking: true },
    { id: 'REGIME_ROBUSTNESS', passed: input.regimeRobustnessPass, actual: input.regimeRobustnessPass ? 'PASS' : 'FAIL', required: 'PASS', blocking: true },
    { id: 'COST_STRESS', passed: input.costStressPass, actual: input.costStressPass ? 'PASS' : 'FAIL', required: 'PASS', blocking: true },
  ];

  const blockers = gates.filter((gate) => gate.blocking && !gate.passed).map((gate) => gate.id);
  let state: LiveEligibilityState = blockers.length ? 'BLOCKED' : 'PAPER_VERIFIED';
  if (!blockers.length) state = input.humanApproval ? 'APPROVED_STAGE_300K' : 'SMALL_LIVE_CANDIDATE';

  return {
    state,
    // This evaluator never opens exchange execution. A separate explicit human-controlled deployment step is required.
    eligibleForLiveExecution: false,
    stageNotionalKrw: state === 'APPROVED_STAGE_300K' ? 300_000 : null,
    gates,
    blockers,
    reasons: blockers.length
      ? [`${blockers.length} promotion gate(s) remain blocked.`, 'Continue PAPER; no live execution authority is granted.']
      : input.humanApproval
        ? ['All quantitative gates passed and explicit human approval is recorded.', 'This result authorizes only the 300,000 KRW candidate stage; it does not activate an exchange connector.']
        : ['All quantitative PAPER gates passed.', 'Explicit human approval is still required before the 300,000 KRW stage can be considered approved.'],
  };
};
