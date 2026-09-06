import assert from 'node:assert/strict';
import test from 'node:test';
import type { StrategyGenome } from '../../src/trading/strategyGenome';
import type { StrategyPromotionEligibility } from '../../src/trading/promotionHardGate';
import { runtimeStrategyVaultStore } from './strategyVaultStore';

const START = Date.parse('2026-09-06T12:00:00.000Z');
const genome = (): StrategyGenome => ({
  id: 'runtime-vault-genome', generation: 0, createdAt: START, parentGenomeIds: [],
  strategyVersion: 'BO-CRYPTO-v0.1.6', modelVersion: null, markets: ['KRW-BTC'], regimes: ['RANGE'], timeframesMinutes: [15, 60, 240],
  weights: { eventNews: 0.2, trendMomentum: 0.5, meanReversion: 0.3 },
  thresholds: { entryScore: 70, exitScore: 45, minConfidence: 0.65 },
  risk: { maxPositionPct: 0.02, maxDailyLossPct: 0.01, maxTotalDrawdownPct: 0.05 },
  mutations: [], executionAuthority: false,
});
const eligibility = (): StrategyPromotionEligibility => ({
  schemaVersion: 1, policyVersion: 'S7_PROMOTION_HARD_GATE_V1', stage: 'EXPERIMENT_TO_INCUBATOR', verdict: 'PASS', eligible: true,
  minimumGrade: 'BBB-', checks: [], blockers: [], insufficientEvidence: [], reasons: ['PASS fixture'], promotionAuthority: false, executionAuthority: false, liveDeploymentAuthority: false,
});

test('runtime store snapshots and restores Vault governance without granting authority', () => {
  runtimeStrategyVaultStore.restore(null);
  runtimeStrategyVaultStore.registerGenome(genome(), START);
  const review = runtimeStrategyVaultStore.requestPromotionReview('runtime-vault-genome', eligibility(), START + 1);
  runtimeStrategyVaultStore.decidePromotionReview(review.id, { approved: true, decidedBy: 'operator-test', decidedAt: START + 2 });
  const checkpoint = runtimeStrategyVaultStore.snapshot();

  runtimeStrategyVaultStore.restore(null);
  assert.equal(runtimeStrategyVaultStore.summary().entries, 0);
  const restored = runtimeStrategyVaultStore.restore(checkpoint);

  assert.equal(restored.entries, 1);
  assert.equal(restored.incubators, 1);
  assert.equal(restored.approvedReviews, 1);
  assert.equal(restored.executionAuthority, false);
  assert.equal(restored.promotionAuthority, false);
  assert.equal(restored.capitalAuthority, false);
  assert.equal(runtimeStrategyVaultStore.entry('runtime-vault-genome')?.state, 'INCUBATOR');
});
