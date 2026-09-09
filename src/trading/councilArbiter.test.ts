import assert from 'node:assert/strict';
import test from 'node:test';
import { buildShadowArbiterRecommendation } from './councilArbiter';

const council = (verdict: 'APPROVE' | 'CONDITIONAL' | 'REJECT') => ({
  mode: 'SHADOW',
  executionAuthority: false,
  promotionAuthority: false,
  reviewedAction: 'ENTER',
  verdict,
  approveCount: verdict === 'APPROVE' ? 4 : verdict === 'CONDITIONAL' ? 2 : 1,
  cautionCount: verdict === 'CONDITIONAL' ? 2 : 0,
  rejectCount: verdict === 'REJECT' ? 2 : 0,
  abstainCount: 1,
  members: [],
  summary: `Shadow Council ${verdict}`,
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

test('Council REJECT becomes BLOCK recommendation without execution authority', () => {
  const result = buildShadowArbiterRecommendation({
    action: 'ENTER',
    council: council('REJECT'),
    cycle: cycle('READY'),
    challenger: challenger('SUPPORTS'),
  });
  assert.equal(result.recommendation, 'BLOCK');
  assert.equal(result.executionAuthority, false);
});

test('conditional Council, challenger conflict, or non-ready cycle become REVIEW', () => {
  const conditional = buildShadowArbiterRecommendation({
    action: 'ENTER',
    council: council('CONDITIONAL'),
    cycle: cycle('READY'),
    challenger: challenger('SUPPORTS'),
  });
  assert.equal(conditional.recommendation, 'REVIEW');

  const conflict = buildShadowArbiterRecommendation({
    action: 'ENTER',
    council: council('APPROVE'),
    cycle: cycle('READY'),
    challenger: challenger('CONFLICTS'),
  });
  assert.equal(conflict.recommendation, 'REVIEW');

  const timing = buildShadowArbiterRecommendation({
    action: 'ENTER',
    council: council('APPROVE'),
    cycle: cycle('NO_EDGE'),
    challenger: challenger('SUPPORTS'),
  });
  assert.equal(timing.recommendation, 'REVIEW');
});

test('clean approved entry becomes ALLOW but remains shadow-only', () => {
  const result = buildShadowArbiterRecommendation({
    action: 'ENTER',
    council: council('APPROVE'),
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
      council: council('REJECT'),
      cycle: cycle('NO_EDGE'),
      challenger: challenger('CONFLICTS'),
    });
    assert.equal(result.recommendation, 'NOT_APPLICABLE');
    assert.equal(result.executionAuthority, false);
  }
});
