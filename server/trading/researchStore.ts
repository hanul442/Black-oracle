import { TRADING_STRATEGY_VERSION } from '../../src/trading/config';
import {
  pearsonCorrelation,
  resolveFeatureOutcome,
  sampleSufficiency,
  spearmanCorrelation,
  type ResearchFeatureObservation,
  type ResearchFeatureOutcome,
  type ResearchOutcomeHorizon,
} from '../../src/trading/research/featureOutcome';
import type { ShadowFeatureValue } from '../../src/trading/research/shadowFeatures';
import type { Candle } from '../../src/trading/types';
import type { MarketShadowResearchSnapshot } from './researchFeatures';

const MAX_OBSERVATIONS = 75_000;
const MAX_OUTCOMES = 300_000;
const HORIZONS: ResearchOutcomeHorizon[] = ['15M', '1H', '4H', '24H'];

export interface ResearchStoreCheckpoint {
  schemaVersion: 1;
  observations: ResearchFeatureObservation[];
  outcomes: ResearchFeatureOutcome[];
}

export interface AppendShadowResearchInput {
  cycleId: string;
  timestamp: number;
  market: string;
  referencePrice: number;
  executionDecision: ResearchFeatureObservation['executionDecision'];
  evidenceScore: number | null;
  evidenceConfidence: number;
  oracleTradeScore: number;
  snapshot: MarketShadowResearchSnapshot;
}

const cloneObservation = (item: ResearchFeatureObservation): ResearchFeatureObservation => ({
  ...item,
  metadata: { ...item.metadata },
});
const cloneOutcome = (item: ResearchFeatureOutcome): ResearchFeatureOutcome => ({ ...item });

const inferDirection = (feature: ShadowFeatureValue): ResearchFeatureObservation['direction'] => {
  if (!feature.available || feature.normalizedValue === null) return 'UNAVAILABLE';
  if (feature.featureFamily === 'VOLATILITY' || feature.featureFamily === 'VOLUME_WEIGHTED_LOCATION') return 'CONTEXTUAL';
  if (feature.normalizedValue > 0.1) return 'BULLISH';
  if (feature.normalizedValue < -0.1) return 'BEARISH';
  return 'NEUTRAL';
};

const featureValues = (snapshot: MarketShadowResearchSnapshot) => [
  ...(['fourHour', 'oneHour', 'fifteenMinute'] as const).flatMap((frameKey) => {
    const frame = snapshot.frames[frameKey];
    return [
      { timeframe: frame.timeframe, feature: frame.trendStrength },
      { timeframe: frame.timeframe, feature: frame.breakout },
      { timeframe: frame.timeframe, feature: frame.relativeStrength },
      { timeframe: frame.timeframe, feature: frame.vwap },
      { timeframe: frame.timeframe, feature: frame.realizedVolatility },
    ];
  }),
];

export class ResearchFeatureStore {
  private observations: ResearchFeatureObservation[] = [];
  private outcomes: ResearchFeatureOutcome[] = [];
  private observationIds = new Set<string>();
  private outcomeKeys = new Set<string>();

  checkpoint(): ResearchStoreCheckpoint {
    return {
      schemaVersion: 1,
      observations: this.observations.map(cloneObservation),
      outcomes: this.outcomes.map(cloneOutcome),
    };
  }

  restore(checkpoint?: ResearchStoreCheckpoint | null) {
    this.observations = [];
    this.outcomes = [];
    this.observationIds.clear();
    this.outcomeKeys.clear();
    if (!checkpoint) return this.summary();
    if (checkpoint.schemaVersion !== 1) throw new Error('Unsupported research store checkpoint schema.');

    for (const observation of (checkpoint.observations ?? []).slice(-MAX_OBSERVATIONS)) {
      if (!observation?.id || this.observationIds.has(observation.id)) continue;
      this.observations.push(cloneObservation(observation));
      this.observationIds.add(observation.id);
    }
    for (const outcome of (checkpoint.outcomes ?? []).slice(-MAX_OUTCOMES)) {
      if (!outcome?.observationId) continue;
      const key = `${outcome.observationId}:${outcome.horizon}`;
      if (this.outcomeKeys.has(key)) continue;
      this.outcomes.push(cloneOutcome(outcome));
      this.outcomeKeys.add(key);
    }
    return this.summary();
  }

  reset() {
    return this.restore(null);
  }

  appendShadowSnapshot(input: AppendShadowResearchInput) {
    const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || 'UNKNOWN';
    const appended: ResearchFeatureObservation[] = [];
    for (const { timeframe, feature } of featureValues(input.snapshot)) {
      const id = `${input.cycleId}:${input.market}:${timeframe}:${feature.featureId}:${feature.featureVersion}`;
      if (this.observationIds.has(id)) continue;
      const observation: ResearchFeatureObservation = {
        id,
        cycleId: input.cycleId,
        timestamp: input.timestamp,
        market: input.market.toUpperCase(),
        timeframe,
        featureFamily: feature.featureFamily,
        featureName: feature.featureId,
        featureVersion: feature.featureVersion,
        rawValue: feature.value,
        normalizedValue: feature.normalizedValue,
        direction: inferDirection(feature),
        confidence: feature.confidence,
        status: feature.status,
        strategyVersion: TRADING_STRATEGY_VERSION,
        codeCommit: commit,
        configVersion: TRADING_STRATEGY_VERSION,
        provenance: 'PROSPECTIVE',
        referencePrice: input.referencePrice,
        executionDecision: input.executionDecision,
        evidenceScore: input.evidenceScore,
        evidenceConfidence: input.evidenceConfidence,
        oracleTradeScore: input.oracleTradeScore,
        metadata: {
          available: feature.available,
          state: feature.state,
          authority: feature.authority,
          reasons: feature.reasons.slice(),
          ...feature.metadata,
          shadowConsensus: { ...input.snapshot.consensus },
        },
      };
      this.observations.push(observation);
      this.observationIds.add(id);
      appended.push(cloneObservation(observation));
    }
    if (this.observations.length > MAX_OBSERVATIONS) {
      const removed = this.observations.splice(0, this.observations.length - MAX_OBSERVATIONS);
      for (const item of removed) this.observationIds.delete(item.id);
    }
    return appended;
  }

  resolvePendingForMarket(market: string, candles: Candle[], now = Date.now()) {
    const normalized = market.toUpperCase();
    const resolved: ResearchFeatureOutcome[] = [];
    const candidates = this.observations.filter((item) => item.market === normalized);
    for (const observation of candidates) {
      for (const horizon of HORIZONS) {
        const key = `${observation.id}:${horizon}`;
        if (this.outcomeKeys.has(key)) continue;
        const outcome = resolveFeatureOutcome(observation, horizon, candles, now);
        if (!outcome) continue;
        this.outcomes.push(outcome);
        this.outcomeKeys.add(key);
        resolved.push(cloneOutcome(outcome));
      }
    }
    if (this.outcomes.length > MAX_OUTCOMES) {
      const removed = this.outcomes.splice(0, this.outcomes.length - MAX_OUTCOMES);
      for (const item of removed) this.outcomeKeys.delete(`${item.observationId}:${item.horizon}`);
    }
    return resolved;
  }

  list(market?: string, limit = 250) {
    const normalized = market?.toUpperCase();
    return this.observations
      .filter((item) => !normalized || item.market === normalized)
      .slice(-Math.max(1, Math.min(limit, 2_000)))
      .reverse()
      .map(cloneObservation);
  }

  listOutcomes(market?: string, limit = 500) {
    const normalized = market?.toUpperCase();
    const allowedIds = normalized
      ? new Set(this.observations.filter((item) => item.market === normalized).map((item) => item.id))
      : null;
    return this.outcomes
      .filter((item) => !allowedIds || allowedIds.has(item.observationId))
      .slice(-Math.max(1, Math.min(limit, 5_000)))
      .reverse()
      .map(cloneOutcome);
  }

  summary() {
    const outcomeMap = new Map(this.outcomes.map((item) => [`${item.observationId}:${item.horizon}`, item]));
    const tradeCycles = new Set(
      this.observations.filter((item) => item.executionDecision === 'ENTER').map((item) => item.cycleId),
    );
    const noTradeCycles = new Set(
      this.observations.filter((item) => item.executionDecision === 'NO_TRADE').map((item) => item.cycleId),
    );
    const keys = [...new Set(this.observations.map((item) => `${item.featureName}:${item.timeframe}`))];
    const features = keys.map((key) => {
      const [featureName, timeframe] = key.split(':');
      const observations = this.observations.filter((item) => item.featureName === featureName && item.timeframe === timeframe);
      const available = observations.filter((item) => item.normalizedValue !== null);
      const resolved24 = available.flatMap((observation) => {
        const outcome = outcomeMap.get(`${observation.id}:24H`);
        return outcome ? [{ observation, outcome }] : [];
      });
      const featureValues = resolved24.map((item) => item.observation.normalizedValue as number);
      const futureReturns = resolved24.map((item) => item.outcome.futureReturn);
      const oracleScores = resolved24.map((item) => item.observation.oracleTradeScore);
      const evidenceScores = resolved24.map((item) => item.observation.evidenceScore).filter((item): item is number => item !== null);
      const evidenceFeatureValues = resolved24
        .filter((item) => item.observation.evidenceScore !== null)
        .map((item) => item.observation.normalizedValue as number);

      return {
        featureName,
        timeframe,
        status: observations[observations.length - 1]?.status ?? 'SHADOW',
        observationCount: observations.length,
        availableCount: available.length,
        resolved24hCount: resolved24.length,
        sampleSufficiency: sampleSufficiency(observations.length),
        pearsonIc24h: pearsonCorrelation(featureValues, futureReturns),
        rankIc24h: spearmanCorrelation(featureValues, futureReturns),
        correlationWithOracleScore: pearsonCorrelation(featureValues, oracleScores),
        correlationWithEvidenceScore: pearsonCorrelation(evidenceFeatureValues, evidenceScores),
      };
    });

    return {
      authority: 'SHADOW RESEARCH — NO EXECUTION AUTHORITY' as const,
      observationCount: this.observations.length,
      outcomeCount: this.outcomes.length,
      tradeCount: tradeCycles.size,
      noTradeCycleCount: noTradeCycles.size,
      sampleSufficiency: sampleSufficiency(this.observations.length),
      prospectiveCount: this.observations.filter((item) => item.provenance === 'PROSPECTIVE').length,
      reconstructedCount: this.observations.filter((item) => item.provenance === 'RECONSTRUCTED').length,
      features,
    };
  }
}

export const researchFeatureStore = new ResearchFeatureStore();
