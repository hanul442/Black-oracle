import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOperatorEvent, buildOperatorEventId, shouldEmitStateTransition } from './operatorEvent';

const base = {
  runtimeId: 'black-oracle-paper',
  occurredAt: 1_000,
  type: 'DECISION' as const,
  severity: 'NORMAL' as const,
  cycleNumber: 10,
  market: 'KRW-BTC',
  stateKey: 'HOLD|SUPPORTED',
  dedupeKey: 'KRW-BTC:HOLD|SUPPORTED',
  refs: { evidenceIds: ['ev-b', 'ev-a'], tradeCaseId: 'case-1' },
  payload: { action: 'HOLD', score: 70 },
};

test('operator event id is deterministic for canonical payload ordering', () => {
  const first = buildOperatorEventId(base);
  const second = buildOperatorEventId({
    ...base,
    payload: { score: 70, action: 'HOLD' },
    refs: { tradeCaseId: 'case-1', evidenceIds: ['ev-b', 'ev-a'] },
  });
  assert.equal(first, second);
});

test('buildOperatorEvent sorts evidence references without changing source input', () => {
  const event = buildOperatorEvent(base);
  assert.deepEqual(event.refs.evidenceIds, ['ev-a', 'ev-b']);
  assert.deepEqual(base.refs.evidenceIds, ['ev-b', 'ev-a']);
  assert.match(event.eventId, /^boe-decision-/);
});

test('state transition emission only occurs on meaningful change', () => {
  assert.equal(shouldEmitStateTransition('TECHNICAL_ONLY', 'TECHNICAL_ONLY'), false);
  assert.equal(shouldEmitStateTransition('TECHNICAL_ONLY', 'SUPPORTED'), true);
  assert.equal(shouldEmitStateTransition(null, 'SUPPORTED'), true);
  assert.equal(shouldEmitStateTransition('SUPPORTED', null), false);
});
