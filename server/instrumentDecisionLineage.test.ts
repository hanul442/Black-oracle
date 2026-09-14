import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalEventRow, CanonicalEventType } from './eventLedger';
import {
  buildInstrumentDecisionLineage,
  directTraceIdOf,
  selectInstrumentAnalysisAnchor,
} from './instrumentDecisionLineage';

const row = (
  eventType: CanonicalEventType,
  occurredAt: number,
  traceId: string | null,
  overrides: Partial<CanonicalEventRow> = {},
): CanonicalEventRow => ({
  id: `${eventType}-${occurredAt}`,
  eventKey: `${eventType}-${occurredAt}`,
  occurredAt,
  recordedAt: occurredAt,
  runtimeId: 'black-oracle-paper-s2-shadow',
  eventType,
  eventName: `${eventType}_EVENT`,
  market: 'KRX-005930',
  strategyId: null,
  strategyVersion: null,
  action: null,
  summary: `${eventType} event`,
  reason: null,
  severity: 'INFO',
  authority: 'observed',
  executionAuthority: false,
  source: 'test',
  trace: traceId ? { traceId } : {},
  links: {},
  schemaVersion: 1,
  ...overrides,
});

test('instrument lineage never mixes newer events from a different trace', () => {
  const currentTraceId = 'trace-current';
  const events = [
    row('DECISION', 300, currentTraceId),
    row('STRATEGY', 290, currentTraceId),
    row('COUNCIL', 280, 'trace-other'),
    row('OUTCOME', 270, 'trace-other'),
    row('EVIDENCE', 260, currentTraceId),
  ];

  const lineage = buildInstrumentDecisionLineage(events, currentTraceId);

  assert.equal(lineage.status, 'PARTIAL');
  assert.equal(lineage.latestByType.DECISION?.trace.traceId, currentTraceId);
  assert.equal(lineage.latestByType.STRATEGY?.trace.traceId, currentTraceId);
  assert.equal(lineage.stages.COUNCIL.status, 'NOT_LINKED');
  assert.equal(lineage.stages.OUTCOME.status, 'NOT_LINKED');
  assert.equal(lineage.events.some((event) => directTraceIdOf(event) === 'trace-other'), false);
});

test('explicit entryTraceId links an outcome without relabelling its own exit trace', () => {
  const currentTraceId = 'trace-entry';
  const outcome = row('OUTCOME', 400, 'trace-exit', {
    links: { entryTraceId: currentTraceId, tradeId: 'TRADE-1' },
  });

  const lineage = buildInstrumentDecisionLineage([
    row('DECISION', 300, currentTraceId),
    outcome,
  ], currentTraceId);

  assert.equal(lineage.stages.OUTCOME.status, 'LINKED');
  assert.equal(lineage.stages.OUTCOME.linkMethod, 'ENTRY_TRACE_ID');
  assert.equal(lineage.stages.OUTCOME.event?.trace.traceId, 'trace-exit');
  assert.equal(directTraceIdOf(outcome), 'trace-exit');
});

test('missing canonical trace fails truthful instead of falling back to unrelated history', () => {
  const events = [
    row('DECISION', 500, null),
    row('COUNCIL', 490, 'older-trace'),
    row('STRATEGY', 480, 'older-trace'),
  ];

  const anchor = selectInstrumentAnalysisAnchor(events);
  assert.equal(anchor?.eventType, 'DECISION');
  assert.equal(directTraceIdOf(anchor), null);

  const lineage = buildInstrumentDecisionLineage(events, directTraceIdOf(anchor));
  assert.equal(lineage.status, 'DATA_GAP');
  assert.equal(lineage.traceId, null);
  assert.equal(lineage.events.length, 0);
  assert.equal(lineage.stages.COUNCIL.status, 'NOT_LINKED');
  assert.equal(lineage.stages.STRATEGY.status, 'NOT_LINKED');
});

test('analysis anchor prefers current decision over older council or strategy', () => {
  const events = [
    row('STRATEGY', 700, 'strategy-trace'),
    row('COUNCIL', 710, 'council-trace'),
    row('DECISION', 650, 'decision-trace'),
  ];

  const anchor = selectInstrumentAnalysisAnchor(events);
  assert.equal(anchor?.eventType, 'DECISION');
  assert.equal(directTraceIdOf(anchor), 'decision-trace');
});
