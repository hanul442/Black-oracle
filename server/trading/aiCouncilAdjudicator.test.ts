import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldEscalateAiCouncil, type OperationalCouncilTrace } from './aiCouncilAdjudicator';

const trace = (overrides: Partial<OperationalCouncilTrace> = {}): OperationalCouncilTrace => ({
  timestamp: 1_788_920_000_000,
  market: 'KRW-BTC',
  action: 'NO_TRADE',
  oracleTradeScore: 52,
  confidence: 0.62,
  regime: 'RANGE',
  regimeConfidence: 0.7,
  riskDisposition: 'APPROVE',
  eventScore: null,
  evidenceActiveCount: 0,
  evidenceContradictionCount: 0,
  evidenceIds: [],
  strategyDisposition: 'NO_TRADE',
  council: {
    verdict: 'CONDITIONAL',
    approveCount: 1,
    cautionCount: 2,
    rejectCount: 0,
    abstainCount: 2,
    members: [],
  },
  primaryReason: 'No sufficient edge.',
  reasons: ['No sufficient edge.'],
  riskReasons: [],
  ...overrides,
});

test('routine NO_TRADE without material conflict does not spend AI budget', () => {
  const result = shouldEscalateAiCouncil(trace());
  assert.equal(result.escalate, false);
  assert.equal(result.priority, 0);
});

test('ENTER and EXIT are always eligible for post-decision shadow adjudication', () => {
  const enter = shouldEscalateAiCouncil(trace({ action: 'ENTER' }));
  const exit = shouldEscalateAiCouncil(trace({ action: 'EXIT' }));
  assert.equal(enter.escalate, true);
  assert.equal(exit.escalate, true);
  assert.equal(enter.highMateriality, true);
  assert.equal(exit.highMateriality, true);
});

test('mixed deterministic Council votes trigger AI escalation', () => {
  const result = shouldEscalateAiCouncil(trace({
    council: {
      verdict: 'CONDITIONAL', approveCount: 2, cautionCount: 1, rejectCount: 1, abstainCount: 1, members: [],
    },
  }));
  assert.equal(result.escalate, true);
  assert.match(result.reason, /APPROVE and REJECT/);
});

test('active Evidence contradictions trigger AI escalation without creating a trade action', () => {
  const result = shouldEscalateAiCouncil(trace({
    action: 'NO_TRADE',
    evidenceActiveCount: 3,
    evidenceContradictionCount: 1,
    eventScore: 18,
  }));
  assert.equal(result.escalate, true);
  assert.equal(result.highMateriality, true);
});

test('high-score Council rejection is reviewed even when execution remains NO_TRADE', () => {
  const result = shouldEscalateAiCouncil(trace({
    action: 'NO_TRADE',
    oracleTradeScore: 71,
    council: {
      verdict: 'REJECT', approveCount: 0, cautionCount: 2, rejectCount: 2, abstainCount: 1, members: [],
    },
  }));
  assert.equal(result.escalate, true);
  assert.equal(result.priority, 65);
});
