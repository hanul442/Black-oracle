import {
  buildDeterministicGovernancePackage,
  type GovernanceCoreInput,
  type GovernedTradingIntelligencePackage,
} from './governanceCore';
import type { CouncilScenarioDisposition, TradingScenarioBranch } from './intelligencePipeline';

export type CouncilV2SpecialistId = 'MARKET_STATE' | 'EVIDENCE_EVENT' | 'LIQUIDITY_REGIME' | 'RISK_EXECUTION' | 'FALSIFIER';
export type CouncilV2Stance = 'SUPPORT' | 'CHALLENGE' | 'MIXED' | 'INSUFFICIENT';

export interface CouncilV2SpecialistReview {
  specialistId: CouncilV2SpecialistId;
  scenarioId: string;
  stance: CouncilV2Stance;
  confidence: number;
  score: number;
  reasons: string[];
  blindFirstPass: true;
}

export interface CouncilV2ScenarioAssessment {
  scenarioId: string;
  rank: number;
  synthesisScore: number;
  confidence: number;
  supportRatio: number;
  challengeRatio: number;
  dissentRatio: number;
  falsificationPressure: number;
  disposition: CouncilScenarioDisposition;
  preservedDissent: string[];
  unresolvedUncertainty: string[];
}

export interface CouncilV2Assessment {
  protocolVersion: 'COUNCIL-V2-CHALLENGER-0.1';
  market: string;
  generatedAt: number;
  recommendedScenarioId: string | null;
  assessments: CouncilV2ScenarioAssessment[];
  specialistReviews: CouncilV2SpecialistReview[];
  baseCouncilRunId: string;
  basePackageId: string;
  executionAuthority: false;
  promotionAuthority: false;
}

export interface CouncilV2ChallengerPackage {
  base: GovernedTradingIntelligencePackage;
  challenger: CouncilV2Assessment;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const round = (value: number, digits = 6) => Number(value.toFixed(digits));

const scenarioDirectionAlignment = (branch: TradingScenarioBranch, directionalScore: number) => {
  const normalized = Math.max(-1, Math.min(1, directionalScore / 100));
  if (branch.direction === 'UP') return clamp01((normalized + 1) / 2);
  if (branch.direction === 'DOWN') return clamp01((1 - normalized) / 2);
  if (branch.direction === 'FLAT') return clamp01(1 - Math.abs(normalized));
  return clamp01(Math.abs(normalized));
};

const reviewMarketState = (branch: TradingScenarioBranch, input: GovernanceCoreInput): CouncilV2SpecialistReview => {
  const alignment = scenarioDirectionAlignment(branch, input.multiTimeframe.directionalScore);
  const confidence = clamp01(input.multiTimeframe.confidence);
  const stance: CouncilV2Stance = alignment >= 0.62 ? 'SUPPORT' : alignment <= 0.35 ? 'CHALLENGE' : 'MIXED';
  return {
    specialistId: 'MARKET_STATE',
    scenarioId: branch.id,
    stance,
    confidence: round(confidence),
    score: round(alignment),
    reasons: [
      `Directional score ${Math.round(input.multiTimeframe.directionalScore)} with ${(confidence * 100).toFixed(0)}% multi-timeframe confidence.`,
      `Scenario-direction alignment ${(alignment * 100).toFixed(0)}%.`,
    ],
    blindFirstPass: true,
  };
};

const reviewEvidenceEvent = (branch: TradingScenarioBranch, input: GovernanceCoreInput): CouncilV2SpecialistReview => {
  if (input.evidence.activeCount === 0) {
    return {
      specialistId: 'EVIDENCE_EVENT',
      scenarioId: branch.id,
      stance: 'INSUFFICIENT',
      confidence: 0,
      score: 0,
      reasons: ['No active structured external Evidence is available.'],
      blindFirstPass: true,
    };
  }
  const directional = input.evidence.score / 100;
  const alignment = branch.direction === 'UP'
    ? clamp01((directional + 1) / 2)
    : branch.direction === 'DOWN'
      ? clamp01((1 - directional) / 2)
      : branch.direction === 'FLAT'
        ? clamp01(1 - Math.abs(directional))
        : clamp01(input.evidence.contradictionCount / Math.max(1, input.evidence.activeCount));
  const contradictionPenalty = clamp01(input.evidence.contradictionCount / Math.max(1, input.evidence.activeCount));
  const score = clamp01(alignment * (1 - contradictionPenalty * 0.5));
  const stance: CouncilV2Stance = score >= 0.62 ? 'SUPPORT' : score <= 0.35 ? 'CHALLENGE' : 'MIXED';
  return {
    specialistId: 'EVIDENCE_EVENT',
    scenarioId: branch.id,
    stance,
    confidence: round(clamp01(input.evidence.confidence * (1 - contradictionPenalty * 0.35))),
    score: round(score),
    reasons: [
      `Evidence score ${Math.round(input.evidence.score)} from ${input.evidence.activeCount} active item(s).`,
      `${input.evidence.contradictionCount} contradiction link(s); contradiction pressure ${(contradictionPenalty * 100).toFixed(0)}%.`,
    ],
    blindFirstPass: true,
  };
};

const reviewLiquidityRegime = (branch: TradingScenarioBranch, input: GovernanceCoreInput): CouncilV2SpecialistReview => {
  const eligibility = input.liquidity.eligible ? 1 : 0;
  const liquidityQuality = clamp01(input.liquidity.score / 100);
  const warningPenalty = input.liquidity.warning ? 0.25 : 0;
  const directionalLiquidity = clamp01(0.5 + input.liquidity.orderbookImbalance * 0.7 + input.liquidity.signedChangeRate * 5);
  let scenarioFit = branch.direction === 'UP' ? directionalLiquidity
    : branch.direction === 'DOWN' ? 1 - directionalLiquidity
      : branch.direction === 'FLAT' ? 1 - Math.abs(directionalLiquidity - 0.5) * 2
        : clamp01(input.multiTimeframe.frames.oneHour.indicators.atrPct / 0.04);
  scenarioFit = clamp01(scenarioFit);
  const score = clamp01(liquidityQuality * 0.55 + scenarioFit * 0.30 + eligibility * 0.15 - warningPenalty);
  const stance: CouncilV2Stance = !input.liquidity.eligible ? 'CHALLENGE' : score >= 0.62 ? 'SUPPORT' : score <= 0.35 ? 'CHALLENGE' : 'MIXED';
  return {
    specialistId: 'LIQUIDITY_REGIME',
    scenarioId: branch.id,
    stance,
    confidence: round(clamp01(liquidityQuality * 0.75 + 0.2)),
    score: round(score),
    reasons: [
      `Liquidity ${input.liquidity.eligible ? 'eligible' : 'ineligible'}; score ${Math.round(input.liquidity.score)} and spread ${input.liquidity.spreadBps.toFixed(1)} bps.`,
      `Orderbook imbalance ${input.liquidity.orderbookImbalance.toFixed(3)}; signed change ${(input.liquidity.signedChangeRate * 100).toFixed(2)}%.`,
    ],
    blindFirstPass: true,
  };
};

const riskPressureFor = (branch: TradingScenarioBranch, input: GovernanceCoreInput) => {
  const volatility = clamp01(input.multiTimeframe.frames.oneHour.indicators.atrPct / 0.04);
  const contradictions = clamp01(input.evidence.contradictionCount / Math.max(1, input.evidence.activeCount));
  const liquidityRisk = input.liquidity.eligible ? (input.liquidity.warning ? 0.45 : 0.15) : 1;
  const directionMismatch = 1 - scenarioDirectionAlignment(branch, input.multiTimeframe.directionalScore);
  const tailBias = branch.label === 'TAIL' ? volatility : 0;
  return clamp01(volatility * 0.30 + contradictions * 0.20 + liquidityRisk * 0.25 + directionMismatch * 0.20 + tailBias * 0.05);
};

const reviewRiskExecution = (branch: TradingScenarioBranch, input: GovernanceCoreInput): CouncilV2SpecialistReview => {
  const pressure = riskPressureFor(branch, input);
  const score = clamp01(1 - pressure);
  const stance: CouncilV2Stance = pressure >= 0.62 ? 'CHALLENGE' : pressure <= 0.35 ? 'SUPPORT' : 'MIXED';
  return {
    specialistId: 'RISK_EXECUTION',
    scenarioId: branch.id,
    stance,
    confidence: round(clamp01(0.65 + Math.abs(pressure - 0.5) * 0.6)),
    score: round(score),
    reasons: [
      `Deterministic risk-pressure proxy ${(pressure * 100).toFixed(0)}%.`,
      `ATR ${(input.multiTimeframe.frames.oneHour.indicators.atrPct * 100).toFixed(2)}%, liquidity ${input.liquidity.eligible ? 'eligible' : 'ineligible'}.`,
    ],
    blindFirstPass: true,
  };
};

const reviewFalsifier = (branch: TradingScenarioBranch, input: GovernanceCoreInput): CouncilV2SpecialistReview => {
  const directionMismatch = 1 - scenarioDirectionAlignment(branch, input.multiTimeframe.directionalScore);
  const evidenceMismatch = branch.direction === 'UP'
    ? clamp01((-input.evidence.score + 100) / 200)
    : branch.direction === 'DOWN'
      ? clamp01((input.evidence.score + 100) / 200)
      : clamp01(Math.abs(input.evidence.score) / 100);
  const contradictionPressure = clamp01(input.evidence.contradictionCount / Math.max(1, input.evidence.activeCount));
  const confidenceWeakness = 1 - clamp01((input.evidence.confidence + input.multiTimeframe.confidence) / 2);
  const liquidityFailure = input.liquidity.eligible ? (input.liquidity.warning ? 0.35 : 0) : 1;
  const falsificationPressure = clamp01(
    directionMismatch * 0.28
      + evidenceMismatch * 0.28
      + contradictionPressure * 0.20
      + confidenceWeakness * 0.12
      + liquidityFailure * 0.12,
  );
  const stance: CouncilV2Stance = input.evidence.activeCount === 0
    ? 'INSUFFICIENT'
    : falsificationPressure >= 0.55 ? 'CHALLENGE'
      : falsificationPressure <= 0.25 ? 'SUPPORT'
        : 'MIXED';
  const reasons = [
    `Falsification pressure ${(falsificationPressure * 100).toFixed(0)}% from direction, Evidence, contradictions, confidence and liquidity.`,
  ];
  if (directionMismatch > 0.55) reasons.push('Scenario direction conflicts with current multi-timeframe structure.');
  if (evidenceMismatch > 0.55) reasons.push('Scenario direction is weakly supported or opposed by current structured Evidence.');
  if (contradictionPressure > 0.25) reasons.push('Evidence contradiction pressure is material.');
  if (!input.liquidity.eligible) reasons.push('Liquidity eligibility failure is an explicit invalidation condition.');

  return {
    specialistId: 'FALSIFIER',
    scenarioId: branch.id,
    stance,
    confidence: round(clamp01(0.70 + falsificationPressure * 0.25)),
    score: round(1 - falsificationPressure),
    reasons,
    blindFirstPass: true,
  };
};

const reviewScenario = (branch: TradingScenarioBranch, input: GovernanceCoreInput) => [
  reviewMarketState(branch, input),
  reviewEvidenceEvent(branch, input),
  reviewLiquidityRegime(branch, input),
  reviewRiskExecution(branch, input),
  reviewFalsifier(branch, input),
];

const dispositionFor = (
  rank: number,
  synthesisScore: number,
  confidence: number,
  dissentRatio: number,
  falsificationPressure: number,
  input: GovernanceCoreInput,
): CouncilScenarioDisposition => {
  if (input.evidence.activeCount === 0) return 'INSUFFICIENT';
  if (!input.liquidity.eligible) return 'CHALLENGE';
  if (falsificationPressure >= 0.55) return 'CHALLENGE';
  if (dissentRatio >= 0.5) return 'CHALLENGE';
  if (rank === 1 && synthesisScore >= 0.58 && confidence >= 0.55) return 'ADVANCE';
  if (synthesisScore < 0.38) return 'CHALLENGE';
  return 'MONITOR';
};

export const buildCouncilV2Challenger = (input: GovernanceCoreInput): CouncilV2ChallengerPackage => {
  const base = buildDeterministicGovernancePackage(input);
  const reviews = base.scenarios.branches.flatMap((branch) => reviewScenario(branch, input));

  const scored = base.scenarios.branches.map((branch) => {
    const branchReviews = reviews.filter((review) => review.scenarioId === branch.id);
    const nonFalsifier = branchReviews.filter((review) => review.specialistId !== 'FALSIFIER');
    const falsifier = branchReviews.find((review) => review.specialistId === 'FALSIFIER');
    const supportWeight = nonFalsifier.reduce((sum, review) => sum + (review.stance === 'SUPPORT' ? review.confidence : 0), 0);
    const challengeWeight = nonFalsifier.reduce((sum, review) => sum + (review.stance === 'CHALLENGE' || review.stance === 'INSUFFICIENT' ? review.confidence : 0), 0);
    const totalOpinionWeight = nonFalsifier.reduce((sum, review) => sum + review.confidence, 0) || 1;
    const supportRatio = clamp01(supportWeight / totalOpinionWeight);
    const challengeRatio = clamp01(challengeWeight / totalOpinionWeight);
    const mixedRatio = clamp01(nonFalsifier.filter((review) => review.stance === 'MIXED').reduce((sum, review) => sum + review.confidence, 0) / totalOpinionWeight);
    const dissentRatio = clamp01(challengeRatio + mixedRatio * 0.5);
    const specialistScore = nonFalsifier.reduce((sum, review) => sum + review.score * review.confidence, 0) / totalOpinionWeight;
    const baseRanking = base.council.rankings.find((ranking) => ranking.scenarioId === branch.id);
    const falsificationPressure = clamp01(1 - (falsifier?.score ?? 0));
    const synthesisScore = clamp01(
      (baseRanking?.consensusScore ?? branch.probability) * 0.45
        + specialistScore * 0.35
        + (1 - falsificationPressure) * 0.20,
    );
    const confidence = clamp01(
      branchReviews.reduce((sum, review) => sum + review.confidence, 0) / Math.max(1, branchReviews.length)
        * (1 - dissentRatio * 0.2),
    );
    return {
      branch,
      branchReviews,
      synthesisScore,
      confidence,
      supportRatio,
      challengeRatio,
      dissentRatio,
      falsificationPressure,
    };
  }).sort((left, right) => right.synthesisScore - left.synthesisScore || right.branch.probability - left.branch.probability || left.branch.id.localeCompare(right.branch.id));

  const assessments: CouncilV2ScenarioAssessment[] = scored.map((item, index) => {
    const rank = index + 1;
    const disposition = dispositionFor(rank, item.synthesisScore, item.confidence, item.dissentRatio, item.falsificationPressure, input);
    const dissent = item.branchReviews
      .filter((review) => review.stance === 'CHALLENGE' || review.stance === 'INSUFFICIENT')
      .map((review) => `${review.specialistId}: ${review.reasons[0]}`);
    const uncertainty = [
      ...(item.dissentRatio >= 0.3 ? [`Specialist dissent ${(item.dissentRatio * 100).toFixed(0)}% remains unresolved.`] : []),
      ...(item.falsificationPressure >= 0.35 ? [`Falsification pressure ${(item.falsificationPressure * 100).toFixed(0)}% remains material.`] : []),
      ...(input.evidence.activeCount < 2 ? ['Evidence breadth is thin.'] : []),
      ...(input.evidence.contradictionCount > 0 ? ['Structured Evidence contains contradiction links.'] : []),
    ];
    return {
      scenarioId: item.branch.id,
      rank,
      synthesisScore: round(item.synthesisScore),
      confidence: round(item.confidence),
      supportRatio: round(item.supportRatio),
      challengeRatio: round(item.challengeRatio),
      dissentRatio: round(item.dissentRatio),
      falsificationPressure: round(item.falsificationPressure),
      disposition,
      preservedDissent: dissent.slice(0, 5),
      unresolvedUncertainty: uncertainty,
    };
  });

  return {
    base,
    challenger: {
      protocolVersion: 'COUNCIL-V2-CHALLENGER-0.1',
      market: input.market.toUpperCase(),
      generatedAt: input.now ?? Date.now(),
      recommendedScenarioId: assessments[0]?.scenarioId ?? null,
      assessments,
      specialistReviews: reviews,
      baseCouncilRunId: base.council.id,
      basePackageId: base.id,
      executionAuthority: false,
      promotionAuthority: false,
    },
  };
};
