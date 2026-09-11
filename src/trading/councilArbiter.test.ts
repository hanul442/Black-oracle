import assert from 'node:assert/strict';
import test from 'node:test';
import { buildShadowArbiterRecommendation } from './councilArbiter';

const council = (
  verdict: 'APPROVE' | 'CONDITIONAL' | 'REJECT',
  redTeamResult: 'INVALIDATED' | 'SERIOUSLY_CHALLENGED' | 'PARTIALLY_SURVIVED' | 'SURVIVED' = 'SURVIVED',
  dataGaps: string[] = [],
) => ({
  mode: 'SHADOW',
  constitutionVersion: '3.0.0-shadow',
  decisionMethod: 'EVIDENCE_GATED',
  executionAuthority: false,
  promotionAuthority: false,
  reviewedAction: 'ENTER',
  verdict,
  redTeamResult,
  approveCount: verdict === 'APPROVE' ? 4 : verdict === 'CONDITIONAL' ? 2 : 1,
  cautionCount: verdict === 'CONDITIONAL' ? 2 : 0,
  rejectCount: verdict === 'REJECT' ? 2 : 0,
  abstainCount: 1,
  members: [],
  criticalDissent: redTeamResult === 'INVALIDATED' ? ['Primary thesis failed adversarial review.'] : [],
  dataGaps,
  summary: `Council v3 ${verdict}`,
}) as any;

const cycle = (entryTiming: 'READY' | 'WAIT_PULLBACK' | 'WAIT_CONFIRMATION' | 'NO_EDGE') => ({
  state: 'NEUTRAL',
  directionalScore: 10,
  confidence: 0.8,
  aligned: true,
  entryTiming,
  frames: { fourHour: 10, oneHour: 10, fifteenMinute: 10 },
  reasons: [],
}) as any;

const challenger = (alignment: 'SUPPORTS' | 'CONFLICTS' | 'NEUTRAL' | 'UNAVAILABLE') => ({
  available: alignment !== 'UNAVAILABLE',
  baselineAction: 'BUY',
  baselineOracleScore: 70,
  alignment,
  pressureScore: alignment === 'CONFLICTS' ? -30 : 30,
  shadowScoreAdjustment: 0,
  shadowOracleScore: 70,
  confidence: 0.9,
  reasons: [],
}) as any;

test('Council REJECT becomes BLOCK without execution authority', () => {
  const result = buildShadowArbiterRecommendation({
    action: 'ENTER',
    council: council('REJECT'),
    cycle: cycle('READY'),
    challenger: challenger('SUPPORTS'),
  });
  assert.equal(result.recommendation, 'BLOCK');
  assert.equal(result.executionAuthority, false);
  assert.equal(result.decisionMethod, 'EVIDENCE_GATED');
});

test('Red Team invalidation independently becomes BLOCK', () => {
  const result = buildShadowArbiterRecommendation({
    action: 'ENTER',
    council: council('CONDITIONAL', 'INVALIDATED'),
    cycle: cycle('READY'),
    challenger: challenger('SUPPORTS'),
  });
  assert.equal(result.recommendation, 'BLOCK');
  assert.equal(result.redTeamResult, 'INVALIDATED');
});

test('conditional Council, serious Red Team challenge, data gap, challenger conflict, or non-ready cycle become REVIEW', () => {
  const cases = [
    buildShadowArbiterRecommendation({ action: 'ENTER', council: council('CONDITIONAL'), cycle: cycle('READY'), challenger: challenger('SUPPORTS') }),
    buildShadowArbiterRecommendation({ action: 'ENTER', council: council('APPROVE', 'SERIOUSLY_CHALLENGED'), cycle: cycle('READY'), challenger: challenger('SUPPORTS') }),
    buildShadowArbiterRecommendation({ action: 'ENTER', council: council('APPROVE', 'SURVIVED', ['validation unavailable']), cycle: cycle('READY'), challenger: challenger('SUPPORTS') }),
    buildShadowArbiterRecommendation({ action: 'ENTER', council: council('APPROVE'), cycle: cycle('READY'), challenger: challenger('CONFLICTS') }),
    buildShadowArbiterRecommendation({ action: 'ENTER', council: council('APPROVE'), cycle: cycle('NO_EDGE'), challenger: challenger('SUPPORTS') }),
  ];
  assert.equal(cases.every((result) => result.recommendation === 'REVIEW'), true);
});

test('clean evidence-gated entry becomes ALLOW but remains shadow-only', () => {
  const result = buildShadowArbiterRecommendation({
    action: 'ENTER',
    council: council('APPROVE', 'SURVIVED'),
    cycle: cycle('READY'),
    challenger: challenger('SUPPORTS'),
  });
  assert.equal(result.recommendation, 'ALLOW');
  assert.equal(result.executionAuthority, false);
});

test('non-entry actions are NOT_APPLICABLE so exits cannot be blocked by shadow calibration', () => {
  for (const action of ['EXIT', 'HOLD', 'NO_TRADE'] as const) {
    const result = buildShadowArbiterRecommendation({
      action,
      council: council('REJECT', 'INVALIDATED'),
      cycle: cycle('NO_EDGE'),
      challenger: challenger('CONFLICTS'),
    });
    assert.equal(result.recommendation, 'NOT_APPLICABLE');
    assert.equal(result.executionAuthority, false);
  }
});
