import test from 'node:test';
import assert from 'node:assert/strict';
import { attachStrategyFactoryRuntime } from './eventLedgerStrategyFactoryRuntime';

const baseEvent = {
  eventKey: 'sf-run:experiment',
  occurredAt: 1_000,
  eventType: 'EXPERIMENT' as const,
  eventName: 'STRATEGY_FACTORY_RUN_COMPLETED',
  market: 'KRW-BTC',
  action: 'RESEARCH_ONLY',
  summary: 'Strategy Factory completed.',
  authority: 'research_only',
  executionAuthority: false,
  source: 'strategy_factory',
};

test('attaches Strategy Factory canonical events to the calling runtime without changing authority', () => {
  const [event] = attachStrategyFactoryRuntime([baseEvent], 'black-oracle-paper-s2-shadow');

  assert.equal(event.runtimeId, 'black-oracle-paper-s2-shadow');
  assert.equal(event.executionAuthority, false);
  assert.equal(event.authority, 'research_only');
  assert.equal(event.eventKey, baseEvent.eventKey);
});

test('fails closed when Strategy Factory runtime lineage is missing', () => {
  assert.throws(() => attachStrategyFactoryRuntime([baseEvent], '   '), /runtime id/i);
});
