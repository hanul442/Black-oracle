import type { StrategyFactoryCandidate } from './strategyFactory';
import { fingerprintStrategyGenome, normalizeStrategyGenome, type StrategyGenome } from './strategyGenome';
import type { StrategyPromotionEligibility, StrategyPromotionStage } from './promotionHardGate';

export type StrategyVaultState = 'RESEARCH' | 'INCUBATOR' | 'CHALLENGER' | 'CHAMPION_CANDIDATE' | 'RETIRED';
export type StrategyLifecycleReviewDecision = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StrategyVaultEntry {
  genomeId: string;
  fingerprint: string;
  strategyVersion: string;
  modelVersion: string | null;
  generation: number;
  parentGenomeIds: string[];
  registeredAt: number;
  state: StrategyVaultState;
  stateUpdatedAt: number;
  retiredReason: string | null;
  executionAuthority: false;
  promotionAuthority: false;
  capitalAuthority: false;
}

export interface StrategyLifecycleReview {
  id: string;
  sequence: number;
  genomeId: string;
  stage: StrategyPromotionStage;
  fromState: StrategyVaultState;
  toState: StrategyVaultState;
  requestedAt: number;
  decidedAt: number | null;
  decision: StrategyLifecycleReviewDecision;
  decidedBy: string | null;
  note: string | null;
  eligibility: {
    policyVersion: string;
    verdict: StrategyPromotionEligibility['verdict'];
    eligible: boolean;
    minimumGrade: StrategyPromotionEligibility['minimumGrade'];
    blockers: string[];
    insufficientEvidence: string[];
    reasons: string[];
  };
  autoTransition: false;
  requiresHumanApproval: true;
  executionAuthority: false;
  promotionAuthority: false;
  capitalAuthority: false;
}

export interface StrategyLifecycleApproval {
  approved: boolean;
  decidedBy: string;
  decidedAt: number;
  note?: string;
}

export interface StrategyVaultCheckpoint {
  schemaVersion: 1;
  entries: StrategyVaultEntry[];
  reviews: StrategyLifecycleReview[];
}

const STAGE_TRANSITION: Record<StrategyPromotionStage, { from: StrategyVaultState; to: StrategyVaultState }> = {
  EXPERIMENT_TO_INCUBATOR: { from: 'RESEARCH', to: 'INCUBATOR' },
  INCUBATOR_TO_CHALLENGER: { from: 'INCUBATOR', to: 'CHALLENGER' },
  CHALLENGER_TO_CHAMPION_CANDIDATE: { from: 'CHALLENGER', to: 'CHAMPION_CANDIDATE' },
};

const cloneEntry = (entry: StrategyVaultEntry): StrategyVaultEntry => ({ ...entry, parentGenomeIds: entry.parentGenomeIds.slice() });
const cloneReview = (review: StrategyLifecycleReview): StrategyLifecycleReview => ({
  ...review,
  eligibility: {
    ...review.eligibility,
    blockers: review.eligibility.blockers.slice(),
    insufficientEvidence: review.eligibility.insufficientEvidence.slice(),
    reasons: review.eligibility.reasons.slice(),
  },
});

const validateTimestamp = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive timestamp.`);
};

const reviewId = (genomeId: string, sequence: number, requestedAt: number) =>
  `strategy-review:${genomeId}:${sequence}:${requestedAt}`;

const lifecycleEvidence = (eligibility: StrategyPromotionEligibility) => ({
  policyVersion: eligibility.policyVersion,
  verdict: eligibility.verdict,
  eligible: eligibility.eligible,
  minimumGrade: eligibility.minimumGrade,
  blockers: eligibility.blockers.slice(),
  insufficientEvidence: eligibility.insufficientEvidence.slice(),
  reasons: eligibility.reasons.slice(),
});

/**
 * Research lifecycle registry only. A Vault transition changes research/governance
 * classification, never broker routing, capital allocation or LIVE deployment.
 * Every upward transition requires a separately recorded human decision even when
 * the deterministic Promotion Hard Gate returns PASS.
 */
export class StrategyVault {
  private readonly entries = new Map<string, StrategyVaultEntry>();
  private readonly reviews: StrategyLifecycleReview[] = [];

  static restore(checkpoint: StrategyVaultCheckpoint) {
    if (!checkpoint || checkpoint.schemaVersion !== 1) throw new Error('Unsupported Strategy Vault checkpoint schema.');
    const vault = new StrategyVault();
    for (const candidate of checkpoint.entries ?? []) {
      if (!candidate.genomeId?.trim() || !candidate.fingerprint?.trim()) throw new Error('Strategy Vault checkpoint contains an invalid entry.');
      validateTimestamp(candidate.registeredAt, 'Strategy Vault registeredAt');
      validateTimestamp(candidate.stateUpdatedAt, 'Strategy Vault stateUpdatedAt');
      if (!['RESEARCH', 'INCUBATOR', 'CHALLENGER', 'CHAMPION_CANDIDATE', 'RETIRED'].includes(candidate.state)) throw new Error(`Invalid Strategy Vault state: ${candidate.state}`);
      const normalized: StrategyVaultEntry = Object.freeze({
        ...cloneEntry(candidate),
        genomeId: candidate.genomeId.trim(),
        fingerprint: candidate.fingerprint.trim(),
        strategyVersion: candidate.strategyVersion.trim(),
        modelVersion: candidate.modelVersion?.trim() || null,
        parentGenomeIds: Object.freeze([...new Set(candidate.parentGenomeIds.map((item) => item.trim()).filter(Boolean))].sort()) as string[],
        retiredReason: candidate.retiredReason?.trim() || null,
        executionAuthority: false,
        promotionAuthority: false,
        capitalAuthority: false,
      });
      if (vault.entries.has(normalized.genomeId)) throw new Error(`Duplicate Strategy Vault genome ${normalized.genomeId}.`);
      vault.entries.set(normalized.genomeId, normalized);
    }
    const orderedReviews = (checkpoint.reviews ?? []).slice().sort((a, b) => a.sequence - b.sequence);
    for (let index = 0; index < orderedReviews.length; index += 1) {
      const item = orderedReviews[index];
      if (!vault.entries.has(item.genomeId)) throw new Error(`Strategy Vault review references unknown genome ${item.genomeId}.`);
      vault.reviews.push(Object.freeze({
        ...cloneReview(item),
        sequence: index + 1,
        autoTransition: false,
        requiresHumanApproval: true,
        executionAuthority: false,
        promotionAuthority: false,
        capitalAuthority: false,
      }));
    }
    return vault;
  }

  registerGenome(genome: StrategyGenome, registeredAt = Date.now()) {
    validateTimestamp(registeredAt, 'Strategy Vault registeredAt');
    const normalized = normalizeStrategyGenome(genome);
    if (this.entries.has(normalized.id)) throw new Error(`Strategy Genome ${normalized.id} is already registered in the Vault.`);
    const entry: StrategyVaultEntry = Object.freeze({
      genomeId: normalized.id,
      fingerprint: fingerprintStrategyGenome(normalized),
      strategyVersion: normalized.strategyVersion,
      modelVersion: normalized.modelVersion,
      generation: normalized.generation,
      parentGenomeIds: Object.freeze(normalized.parentGenomeIds.slice()) as string[],
      registeredAt,
      state: 'RESEARCH',
      stateUpdatedAt: registeredAt,
      retiredReason: null,
      executionAuthority: false,
      promotionAuthority: false,
      capitalAuthority: false,
    });
    this.entries.set(entry.genomeId, entry);
    return cloneEntry(entry);
  }

  registerFactoryCandidate(candidate: StrategyFactoryCandidate, registeredAt = Date.now()) {
    return this.registerGenome(candidate.genome, registeredAt);
  }

  requestPromotionReview(genomeId: string, eligibility: StrategyPromotionEligibility, requestedAt = Date.now()) {
    validateTimestamp(requestedAt, 'Strategy promotion review requestedAt');
    const entry = this.entries.get(genomeId);
    if (!entry) throw new Error(`Strategy Genome ${genomeId} is not registered in the Vault.`);
    if (entry.state === 'RETIRED') throw new Error('Retired strategies cannot request promotion review.');
    const transition = STAGE_TRANSITION[eligibility.stage];
    if (entry.state !== transition.from) {
      throw new Error(`Promotion stage ${eligibility.stage} requires Vault state ${transition.from}; current state is ${entry.state}.`);
    }
    const pending = this.reviews.find((review) => review.genomeId === genomeId && review.decision === 'PENDING');
    if (pending) throw new Error(`Strategy Genome ${genomeId} already has a pending promotion review.`);

    const sequence = this.reviews.length + 1;
    const review: StrategyLifecycleReview = Object.freeze({
      id: reviewId(genomeId, sequence, requestedAt),
      sequence,
      genomeId,
      stage: eligibility.stage,
      fromState: transition.from,
      toState: transition.to,
      requestedAt,
      decidedAt: null,
      decision: 'PENDING',
      decidedBy: null,
      note: null,
      eligibility: Object.freeze({
        ...lifecycleEvidence(eligibility),
        blockers: Object.freeze(eligibility.blockers.slice()) as string[],
        insufficientEvidence: Object.freeze(eligibility.insufficientEvidence.slice()) as string[],
        reasons: Object.freeze(eligibility.reasons.slice()) as string[],
      }),
      autoTransition: false,
      requiresHumanApproval: true,
      executionAuthority: false,
      promotionAuthority: false,
      capitalAuthority: false,
    });
    this.reviews.push(review);
    return cloneReview(review);
  }

  decidePromotionReview(reviewIdValue: string, approval: StrategyLifecycleApproval) {
    validateTimestamp(approval.decidedAt, 'Strategy promotion decision decidedAt');
    const decidedBy = approval.decidedBy.trim();
    if (!decidedBy) throw new Error('Strategy promotion decision requires an approver identity.');
    const index = this.reviews.findIndex((review) => review.id === reviewIdValue);
    if (index < 0) throw new Error(`Strategy promotion review ${reviewIdValue} does not exist.`);
    const currentReview = this.reviews[index];
    if (currentReview.decision !== 'PENDING') throw new Error(`Strategy promotion review ${reviewIdValue} is already decided.`);
    if (approval.decidedAt < currentReview.requestedAt) throw new Error('Strategy promotion decision cannot predate its review request.');
    if (approval.approved && !currentReview.eligibility.eligible) {
      throw new Error(`Strategy promotion review cannot be approved while eligibility is ${currentReview.eligibility.verdict}.`);
    }

    const entry = this.entries.get(currentReview.genomeId);
    if (!entry) throw new Error('Strategy Vault entry disappeared before review decision.');
    if (entry.state !== currentReview.fromState) throw new Error(`Strategy Vault state changed after review request; expected ${currentReview.fromState}, found ${entry.state}.`);

    const decided: StrategyLifecycleReview = Object.freeze({
      ...currentReview,
      decidedAt: approval.decidedAt,
      decision: approval.approved ? 'APPROVED' : 'REJECTED',
      decidedBy,
      note: approval.note?.trim() || null,
      autoTransition: false,
      requiresHumanApproval: true,
      executionAuthority: false,
      promotionAuthority: false,
      capitalAuthority: false,
    });
    this.reviews[index] = decided;

    if (approval.approved) {
      this.entries.set(entry.genomeId, Object.freeze({
        ...entry,
        state: currentReview.toState,
        stateUpdatedAt: approval.decidedAt,
        executionAuthority: false,
        promotionAuthority: false,
        capitalAuthority: false,
      }));
    }

    return {
      review: cloneReview(decided),
      entry: cloneEntry(this.entries.get(entry.genomeId)!),
    };
  }

  retire(genomeId: string, input: { reason: string; decidedBy: string; decidedAt: number }) {
    validateTimestamp(input.decidedAt, 'Strategy retirement decidedAt');
    const reason = input.reason.trim();
    const decidedBy = input.decidedBy.trim();
    if (!reason) throw new Error('Strategy retirement requires a reason.');
    if (!decidedBy) throw new Error('Strategy retirement requires an approver identity.');
    const entry = this.entries.get(genomeId);
    if (!entry) throw new Error(`Strategy Genome ${genomeId} is not registered in the Vault.`);
    if (entry.state === 'RETIRED') throw new Error(`Strategy Genome ${genomeId} is already retired.`);
    if (input.decidedAt < entry.stateUpdatedAt) throw new Error('Strategy retirement cannot predate the current Vault state.');
    if (this.reviews.some((review) => review.genomeId === genomeId && review.decision === 'PENDING')) throw new Error('Resolve the pending promotion review before retirement.');
    const retired = Object.freeze({
      ...entry,
      state: 'RETIRED' as const,
      stateUpdatedAt: input.decidedAt,
      retiredReason: `${reason} [approved by ${decidedBy}]`,
      executionAuthority: false as const,
      promotionAuthority: false as const,
      capitalAuthority: false as const,
    });
    this.entries.set(genomeId, retired);
    return cloneEntry(retired);
  }

  entry(genomeId: string) {
    const entry = this.entries.get(genomeId);
    return entry ? cloneEntry(entry) : null;
  }

  reviewHistory(genomeId?: string) {
    return this.reviews.filter((review) => !genomeId || review.genomeId === genomeId).map(cloneReview);
  }

  checkpoint(): StrategyVaultCheckpoint {
    return {
      schemaVersion: 1,
      entries: [...this.entries.values()].map(cloneEntry).sort((a, b) => a.registeredAt - b.registeredAt || a.genomeId.localeCompare(b.genomeId)),
      reviews: this.reviews.map(cloneReview),
    };
  }
}
