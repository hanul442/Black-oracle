import type { CouncilSnapshot } from './council';
import type { MicrostructureChallengerSnapshot } from './microstructureChallenger';
import type { MultiCycleSnapshot } from './types';

export type ShadowArbiterRecommendation = 'ALLOW' | 'REVIEW' | 'BLOCK' | 'NOT_APPLICABLE';

export interface ShadowArbiterInput {
  action: 'ENTER' | 'EXIT' | 'HOLD' | 'NO_TRADE';
  council: CouncilSnapshot;
  cycle?: MultiCycleSnapshot | null;
  challenger?: MicrostructureChallengerSnapshot | null;
}

export interface ShadowArbiterSnapshot {
  mode: 'SHADOW';
  executionAuthority: false;
  recommendation: ShadowArbiterRecommendation;
  reasons: string[];
  councilVerdict: CouncilSnapshot['verdict'];
  redTeamResult: CouncilSnapshot['redTeamResult'];
  decisionMethod: CouncilSnapshot['decisionMethod'];
  criticalDissent: string[];
  dataGaps: string[];
  cycleTiming: MultiCycleSnapshot['entryTiming'] | 'UNAVAILABLE';
  challengerAlignment: MicrostructureChallengerSnapshot['alignment'] | 'UNAVAILABLE';
}

/**
 * Shadow-only Arbiter recommendation used to calibrate whether Council/Router
 * disagreement would have improved Paper outcomes. It never mutates an
 * ExecutionDecision, cannot bypass deterministic Risk, and does not use
 * majority voting as a decision rule.
 */
export const buildShadowArbiterRecommendation = (input: ShadowArbiterInput): ShadowArbiterSnapshot => {
  const cycleTiming: ShadowArbiterSnapshot['cycleTiming'] = input.cycle?.entryTiming ?? 'UNAVAILABLE';
  const challengerAlignment: ShadowArbiterSnapshot['challengerAlignment'] = input.challenger?.alignment ?? 'UNAVAILABLE';
  const base = {
    mode: 'SHADOW' as const,
    executionAuthority: false as const,
    councilVerdict: input.council.verdict,
    redTeamResult: input.council.redTeamResult,
    decisionMethod: input.council.decisionMethod,
    criticalDissent: input.council.criticalDissent.slice(),
    dataGaps: input.council.dataGaps.slice(),
    cycleTiming,
    challengerAlignment,
  };

  if (input.action !== 'ENTER') {
    return {
      ...base,
      recommendation: 'NOT_APPLICABLE',
      reasons: ['Shadow Arbiter currently evaluates new-risk entry candidates only; existing-risk exits and no-trade outcomes are not blocked.'],
    };
  }

  if (input.council.verdict === 'REJECT' || input.council.redTeamResult === 'INVALIDATED') {
    return {
      ...base,
      recommendation: 'BLOCK',
      reasons: [
        input.council.redTeamResult === 'INVALIDATED'
          ? 'Independent Red Team invalidated the proposed new-risk thesis.'
          : 'Evidence-gated Council rejected the proposed new-risk entry.',
        ...input.council.criticalDissent.slice(0, 3),
        'This is a shadow recommendation only and does not change the completed Paper execution path.',
      ],
    };
  }

  const reviewReasons: string[] = [];
  if (input.council.verdict === 'CONDITIONAL') {
    reviewReasons.push('Evidence-gated Council returned CONDITIONAL rather than APPROVE.');
  }
  if (input.council.redTeamResult === 'SERIOUSLY_CHALLENGED') {
    reviewReasons.push('Independent Red Team found an unresolved material challenge.');
  }
  if (input.council.dataGaps.length > 0) {
    reviewReasons.push(`${input.council.dataGaps.length} material Council data gap(s) remain unresolved.`);
  }
  if (challengerAlignment === 'CONFLICTS') {
    reviewReasons.push('Microstructure Challenger conflicts with the baseline entry direction.');
  }
  if (cycleTiming !== 'UNAVAILABLE' && cycleTiming !== 'READY') {
    reviewReasons.push(`Multi-cycle entry timing is ${cycleTiming}, not READY.`);
  }

  if (reviewReasons.length > 0) {
    return {
      ...base,
      recommendation: 'REVIEW',
      reasons: [
        ...reviewReasons,
        ...input.council.criticalDissent.slice(0, 2),
        'Persist this disagreement for outcome calibration before granting any execution authority.',
      ],
    };
  }

  return {
    ...base,
    recommendation: 'ALLOW',
    reasons: [
      'Council v3 passed evidence gates, Red Team did not invalidate the thesis, and no recorded challenger/cycle objection remains.',
      'ALLOW is still a shadow recommendation and does not authorize execution.',
    ],
  };
};
