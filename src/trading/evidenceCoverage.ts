import type { EvidenceAggregate } from './evidence';
import { evidenceAliasesFor, findTradingInstrument, type AssetClass } from './assets';
import { inferAssetClassFromMarket } from './assetPolicy';

export type EvidenceCoverageStatus = 'COVERED' | 'MISSING' | 'REQUESTED' | 'STALE' | 'FAILED';
export type EvidenceRequestStatus = 'PENDING' | 'ACQUIRING' | 'FULFILLED' | 'FAILED' | 'CANCELLED';

export interface EvidenceCoverageAssessment {
  market: string;
  assetClass: AssetClass | 'UNKNOWN';
  status: EvidenceCoverageStatus;
  activeCount: number;
  evidenceIds: string[];
  confidence: number;
  reason: string;
}

export interface EvidenceCoverageRequest {
  requestKey: string;
  market: string;
  assetClass: AssetClass | 'UNKNOWN';
  aliases: string[];
  status: EvidenceRequestStatus;
  trigger: 'ENTRY_CANDIDATE' | 'MANUAL' | 'UNIVERSE_DISCOVERY';
  requestedAt: number;
  requiredBy: number;
  reason: string;
  decisionId?: string | null;
  strategyId?: string | null;
  minimumActiveEvidence: number;
  executionAuthority: false;
}

export interface EvidenceCoverageRequestOptions extends Partial<Pick<
  EvidenceCoverageRequest,
  'trigger' | 'decisionId' | 'strategyId' | 'minimumActiveEvidence' | 'reason'
>> {
  aliases?: string[];
  assetClass?: AssetClass | 'UNKNOWN';
}

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const normalizedAliases = (market: string, aliases: string[]) => Array.from(new Set([
  market,
  ...aliases.map((item) => item.normalize('NFKC').trim()).filter(Boolean),
]));

export const assessEvidenceCoverage = (
  market: string,
  evidence: EvidenceAggregate,
): EvidenceCoverageAssessment => {
  const assetClass = inferAssetClassFromMarket(market);
  if (evidence.activeCount > 0) {
    return {
      market: market.toUpperCase(),
      assetClass,
      status: 'COVERED',
      activeCount: evidence.activeCount,
      evidenceIds: evidence.evidenceIds.slice(),
      confidence: evidence.confidence,
      reason: `${evidence.activeCount} active source-backed evidence item(s) are available for this market.`,
    };
  }

  return {
    market: market.toUpperCase(),
    assetClass,
    status: 'MISSING',
    activeCount: 0,
    evidenceIds: [],
    confidence: 0,
    reason: 'No active source-backed evidence is attached to this market. Evidence-required new risk must wait for acquisition and re-analysis.',
  };
};

/**
 * Coverage means "we have source-backed information". Support means the analyzed
 * information is sufficiently material, reliable and directionally compatible with
 * a new long. These are deliberately different gates.
 */
export const evidenceSupportsNewLongRisk = (evidence: EvidenceAggregate) => ({
  allowed: evidence.activeCount > 0 && evidence.score >= 10 && evidence.confidence >= 0.45,
  reason: evidence.activeCount === 0
    ? 'No active source-backed evidence is available.'
    : evidence.score < 10
      ? `Source-backed evidence does not support a new long (aggregate score ${evidence.score}).`
      : evidence.confidence < 0.45
        ? `Evidence confidence ${(evidence.confidence * 100).toFixed(0)}% is below the 45% new-risk floor.`
        : `Source-backed evidence supports a new long with aggregate score ${evidence.score} and ${(evidence.confidence * 100).toFixed(0)}% confidence.`,
});

export const buildEvidenceCoverageRequest = (
  market: string,
  now = Date.now(),
  options: EvidenceCoverageRequestOptions = {},
): EvidenceCoverageRequest => {
  const normalized = market.toUpperCase();
  const instrument = findTradingInstrument(normalized);
  const inferredAssetClass = inferAssetClassFromMarket(normalized);
  const aliases = normalizedAliases(
    normalized,
    options.aliases?.length ? options.aliases : evidenceAliasesFor(normalized),
  );
  const assetClass = options.assetClass ?? instrument?.assetClass ?? inferredAssetClass;
  const requestKey = `coverage:${stableHash(`${normalized}|${Math.floor(now / (15 * 60_000))}`)}`;
  return {
    requestKey,
    market: normalized,
    assetClass,
    aliases,
    status: 'PENDING',
    trigger: options.trigger ?? 'ENTRY_CANDIDATE',
    requestedAt: now,
    requiredBy: now + 15 * 60_000,
    reason: options.reason ?? 'Technical/risk path produced a candidate but active source-backed evidence was missing.',
    decisionId: options.decisionId ?? null,
    strategyId: options.strategyId ?? null,
    minimumActiveEvidence: Math.max(1, Math.floor(options.minimumActiveEvidence ?? 1)),
    executionAuthority: false,
  };
};

export const shouldRequestEvidenceForEntry = (candidateAction: string, evidence: EvidenceAggregate) =>
  candidateAction === 'ENTER' && evidence.activeCount === 0;
