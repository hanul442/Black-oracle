export type EvidenceDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type EvidenceSourceType = 'PRIMARY' | 'NEWS' | 'MACRO' | 'ONCHAIN' | 'MARKET' | 'ANALYST' | 'SYSTEM';

export interface TradingEvidence {
  id: string;
  market: string;
  title: string;
  direction: EvidenceDirection;
  strength: number;
  reliability: number;
  sourceType: EvidenceSourceType;
  /** Legacy compact source label. Prefer publisher + sourceUrl for new evidence. */
  source?: string;
  publisher?: string;
  sourceUrl?: string;
  summary?: string;
  observedAt: number;
  expiresAt: number;
  contradictionOf?: string;
  tags?: string[];
}

export interface EvidenceAggregate {
  market: string;
  score: number;
  confidence: number;
  activeCount: number;
  bullishWeight: number;
  bearishWeight: number;
  contradictionCount: number;
  asOf: number;
  evidenceIds: string[];
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const directionSign = (direction: EvidenceDirection) => {
  if (direction === 'BULLISH') return 1;
  if (direction === 'BEARISH') return -1;
  return 0;
};

export const validateTradingEvidence = (evidence: TradingEvidence) => {
  if (!evidence.id.trim()) throw new Error('Evidence id is required.');
  if (!/^KRW-[A-Z0-9]+$/.test(evidence.market)) throw new Error('Evidence market must be a normalized KRW market.');
  if (!evidence.title.trim()) throw new Error('Evidence title is required.');
  if (!Number.isFinite(evidence.strength) || evidence.strength < 0 || evidence.strength > 100) {
    throw new Error('Evidence strength must be between 0 and 100.');
  }
  if (!Number.isFinite(evidence.reliability) || evidence.reliability < 0 || evidence.reliability > 1) {
    throw new Error('Evidence reliability must be between 0 and 1.');
  }
  if (!Number.isFinite(evidence.observedAt) || !Number.isFinite(evidence.expiresAt) || evidence.expiresAt <= evidence.observedAt) {
    throw new Error('Evidence expiry must be later than observedAt.');
  }
  if (evidence.sourceUrl) {
    try {
      const url = new URL(evidence.sourceUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('invalid protocol');
    } catch {
      throw new Error('Evidence sourceUrl must be an absolute HTTP(S) URL.');
    }
  }
};

export const aggregateTradingEvidence = (
  evidence: TradingEvidence[],
  market: string,
  asOf = Date.now(),
): EvidenceAggregate => {
  const normalized = market.toUpperCase();
  const active = evidence.filter((item) =>
    item.market === normalized && item.observedAt <= asOf && item.expiresAt > asOf,
  );

  if (active.length === 0) {
    return {
      market: normalized,
      score: 0,
      confidence: 0,
      activeCount: 0,
      bullishWeight: 0,
      bearishWeight: 0,
      contradictionCount: 0,
      asOf,
      evidenceIds: [],
      reasons: ['No active structured trading evidence is available; technical weights should be redistributed.'],
    };
  }

  const contradictedIds = new Set(active.map((item) => item.contradictionOf).filter((id): id is string => Boolean(id)));
  let signedWeight = 0;
  let absoluteWeight = 0;
  let bullishWeight = 0;
  let bearishWeight = 0;

  for (const item of active) {
    const life = Math.max(1, item.expiresAt - item.observedAt);
    const remaining = clamp((item.expiresAt - asOf) / life, 0, 1);
    const timeDecay = 0.2 + 0.8 * Math.sqrt(remaining);
    const contradictionPenalty = contradictedIds.has(item.id) ? 0.35 : 1;
    const weight = (item.strength / 100) * item.reliability * timeDecay * contradictionPenalty;
    const sign = directionSign(item.direction);

    signedWeight += sign * weight;
    absoluteWeight += Math.abs(weight);
    if (sign > 0) bullishWeight += weight;
    if (sign < 0) bearishWeight += weight;
  }

  const score = absoluteWeight > 0 ? Math.round(clamp((signedWeight / absoluteWeight) * 100, -100, 100)) : 0;
  const coverage = clamp(active.length / 5, 0, 1);
  const weightQuality = clamp(absoluteWeight / Math.max(1, active.length * 0.65), 0, 1);
  const directionalClarity = absoluteWeight > 0 ? Math.abs(signedWeight) / absoluteWeight : 0;
  const confidence = clamp(coverage * 0.35 + weightQuality * 0.35 + directionalClarity * 0.3, 0, 0.95);
  const contradictionCount = active.filter((item) => Boolean(item.contradictionOf)).length;

  const reasons = [
    `${active.length} active evidence item(s) aggregate to event score ${score}.`,
    `Bullish/bearish evidence weights are ${bullishWeight.toFixed(2)}/${bearishWeight.toFixed(2)} after reliability and expiry decay.`,
  ];
  if (contradictionCount > 0) reasons.push(`${contradictionCount} contradiction link(s) suppress superseded evidence weight.`);

  return {
    market: normalized,
    score,
    confidence,
    activeCount: active.length,
    bullishWeight,
    bearishWeight,
    contradictionCount,
    asOf,
    evidenceIds: active.map((item) => item.id),
    reasons,
  };
};

export class TradingEvidenceStore {
  private readonly items = new Map<string, TradingEvidence>();

  upsert(evidence: TradingEvidence) {
    const normalized = {
      ...evidence,
      market: evidence.market.toUpperCase(),
      publisher: evidence.publisher?.trim() || undefined,
      sourceUrl: evidence.sourceUrl?.trim() || undefined,
      summary: evidence.summary?.trim() || undefined,
      tags: evidence.tags?.slice(),
    };
    validateTradingEvidence(normalized);
    if (normalized.contradictionOf && normalized.contradictionOf === normalized.id) {
      throw new Error('Evidence cannot contradict itself.');
    }
    this.items.set(normalized.id, normalized);
    return { ...normalized, tags: normalized.tags?.slice() };
  }

  replaceAll(evidence: TradingEvidence[]) {
    if (!Array.isArray(evidence)) throw new Error('Evidence checkpoint must be an array.');
    this.items.clear();
    for (const item of evidence) this.upsert(item);
    return this.list(undefined, true);
  }

  remove(id: string) {
    return this.items.delete(id);
  }

  clear() {
    this.items.clear();
  }

  list(market?: string, includeExpired = false, asOf = Date.now()) {
    const normalized = market?.toUpperCase();
    return Array.from(this.items.values())
      .filter((item) => (!normalized || item.market === normalized) && (includeExpired || item.expiresAt > asOf))
      .sort((a, b) => b.observedAt - a.observedAt)
      .map((item) => ({ ...item, tags: item.tags?.slice() }));
  }

  aggregate(market: string, asOf = Date.now()) {
    return aggregateTradingEvidence(Array.from(this.items.values()), market, asOf);
  }
}
