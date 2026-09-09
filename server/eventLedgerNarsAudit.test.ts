import test from 'node:test';
import assert from 'node:assert/strict';
import { projectNarsRowsToCanonicalEvents } from './eventLedgerNarsAudit';

test('records UNMAPPED NARS delivery as canonical evidence instead of dropping it', () => {
  const events = projectNarsRowsToCanonicalEvents([{
    outbox_id: 'out-1',
    event_id: 'event-1',
    status: 'UNMAPPED',
    mapped_markets: [],
    received_at: '2026-09-09T06:45:06.000Z',
    updated_at: '2026-09-09T06:45:06.100Z',
  }], [], 'black-oracle-paper', '2026-09-09T06:45:15.000Z');

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'EVIDENCE');
  assert.equal(events[0].eventName, 'NARS_PACKET_UNMAPPED');
  assert.equal(events[0].authority, 'evidence_only');
  assert.equal(events[0].executionAuthority, false);
  assert.deepEqual(events[0].links, { outboxId: 'out-1', eventId: 'event-1' });
});

test('records analyzed external evidence with eligibility but never execution authority', () => {
  const events = projectNarsRowsToCanonicalEvents([{
    outbox_id: 'out-2',
    event_id: 'event-2',
    status: 'ANALYZED',
    mapped_markets: ['KRX-039490'],
    updated_at: '2026-09-09T06:45:10.000Z',
    analyzed_at: '2026-09-09T06:45:10.000Z',
  }], [{
    id: 'nars:out-2:KRX-039490',
    packet_outbox_id: 'out-2',
    event_id: 'event-2',
    market: 'KRX-039490',
    direction: 'BULLISH',
    materiality: 0.7,
    impact_confidence: 0.8,
    evidence_grade: 'A0',
    evidence_score: 78,
    eligible_for_new_risk: true,
    analysis_model: 'gpt-5.6-luna',
    analysis_version: 'BO-NARS-IMPACT-v2',
    updated_at: '2026-09-09T06:45:10.100Z',
    execution_authority: false,
  }], 'black-oracle-paper', '2026-09-09T06:45:15.000Z');

  assert.equal(events.length, 2);
  const packet = events.find((event) => event.eventName === 'NARS_PACKET_ANALYZED');
  const external = events.find((event) => event.eventName === 'EXTERNAL_EVIDENCE_ANALYZED');
  assert.equal(packet?.market, 'KRX-039490');
  assert.equal(external?.market, 'KRX-039490');
  assert.equal(external?.executionAuthority, false);
  assert.equal((external?.trace as any).eligibleForNewRisk, true);
});
