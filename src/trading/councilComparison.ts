import type { CouncilV2ChallengerPackage } from './councilV2.ts';
import type { CouncilScenarioDisposition, TradingScenarioBranch } from './intelligencePipeline.ts';
import type { MarketPriceSnapshot } from './marketHistory.ts';

export interface CouncilPredictionSnapshot {
  protocol: 'COUNCIL_V1' | 'COUNCIL_V2_CHALLENGER';
  scenarioId: string;
  label: TradingScenarioBranch['label'];
  direction: TradingScenarioBranch['direction'];
  probability: number;
  confidence: number;
  disposition: CouncilScenarioDisposition;
  score: number;
}

export interface CouncilComparisonObservation {
  id: string;
  market: string;
  generatedAt: number;
  targetTimestamp: number;
  anchorPrice: number;
  v1: CouncilPredictionSnapshot;
  v2: CouncilPredictionSnapshot;
  resolvedAt: number | null;
  targetPrice: number | null;
  rawReturn: number | null;
  v1DirectionalUtility: number | null;
  v2DirectionalUtility: number | null;
  v1Favorable: boolean | null;
  v2Favorable: boolean | null;
  executionAuthority: false;
  promotionAuthority: false;
}

export interface CouncilComparisonSummary {
  total: number;
  resolved: number;
  unresolved: number;
  disagreements: number;
  v1FavorableRate: number | null;
  v2FavorableRate: number | null;
  v1MeanDirectionalUtility: number | null;
  v2MeanDirectionalUtility: number | null;
  v1DirectionalBrierProxy: number | null;
  v2DirectionalBrierProxy: number | null;
  v2WinRateOnDisagreement: number | null;
  recommendation: 'INSUFFICIENT_DATA' | 'KEEP_V1' | 'V2_PROMOTION_CANDIDATE';
  executionAuthority: false;
  promotionAuthority: false;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const round = (value: number, digits = 8) => Number(value.toFixed(digits));
const FLAT_BAND = 0.003;
const VOLATILITY_BAND = 0.007;

const stableId = (market: string, generatedAt: number, v1ScenarioId: string, v2ScenarioId: string) => (
  `council-compare:${market}:${generatedAt}:${v1ScenarioId}:${v2ScenarioId}`
);

const predictionFrom = (
  protocol: CouncilPredictionSnapshot['protocol'],
  branch: TradingScenarioBranch,
  confidence: number,
  disposition: CouncilScenarioDisposition,
  score: number,
): CouncilPredictionSnapshot => ({
  protocol,
  scenarioId: branch.id,
  label: branch.label,
  direction: branch.direction,
  probability: clamp01(branch.probability),
  confidence: clamp01(confidence),
  disposition,
  score: clamp01(score),
});

export const createCouncilComparisonObservation = (
  value: CouncilV2ChallengerPackage,
  anchorPrice: number,
  horizonMs = 4 * 60 * 60_000,
): CouncilComparisonObservation | null => {
  if (!Number.isFinite(anchorPrice) || anchorPrice <= 0) return null;
  const generatedAt = value.challenger.generatedAt;
  const v1Ranking = value.base.council.rankings.find((item) => item.rank === 1) ?? value.base.council.rankings[0];
  const v2Assessment = value.challenger.assessments.find((item) => item.rank === 1) ?? value.challenger.assessments[0];
  if (!v1Ranking || !v2Assessment) return null;
  const v1Branch = value.base.scenarios.branches.find((item) => item.id === v1Ranking.scenarioId);
  const v2Branch = value.base.scenarios.branches.find((item) => item.id === v2Assessment.scenarioId);
  if (!v1Branch || !v2Branch) return null;
  return {
    id: stableId(value.base.market, generatedAt, v1Branch.id, v2Branch.id),
    market: value.base.market,
    generatedAt,
    targetTimestamp: generatedAt + Math.max(60_000, horizonMs),
    anchorPrice,
    v1: predictionFrom('COUNCIL_V1', v1Branch, v1Ranking.confidence, v1Ranking.disposition, v1Ranking.consensusScore),
    v2: predictionFrom('COUNCIL_V2_CHALLENGER', v2Branch, v2Assessment.confidence, v2Assessment.disposition, v2Assessment.synthesisScore),
    resolvedAt: null,
    targetPrice: null,
    rawReturn: null,
    v1DirectionalUtility: null,
    v2DirectionalUtility: null,
    v1Favorable: null,
    v2Favorable: null,
    executionAuthority: false,
    promotionAuthority: false,
  };
};

export const directionalUtility = (direction: TradingScenarioBranch['direction'], rawReturn: number) => {
  if (direction === 'UP') return rawReturn;
  if (direction === 'DOWN') return -rawReturn;
  if (direction === 'FLAT') return FLAT_BAND - Math.abs(rawReturn);
  return Math.abs(rawReturn) - VOLATILITY_BAND;
};

const firstTarget = (history: MarketPriceSnapshot[], market: string, targetTimestamp: number) => {
  for (const snapshot of history) {
    if (snapshot.timestamp < targetTimestamp) continue;
    const match = snapshot.prices.find(([candidate]) => candidate === market);
    if (match && Number.isFinite(match[1]) && match[1] > 0) return { timestamp: snapshot.timestamp, price: match[1] };
  }
  return null;
};

export const resolveCouncilComparisonObservations = (
  observations: CouncilComparisonObservation[],
  history: MarketPriceSnapshot[],
): CouncilComparisonObservation[] => {
  const orderedHistory = history.slice().sort((a, b) => a.timestamp - b.timestamp);
  return observations.map((item) => {
    if (item.resolvedAt != null) return { ...item, v1: { ...item.v1 }, v2: { ...item.v2 } };
    const target = firstTarget(orderedHistory, item.market, item.targetTimestamp);
    if (!target) return { ...item, v1: { ...item.v1 }, v2: { ...item.v2 } };
    const rawReturn = target.price / item.anchorPrice - 1;
    const v1Utility = directionalUtility(item.v1.direction, rawReturn);
    const v2Utility = directionalUtility(item.v2.direction, rawReturn);
    return {
      ...item,
      v1: { ...item.v1 },
      v2: { ...item.v2 },
      resolvedAt: target.timestamp,
      targetPrice: target.price,
      rawReturn: round(rawReturn),
      v1DirectionalUtility: round(v1Utility),
      v2DirectionalUtility: round(v2Utility),
      v1Favorable: v1Utility > 0,
      v2Favorable: v2Utility > 0,
    };
  });
};

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const favorableRate = (values: Array<boolean | null>) => {
  const usable = values.filter((value): value is boolean => typeof value === 'boolean');
  return usable.length ? usable.filter(Boolean).length / usable.length : null;
};
const brierProxy = (rows: CouncilComparisonObservation[], protocol: 'v1' | 'v2') => {
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => {
    const prediction = protocol === 'v1' ? row.v1 : row.v2;
    const outcome = protocol === 'v1' ? row.v1Favorable : row.v2Favorable;
    const probability = clamp01(prediction.probability * 0.7 + prediction.confidence * 0.3);
    return sum + (probability - (outcome ? 1 : 0)) ** 2;
  }, 0);
  return total / rows.length;
};

export const summarizeCouncilComparison = (
  observations: CouncilComparisonObservation[],
  minimumResolved = 60,
  minimumDisagreements = 15,
): CouncilComparisonSummary => {
  const resolved = observations.filter((item) => item.resolvedAt != null && item.rawReturn != null);
  const disagreements = resolved.filter((item) => item.v1.direction !== item.v2.direction || item.v1.disposition !== item.v2.disposition);
  const v1FavorableRate = favorableRate(resolved.map((item) => item.v1Favorable));
  const v2FavorableRate = favorableRate(resolved.map((item) => item.v2Favorable));
  const v1MeanDirectionalUtility = mean(resolved.flatMap((item) => item.v1DirectionalUtility == null ? [] : [item.v1DirectionalUtility]));
  const v2MeanDirectionalUtility = mean(resolved.flatMap((item) => item.v2DirectionalUtility == null ? [] : [item.v2DirectionalUtility]));
  const v1DirectionalBrierProxy = brierProxy(resolved, 'v1');
  const v2DirectionalBrierProxy = brierProxy(resolved, 'v2');
  const v2WinRateOnDisagreement = disagreements.length
    ? disagreements.filter((item) => (item.v2DirectionalUtility ?? -Infinity) > (item.v1DirectionalUtility ?? -Infinity)).length / disagreements.length
    : null;

  let recommendation: CouncilComparisonSummary['recommendation'] = 'INSUFFICIENT_DATA';
  if (resolved.length >= minimumResolved && disagreements.length >= minimumDisagreements) {
    const v2ImprovesHitRate = (v2FavorableRate ?? 0) >= (v1FavorableRate ?? 0) + 0.03;
    const v2ImprovesUtility = (v2MeanDirectionalUtility ?? -Infinity) > (v1MeanDirectionalUtility ?? Infinity);
    const v2NoWorseCalibration = (v2DirectionalBrierProxy ?? Infinity) <= (v1DirectionalBrierProxy ?? -Infinity);
    const v2WinsDisagreements = (v2WinRateOnDisagreement ?? 0) >= 0.55;
    recommendation = v2ImprovesHitRate && v2ImprovesUtility && v2NoWorseCalibration && v2WinsDisagreements
      ? 'V2_PROMOTION_CANDIDATE'
      : 'KEEP_V1';
  }

  return {
    total: observations.length,
    resolved: resolved.length,
    unresolved: observations.length - resolved.length,
    disagreements: disagreements.length,
    v1FavorableRate,
    v2FavorableRate,
    v1MeanDirectionalUtility,
    v2MeanDirectionalUtility,
    v1DirectionalBrierProxy,
    v2DirectionalBrierProxy,
    v2WinRateOnDisagreement,
    recommendation,
    executionAuthority: false,
    promotionAuthority: false,
  };
};
