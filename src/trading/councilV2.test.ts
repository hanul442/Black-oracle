import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCouncilV2Challenger } from './councilV2';
import type { EvidenceAggregate } from './evidence';
import type { LiquiditySnapshot, MultiTimeframeSnapshot } from './types';

const makeEvidence = (score: number, activeCount = 3, confidence = 0.8, contradictions = 0): EvidenceAggregate => ({
  market: 'KRW-BTC',
  score,
  confidence,
  activeCount,
  bullishWeight: score > 0 ? 1.8 : 0.15,
  bearishWeight: score < 0 ? 1.8 : 0.15,
  contradictionCount: contradictions,
  asOf: 1_000_000,
  evidenceIds: activeCount ? Array.from({ length: activeCount }, (_, index) => `ev-${index + 1}`) : [],
  reasons: activeCount ? ['Structured Evidence is active.'] : ['No active Evidence.'],
});

const makeMtf = (directionalScore = 70, confidence = 0.86): MultiTimeframeSnapshot => ({
  market: 'KRW-BTC',
  asOf: 1_000_000,
  action: directionalScore > 20 ? 'BUY' : directionalScore < -20 ? 'SELL' : 'WAIT',
  directionalScore,
  oracleTradeScore: directionalScore > 0 ? 80 : 28,
  confidence,
  aligned: true,
  positionRiskMultiplier: 1,
  frames: {
    fourHour: {} as any,
    oneHour: { indicators: { atrPct: 0.018 } } as any,
    fifteenMinute: {} as any,
  },
  reasons: [],
});

const makeLiquidity = (eligible = true, warning = false): LiquiditySnapshot => ({
  market: 'KRW-BTC',
  tradePrice: 100_000_000,
  accTradePrice24h: 300_000_000_000,
  signedChangeRate: 0.012,
  spreadBps: eligible ? 4 : 55,
  top5BidDepthKrw: 1_000_000_000,
  top5AskDepthKrw: 900_000_000,
  orderbookImbalance: 0.08,
  warning,
  score: eligible ? 92 : 20,
  eligible,
  reasons: eligible ? [] : ['Liquidity gate failed.'],
});

test('Council v2 produces five blind specialist reviews per scenario and keeps zero authority', () => {
  const value = buildCouncilV2Challenger({
    market: 'KRW-BTC',
    evidence: makeEvidence(68),
    multiTimeframe: makeMtf(72),
    liquidity: makeLiquidity(),
    now: 1_000_000,
  });
  assert.equal(value.base.scenarios.branches.length, 4);
  assert.equal(value.challenger.specialistReviews.length, 20);
  assert.ok(value.challenger.specialistReviews.every((review) => review.blindFirstPass));
  assert.ok(value.challenger.specialistReviews.some((review) => review.specialistId === 'FALSIFIER'));
  assert.equal(value.challenger.executionAuthority, false);
  assert.equal(value.challenger.promotionAuthority, false);
});

test('aligned bullish context can rank BULL first while preserving falsifier output', () => {
  const value = buildCouncilV2Challenger({
    market: 'KRW-BTC',
    evidence: makeEvidence(75),
    multiTimeframe: makeMtf(78, 0.9),
    liquidity: makeLiquidity(),
    now: 1_000_000,
  });
  const top = value.challenger.assessments.find((assessment) => assessment.rank === 1)!;
  const scenario = value.base.scenarios.branches.find((branch) => branch.id === top.scenarioId);
  assert.equal(scenario?.label, 'BULL');
  assert.ok(top.falsificationPressure < 0.55);
});

test('missing Evidence makes all Council v2 scenarios insufficient', () => {
  const value = buildCouncilV2Challenger({
    market: 'KRW-BTC',
    evidence: makeEvidence(0, 0, 0),
    multiTimeframe: makeMtf(75),
    liquidity: makeLiquidity(),
    now: 1_000_000,
  });
  assert.ok(value.challenger.assessments.every((assessment) => assessment.disposition === 'INSUFFICIENT'));
});

test('liquidity failure prevents Council v2 advance regardless of directional support', () => {
  const value = buildCouncilV2Challenger({
    market: 'KRW-BTC',
    evidence: makeEvidence(85),
    multiTimeframe: makeMtf(85, 0.92),
    liquidity: makeLiquidity(false, true),
    now: 1_000_000,
  });
  assert.ok(value.challenger.assessments.every((assessment) => assessment.disposition !== 'ADVANCE'));
});

test('contradictory Evidence is retained as dissent/uncertainty rather than erased by consensus', () => {
  const value = buildCouncilV2Challenger({
    market: 'KRW-BTC',
    evidence: makeEvidence(45, 4, 0.72, 3),
    multiTimeframe: makeMtf(65, 0.8),
    liquidity: makeLiquidity(),
    now: 1_000_000,
  });
  assert.ok(value.challenger.assessments.some((assessment) => assessment.unresolvedUncertainty.some((item) => item.includes('contradiction'))));
  assert.ok(value.challenger.assessments.some((assessment) => assessment.preservedDissent.length > 0 || assessment.dissentRatio > 0));
});

test('same inputs generate deterministic Council v2 challenger outputs', () => {
  const input = {
    market: 'KRW-BTC',
    evidence: makeEvidence(63),
    multiTimeframe: makeMtf(68),
    liquidity: makeLiquidity(),
    now: 1_000_000,
  };
  const left = buildCouncilV2Challenger(input);
  const right = buildCouncilV2Challenger(input);
  assert.deepEqual(left.challenger.assessments, right.challenger.assessments);
  assert.deepEqual(left.challenger.specialistReviews, right.challenger.specialistReviews);
});
