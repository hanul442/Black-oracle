import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStrategyShadowPoolFromCanonicalEvents,
  S2_STRATEGY_RESEARCH_RUNTIME_ID,
} from './strategyShadowPool';

const baseRow = {
  event_key: 'run-1:strategy:alpha',
  occurred_at: '2026-09-10T10:00:00.000Z',
  runtime_id: S2_STRATEGY_RESEARCH_RUNTIME_ID,
  event_type: 'STRATEGY',
  event_name: 'STRATEGY_TESTED',
  market: 'KRW-BTC',
  strategy_id: 'alpha',
  execution_authority: false,
  links: { runId: 'run-1' },
  trace: {
    genome: {
      id: 'alpha',
      generation: 2,
      indicators: ['EMA', 'MACD'],
      executionAuthority: false,
      promotionAuthority: false,
    },
    evaluation: {
      lifecycle: 'CHALLENGER',
      score: 81.5,
      hardGatePassed: true,
      requiresHumanApproval: true,
    },
    metrics: { oosExpectancy: 0.01 },
  },
};

test('admits only S2 Hard-Gate-passed research candidates with zero authority', () => {
  const rows = [
    baseRow,
    { ...baseRow, event_key: 'legacy', runtime_id: 'black-oracle-paper', strategy_id: 'legacy' },
    { ...baseRow, event_key: 'failed', strategy_id: 'failed', trace: { ...baseRow.trace, evaluation: { ...baseRow.trace.evaluation, hardGatePassed: false } } },
    { ...baseRow, event_key: 'incubator', strategy_id: 'incubator', trace: { ...baseRow.trace, evaluation: { ...baseRow.trace.evaluation, lifecycle: 'INCUBATOR' } } },
    { ...baseRow, event_key: 'authority', strategy_id: 'authority', execution_authority: true },
    { ...baseRow, event_key: 'genome-authority', strategy_id: 'genome-authority', trace: { ...baseRow.trace, genome: { ...baseRow.trace.genome, executionAuthority: true } } },
  ];

  const pool = buildStrategyShadowPoolFromCanonicalEvents(rows, 'krw-btc');
  assert.equal(pool.candidateCount, 1);
  assert.equal(pool.candidates[0]?.strategyId, 'alpha');
  assert.equal(pool.candidates[0]?.executionAuthority, false);
  assert.equal(pool.candidates[0]?.promotionAuthority, false);
});

test('keeps only the latest observation for a strategy and ranks by score', () => {
  const older = { ...baseRow, occurred_at: '2026-09-09T10:00:00.000Z' };
  const newer = {
    ...baseRow,
    event_key: 'run-2:strategy:alpha',
    occurred_at: '2026-09-10T11:00:00.000Z',
    links: { runId: 'run-2' },
    trace: {
      ...baseRow.trace,
      evaluation: { ...baseRow.trace.evaluation, score: 79 },
    },
  };
  const beta = {
    ...baseRow,
    event_key: 'run-2:strategy:beta',
    strategy_id: 'beta',
    trace: {
      ...baseRow.trace,
      genome: { ...baseRow.trace.genome, id: 'beta' },
      evaluation: { ...baseRow.trace.evaluation, score: 90, lifecycle: 'CHAMPION_CANDIDATE' },
    },
  };

  const pool = buildStrategyShadowPoolFromCanonicalEvents([older, newer, beta], 'KRW-BTC');
  assert.deepEqual(pool.candidates.map((candidate) => candidate.strategyId), ['beta', 'alpha']);
  assert.equal(pool.candidates[1]?.runId, 'run-2');
});
