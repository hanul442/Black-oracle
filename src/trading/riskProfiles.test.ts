import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAPER_RISK_PROFILES,
  buildRiskProfileComparison,
  normalizePositionReturnsToAccountImpact,
} from './riskProfiles';

test('position returns are normalized to account impact by allocation', () => {
  assert.deepEqual(normalizePositionReturnsToAccountImpact([0.1, -0.2], 0.02), [0.002, -0.004]);
});

test('risk profiles are ordered from conservative to aggressive sizing', () => {
  assert.ok(PAPER_RISK_PROFILES.CONSERVATIVE.maxPositionPct < PAPER_RISK_PROFILES.BALANCED.maxPositionPct);
  assert.ok(PAPER_RISK_PROFILES.BALANCED.maxPositionPct < PAPER_RISK_PROFILES.AGGRESSIVE.maxPositionPct);
  assert.ok(PAPER_RISK_PROFILES.CONSERVATIVE.maxTotalDrawdownPct < PAPER_RISK_PROFILES.AGGRESSIVE.maxTotalDrawdownPct);
});

test('profile comparison uses identical sample counts and no execution authority', () => {
  const returns = Array.from({ length: 25 }, (_, index) => index % 5 === 0 ? -0.03 : 0.02);
  const comparison = buildRiskProfileComparison(returns);
  assert.equal(comparison.length, 3);
  assert.deepEqual(comparison.map((item) => item.normalizedTradeCount), [25, 25, 25]);
  assert.ok(comparison.every((item) => item.profile.executionAuthority === false));
  assert.ok(comparison.every((item) => item.promotionAuthority === false));
  assert.ok(comparison.every((item) => item.normalization.concurrencyModeled === false));
  assert.ok(comparison.every((item) => item.normalization.correlationModeled === false));
});

test('insufficient samples remain explicitly insufficient for all profiles', () => {
  const comparison = buildRiskProfileComparison([0.01, -0.01]);
  assert.ok(comparison.every((item) => item.validation.verdict === 'INSUFFICIENT_DATA'));
});
