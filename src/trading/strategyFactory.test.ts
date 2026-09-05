import assert from 'node:assert/strict';
import test from 'node:test';
import { attachFactoryValidation, generateStrategyCandidates, runStrategyTournament, type StrategyFactoryValidationEvidence } from './strategyFactory';
import type { StrategyGenome } from './strategyGenome';

const parent = (): StrategyGenome => ({
  id: 'champion-v1', generation: 0, createdAt: 1, parentGenomeIds: [], strategyVersion: 'BO-CRYPTO-v0.1.6', modelVersion: null,
  markets: ['KRW-BTC', 'KRW-ETH'], regimes: ['UPTREND', 'RANGE'], timeframesMinutes: [15, 60, 240],
  weights: { eventNews: 0.2, trendMomentum: 0.55, meanReversion: 0.25 },
  thresholds: { entryScore: 62, exitScore: 45, minConfidence: 0.62 },
  risk: { maxPositionPct: 0.02, maxDailyLossPct: 0.01, maxTotalDrawdownPct: 0.05 },
  mutations: [], executionAuthority: false,
});

const validation = (expectancyR = 0.35): StrategyFactoryValidationEvidence => ({
  blindVerdict: 'PASS', walkForwardVerdict: 'PASS', monteCarloVerdict: 'PASS', closedTrades: 100, observationDays: 30,
  expectancyR, payoffRatio: 1.8, maxDrawdownPct: 0.025, favorableRate: 0.55, evidenceCoverage: 0.99, auditCoverage: 0.96,
  regimeRobustnessPass: true, costStressPass: true,
});

test('candidate generation is deterministic and bounded by hard risk limits', () => {
  const first = generateStrategyCandidates(parent(), { count: 6, seed: 42, createdAt: 100 });
  const second = generateStrategyCandidates(parent(), { count: 6, seed: 42, createdAt: 100 });
  assert.deepEqual(first.candidates.map((item) => item.fingerprint), second.candidates.map((item) => item.fingerprint));
  assert.equal(first.candidates.length, 6);
  for (const item of first.candidates) {
    assert.ok(item.genome.risk.maxPositionPct <= 0.02);
    assert.equal(item.executionAuthority, false);
  }
});

test('failed blind validation retires candidate before tournament', () => {
  const candidate = generateStrategyCandidates(parent(), { count: 2, seed: 7, createdAt: 100 }).candidates[0];
  const bad = validation(); bad.blindVerdict = 'REJECT';
  const assessed = attachFactoryValidation(candidate, bad);
  assert.equal(assessed.state, 'REJECTED');
  assert.ok(assessed.rejectionReasons.some((reason) => reason.includes('Blind validation')));
});

test('tournament can create challengers but never promotes a Champion or execution authority', () => {
  const generation = generateStrategyCandidates(parent(), { count: 5, seed: 9, createdAt: 100 });
  const assessed = generation.candidates.map((candidate, index) => attachFactoryValidation(candidate, validation(0.2 + index * 0.08)));
  const ranked = runStrategyTournament(assessed, 2);
  assert.equal(ranked.filter((item) => item.state === 'CHALLENGER').length, 2);
  assert.ok(ranked.every((item) => item.executionAuthority === false));
  assert.equal(ranked.some((item: any) => item.state === 'CHAMPION'), false);
});
