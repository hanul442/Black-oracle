import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalEventRow } from './eventLedger';
import { buildDecisionReplayRestUrl, mergeDecisionReplayTimeline } from './decisionReplay';

const event = (overrides: Partial<CanonicalEventRow>): CanonicalEventRow => ({
  id: 'event-1',
  eventKey: 'key-1',
  occurredAt: 100,
  recordedAt: 101,
  runtimeId: 'black-oracle-paper-s2-shadow',
  eventType: 'DECISION',
  eventName: 'DECISION_ENTER',
  market: 'KRW-BTC',
  strategyId: null,
  strategyVersion: null,
  action: 'ENTER',
  summary: 'Decision.',
  reason: null,
  severity: 'INFO',
  authority: 'decision_authority',
  executionAuthority: false,
  source: 'paper_runtime',
  trace: {},
  links: {},
  schemaVersion: 1,
  ...overrides,
});

test('Decision Replay REST URL uses native PostgREST JSON-path filters', () => {
  const url = buildDecisionReplayRestUrl(
    'https://example.supabase.co',
    'black-oracle-paper-s2-shadow',
    'trace',
    'traceId',
    'black-oracle-paper-s2-shadow:KRW-BTC:1788930000000',
  );

  assert.equal(url.pathname, '/rest/v1/black_oracle_events');
  assert.equal(url.searchParams.get('runtime_id'), 'eq.black-oracle-paper-s2-shadow');
  assert.equal(
    url.searchParams.get('trace->>traceId'),
    'eq.black-oracle-paper-s2-shadow:KRW-BTC:1788930000000',
  );
  assert.equal(url.searchParams.get('order'), 'occurred_at.asc,recorded_at.asc');
});

test('Decision Replay timeline is deterministic, chronological and de-duplicated', () => {
  const strategy = event({ id: 'strategy', eventKey: 'strategy', occurredAt: 100, recordedAt: 100, eventType: 'STRATEGY' });
  const order = event({ id: 'order', eventKey: 'order', occurredAt: 200, recordedAt: 200, eventType: 'ORDER' });
  const outcome = event({ id: 'outcome', eventKey: 'outcome', occurredAt: 300, recordedAt: 300, eventType: 'OUTCOME' });

  const timeline = mergeDecisionReplayTimeline([order, outcome], [strategy, outcome]);
  assert.deepEqual(timeline.map((item) => item.id), ['strategy', 'order', 'outcome']);
});
