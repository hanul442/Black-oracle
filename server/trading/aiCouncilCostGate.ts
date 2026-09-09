import {
  runConditionalAiCouncilForCycle,
  type OperationalCouncilTrace,
} from './aiCouncilAdjudicator';

export const isRoutineFailClosedRiskRejection = (trace: OperationalCouncilTrace) => {
  if (trace.action !== 'NO_TRADE') return false;
  if (trace.riskDisposition !== 'REJECT') return false;
  if (trace.evidenceContradictionCount > 0) return false;

  const members = Array.isArray(trace.council?.members) ? trace.council.members : [];
  const riskRejected = members.some((member) => member.role === 'RISK' && member.vote === 'REJECT');
  const nonRiskRejected = members.some((member) => member.role !== 'RISK' && member.vote === 'REJECT');

  return riskRejected && !nonRiskRejected;
};

export const filterCycleForCostGatedAiCouncil = (
  cycle: { markets?: OperationalCouncilTrace[] } | null | undefined,
) => {
  const markets = Array.isArray(cycle?.markets) ? cycle!.markets! : [];
  return {
    ...(cycle ?? {}),
    markets: markets.filter((trace) => !isRoutineFailClosedRiskRejection(trace)),
  };
};

/**
 * Cost-aware operational Council wrapper.
 *
 * Hard deterministic Risk rejects are already fail-closed. When the completed
 * action is NO_TRADE and the only REJECT vote comes from Risk, an AI review has
 * no ability to change the safe outcome and adds recurring cost without useful
 * decision authority. Evidence contradictions and independent non-risk rejects
 * remain eligible for escalation.
 */
export const runCostGatedAiCouncilForCycle = async (
  cycle: { markets?: OperationalCouncilTrace[] } | null | undefined,
  runtimeId: string,
  maxReviews = 2,
) => runConditionalAiCouncilForCycle(
  filterCycleForCostGatedAiCouncil(cycle),
  runtimeId,
  maxReviews,
);
