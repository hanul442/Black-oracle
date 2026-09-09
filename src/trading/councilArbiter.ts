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
  cycleTiming: MultiCycleSnapshot['entryTiming'] | 'UNAVAILABLE';
  challengerAlignment: MicrostructureChallengerSnapshot['alignment'] | 'UNAVAILABLE';
}

/**
 * Shadow-only arbiter recommendation used to calibrate whether Council/Router
 * disagreement would have improved Paper outcomes. It must never mutate an
 * ExecutionDecision or grant execution authority.
 */
export const buildShadowArbiterRecommendation = (input: ShadowArbiterInput): ShadowArbiterSnapshot => {
  const cycleTiming = input.cycle?.entryTiming ?? 'UNAVAILABLE';
  const challengerAlignment = input.challenger?.alignment ?? 'UNAVAILABLE';
  const base = {
    mode: 'SHADOW' as const,
    executionAuthority: false as const,
    councilVerdict: input.council.verdict,
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

  if (input.council.verdict === 'REJECT') {
    return {
      ...base,
      recommendation: 'BLOCK',
      reasons: [
        'Deterministic Council returned REJECT for the proposed new-risk entry.',
        'This is a shadow recommendation only and does not change the completed Paper execution path.',
      ],
    };
  }

  const reviewReasons: string[] = [];
  if (input.council.verdict === 'CONDITIONAL') {
    reviewReasons.push('Deterministic Council returned CONDITIONAL rather than APPROVE.');
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
        'Persist this disagreement for outcome calibration before granting any execution authority.',
      ],
    };
  }

  return {
    ...base,
    recommendation: 'ALLOW',
    reasons: [
      'Council APPROVE has no recorded challenger conflict and cycle timing is READY or unavailable.',
      'ALLOW is still a shadow recommendation and does not authorize execution.',
    ],
  };
};
