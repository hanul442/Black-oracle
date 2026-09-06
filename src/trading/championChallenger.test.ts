import test from 'node:test';
import assert from 'node:assert/strict';
import { ChampionChallengerRegistry, type StrategyCandidate } from './championChallenger';

const champion: StrategyCandidate = {
  id: 'champion-v1',
  strategyVersion: 'strategy-v1',
  modelVersion: null,
  registeredAt: 1,
  role: 'CHAMPION',
  experimentId: null,
  regimes: ['UPTREND', 'RANGE'],
};

const challenger: StrategyCandidate = {
  id: 'challenger-v2',
  strategyVersion: 'strategy-v2',
  modelVersion: 'model-v2',
  registeredAt: 2,
  role: 'CHALLENGER',
  experimentId: 'exp-v2',
  regimes: ['RANGE'],
};

const passEvidence = {
  experimentStatus: 'PASSED' as const,
  monteCarloVerdict: 'PASS' as const,
  reliabilityVerdict: 'PASS' as const,
};

test('challenger never auto-promotes even when all gates pass', () => {
  const registry = new ChampionChallengerRegistry(champion);
  registry.registerChallenger(challenger);

  const review = registry.assess(challenger.id, passEvidence);
  assert.equal(review.eligibleForReview, true);
  assert.equal(review.autoPromote, false);
  assert.equal(review.requiresHumanApproval, true);
  assert.equal(registry.champion().id, champion.id);
});

test('failed validation gates block promotion review', () => {
  const registry = new ChampionChallengerRegistry(champion);
  registry.registerChallenger(challenger);

  const review = registry.assess(challenger.id, {
    experimentStatus: 'PASSED',
    monteCarloVerdict: 'WATCH',
    reliabilityVerdict: 'EXTEND',
  });

  assert.equal(review.eligibleForReview, false);
  assert.equal(review.blockers.length, 2);
  assert.throws(() => registry.promote(challenger.id, {
    experimentStatus: 'PASSED',
    monteCarloVerdict: 'WATCH',
    reliabilityVerdict: 'EXTEND',
  }, {
    humanApproved: true,
    approvedBy: 'human',
    approvedAt: 3,
  }));
});

test('explicit human approval is required before Champion replacement', () => {
  const registry = new ChampionChallengerRegistry(champion);
  registry.registerChallenger(challenger);

  assert.throws(() => registry.promote(challenger.id, passEvidence, {
    humanApproved: false,
    approvedBy: 'human',
    approvedAt: 3,
  }), /Human approval/);

  const result = registry.promote(challenger.id, passEvidence, {
    humanApproved: true,
    approvedBy: 'Hanseo',
    approvedAt: 4,
    note: 'Approved after validation review.',
  });

  assert.equal(result.champion.id, challenger.id);
  assert.equal(result.champion.role, 'CHAMPION');
  assert.equal(result.retiredChampion.id, champion.id);
  assert.equal(result.retiredChampion.role, 'RETIRED');
  assert.equal(registry.champion().id, challenger.id);
});
