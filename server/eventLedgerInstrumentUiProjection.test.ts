import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveInstrumentCockpit } from '../src/mobile/v9/instrument';
import type { LedgerEvent } from '../src/mobile/v2/types';

const event = (
  id: string,
  eventType: string,
  occurredAt: number,
  traceId?: string,
  links: Record<string, unknown> = {},
): LedgerEvent => ({
  id,
  eventKey: id,
  occurredAt,
  recordedAt: occurredAt,
  runtimeId: 'black-oracle-paper',
  eventType,
  eventName: eventType,
  market: 'KRW-BTC',
  strategyId: null,
  strategyVersion: null,
  action: null,
  summary: id,
  reason: null,
  severity: 'INFO',
  authority: 'OBSERVATION_ONLY',
  executionAuthority: false,
  source: 'test',
  trace: traceId ? { traceId } : {},
  links,
});

test('V11 instrument cockpit keeps replay stages on the current canonical trace', () => {
  const events = [
    event('new-decision', 'DECISION', 500, 'trace-new'),
    event('new-risk', 'RISK', 490, 'trace-new'),
    event('new-council', 'COUNCIL', 480, 'trace-new'),
    event('old-outcome', 'OUTCOME', 470, 'trace-old'),
    event('old-trade', 'TRADE', 460, 'trace-old'),
    event('old-evidence', 'EVIDENCE', 450, 'trace-old'),
  ];

  const projection = deriveInstrumentCockpit('KRW-BTC', null, events);

  assert.equal(projection.currentTraceId, 'trace-new');
  assert.equal(projection.lineageStatus, 'PARTIAL');
  assert.deepEqual(projection.events.map((item) => item.id), ['new-decision', 'new-risk', 'new-council']);
  assert.equal(projection.latestByType.OUTCOME, null);
  assert.equal(projection.latestByType.TRADE, null);
  assert.equal(projection.observedLatestByType.OUTCOME?.id, 'old-outcome');
});

test('V11 instrument cockpit accepts explicit outcome entryTraceId linkage without treating it as own trace', () => {
  const events = [
    event('decision', 'DECISION', 500, 'trace-entry'),
    event('exit-outcome', 'OUTCOME', 510, 'trace-exit', { entryTraceId: 'trace-entry' }),
  ];

  const projection = deriveInstrumentCockpit('KRW-BTC', null, events);

  assert.equal(projection.currentTraceId, 'trace-entry');
  assert.equal(projection.latestByType.OUTCOME?.id, 'exit-outcome');
  assert.deepEqual(projection.events.map((item) => item.id), ['exit-outcome', 'decision']);
});

test('V11 instrument cockpit fails closed when the newest analysis anchor has no canonical trace', () => {
  const events = [
    event('untraced-decision', 'DECISION', 500),
    event('older-traced-risk', 'RISK', 490, 'trace-old'),
  ];

  const projection = deriveInstrumentCockpit('KRW-BTC', null, events);

  assert.equal(projection.currentTraceId, null);
  assert.equal(projection.lineageStatus, 'DATA_GAP');
  assert.deepEqual(projection.events, []);
  assert.equal(projection.latestByType.RISK, null);
  assert.equal(projection.observedLatestByType.RISK?.id, 'older-traced-risk');
});
