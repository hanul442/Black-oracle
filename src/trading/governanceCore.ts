import type { EvidenceAggregate } from './evidence';
import type {
  AssetImpactAssessment,
  AssetScope,
  CouncilScenarioDisposition,
  CouncilScenarioRanking,
  TradingCouncilAssessment,
  TradingIntelligencePackage,
  TradingScenarioBranch,
  TradingScenarioSet,
} from './intelligencePipeline';
import type { LiquiditySnapshot, MultiTimeframeSnapshot } from './types';

export type GovernanceLensId = 'TREND' | 'EVENT' | 'LIQUIDITY' | 'RISK';
export type GovernanceLensStance = 'SUPPORT' | 'CHALLENGE' | 'MIXED' | 'INSUFFICIENT';

export interface GovernanceLensReview {
  lensId: GovernanceLensId;
  scenarioId: string;
  stance: GovernanceLensStance;
  confidence: number;
  reasons: string[];
}

export interface GovernedScenarioSet extends TradingScenarioSet {
  id: string;
}

export interface GovernedCouncilAssessment extends TradingCouncilAssessment {
  id: string;
  lensReviews: GovernanceLensReview[];
}

export interface GovernedTradingIntelligencePackage extends TradingIntelligencePackage {
  id: string;
  scenarios: GovernedScenarioSet;
  council: GovernedCouncilAssessment;
  provenance: {
    engine: 'DETERMINISTIC_COUNCIL_CORE_V1';
    evidenceAsOf: number;
    technicalAsOf: number;
    liquidityEligible: boolean;
  };
}

export interface GovernanceCoreInput {
  market: string;
  evidence: EvidenceAggregate;
  multiTimeframe: MultiTimeframeSnapshot;
  liquidity: LiquiditySnapshot;
  scope?: AssetScope;
  now?: number;
  ttlMs?: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
const round = (value: number, digits = 6) => Number(value.toFixed(digits));

const stableHash = (value: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};

const stableId = (prefix: string, parts: Array<string | number>) => `${prefix}-${stableHash(parts.join('|'))}`;

const directionFromEvidence = (evidence: EvidenceAggregate): AssetImpactAssessment['direction'] => {
  if (evidence.activeCount === 0) return 'NEUTRAL';
  const hasTwoSidedWeight = evidence.bullishWeight > 0.08 && evidence.bearishWeight > 0.08;
  if (evidence.contradictionCount > 0 && hasTwoSidedWeight) return 'MIXED';
  if (evidence.score >= 15) return 'BULLISH';
  if (evidence.score <= -15) return 'BEARISH';
  return 'NEUTRAL';
};

const buildImpact = (input: GovernanceCoreInput, now: number, expiresAt: number): AssetImpactAssessment => {
  const { evidence } = input;
  const direction = directionFromEvidence(evidence);
  const materiality = clamp01(Math.abs(evidence.score) / 100 * 0.55 + evidence.confidence * 0.45);
  let disposition: AssetImpactAssessment['disposition'] = 'INSUFFICIENT';
  if (evidence.activeCount > 0 && materiality >= 0.35 && evidence.confidence >= 0.45) disposition = 'MATERIAL';
  else if (evidence.activeCount > 0) disposition = 'WATCH';

  const reasons = evidence.reasons.slice();
  if (evidence.activeCount === 0) reasons.push('Entry governance requires at least one active structured external evidence item.');
  if (evidence.contradictionCount > 0) reasons.push(`${evidence.contradictionCount} contradiction link(s) require Council caution.`);

  return {
    market: input.market.toUpperCase(),
    scope: input.scope ?? 'CANDIDATE',
    disposition,
    direction,
    materiality: round(materiality),
    confidence: round(clamp01(evidence.confidence)),
    evidenceIds: evidence.evidenceIds.slice(),
    reasons,
    asOf: now,
    expiresAt,
    executionAuthority: false,
  };
};

const normalizedProbabilities = (values: number[]) => {
  const safe = values.map((value) => Math.max(0.01, value));
  const total = safe.reduce((sum, value) => sum + value, 0);
  return safe.map((value) => round(value / total));
};

const buildScenarios = (
  input: GovernanceCoreInput,
  now: number,
  expiresAt: number,
  scenarioSetId: string,
): GovernedScenarioSet => {
  const technical = clamp(input.multiTimeframe.directionalScore, -100, 100);
  const event = clamp(input.evidence.score, -100, 100);
  const liquidityBias = clamp(input.liquidity.orderbookImbalance * 45 + input.liquidity.signedChangeRate * 400, -100, 100);
  const combined = clamp(technical * 0.55 + event * 0.35 + liquidityBias * 0.10, -100, 100);
  const atrPct = input.multiTimeframe.frames.oneHour.indicators.atrPct;
  const volatility = clamp01(atrPct / 0.04);
  const contradictionPressure = clamp01(input.evidence.contradictionCount / Math.max(1, input.evidence.activeCount));

  const [bullProbability, baseProbability, bearProbability, tailProbability] = normalizedProbabilities([
    0.28 + Math.max(0, combined) / 240 - Math.max(0, -combined) / 650,
    0.38 - Math.abs(combined) / 520,
    0.20 + Math.max(0, -combined) / 240 - Math.max(0, combined) / 700,
    0.14 + volatility * 0.08 + contradictionPressure * 0.07,
  ]);

  const sharedConfidence = clamp01(
    input.multiTimeframe.confidence * 0.45
      + input.evidence.confidence * 0.35
      + clamp01(input.liquidity.score / 100) * 0.20,
  );
  const evidenceIds = input.evidence.evidenceIds.slice();
  const market = input.market.toUpperCase();
  const makeBranch = (
    label: TradingScenarioBranch['label'],
    probability: number,
    direction: TradingScenarioBranch['direction'],
    thesis: string,
    triggerConditions: string[],
    invalidationConditions: string[],
    watchItems: string[],
    confidenceAdjustment = 0,
  ): TradingScenarioBranch => ({
    id: stableId('scenario', [scenarioSetId, label]),
    market,
    label,
    probability,
    confidence: round(clamp01(sharedConfidence + confidenceAdjustment)),
    direction,
    thesis,
    triggerConditions,
    invalidationConditions,
    watchItems,
    evidenceIds,
  });

  const branches: TradingScenarioBranch[] = [
    makeBranch(
      'BULL', bullProbability, 'UP',
      'Evidence and multi-timeframe structure remain positively aligned and price continuation is sustained.',
      ['Directional score remains positive.', 'Bullish evidence remains active and non-stale.', 'Liquidity gate remains eligible.'],
      ['Directional score falls below neutral.', 'Material evidence turns bearish or expires.', 'Liquidity becomes ineligible.'],
      ['4H/1H trend alignment', 'Evidence expiry/contradictions', 'Spread and orderbook depth'],
      combined >= 20 ? 0.06 : -0.04,
    ),
    makeBranch(
      'BASE', baseProbability, 'FLAT',
      'Signals remain mixed enough that consolidation or slow drift is more likely than immediate expansion.',
      ['Directional score stays near neutral.', 'Evidence remains mixed or low-materiality.'],
      ['A high-confidence directional signal emerges.', 'Material event evidence changes the balance.'],
      ['Range width', '1H regime', 'Evidence materiality'],
      Math.abs(combined) <= 25 ? 0.04 : -0.03,
    ),
    makeBranch(
      'BEAR', bearProbability, 'DOWN',
      'Technical structure weakens and/or material source-backed evidence turns adverse for a long-only spot position.',
      ['Directional score becomes negative.', 'Bearish evidence weight exceeds bullish weight.'],
      ['Technical structure recovers with bullish evidence confirmation.'],
      ['Stop distance', 'Bearish evidence weight', 'Downtrend regime persistence'],
      combined <= -20 ? 0.06 : -0.04,
    ),
    makeBranch(
      'TAIL', tailProbability, 'VOLATILE',
      'Volatility, evidence contradiction, or liquidity deterioration creates a discontinuous adverse path.',
      ['ATR expands materially.', 'Contradictions increase.', 'Liquidity eligibility degrades.'],
      ['Volatility normalizes and evidence contradictions resolve.'],
      ['ATR%', 'Contradiction count', 'Liquidity warning/spread'],
      volatility >= 0.75 || contradictionPressure >= 0.5 ? 0.03 : -0.08,
    ),
  ];

  return {
    id: scenarioSetId,
    market,
    asOf: now,
    expiresAt,
    branches,
    sourceEvidenceIds: evidenceIds,
    executionAuthority: false,
  };
};

const branchAlignment = (branch: TradingScenarioBranch, combined: number, volatility: number) => {
  if (branch.direction === 'UP') return clamp01((combined + 100) / 200);
  if (branch.direction === 'DOWN') return clamp01((100 - combined) / 200);
  if (branch.direction === 'FLAT') return clamp01(1 - Math.abs(combined) / 100);
  return volatility;
};

const stanceFor = (
  lensId: GovernanceLensId,
  branch: TradingScenarioBranch,
  input: GovernanceCoreInput,
): GovernanceLensReview => {
  const technical = input.multiTimeframe.directionalScore;
  const evidence = input.evidence.score;
  const volatility = clamp01(input.multiTimeframe.frames.oneHour.indicators.atrPct / 0.04);
  let stance: GovernanceLensStance = 'MIXED';
  let confidence = 0.5;
  const reasons: string[] = [];

  if (lensId === 'TREND') {
    const alignment = branch.direction === 'UP' ? technical / 100
      : branch.direction === 'DOWN' ? -technical / 100
        : branch.direction === 'FLAT' ? 1 - Math.abs(technical) / 100
          : volatility;
    stance = alignment >= 0.35 ? 'SUPPORT' : alignment <= -0.2 ? 'CHALLENGE' : 'MIXED';
    confidence = clamp01(input.multiTimeframe.confidence);
    reasons.push(`Multi-timeframe directional score is ${Math.round(technical)}.`);
  } else if (lensId === 'EVENT') {
    if (input.evidence.activeCount === 0) {
      stance = 'INSUFFICIENT';
      confidence = 0;
      reasons.push('No active structured external evidence is available.');
    } else {
      const alignment = branch.direction === 'UP' ? evidence / 100
        : branch.direction === 'DOWN' ? -evidence / 100
          : branch.direction === 'FLAT' ? 1 - Math.abs(evidence) / 100
            : input.evidence.contradictionCount > 0 ? 0.7 : 0.2;
      stance = alignment >= 0.35 ? 'SUPPORT' : alignment <= -0.2 ? 'CHALLENGE' : 'MIXED';
      confidence = clamp01(input.evidence.confidence);
      reasons.push(`Evidence score is ${Math.round(evidence)} with ${input.evidence.activeCount} active item(s).`);
    }
  } else if (lensId === 'LIQUIDITY') {
    stance = input.liquidity.eligible ? 'SUPPORT' : 'CHALLENGE';
    confidence = clamp01(input.liquidity.score / 100);
    reasons.push(input.liquidity.eligible ? 'Liquidity gate is eligible.' : 'Liquidity gate is not eligible.');
    reasons.push(`Spread is ${input.liquidity.spreadBps.toFixed(1)} bps.`);
  } else {
    const tailPressure = volatility * 0.55 + clamp01(input.evidence.contradictionCount / 3) * 0.25 + (input.liquidity.warning ? 0.2 : 0);
    if (branch.label === 'TAIL') stance = tailPressure >= 0.45 ? 'SUPPORT' : 'MIXED';
    else stance = tailPressure >= 0.7 ? 'CHALLENGE' : 'SUPPORT';
    confidence = clamp01(0.55 + Math.abs(tailPressure - 0.5) * 0.7);
    reasons.push(`Tail-pressure proxy is ${Math.round(tailPressure * 100)}%.`);
  }

  return {
    lensId,
    scenarioId: branch.id,
    stance,
    confidence: round(confidence),
    reasons,
  };
};

const dispositionFor = (
  branch: TradingScenarioBranch,
  rank: number,
  consensusScore: number,
  confidence: number,
  input: GovernanceCoreInput,
): CouncilScenarioDisposition => {
  if (input.evidence.activeCount === 0) return 'INSUFFICIENT';
  if (!input.liquidity.eligible) return 'CHALLENGE';
  if (branch.label === 'TAIL' && rank === 1) return 'CHALLENGE';
  if (branch.label === 'BEAR' && rank === 1) return 'CHALLENGE';
  if (rank === 1 && consensusScore >= 0.55 && confidence >= 0.55) return 'ADVANCE';
  if (consensusScore < 0.35) return 'CHALLENGE';
  return 'MONITOR';
};

const buildCouncil = (
  input: GovernanceCoreInput,
  scenarios: GovernedScenarioSet,
  now: number,
  expiresAt: number,
  councilRunId: string,
): GovernedCouncilAssessment => {
  const technical = clamp(input.multiTimeframe.directionalScore, -100, 100);
  const event = clamp(input.evidence.score, -100, 100);
  const liquidityBias = clamp(input.liquidity.orderbookImbalance * 45 + input.liquidity.signedChangeRate * 400, -100, 100);
  const combined = clamp(technical * 0.55 + event * 0.35 + liquidityBias * 0.10, -100, 100);
  const volatility = clamp01(input.multiTimeframe.frames.oneHour.indicators.atrPct / 0.04);
  const lensIds: GovernanceLensId[] = ['TREND', 'EVENT', 'LIQUIDITY', 'RISK'];
  const lensReviews = scenarios.branches.flatMap((branch) => lensIds.map((lensId) => stanceFor(lensId, branch, input)));

  const scored = scenarios.branches.map((branch) => {
    const branchLens = lensReviews.filter((item) => item.scenarioId === branch.id);
    const support = branchLens.reduce((sum, item) => sum + (item.stance === 'SUPPORT' ? item.confidence : item.stance === 'CHALLENGE' ? -item.confidence : 0), 0) / branchLens.length;
    const alignment = branchAlignment(branch, combined, volatility);
    const consensusScore = clamp01(branch.probability * 0.45 + alignment * 0.25 + branch.confidence * 0.20 + clamp01((support + 1) / 2) * 0.10);
    const confidence = clamp01(branch.confidence * 0.55 + branchLens.reduce((sum, item) => sum + item.confidence, 0) / branchLens.length * 0.45);
    return { branch, consensusScore, confidence, branchLens };
  }).sort((a, b) => b.consensusScore - a.consensusScore || b.branch.probability - a.branch.probability || a.branch.id.localeCompare(b.branch.id));

  const rankings: CouncilScenarioRanking[] = scored.map((item, index) => {
    const rank = index + 1;
    const disposition = dispositionFor(item.branch, rank, item.consensusScore, item.confidence, input);
    const supports = item.branchLens.filter((review) => review.stance === 'SUPPORT');
    const challenges = item.branchLens.filter((review) => review.stance === 'CHALLENGE' || review.stance === 'INSUFFICIENT');
    return {
      scenarioId: item.branch.id,
      rank,
      consensusScore: round(item.consensusScore),
      probabilityEstimate: item.branch.probability,
      confidence: round(item.confidence),
      disposition,
      dominantSupport: supports[0]?.reasons[0] ?? 'No dominant supporting lens.',
      dominantChallenge: challenges[0]?.reasons[0] ?? 'No dominant challenging lens.',
      unresolvedUncertainty: [
        ...(input.evidence.contradictionCount > 0 ? ['Structured evidence contains unresolved contradiction links.'] : []),
        ...(input.evidence.activeCount < 2 ? ['Evidence breadth is thin.'] : []),
      ],
      preservedDissent: challenges.map((review) => `${review.lensId}: ${review.reasons[0]}`).slice(0, 4),
    };
  });

  const recommendedScenarioId = rankings[0]?.scenarioId ?? null;
  const crossScenarioObservations = [
    `Combined deterministic directional context is ${Math.round(combined)} on a -100 to +100 scale.`,
    `Council evaluated ${scenarios.branches.length} scenarios through ${lensIds.length} independent deterministic lenses.`,
  ];
  if (input.evidence.activeCount === 0) crossScenarioObservations.push('All entry governance remains insufficient until structured external evidence is attached.');

  return {
    id: councilRunId,
    market: input.market.toUpperCase(),
    asOf: now,
    expiresAt,
    recommendedScenarioId,
    rankings,
    crossScenarioObservations,
    executionAuthority: false,
    lensReviews,
  };
};

export const buildDeterministicGovernancePackage = (input: GovernanceCoreInput): GovernedTradingIntelligencePackage => {
  const market = input.market.toUpperCase();
  const now = input.now ?? Date.now();
  const ttlMs = clamp(input.ttlMs ?? 45 * 60_000, 5 * 60_000, 4 * 60 * 60_000);
  const expiresAt = now + ttlMs;
  const identity = [
    market,
    now,
    input.evidence.asOf,
    input.evidence.evidenceIds.slice().sort().join(','),
    Math.round(input.multiTimeframe.oracleTradeScore),
    Math.round(input.multiTimeframe.directionalScore),
  ];
  const packageId = stableId('intel', identity);
  const scenarioSetId = stableId('scenario-set', identity);
  const councilRunId = stableId('council', identity);
  const impact = buildImpact(input, now, expiresAt);
  const scenarios = buildScenarios(input, now, expiresAt, scenarioSetId);
  const council = buildCouncil(input, scenarios, now, expiresAt, councilRunId);

  return {
    id: packageId,
    market,
    generatedAt: now,
    expiresAt,
    impact,
    scenarios,
    council,
    evidenceIds: input.evidence.evidenceIds.slice(),
    executionAuthority: false,
    provenance: {
      engine: 'DETERMINISTIC_COUNCIL_CORE_V1',
      evidenceAsOf: input.evidence.asOf,
      technicalAsOf: input.multiTimeframe.asOf,
      liquidityEligible: input.liquidity.eligible,
    },
  };
};
