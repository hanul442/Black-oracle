import type { ExecutionDecision } from './types';

export type AssetScope = 'HELD' | 'CANDIDATE' | 'RESEARCH';
export type AssetImpactDisposition = 'MATERIAL' | 'WATCH' | 'IRRELEVANT' | 'INSUFFICIENT';
export type IntelligenceDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';

export interface AssetImpactAssessment {
  market: string;
  scope: AssetScope;
  disposition: AssetImpactDisposition;
  direction: IntelligenceDirection;
  materiality: number;
  confidence: number;
  evidenceIds: string[];
  reasons: string[];
  asOf: number;
  expiresAt: number;
  executionAuthority: false;
}

export type TradingScenarioLabel = 'BULL' | 'BASE' | 'BEAR' | 'TAIL';
export type TradingScenarioDirection = 'UP' | 'FLAT' | 'DOWN' | 'VOLATILE';

export interface TradingScenarioBranch {
  id: string;
  market: string;
  label: TradingScenarioLabel;
  probability: number;
  confidence: number;
  direction: TradingScenarioDirection;
  thesis: string;
  triggerConditions: string[];
  invalidationConditions: string[];
  watchItems: string[];
  evidenceIds: string[];
}

export interface TradingScenarioSet {
  market: string;
  asOf: number;
  expiresAt: number;
  branches: TradingScenarioBranch[];
  sourceEvidenceIds: string[];
  executionAuthority: false;
}

export type CouncilScenarioDisposition = 'ADVANCE' | 'MONITOR' | 'CHALLENGE' | 'INSUFFICIENT';

export interface CouncilScenarioRanking {
  scenarioId: string;
  rank: number;
  consensusScore: number;
  probabilityEstimate: number;
  confidence: number;
  disposition: CouncilScenarioDisposition;
  dominantSupport: string;
  dominantChallenge: string;
  unresolvedUncertainty: string[];
  preservedDissent: string[];
}

export interface TradingCouncilAssessment {
  market: string;
  asOf: number;
  expiresAt: number;
  recommendedScenarioId: string | null;
  rankings: CouncilScenarioRanking[];
  crossScenarioObservations: string[];
  executionAuthority: false;
}

export interface TradingIntelligencePackage {
  market: string;
  generatedAt: number;
  expiresAt: number;
  impact: AssetImpactAssessment;
  scenarios: TradingScenarioSet;
  council: TradingCouncilAssessment;
  evidenceIds: string[];
  executionAuthority: false;
}

export type IntelligenceDisposition = 'SUPPORTED' | 'CAUTION' | 'OPPOSED' | 'INSUFFICIENT' | 'STALE';
export type FinalDecisionAction = 'ENTER' | 'HOLD' | 'EXIT' | 'NO_TRADE';
export type FinalDecisionMode = 'OBSERVE_ONLY' | 'ENFORCE';

export interface FinalDecisionInput {
  market: string;
  executionDecision: ExecutionDecision;
  hasOpenPositionBefore: boolean;
  intelligence?: TradingIntelligencePackage | null;
  mode?: FinalDecisionMode;
  now?: number;
}

export interface FinalDecision {
  market: string;
  action: FinalDecisionAction;
  proposedAction: FinalDecisionAction;
  baseAction: FinalDecisionAction;
  mode: FinalDecisionMode;
  intelligenceDisposition: IntelligenceDisposition;
  intelligenceFresh: boolean;
  intelligenceConfidence: number;
  recommendedScenarioId: string | null;
  evidenceIds: string[];
  reasons: string[];
  executionAuthority: 'DETERMINISTIC_FINAL_DECISION_ENGINE';
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const normalizeBaseAction = (
  decision: ExecutionDecision,
  hasOpenPositionBefore: boolean,
): FinalDecisionAction => {
  if (decision.action === 'ENTER') return 'ENTER';
  if (decision.action === 'EXIT') return 'EXIT';
  return hasOpenPositionBefore ? 'HOLD' : 'NO_TRADE';
};

const findRecommendedRanking = (intelligence: TradingIntelligencePackage) => {
  const requested = intelligence.council.recommendedScenarioId;
  if (requested) {
    const match = intelligence.council.rankings.find((item) => item.scenarioId === requested);
    if (match) return match;
  }
  return [...intelligence.council.rankings].sort((a, b) => a.rank - b.rank)[0] ?? null;
};

const validateScenarioSet = (scenarioSet: TradingScenarioSet) => {
  if (scenarioSet.branches.length < 2) return false;
  const probabilitySum = scenarioSet.branches.reduce((sum, item) => sum + clamp01(item.probability), 0);
  return probabilitySum >= 0.9 && probabilitySum <= 1.1;
};

const assessIntelligence = (
  intelligence: TradingIntelligencePackage | null | undefined,
  now: number,
): {
  disposition: IntelligenceDisposition;
  fresh: boolean;
  confidence: number;
  recommendedScenarioId: string | null;
  evidenceIds: string[];
  reasons: string[];
} => {
  if (!intelligence) {
    return {
      disposition: 'INSUFFICIENT',
      fresh: false,
      confidence: 0,
      recommendedScenarioId: null,
      evidenceIds: [],
      reasons: ['No source-backed trading intelligence package is available.'],
    };
  }

  const evidenceIds = Array.from(new Set(intelligence.evidenceIds || []));
  if (intelligence.expiresAt <= now || intelligence.impact.expiresAt <= now || intelligence.scenarios.expiresAt <= now || intelligence.council.expiresAt <= now) {
    return {
      disposition: 'STALE',
      fresh: false,
      confidence: 0,
      recommendedScenarioId: intelligence.council.recommendedScenarioId,
      evidenceIds,
      reasons: ['The latest intelligence package or one of its components has expired.'],
    };
  }

  if (!validateScenarioSet(intelligence.scenarios)) {
    return {
      disposition: 'INSUFFICIENT',
      fresh: true,
      confidence: 0,
      recommendedScenarioId: intelligence.council.recommendedScenarioId,
      evidenceIds,
      reasons: ['Scenario set is incomplete or its probability mass is invalid.'],
    };
  }

  if (intelligence.impact.disposition === 'IRRELEVANT' || intelligence.impact.disposition === 'INSUFFICIENT' || evidenceIds.length === 0) {
    return {
      disposition: 'INSUFFICIENT',
      fresh: true,
      confidence: clamp01(intelligence.impact.confidence),
      recommendedScenarioId: intelligence.council.recommendedScenarioId,
      evidenceIds,
      reasons: ['Source-backed evidence is not sufficiently material for this asset.'],
    };
  }

  const ranking = findRecommendedRanking(intelligence);
  if (!ranking) {
    return {
      disposition: 'INSUFFICIENT',
      fresh: true,
      confidence: 0,
      recommendedScenarioId: null,
      evidenceIds,
      reasons: ['Council did not produce a comparable scenario ranking.'],
    };
  }

  const confidence = clamp01((clamp01(intelligence.impact.confidence) + clamp01(ranking.confidence)) / 2);
  const reasons = [
    `Asset impact is ${intelligence.impact.disposition.toLowerCase()} with ${Math.round(intelligence.impact.confidence * 100)}% confidence.`,
    `Council ranks scenario ${ranking.scenarioId} #${ranking.rank} with ${ranking.disposition.toLowerCase()} disposition and ${Math.round(ranking.confidence * 100)}% confidence.`,
  ];

  if (intelligence.impact.direction === 'BEARISH') {
    return {
      disposition: 'OPPOSED',
      fresh: true,
      confidence,
      recommendedScenarioId: ranking.scenarioId,
      evidenceIds,
      reasons: [...reasons, 'Material source-backed impact is bearish for a long-only spot entry.'],
    };
  }

  if (ranking.disposition === 'CHALLENGE') {
    return {
      disposition: 'OPPOSED',
      fresh: true,
      confidence,
      recommendedScenarioId: ranking.scenarioId,
      evidenceIds,
      reasons: [...reasons, 'Council materially challenges the leading scenario.'],
    };
  }

  if (ranking.disposition === 'INSUFFICIENT' || confidence < 0.55) {
    return {
      disposition: 'INSUFFICIENT',
      fresh: true,
      confidence,
      recommendedScenarioId: ranking.scenarioId,
      evidenceIds,
      reasons: [...reasons, 'Council/intelligence confidence is below the deterministic 55% intelligence threshold.'],
    };
  }

  if (ranking.disposition === 'MONITOR' || intelligence.impact.direction === 'MIXED' || intelligence.impact.disposition === 'WATCH') {
    return {
      disposition: 'CAUTION',
      fresh: true,
      confidence,
      recommendedScenarioId: ranking.scenarioId,
      evidenceIds,
      reasons: [...reasons, 'Intelligence remains actionable only as cautionary context.'],
    };
  }

  return {
    disposition: 'SUPPORTED',
    fresh: true,
    confidence,
    recommendedScenarioId: ranking.scenarioId,
    evidenceIds,
    reasons: [...reasons, 'Source-backed impact and Council review support the current long-entry thesis.'],
  };
};

export const buildFinalDecision = (input: FinalDecisionInput): FinalDecision => {
  const mode = input.mode ?? 'OBSERVE_ONLY';
  const now = input.now ?? Date.now();
  const baseAction = normalizeBaseAction(input.executionDecision, input.hasOpenPositionBefore);
  const intelligence = assessIntelligence(input.intelligence, now);
  let proposedAction = baseAction;
  const reasons = [...input.executionDecision.reasons, ...intelligence.reasons];

  // Protective and deterministic technical exits retain authority. Council never blocks a stop or risk exit.
  if (baseAction === 'EXIT') {
    proposedAction = 'EXIT';
    reasons.push('Existing deterministic exit authority overrides intelligence overlays.');
  } else if (baseAction === 'ENTER') {
    if (intelligence.disposition === 'SUPPORTED' || intelligence.disposition === 'CAUTION') {
      proposedAction = 'ENTER';
      reasons.push('Deterministic technical/risk entry remains eligible after intelligence review.');
    } else {
      proposedAction = 'NO_TRADE';
      reasons.push(`New entry is blocked by intelligence disposition ${intelligence.disposition}.`);
    }
  } else {
    // Intelligence cannot manufacture a new order when the technical/risk engine did not request one.
    proposedAction = baseAction;
    reasons.push('Intelligence cannot manufacture an ENTER or EXIT action absent a deterministic trading trigger.');
  }

  return {
    market: input.market.toUpperCase(),
    action: mode === 'OBSERVE_ONLY' ? baseAction : proposedAction,
    proposedAction,
    baseAction,
    mode,
    intelligenceDisposition: intelligence.disposition,
    intelligenceFresh: intelligence.fresh,
    intelligenceConfidence: intelligence.confidence,
    recommendedScenarioId: intelligence.recommendedScenarioId,
    evidenceIds: intelligence.evidenceIds,
    reasons,
    executionAuthority: 'DETERMINISTIC_FINAL_DECISION_ENGINE',
  };
};
