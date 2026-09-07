import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateTradingEvidence, type TradingEvidence } from './evidence';
import { evaluateEvidenceGate } from './evidenceGate';

const NOW = 1_000_000;

const evidence = (patch: Partial<TradingEvidence> = {}): TradingEvidence => ({
  id: patch.id ?? 'e1',
  market: 'KRW-TEST',
  title: patch.title ?? 'validated market catalyst',
  direction: patch.direction ?? 'BULLISH',
  strength: patch.strength ?? 85,
  reliability: patch.reliability ?? 0.85,
  sourceType: patch.sourceType ?? 'PRIMARY',
  source: patch.source ?? 'source-a',
  observedAt: patch.observedAt ?? NOW - 60_000,
  expiresAt: patch.expiresAt ?? NOW + 5 * 60 * 60_000,
  contradictionOf: patch.contradictionOf,
  tags: patch.tags,
});

test('no active evidence cannot authorize new risk', () => {
  const aggregate = aggregateTradingEvidence([], 'KRW-TEST', NOW);
  const gate = evaluateEvidenceGate(aggregate, [], 'LONG');
  assert.equal(gate.status, 'NO_DATA');
  assert.equal(gate.eligibleForNewRisk, false);
  assert.match(gate.reasons.join(' '), /NO_ACTIVE_EVIDENCE/);
});

test('expired evidence has no entry authority', () => {
  const expired = evidence({ expiresAt: NOW - 1 });
  const aggregate = aggregateTradingEvidence([expired], 'KRW-TEST', NOW);
  const gate = evaluateEvidenceGate(aggregate, [expired], 'LONG');
  assert.equal(gate.status, 'NO_DATA');
  assert.equal(gate.eligibleForNewRisk, false);
});

test('weak evidence is rejected even when present', () => {
  const weak = evidence({ strength: 25, reliability: 0.4 });
  const aggregate = aggregateTradingEvidence([weak], 'KRW-TEST', NOW);
  const gate = evaluateEvidenceGate(aggregate, [weak], 'LONG');
  assert.equal(gate.status, 'REJECT');
  assert.equal(gate.eligibleForNewRisk, false);
  assert.match(gate.reasons.join(' '), /WEAK_EVIDENCE_QUALITY|INSUFFICIENT_EVIDENCE_CONFIDENCE/);
});

test('severe bullish bearish contradiction blocks a long entry', () => {
  const bullish = evidence({ id: 'bull', source: 'source-a', direction: 'BULLISH', strength: 90, reliability: 0.9 });
  const bearish = evidence({ id: 'bear', source: 'source-b', sourceType: 'NEWS', direction: 'BEARISH', strength: 90, reliability: 0.9, contradictionOf: 'bull' });
  const items = [bullish, bearish];
  const aggregate = aggregateTradingEvidence(items, 'KRW-TEST', NOW);
  const gate = evaluateEvidenceGate(aggregate, items, 'LONG');
  assert.equal(gate.eligibleForNewRisk, false);
  assert.equal(gate.status, 'REJECT');
  assert.match(gate.reasons.join(' '), /CONTRADICTION|DIRECTION/);
});

test('high-quality aligned active evidence can pass', () => {
  const items = [
    evidence({ id: 'primary', source: 'primary-feed', direction: 'BULLISH', strength: 92, reliability: 0.92 }),
    evidence({ id: 'market', source: 'market-feed', sourceType: 'MARKET', direction: 'BULLISH', strength: 78, reliability: 0.82 }),
  ];
  const aggregate = aggregateTradingEvidence(items, 'KRW-TEST', NOW);
  const gate = evaluateEvidenceGate(aggregate, items, 'LONG');
  assert.equal(gate.status, 'PASS');
  assert.equal(gate.eligibleForNewRisk, true);
  assert.deepEqual(new Set(gate.evidenceIds), new Set(['primary', 'market']));
  assert.equal(gate.sourceDiversity, 2);
});

test('bearish evidence cannot authorize a long entry', () => {
  const bearish = evidence({ direction: 'BEARISH', strength: 95, reliability: 0.95 });
  const aggregate = aggregateTradingEvidence([bearish], 'KRW-TEST', NOW);
  const gate = evaluateEvidenceGate(aggregate, [bearish], 'LONG');
  assert.equal(gate.eligibleForNewRisk, false);
  assert.match(gate.reasons.join(' '), /DIRECTION_MISALIGNED/);
});
