import type { EvidenceAggregate, TradingEvidence } from './evidence';

export type EvidenceGateStatus = 'PASS' | 'WATCH' | 'REJECT' | 'NO_DATA';
export type EvidenceGateDirection = 'LONG' | 'SHORT';

export interface EvidenceGateDecision {
  status: EvidenceGateStatus;
  eligibleForNewRisk: boolean;
  score: number;
  confidence: number;
  activeCount: number;
  uniqueEvidenceCount: number;
  sourceDiversity: number;
  sourceTypeDiversity: number;
  weightedQuality: number;
  freshness: number;
  contradictionSeverity: number;
  evidenceIds: string[];
  reasons: string[];
}

export interface EvidenceGatePolicy {
  minWeightedQuality: number;
  minConfidence: number;
  watchConfidence: number;
  minFreshness: number;
  watchFreshness: number;
  minDirectionalScore: number;
  watchDirectionalScore: number;
  watchContradictionSeverity: number;
  rejectContradictionSeverity: number;
}

/**
 * Policy v1 is calibrated to the existing EvidenceAggregate scale rather than
 * introducing a second arbitrary scoring model. The aggregate already treats
 * 0.65 as the reference per-item quality denominator and five active items as
 * full coverage. The gate therefore uses 0.30 as a minimum per-item weighted
 * quality floor (roughly half of that reference), and requires aggregate
 * confidence to clear the range produced by a single moderate-quality item.
 * WATCH is deliberately non-authoritative: only PASS can add new risk.
 */
export const DEFAULT_EVIDENCE_GATE_POLICY: EvidenceGatePolicy = Object.freeze({
  minWeightedQuality: 0.30,
  minConfidence: 0.45,
  watchConfidence: 0.55,
  minFreshness: 0.08,
  watchFreshness: 0.18,
  minDirectionalScore: 5,
  watchDirectionalScore: 15,
  watchContradictionSeverity: 0.25,
  rejectContradictionSeverity: 0.40,
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const activeAt = (item: TradingEvidence, asOf: number) => item.observedAt <= asOf && item.expiresAt > asOf;

const sourceKey = (item: TradingEvidence) => {
  const source = item.source?.trim().toLowerCase();
  return `${item.sourceType}:${source || item.title.trim().toLowerCase()}`;
};

const evidenceIdentity = (item: TradingEvidence) => [
  item.market,
  item.direction,
  item.title.trim().toLowerCase(),
  sourceKey(item),
].join('|');

export const evaluateEvidenceGate = (
  aggregate: EvidenceAggregate,
  evidence: TradingEvidence[],
  direction: EvidenceGateDirection = 'LONG',
  policy: EvidenceGatePolicy = DEFAULT_EVIDENCE_GATE_POLICY,
): EvidenceGateDecision => {
  const asOf = aggregate.asOf;
  const active = evidence.filter((item) => item.market === aggregate.market && activeAt(item, asOf));
  const unique = Array.from(new Map(active.map((item) => [evidenceIdentity(item), item])).values());
  const reasons: string[] = [];

  if (active.length === 0 || aggregate.activeCount === 0 || aggregate.evidenceIds.length === 0) {
    return {
      status: 'NO_DATA',
      eligibleForNewRisk: false,
      score: aggregate.score,
      confidence: aggregate.confidence,
      activeCount: 0,
      uniqueEvidenceCount: 0,
      sourceDiversity: 0,
      sourceTypeDiversity: 0,
      weightedQuality: 0,
      freshness: 0,
      contradictionSeverity: 0,
      evidenceIds: [],
      reasons: ['REJECT — NO_ACTIVE_EVIDENCE'],
    };
  }

  const sourceDiversity = new Set(unique.map(sourceKey)).size;
  const sourceTypeDiversity = new Set(unique.map((item) => item.sourceType)).size;
  const weightedQualities = unique.map((item) => (item.strength / 100) * item.reliability);
  const weightedQuality = weightedQualities.length > 0
    ? weightedQualities.reduce((sum, value) => sum + value, 0) / weightedQualities.length
    : 0;
  const freshnessValues = unique.map((item) => {
    const life = Math.max(1, item.expiresAt - item.observedAt);
    return clamp((item.expiresAt - asOf) / life, 0, 1);
  });
  const freshness = freshnessValues.length > 0
    ? freshnessValues.reduce((sum, value) => sum + value, 0) / freshnessValues.length
    : 0;
  const totalDirectionalWeight = aggregate.bullishWeight + aggregate.bearishWeight;
  const contradictionSeverity = totalDirectionalWeight > 0
    ? Math.min(aggregate.bullishWeight, aggregate.bearishWeight) / totalDirectionalWeight
    : 0;

  let status: EvidenceGateStatus = 'PASS';
  const reject = (reason: string) => {
    status = 'REJECT';
    reasons.push(reason);
  };
  const watch = (reason: string) => {
    if (status === 'PASS') status = 'WATCH';
    reasons.push(reason);
  };

  if (unique.length < Math.min(2, active.length)) {
    reject('REJECT — DUPLICATED_EVIDENCE_DOES_NOT_ADD_DIVERSITY');
  }
  if (sourceDiversity === 0) reject('REJECT — NO_INDEPENDENT_EVIDENCE_SOURCE');
  if (weightedQuality < policy.minWeightedQuality) {
    reject(`REJECT — WEAK_EVIDENCE_QUALITY (${weightedQuality.toFixed(3)} < ${policy.minWeightedQuality.toFixed(3)})`);
  }
  if (freshness < policy.minFreshness) {
    reject(`REJECT — EVIDENCE_TOO_CLOSE_TO_EXPIRY (${freshness.toFixed(3)})`);
  } else if (freshness < policy.watchFreshness) {
    watch(`WATCH — EVIDENCE_FRESHNESS_DETERIORATING (${freshness.toFixed(3)})`);
  }
  if (aggregate.confidence < policy.minConfidence) {
    reject(`REJECT — INSUFFICIENT_EVIDENCE_CONFIDENCE (${aggregate.confidence.toFixed(3)})`);
  } else if (aggregate.confidence < policy.watchConfidence) {
    watch(`WATCH — MARGINAL_EVIDENCE_CONFIDENCE (${aggregate.confidence.toFixed(3)})`);
  }
  if (contradictionSeverity >= policy.rejectContradictionSeverity) {
    reject(`REJECT — SEVERE_EVIDENCE_CONTRADICTION (${contradictionSeverity.toFixed(3)})`);
  } else if (contradictionSeverity >= policy.watchContradictionSeverity) {
    watch(`WATCH — MATERIAL_EVIDENCE_CONTRADICTION (${contradictionSeverity.toFixed(3)})`);
  }

  const directionalScore = direction === 'LONG' ? aggregate.score : -aggregate.score;
  if (directionalScore < policy.minDirectionalScore) {
    reject(`REJECT — EVIDENCE_DIRECTION_MISALIGNED (${aggregate.score})`);
  } else if (directionalScore < policy.watchDirectionalScore) {
    watch(`WATCH — WEAK_DIRECTIONAL_ALIGNMENT (${aggregate.score})`);
  }

  if (status === 'PASS') {
    reasons.push(
      `PASS — ${unique.length} unique active evidence item(s), ${sourceDiversity} source(s), confidence ${aggregate.confidence.toFixed(3)}.`,
    );
  }

  return {
    status,
    eligibleForNewRisk: status === 'PASS',
    score: aggregate.score,
    confidence: aggregate.confidence,
    activeCount: active.length,
    uniqueEvidenceCount: unique.length,
    sourceDiversity,
    sourceTypeDiversity,
    weightedQuality,
    freshness,
    contradictionSeverity,
    evidenceIds: unique.map((item) => item.id),
    reasons,
  };
};
