import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiCouncilAuditPacket } from './aiCouncilAuditPacket';

test('includes structured shadow inputs and reports missing execution arithmetic', () => {
  const packet = buildAiCouncilAuditPacket({
    timestamp: 1_000,
    market: 'KRW-ETH',
    action: 'ENTER',
    oracleTradeScore: 65,
    confidence: 0.81,
    regime: 'RANGE',
    regimeConfidence: 0.58,
    riskDisposition: 'APPROVE',
    eventScore: null,
    evidenceActiveCount: 0,
    evidenceContradictionCount: 0,
    evidenceIds: [],
    strategyDisposition: 'BLENDED',
    council: {
      verdict: 'CONDITIONAL',
      approveCount: 2,
      cautionCount: 2,
      rejectCount: 0,
      abstainCount: 1,
      members: [{ role: 'SKEPTIC', vote: 'CAUTION', confidence: 0.69, reasons: ['Bearish microstructure.'] }],
    },
    arbiter: {
      mode: 'SHADOW', executionAuthority: false, recommendation: 'REVIEW', reasons: ['Conflict.'],
      councilVerdict: 'CONDITIONAL', cycleTiming: 'NO_EDGE', challengerAlignment: 'CONFLICTS',
    },
    cycle: { state: 'NEUTRAL', entryTiming: 'NO_EDGE' },
    structure: { bias: 'NEUTRAL', confidence: 0.6 },
    microstructure: { direction: 'BEARISH', pressureScore: -31, confidence: 0.9 },
    challenger: { alignment: 'CONFLICTS', pressureScore: -31, shadowOracleScore: 61.7 },
    tradeMap: { entryPrice: 3383000, stopLossPrice: 3355779, expectedRiskPct: 0.008 },
    primaryReason: 'Candidate passed deterministic risk gates.',
    reasons: ['Candidate passed deterministic risk gates.'],
    riskReasons: ['All deterministic risk gates passed.'],
  });

  assert.equal(packet.arbiter?.recommendation, 'REVIEW');
  assert.equal(packet.microstructure?.pressureScore, -31);
  assert.equal(packet.challenger?.alignment, 'CONFLICTS');
  assert.equal(packet.tradeMap?.stopLossPrice, 3355779);
  assert.equal(packet.dataCompleteness.tradeMapProvided, true);
  assert.equal(packet.dataCompleteness.microstructureProvided, true);
  assert.equal(packet.dataCompleteness.portfolioExposureProvided, false);
  assert.equal(packet.dataCompleteness.feeSlippageBreakdownProvided, false);
  assert.equal(packet.dataCompleteness.requiredShadowInputsComplete, false);
  assert.deepEqual(packet.dataCompleteness.missingInputs, ['liquidity', 'portfolioRisk', 'positionSizing', 'executionCosts']);
});

test('preserves missing facts as null instead of fabricating zero values', () => {
  const packet = buildAiCouncilAuditPacket({
    market: 'KRW-BTC',
    action: 'NO_TRADE',
    council: { verdict: 'CONDITIONAL', members: [] },
  });

  assert.equal(packet.identity.timestamp, null);
  assert.equal(packet.decision.oracleTradeScore, null);
  assert.equal(packet.decision.confidence, null);
  assert.equal(packet.decision.regimeConfidence, null);
  assert.equal(packet.evidence.eventScore, null);
  assert.equal(packet.evidence.activeCount, null);
  assert.equal(packet.evidence.contradictionCount, null);
  assert.equal(packet.deterministicCouncil?.counts.approve, null);
  assert.ok(packet.dataCompleteness.missingInputs.includes('cycle'));
  assert.ok(packet.dataCompleteness.missingInputs.includes('positionSizing'));
});

test('bounds free-text and evidence arrays', () => {
  const packet = buildAiCouncilAuditPacket({
    market: 'KRW-BTC',
    action: 'NO_TRADE',
    primaryReason: 'x'.repeat(2_000),
    reasons: Array.from({ length: 20 }, (_, index) => `reason-${index}`),
    evidenceIds: Array.from({ length: 40 }, (_, index) => `ev-${index}`),
    council: { verdict: 'CONDITIONAL', approveCount: 0, cautionCount: 1, rejectCount: 0, abstainCount: 4, members: [] },
  });

  assert.equal(packet.decision.primaryReason?.length, 800);
  assert.equal(packet.decision.reasons.length, 10);
  assert.equal(packet.evidence.evidenceIds.length, 20);
});
