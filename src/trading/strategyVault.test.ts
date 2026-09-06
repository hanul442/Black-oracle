import assert from 'node:assert/strict';
import test from 'node:test';
import type { StrategyPromotionEligibility, StrategyPromotionStage } from './promotionHardGate';
import type { StrategyGenome } from './strategyGenome';
import { StrategyVault } from './strategyVault';

const START = Date.parse('2026-09-06T12:00:00.000Z');

const genome = (id = 'genome-g0-root', parents: string[] = []): StrategyGenome => ({
  id,
  generation: parents.length ? 1 : 0,
  createdAt: START,
  parentGenomeIds: parents,
  strategyVersion: 'BO-CRYPTO-v0.1.6',
  modelVersion: null,
  markets: ['KRW-BTC', 'KRW-ETH'],
  regimes: ['UPTREND', 'RANGE'],
  timeframesMinutes: [15, 60, 240],
  weights: { eventNews: 0.2, trendMomentum: 0.5, meanReversion: 0.3 },
  thresholds: { entryScore: 70, exitScore: 45, minConfidence: 0.65 },
  risk: { maxPositionPct: 0.02, maxDailyLossPct: 0.01, maxTotalDrawdownPct: 0.05 },
  mutations: [],
  executionAuthority: false,
});

const minimumGrade = (stage: StrategyPromotionStage): StrategyPromotionEligibility['minimumGrade'] => (
  stage === 'EXPERIMENT_TO_INCUBATOR' ? 'BBB-' : stage === 'INCUBATOR_TO_CHALLENGER' ? 'A-' : 'AA-'
);

const eligibility = (
  stage: StrategyPromotionStage,
  verdict: StrategyPromotionEligibility['verdict'] = 'PASS',
): StrategyPromotionEligibility => ({
  schemaVersion: 1,
  policyVersion: 'S7_PROMOTION_HARD_GATE_V1',
  stage,
  verdict,
  eligible: verdict === 'PASS',
  minimumGrade: minimumGrade(stage),
  checks: [],
  blockers: verdict === 'BLOCKED' ? ['MONTE_CARLO_SURVIVAL'] : [],
  insufficientEvidence: verdict === 'INSUFFICIENT_DATA' ? ['ADAPTER_PARITY'] : [],
  reasons: [`fixture ${verdict}`],
  promotionAuthority: false,
  executionAuthority: false,
  liveDeploymentAuthority: false,
});

test('registering a Genome creates a research-only Vault entry with immutable lineage metadata', () => {
  const vault = new StrategyVault();
  const entry = vault.registerGenome(genome('child-genome', ['parent-b', 'parent-a', 'parent-a']), START + 1);

  assert.equal(entry.state, 'RESEARCH');
  assert.deepEqual(entry.parentGenomeIds, ['parent-a', 'parent-b']);
  assert.equal(entry.executionAuthority, false);
  assert.equal(entry.promotionAuthority, false);
  assert.equal(entry.capitalAuthority, false);
  assert.match(entry.fingerprint, /^sg-[0-9a-f]{8}$/);
});

test('a PASS hard gate creates only a pending review and never auto-transitions the strategy', () => {
  const vault = new StrategyVault();
  vault.registerGenome(genome(), START);

  const review = vault.requestPromotionReview('genome-g0-root', eligibility('EXPERIMENT_TO_INCUBATOR'), START + 1);

  assert.equal(review.decision, 'PENDING');
  assert.equal(review.autoTransition, false);
  assert.equal(review.requiresHumanApproval, true);
  assert.equal(review.eligibility.eligible, true);
  assert.equal(vault.entry('genome-g0-root')?.state, 'RESEARCH');
  assert.equal(review.executionAuthority, false);
  assert.equal(review.promotionAuthority, false);
  assert.equal(review.capitalAuthority, false);
});

test('explicit human approval is required before a PASS review advances Vault state', () => {
  const vault = new StrategyVault();
  vault.registerGenome(genome(), START);
  const review = vault.requestPromotionReview('genome-g0-root', eligibility('EXPERIMENT_TO_INCUBATOR'), START + 1);

  const result = vault.decidePromotionReview(review.id, {
    approved: true,
    decidedBy: 'operator-hanseo',
    decidedAt: START + 2,
    note: 'Research lifecycle approval only.',
  });

  assert.equal(result.review.decision, 'APPROVED');
  assert.equal(result.entry.state, 'INCUBATOR');
  assert.equal(result.entry.executionAuthority, false);
  assert.equal(result.entry.capitalAuthority, false);
});

test('BLOCKED or INSUFFICIENT_DATA review can be recorded but cannot be approved', () => {
  for (const verdict of ['BLOCKED', 'INSUFFICIENT_DATA'] as const) {
    const vault = new StrategyVault();
    vault.registerGenome(genome(), START);
    const review = vault.requestPromotionReview('genome-g0-root', eligibility('EXPERIMENT_TO_INCUBATOR', verdict), START + 1);

    assert.throws(() => vault.decidePromotionReview(review.id, {
      approved: true,
      decidedBy: 'operator-hanseo',
      decidedAt: START + 2,
    }), /cannot be approved while eligibility/);
    assert.equal(vault.entry('genome-g0-root')?.state, 'RESEARCH');
  }
});

test('promotion stage must match the current Vault state and cannot skip lifecycle stages', () => {
  const vault = new StrategyVault();
  vault.registerGenome(genome(), START);

  assert.throws(
    () => vault.requestPromotionReview('genome-g0-root', eligibility('INCUBATOR_TO_CHALLENGER'), START + 1),
    /requires Vault state INCUBATOR/,
  );
});

test('a strategy can advance through research lifecycle only via separate reviews at each stage', () => {
  const vault = new StrategyVault();
  vault.registerGenome(genome(), START);

  const steps: Array<[StrategyPromotionStage, string]> = [
    ['EXPERIMENT_TO_INCUBATOR', 'INCUBATOR'],
    ['INCUBATOR_TO_CHALLENGER', 'CHALLENGER'],
    ['CHALLENGER_TO_CHAMPION_CANDIDATE', 'CHAMPION_CANDIDATE'],
  ];

  steps.forEach(([stage, expected], index) => {
    const requestedAt = START + 10 + index * 10;
    const review = vault.requestPromotionReview('genome-g0-root', eligibility(stage), requestedAt);
    assert.equal(vault.entry('genome-g0-root')?.state === expected, false);
    vault.decidePromotionReview(review.id, {
      approved: true,
      decidedBy: 'operator-hanseo',
      decidedAt: requestedAt + 1,
    });
    assert.equal(vault.entry('genome-g0-root')?.state, expected);
  });

  assert.equal(vault.reviewHistory('genome-g0-root').length, 3);
});

test('checkpoint restore preserves lifecycle state and the immutable promotion review trail', () => {
  const vault = new StrategyVault();
  vault.registerGenome(genome(), START);
  const review = vault.requestPromotionReview('genome-g0-root', eligibility('EXPERIMENT_TO_INCUBATOR'), START + 1);
  vault.decidePromotionReview(review.id, { approved: true, decidedBy: 'operator-hanseo', decidedAt: START + 2 });

  const restored = StrategyVault.restore(vault.checkpoint());
  assert.equal(restored.entry('genome-g0-root')?.state, 'INCUBATOR');
  assert.equal(restored.reviewHistory()[0]?.decision, 'APPROVED');
  assert.equal(restored.reviewHistory()[0]?.executionAuthority, false);
});

test('retirement is explicit, blocks pending reviews and never grants capital authority', () => {
  const vault = new StrategyVault();
  vault.registerGenome(genome(), START);
  const review = vault.requestPromotionReview('genome-g0-root', eligibility('EXPERIMENT_TO_INCUBATOR'), START + 1);

  assert.throws(() => vault.retire('genome-g0-root', {
    reason: 'Robustness decay.', decidedBy: 'operator-hanseo', decidedAt: START + 2,
  }), /pending promotion review/);

  vault.decidePromotionReview(review.id, { approved: false, decidedBy: 'operator-hanseo', decidedAt: START + 3 });
  const retired = vault.retire('genome-g0-root', {
    reason: 'Robustness decay.', decidedBy: 'operator-hanseo', decidedAt: START + 4,
  });
  assert.equal(retired.state, 'RETIRED');
  assert.match(retired.retiredReason ?? '', /Robustness decay/);
  assert.equal(retired.executionAuthority, false);
  assert.equal(retired.capitalAuthority, false);
});
