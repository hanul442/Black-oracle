import { buildShadowCouncil, type CouncilSnapshot } from './council';
import { buildShadowArbiterRecommendation, type ShadowArbiterSnapshot } from './councilArbiter';
import type { EvidenceAggregate } from './evidence';
import { buildEvidenceForecast, type EvidenceForecast } from './evidenceForecast';
import type { MicrostructureSnapshot } from './microstructure';
import type { MicrostructureChallengerSnapshot } from './microstructureChallenger';
import { buildStrategyRouterDecision, type StrategyRouterDecision } from './strategyRouter';
import type { ExecutionDecision, MultiTimeframeSnapshot } from './types';

export interface PreTradeShadowReview {
  stage: 'PRE_EXECUTION_SHADOW';
  executionAuthority: false;
  generatedAt: number;
  market: string;
  reviewedAction: ExecutionDecision['action'];
  forecast: EvidenceForecast;
  router: StrategyRouterDecision;
  council: CouncilSnapshot;
  arbiter: ShadowArbiterSnapshot;
}

export interface PreTradeShadowReviewInput {
  timestamp?: number;
  market: string;
  decision: ExecutionDecision;
  multiTimeframe: MultiTimeframeSnapshot;
  evidence: EvidenceAggregate;
  microstructure?: MicrostructureSnapshot | null;
  challenger?: MicrostructureChallengerSnapshot | null;
}

export const buildPreTradeShadowReview = (input: PreTradeShadowReviewInput): PreTradeShadowReview => {
  const market = input.market.toUpperCase();
  const forecast = buildEvidenceForecast(input.evidence);
  const router = buildStrategyRouterDecision(input.multiTimeframe, forecast);
  const council = buildShadowCouncil({
    market,
    decision: input.decision,
    multiTimeframe: input.multiTimeframe,
    evidence: input.evidence,
    microstructure: input.microstructure ?? null,
  });
  const arbiter = buildShadowArbiterRecommendation({
    action: input.decision.action,
    council,
    cycle: input.multiTimeframe.cycle ?? null,
    challenger: input.challenger ?? null,
  });

  return {
    stage: 'PRE_EXECUTION_SHADOW',
    executionAuthority: false,
    generatedAt: input.timestamp ?? Date.now(),
    market,
    reviewedAction: input.decision.action,
    forecast,
    router,
    council,
    arbiter,
  };
};
