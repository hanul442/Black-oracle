import type { ExperimentResult } from './experiment';
import type { MonteCarloVerdict } from './monteCarlo';

export type CandidateRole = 'CHAMPION' | 'CHALLENGER' | 'RETIRED';
export type ReliabilityVerdict = 'PASS' | 'EXTEND' | 'BLOCK';

export interface StrategyCandidate {
  id: string;
  strategyVersion: string;
  modelVersion: string | null;
  registeredAt: number;
  role: CandidateRole;
  experimentId: string | null;
  regimes: string[];
}

export interface PromotionEvidence {
  experimentStatus: ExperimentResult['status'];
  monteCarloVerdict: MonteCarloVerdict;
  reliabilityVerdict: ReliabilityVerdict;
}

export interface PromotionReview {
  candidateId: string;
  eligibleForReview: boolean;
  autoPromote: false;
  requiresHumanApproval: true;
  blockers: string[];
}

export interface HumanPromotionApproval {
  humanApproved: boolean;
  approvedBy: string;
  approvedAt: number;
  note?: string;
}

const cloneCandidate = (candidate: StrategyCandidate): StrategyCandidate => ({
  ...candidate,
  regimes: candidate.regimes.slice(),
});

const normalizeCandidate = (candidate: StrategyCandidate): StrategyCandidate => {
  if (!candidate.id.trim()) throw new Error('Candidate id is required.');
  if (!candidate.strategyVersion.trim()) throw new Error('Candidate strategyVersion is required.');
  if (!Number.isFinite(candidate.registeredAt) || candidate.registeredAt <= 0) throw new Error('Candidate registeredAt must be a positive timestamp.');

  return Object.freeze({
    ...candidate,
    id: candidate.id.trim(),
    strategyVersion: candidate.strategyVersion.trim(),
    modelVersion: candidate.modelVersion?.trim() || null,
    experimentId: candidate.experimentId?.trim() || null,
    regimes: Object.freeze([...new Set(candidate.regimes.map((item) => item.trim()).filter(Boolean))].sort()) as string[],
  });
};

export const assessPromotionEvidence = (
  candidate: StrategyCandidate,
  evidence: PromotionEvidence,
): PromotionReview => {
  const blockers: string[] = [];
  if (candidate.role !== 'CHALLENGER') blockers.push('Only CHALLENGER candidates can be promoted.');
  if (evidence.experimentStatus !== 'PASSED') blockers.push(`Experiment status is ${evidence.experimentStatus}, not PASSED.`);
  if (evidence.monteCarloVerdict !== 'PASS') blockers.push(`Monte Carlo verdict is ${evidence.monteCarloVerdict}, not PASS.`);
  if (evidence.reliabilityVerdict !== 'PASS') blockers.push(`Reliability verdict is ${evidence.reliabilityVerdict}, not PASS.`);

  return Object.freeze({
    candidateId: candidate.id,
    eligibleForReview: blockers.length === 0,
    autoPromote: false,
    requiresHumanApproval: true,
    blockers: Object.freeze(blockers) as string[],
  });
};

export class ChampionChallengerRegistry {
  private readonly candidates = new Map<string, StrategyCandidate>();
  private championId: string;

  constructor(champion: StrategyCandidate) {
    const normalized = normalizeCandidate({ ...champion, role: 'CHAMPION' });
    this.candidates.set(normalized.id, normalized);
    this.championId = normalized.id;
  }

  registerChallenger(candidate: StrategyCandidate) {
    const normalized = normalizeCandidate({ ...candidate, role: 'CHALLENGER' });
    if (this.candidates.has(normalized.id)) throw new Error(`Candidate ${normalized.id} is already registered.`);
    this.candidates.set(normalized.id, normalized);
    return cloneCandidate(normalized);
  }

  assess(candidateId: string, evidence: PromotionEvidence) {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) throw new Error(`Candidate ${candidateId} is not registered.`);
    return assessPromotionEvidence(candidate, evidence);
  }

  promote(candidateId: string, evidence: PromotionEvidence, approval: HumanPromotionApproval) {
    const review = this.assess(candidateId, evidence);
    if (!review.eligibleForReview) throw new Error(`Candidate ${candidateId} is not eligible for promotion review: ${review.blockers.join(' ')}`);
    if (!approval.humanApproved) throw new Error('Human approval is required for Champion promotion.');
    if (!approval.approvedBy.trim()) throw new Error('Champion promotion requires an approver identity.');
    if (!Number.isFinite(approval.approvedAt) || approval.approvedAt <= 0) throw new Error('Champion promotion requires a valid approval timestamp.');

    const currentChampion = this.candidates.get(this.championId);
    const challenger = this.candidates.get(candidateId);
    if (!currentChampion || !challenger) throw new Error('Champion/Challenger registry is inconsistent.');

    this.candidates.set(currentChampion.id, Object.freeze({ ...currentChampion, role: 'RETIRED' }));
    this.candidates.set(challenger.id, Object.freeze({ ...challenger, role: 'CHAMPION' }));
    this.championId = challenger.id;

    return {
      champion: cloneCandidate(this.candidates.get(this.championId)!),
      retiredChampion: cloneCandidate(this.candidates.get(currentChampion.id)!),
      approval: Object.freeze({ ...approval, approvedBy: approval.approvedBy.trim() }),
    };
  }

  champion() {
    return cloneCandidate(this.candidates.get(this.championId)!);
  }

  snapshot() {
    return [...this.candidates.values()].map(cloneCandidate).sort((a, b) => a.registeredAt - b.registeredAt || a.id.localeCompare(b.id));
  }
}
