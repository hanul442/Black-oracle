import assert from 'node:assert/strict';
import test from 'node:test';
import { buildParticipantFlowFootprint } from './participantFlowFootprint';
import type { LargeParticipantFootprintSnapshot } from './largeParticipantFootprint';

const behavioral: LargeParticipantFootprintSnapshot = {
  available: true,
  direction: 'ACCUMULATION',
  score: 60,
  confidence: 'HIGH',
  abnormalVolumeRatio: 2.2,
  closeLocationValue: 0.8,
  priceChangePct: 0.03,
  volumeExpansionPersistence: 0.8,
  absorptionLike: false,
  breakoutParticipation: true,
  warnings: [],
  reasons: ['high-volume breakout'],
  actorIdentity: null,
};

test('observed foreign and program buying strengthens accumulation-like footprint without hidden actor claims', () => {
  const result = buildParticipantFlowFootprint(behavioral, {
    foreignNetBuyQty: 120_000,
    programNetBuyQty: 80_000,
    foreignHoldingQty: 1_000_000,
    foreignExhaustionRate: 20,
  });
  assert.equal(result.state, 'ACCUMULATION_LIKE');
  assert.equal(result.actorAttribution, 'MULTIPLE_FLOW_OBSERVED');
  assert.ok(result.score > 50);
  assert.ok(result.reasons.some((item) => item.includes('do not establish manipulation')));
});

test('returns data gap when neither behavior nor published flow is available', () => {
  const result = buildParticipantFlowFootprint({ ...behavioral, available: false, score: 0, confidence: 'LOW', reasons: [] }, {
    foreignNetBuyQty: null,
    programNetBuyQty: null,
    foreignHoldingQty: null,
    foreignExhaustionRate: null,
  });
  assert.equal(result.state, 'DATA_GAP');
  assert.equal(result.confidence, 0);
});
