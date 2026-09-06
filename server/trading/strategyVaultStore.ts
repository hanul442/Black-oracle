import type { StrategyFactoryCandidate } from '../../src/trading/strategyFactory';
import type { StrategyGenome } from '../../src/trading/strategyGenome';
import type { StrategyPromotionEligibility } from '../../src/trading/promotionHardGate';
import {
  StrategyVault,
  type StrategyLifecycleApproval,
  type StrategyVaultCheckpoint,
} from '../../src/trading/strategyVault';

export interface RuntimeStrategyVaultSummary {
  entries: number;
  research: number;
  incubators: number;
  challengers: number;
  championCandidates: number;
  retired: number;
  pendingReviews: number;
  approvedReviews: number;
  rejectedReviews: number;
  executionAuthority: false;
  promotionAuthority: false;
  capitalAuthority: false;
}

class RuntimeStrategyVaultStore {
  private vault = new StrategyVault();

  restore(checkpoint: StrategyVaultCheckpoint | null | undefined) {
    this.vault = checkpoint ? StrategyVault.restore(checkpoint) : new StrategyVault();
    return this.summary();
  }

  snapshot(): StrategyVaultCheckpoint {
    return this.vault.checkpoint();
  }

  registerGenome(genome: StrategyGenome, registeredAt = Date.now()) {
    return this.vault.registerGenome(genome, registeredAt);
  }

  registerFactoryCandidate(candidate: StrategyFactoryCandidate, registeredAt = Date.now()) {
    return this.vault.registerFactoryCandidate(candidate, registeredAt);
  }

  requestPromotionReview(genomeId: string, eligibility: StrategyPromotionEligibility, requestedAt = Date.now()) {
    return this.vault.requestPromotionReview(genomeId, eligibility, requestedAt);
  }

  decidePromotionReview(reviewId: string, approval: StrategyLifecycleApproval) {
    return this.vault.decidePromotionReview(reviewId, approval);
  }

  retire(genomeId: string, input: { reason: string; decidedBy: string; decidedAt: number }) {
    return this.vault.retire(genomeId, input);
  }

  entry(genomeId: string) {
    return this.vault.entry(genomeId);
  }

  reviewHistory(genomeId?: string) {
    return this.vault.reviewHistory(genomeId);
  }

  summary(): RuntimeStrategyVaultSummary {
    const checkpoint = this.vault.checkpoint();
    const count = (state: StrategyVaultCheckpoint['entries'][number]['state']) => checkpoint.entries.filter((entry) => entry.state === state).length;
    return {
      entries: checkpoint.entries.length,
      research: count('RESEARCH'),
      incubators: count('INCUBATOR'),
      challengers: count('CHALLENGER'),
      championCandidates: count('CHAMPION_CANDIDATE'),
      retired: count('RETIRED'),
      pendingReviews: checkpoint.reviews.filter((review) => review.decision === 'PENDING').length,
      approvedReviews: checkpoint.reviews.filter((review) => review.decision === 'APPROVED').length,
      rejectedReviews: checkpoint.reviews.filter((review) => review.decision === 'REJECTED').length,
      executionAuthority: false,
      promotionAuthority: false,
      capitalAuthority: false,
    };
  }
}

export const runtimeStrategyVaultStore = new RuntimeStrategyVaultStore();
