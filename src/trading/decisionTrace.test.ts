import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionTrace, classifyDecisionTraceAction } from './decisionTrace';
import type { EvidenceAggregate } from './evidence';
import type { ExecutionDecision, MultiTimeframeSnapshot } from './types';

const evidence: EvidenceAggregate = {
  market: 'KRW-BTC',
  score: 42,
  confidence: 0.66,
  activeCount: 2,
  bullishWeight: 1.1,
  bearishWeight: 0.4,
  contradictionCount: 1,
  asOf: 1_000,
  evidenceIds: ['ev-1', 'ev-2'],
  reasons: ['fixture'],
};

const multiTimeframe = {
  market: 'KRW-BTC',
  asOf: 1_000,
  action: 'WAIT',
  directionalScore: 10,
  oracleTradeScore: 55,
  confidence: 0.58,
  aligned: false,
  positionRiskMultiplier: 1,
  frames: {
    fourHour: { regime: { regime: 'UPTREND', confidence: 0.72 } },
    oneHour: { regime: { regime: 'RANGE', confidence: 0.64 } },
    fifteenMinute: { regime: { regime: 'RANGE', confidence: 0.6 } },
  },
  reasons: [],
} as unknown as MultiTimeframeSnapshot;

const decision: ExecutionDecision = {
  action: 'HOLD',
  side: null,
  notional: 0,
  quantity: 0,
  confidence: 0.58,
  stopLossPrice: null,
  takeProfitPrice: null,
  riskDisposition: 'REJECT',
  riskReasons: ['Daily loss limit reached.'],
  reasons: ['Deterministic risk gate rejected the candidate.', 'Daily loss limit reached.'],
};

test('classifies flat HOLD execution as explicit NO_TRADE', () => {
  assert.equal(classifyDecisionTraceAction('HOLD', false), 'NO_TRADE');
  assert.equal(classifyDecisionTraceAction('HOLD', true), 'HOLD');
});

test('builds an auditable NO_TRADE trace with regime, evidence and risk reasons', () => {
  const trace = buildDecisionTrace({
    timestamp: 2_000,
    market: 'krw-btc',
    decision,
    multiTimeframe,
    evidence,
    hasOpenPositionAfterStep: false,
  });

  assert.equal(trace.action, 'NO_TRADE');
  assert.equal(trace.market, 'KRW-BTC');
  assert.equal(trace.regime, 'RANGE');
  assert.equal(trace.regimeConfidence, 0.64);
  assert.equal(trace.riskDisposition, 'REJECT');
  assert.equal(trace.eventScore, 42);
  assert.deepEqual(trace.evidenceIds, ['ev-1', 'ev-2']);
  assert.equal(trace.evidenceContradictionCount, 1);
  assert.equal(trace.primaryReason, 'Deterministic risk gate rejected the candidate.');
  assert.deepEqual(trace.riskReasons, ['Daily loss limit reached.']);
});

test('keeps HOLD for an existing open position', () => {
  const trace = buildDecisionTrace({
    market: 'KRW-BTC',
    decision: { ...decision, riskDisposition: 'NOT_EVALUATED', riskReasons: [], reasons: ['Existing position remains open.'] },
    multiTimeframe,
    evidence: { ...evidence, activeCount: 0, evidenceIds: [], contradictionCount: 0 },
    hasOpenPositionAfterStep: true,
  });

  assert.equal(trace.action, 'HOLD');
  assert.equal(trace.eventScore, null);
  assert.equal(trace.riskDisposition, 'NOT_EVALUATED');
});