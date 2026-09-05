import type { EvidenceDirection, EvidenceSourceType, TradingEvidence } from './evidence';
import { validateTradingEvidence } from './evidence';

export interface ExternalEvidenceCandidate {
  market: string;
  title: string;
  summary?: string;
  publisher: string;
  sourceUrl: string;
  publishedAt: number;
  sourceType: Extract<EvidenceSourceType, 'PRIMARY' | 'NEWS' | 'MACRO' | 'ANALYST'>;
  reliability: number;
  tags?: string[];
}

export interface EvidenceClassification {
  relevant: boolean;
  direction: EvidenceDirection;
  strength: number;
  expiryHours: number;
  rationale: string;
  contradictionOf?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const buildEvidenceId = (candidate: ExternalEvidenceCandidate) =>
  `ext-${candidate.market.toLowerCase()}-${hashString(`${candidate.sourceUrl}|${candidate.title}`)}`;

export const buildExternalTradingEvidence = (
  candidate: ExternalEvidenceCandidate,
  classification: EvidenceClassification,
  observedAt = Date.now(),
): TradingEvidence | null => {
  if (!classification.relevant) return null;
  if (!/^KRW-[A-Z0-9]+$/.test(candidate.market.toUpperCase())) {
    throw new Error('External evidence candidate market must be a normalized KRW market.');
  }
  if (!candidate.title.trim() || !candidate.publisher.trim() || !candidate.sourceUrl.trim()) {
    throw new Error('External evidence requires title, publisher and sourceUrl.');
  }
  if (!Number.isFinite(candidate.publishedAt) || candidate.publishedAt <= 0) {
    throw new Error('External evidence publishedAt is required.');
  }
  if (!Number.isFinite(candidate.reliability) || candidate.reliability < 0 || candidate.reliability > 1) {
    throw new Error('External evidence reliability must be between 0 and 1.');
  }

  const publishedAgeMs = Math.max(0, observedAt - candidate.publishedAt);
  const maxAgeMs = candidate.sourceType === 'PRIMARY' ? 7 * 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;
  if (publishedAgeMs > maxAgeMs) return null;

  const expiryHours = clamp(Math.round(classification.expiryHours || 24), 4, candidate.sourceType === 'PRIMARY' ? 96 : 48);
  const evidence: TradingEvidence = {
    id: buildEvidenceId(candidate),
    market: candidate.market.toUpperCase(),
    title: candidate.title.trim().slice(0, 500),
    direction: classification.direction,
    strength: clamp(Math.round(classification.strength || 0), 0, 100),
    reliability: candidate.reliability,
    sourceType: candidate.sourceType,
    source: candidate.publisher.trim(),
    publisher: candidate.publisher.trim(),
    sourceUrl: candidate.sourceUrl.trim(),
    summary: (candidate.summary || classification.rationale || '').trim().slice(0, 1200) || undefined,
    observedAt,
    expiresAt: observedAt + expiryHours * 60 * 60 * 1000,
    contradictionOf: classification.contradictionOf || undefined,
    tags: Array.from(new Set([...(candidate.tags || []), 'external', 'auto-ingested'])),
  };
  validateTradingEvidence(evidence);
  return evidence;
};
