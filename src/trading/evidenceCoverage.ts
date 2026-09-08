import type { EvidenceAggregate } from './evidence';
import { evidenceAliasesFor, findTradingInstrument, type AssetClass } from './assets';

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

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const assessEvidenceCoverage = (
  market: string,
  evidence: EvidenceAggregate,
): EvidenceCoverageAssessment => {
  const instrument = findTradingInstrument(market);
  if (evidence.activeCount > 0) {
    return {
      market: market.toUpperCase(),
      assetClass: instrument?.assetClass ?? 'UNKNOWN',
      status: 'COVERED',
      activeCount: evidence.activeCount,
      evidenceIds: evidence.evidenceIds.slice(),
      confidence: evidence.confidence,
      reason: `${evidence.activeCount} active source-backed evidence item(s) are available for this market.`,
    };
  }

  return {
    market: market.toUpperCase(),
    assetClass: instrument?.assetClass ?? 'UNKNOWN',
    status: 'MISSING',
    activeCount: 0,
    evidenceIds: [],
    confidence: 0,
    reason: 'No active source-backed evidence is attached to this market. New risk must wait for acquisition and re-analysis.',
  };
};

export const buildEvidenceCoverageRequest = (
  market: string,
  now = Date.now(),
  options: Partial<Pick<EvidenceCoverageRequest, 'trigger' | 'decisionId' | 'strategyId' | 'minimumActiveEvidence' | 'reason'>> = {},
): EvidenceCoverageRequest => {
  const normalized = market.toUpperCase();
  const instrument = findTradingInstrument(normalized);
  const aliases = evidenceAliasesFor(normalized);
  const requestKey = `coverage:${stableHash(`${normalized}|${Math.floor(now / (15 * 60_000))}`)}`;
  return {
    requestKey,
    market: normalized,
    assetClass: instrument?.assetClass ?? 'UNKNOWN',
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
