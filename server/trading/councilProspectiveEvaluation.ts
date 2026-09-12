import type {
  CouncilCounterfactualObservation,
  CouncilCounterfactualReport,
} from './councilCounterfactual';

export type CouncilProspectiveMetric = {
  available: boolean;
  value: number | null;
  numerator?: number;
  denominator?: number;
  note: string;
};

export type CouncilProspectiveEvaluation = {
  schemaVersion: 1;
  runtimeId: string;
  status: 'NO_ELIGIBLE_OUTCOMES' | 'PARTIAL_METRICS' | 'OBSERVING';
  closedOutcomeCount: number;
  eligibleSampleCount: number;
  shadowBlockSignalCount: number;
  metrics: {
    lineageCoverage: CouncilProspectiveMetric;
    shadowBlockSignalRate: CouncilProspectiveMetric;
    candidateAvoidedLossShare: CouncilProspectiveMetric;
    candidateFalseBlockShare: CouncilProspectiveMetric;
    deterministicRejectLossShare: CouncilProspectiveMetric;
    redTeamOutcomeCoverage: CouncilProspectiveMetric;
    redTeamInvalidationRate: CouncilProspectiveMetric;
    redTeamInvalidatedLossShare: CouncilProspectiveMetric;
    redTeamSeriousChallengeLossShare: CouncilProspectiveMetric;
    redTeamCandidateNetBenefitKrw: CouncilProspectiveMetric;
    aiDissentLossShare: CouncilProspectiveMetric;
    hardCouncilAiDisagreementRate: CouncilProspectiveMetric;
    candidateNetBenefitKrw: CouncilProspectiveMetric;
  };
  missingProspectiveMetrics: Array<{
    id: 'ROUND0_CALIBRATION' | 'POST_DEBATE_CHANGE' | 'RED_TEAM_INVALIDATION' | 'FORECAST_CALIBRATION_DELTA';
    reason: string;
  }>;
  nextEvidenceNeeds: string[];
  causalClaimAllowed: false;
  policyChangeAuthority: false;
  executionAuthority: false;
  note: string;
};

const ratioMetric = (
  numerator: number,
  denominator: number,
  note: string,
): CouncilProspectiveMetric => ({
  available: denominator > 0,
  value: denominator > 0 ? numerator / denominator : null,
  numerator,
  denominator,
  note,
});

const isLoss = (observation: CouncilCounterfactualObservation) => observation.netPnl < 0;

export const buildCouncilProspectiveEvaluation = (
  report: CouncilCounterfactualReport,
): CouncilProspectiveEvaluation => {
  const observations = Array.isArray(report.observations) ? report.observations : [];
  const closedOutcomeCount = Math.max(0, Number(report.closedOutcomeCount) || 0);
  const eligibleSampleCount = observations.length;
  const blockSignals = observations.filter((item) => item.shadowBlockSignal);
  const avoidedLossCandidates = blockSignals.filter((item) => item.classification === 'CANDIDATE_AVOIDED_LOSS');
  const falseBlockCandidates = blockSignals.filter((item) => item.classification === 'CANDIDATE_FALSE_BLOCK_COST');
  const deterministicRejects = observations.filter((item) => item.deterministicVerdict === 'REJECT');
  const redTeamObserved = observations.filter((item) => item.redTeamResult != null);
  const redTeamInvalidated = observations.filter((item) => item.redTeamResult === 'INVALIDATED');
  const redTeamSeriousChallenges = observations.filter((item) => item.redTeamResult === 'SERIOUSLY_CHALLENGED');
  const redTeamCandidateAvoidedLossKrw = redTeamInvalidated
    .filter((item) => item.netPnl < 0)
    .reduce((sum, item) => sum - item.netPnl, 0);
  const redTeamCandidateFalseBlockCostKrw = redTeamInvalidated
    .filter((item) => item.netPnl > 0)
    .reduce((sum, item) => sum + item.netPnl, 0);
  const redTeamCandidateNetBenefitKrw = redTeamCandidateAvoidedLossKrw - redTeamCandidateFalseBlockCostKrw;
  const aiDissents = observations.filter((item) => item.aiStance === 'DISSENT');
  const hardDisagreements = observations.filter((item) =>
    (item.deterministicVerdict === 'APPROVE' && item.aiStance === 'DISSENT')
    || (item.deterministicVerdict === 'REJECT' && item.aiStance === 'AGREE'));

  const missingProspectiveMetrics: CouncilProspectiveEvaluation['missingProspectiveMetrics'] = [
    {
      id: 'ROUND0_CALIBRATION',
      reason: 'The current preserved rows do not separate a pre-debate Round 0 probability forecast from later Council state.',
    },
    {
      id: 'POST_DEBATE_CHANGE',
      reason: 'The current preserved rows do not contain per-agent before/after belief revisions required to measure debate-induced opinion change.',
    },
    {
      id: 'FORECAST_CALIBRATION_DELTA',
      reason: 'A comparable deterministic-only versus Council-assisted probability forecast pair is not yet preserved for Brier/calibration delta measurement.',
    },
  ];
  if (eligibleSampleCount > 0 && redTeamObserved.length === 0) {
    missingProspectiveMetrics.splice(2, 0, {
      id: 'RED_TEAM_INVALIDATION',
      reason: 'Eligible legacy outcome rows do not expose a preserved deterministic Red Team result; new Council traces support this field prospectively.',
    });
  }

  const nextEvidenceNeeds = [
    'Preserve Round 0 probability/confidence before any debate or revision.',
    'Preserve each AI Council member pre-debate and post-debate stance with immutable trace linkage.',
    'Continue preserving deterministic Red Team result on every entry-time Council trace so invalidation precision/false-block cost grows prospectively.',
    'Link deterministic-only and Council-assisted forecast probabilities to the same realized outcome.',
    'Continue collecting closed S2 outcomes without granting Council, Red Team, or AI execution authority.',
  ];

  const hasAiSample = observations.some((item) => item.aiStance != null);
  const hasRedTeamSample = redTeamObserved.length > 0;
  const status: CouncilProspectiveEvaluation['status'] = eligibleSampleCount === 0
    ? 'NO_ELIGIBLE_OUTCOMES'
    : hasAiSample || hasRedTeamSample
      ? 'OBSERVING'
      : 'PARTIAL_METRICS';

  return {
    schemaVersion: 1,
    runtimeId: report.runtimeId,
    status,
    closedOutcomeCount,
    eligibleSampleCount,
    shadowBlockSignalCount: blockSignals.length,
    metrics: {
      lineageCoverage: ratioMetric(
        eligibleSampleCount,
        closedOutcomeCount,
        'Share of closed outcomes with preserved entry lineage and an entry-time Council/AI shadow review.',
      ),
      shadowBlockSignalRate: ratioMetric(
        blockSignals.length,
        eligibleSampleCount,
        'Share of eligible outcomes where deterministic Council REJECT, Red Team INVALIDATED, and/or AI DISSENT produced a shadow block signal.',
      ),
      candidateAvoidedLossShare: ratioMetric(
        avoidedLossCandidates.length,
        blockSignals.length,
        'Among observed shadow block signals, share attached to trades that later lost money. Diagnostic only; not a causal avoided-loss rate.',
      ),
      candidateFalseBlockShare: ratioMetric(
        falseBlockCandidates.length,
        blockSignals.length,
        'Among observed shadow block signals, share attached to trades that later made money. Diagnostic candidate false-block cost.',
      ),
      deterministicRejectLossShare: ratioMetric(
        deterministicRejects.filter(isLoss).length,
        deterministicRejects.length,
        'Observed loss share among trades whose preserved deterministic Council review was REJECT while still shadow-only.',
      ),
      redTeamOutcomeCoverage: ratioMetric(
        redTeamObserved.length,
        eligibleSampleCount,
        'Share of eligible outcome-linked Council traces that preserve a deterministic Red Team result.',
      ),
      redTeamInvalidationRate: ratioMetric(
        redTeamInvalidated.length,
        redTeamObserved.length,
        'Share of outcome-linked Red Team reviews that were INVALIDATED before the realized trade outcome was known.',
      ),
      redTeamInvalidatedLossShare: ratioMetric(
        redTeamInvalidated.filter(isLoss).length,
        redTeamInvalidated.length,
        'Observed loss share among trades the entry-time Red Team INVALIDATED. Association only; no causal avoided-loss claim.',
      ),
      redTeamSeriousChallengeLossShare: ratioMetric(
        redTeamSeriousChallenges.filter(isLoss).length,
        redTeamSeriousChallenges.length,
        'Observed loss share among trades classified SERIOUSLY_CHALLENGED by the entry-time Red Team.',
      ),
      redTeamCandidateNetBenefitKrw: {
        available: redTeamInvalidated.length > 0,
        value: redTeamInvalidated.length > 0 ? redTeamCandidateNetBenefitKrw : null,
        numerator: redTeamCandidateAvoidedLossKrw,
        denominator: redTeamCandidateFalseBlockCostKrw,
        note: 'Candidate Red Team avoided-loss KRW minus candidate false-block KRW assuming INVALIDATED would have blocked the entry. Diagnostic counterfactual only.',
      },
      aiDissentLossShare: ratioMetric(
        aiDissents.filter(isLoss).length,
        aiDissents.length,
        'Observed loss share among trades with preserved AI DISSENT. This measures association, not causal protection value.',
      ),
      hardCouncilAiDisagreementRate: ratioMetric(
        hardDisagreements.length,
        observations.filter((item) => item.aiStance != null && item.deterministicVerdict != null).length,
        'Hard disagreement means deterministic APPROVE + AI DISSENT or deterministic REJECT + AI AGREE.',
      ),
      candidateNetBenefitKrw: {
        available: blockSignals.length > 0,
        value: blockSignals.length > 0 ? report.candidateNetBenefitKrw : null,
        numerator: report.candidateAvoidedLossKrw,
        denominator: report.candidateFalseBlockCostKrw,
        note: 'Candidate avoided-loss KRW minus candidate false-block KRW under a zero-P&L-if-blocked counterfactual. No causal claim is allowed.',
      },
    },
    missingProspectiveMetrics,
    nextEvidenceNeeds,
    causalClaimAllowed: false,
    policyChangeAuthority: false,
    executionAuthority: false,
    note: eligibleSampleCount
      ? 'Prospective evaluation is collecting outcome-linked shadow evidence. Deterministic Red Team result can now be measured against realized outcomes; Round 0/debate/calibration gaps remain.'
      : 'No eligible outcome-linked Council sample exists yet. Continue S2 shadow collection; do not infer value from model output alone.',
  };
};
