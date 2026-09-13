import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMarketStateSnapshot } from './marketState';

test('classifies broad risk-on state without inventing optional macro data', () => {
  const snapshot = buildMarketStateSnapshot({
    horizon: 'MEDIUM',
    asOf: 1_700_000_000_000,
    indexTrendScore: 82,
    breadthScore: 76,
    turnoverScore: 72,
    volatilityScore: 68,
    evidenceScore: 74,
    dataGaps: ['FX packet unavailable'],
  });

  assert.equal(snapshot.horizon, 'MEDIUM');
  assert.ok(snapshot.score >= 62);
  assert.ok(snapshot.confidence < 0.95);
  assert.ok(snapshot.reasons.some((reason) => reason.includes('DATA_GAP')));
});

test('risk-off state reduces risk multiplier', () => {
  const snapshot = buildMarketStateSnapshot({
    horizon: 'SHORT',
    asOf: 1_700_000_000_000,
    indexTrendScore: 20,
    breadthScore: 25,
    turnoverScore: 35,
    volatilityScore: 20,
    evidenceScore: 30,
    fxRiskScore: 25,
    ratesRiskScore: 30,
    crossAssetScore: 20,
  });

  assert.ok(snapshot.stance === 'RISK_OFF' || snapshot.stance === 'STRONG_RISK_OFF');
  assert.ok(snapshot.riskMultiplier <= 0.4);
});
