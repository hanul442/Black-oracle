import assert from 'node:assert/strict';
import test from 'node:test';
import { PaperPortfolio } from './paperPortfolio';
import { buildShadowTargetPipeline } from './targetPipeline';
import type { ExecutionDecision } from './types';

const baseDecision = (patch: Partial<ExecutionDecision> = {}): ExecutionDecision => ({
  action: 'HOLD',
  side: null,
  notional: 0,
  quantity: 0,
  confidence: 0.8,
  stopLossPrice: null,
  takeProfitPrice: null,
  riskDisposition: 'NOT_EVALUATED',
  riskReasons: [],
  reasons: ['test'],
  ...patch,
});

const baseInput = (decision: ExecutionDecision, portfolio = new PaperPortfolio(1_000_000).snapshot({})) => ({
  market: 'KRW-TEST',
  strategyVersion: 'BO-TEST',
  generatedAt: 1_700_000_000_000,
  referencePrice: 100,
  portfolio,
  decision,
});

const portfolioWithLong = () => {
  const portfolio = new PaperPortfolio(1_000_000);
  portfolio.applyFill({
    orderId: 'seed', market: 'KRW-TEST', side: 'BUY', quantity: 100, referencePrice: 100,
    fillPrice: 100, notional: 10_000, fee: 0, slippageBps: 0, timestamp: 1_600_000_000_000, strategyVersion: 'BO-TEST',
  });
  return portfolio.snapshot({ 'KRW-TEST': 100 }, 1_700_000_000_000);
};

test('ENTER maps legacy BUY notional to an equal positive risk-adjusted target delta', () => {
  const trace = buildShadowTargetPipeline(baseInput(baseDecision({
    action: 'ENTER', side: 'BUY', notional: 20_000, riskDisposition: 'APPROVE', riskReasons: ['within limits'],
  })));

  assert.equal(trace.intent.action, 'OPEN_LONG');
  assert.equal(trace.intent.requestedNotional, 20_000);
  assert.equal(trace.target.deltaNotional, 20_000);
  assert.equal(trace.riskAdjustedTarget.approvedDeltaNotional, 20_000);
  assert.equal(trace.riskAdjustedTarget.sideHint, 'BUY');
  assert.equal(trace.parity.status, 'PASS');
  assert.equal(trace.parity.absoluteDifference, 0);
  assert.equal(trace.executionAuthority, false);
  assert.equal(trace.intent.executionAuthority, false);
  assert.equal(trace.riskAdjustedTarget.executionAuthority, false);
  assert.equal(trace.parity.executionAuthority, false);
});

test('HOLD maps to MAINTAIN with zero target delta and parity PASS', () => {
  const trace = buildShadowTargetPipeline(baseInput(baseDecision(), portfolioWithLong()));

  assert.equal(trace.intent.action, 'MAINTAIN');
  assert.equal(trace.target.currentNotional, 10_000);
  assert.equal(trace.riskAdjustedTarget.approvedTargetNotional, 10_000);
  assert.equal(trace.riskAdjustedTarget.approvedDeltaNotional, 0);
  assert.equal(trace.parity.targetSide, null);
  assert.equal(trace.parity.status, 'PASS');
});

test('risk-rejected legacy HOLD preserves zero execution delta', () => {
  const trace = buildShadowTargetPipeline(baseInput(baseDecision({
    action: 'HOLD', side: null, riskDisposition: 'REJECT', riskReasons: ['daily loss gate'],
    reasons: ['Deterministic risk gate rejected the candidate.'],
  })));

  assert.equal(trace.intent.action, 'MAINTAIN');
  assert.equal(trace.riskAdjustedTarget.riskDisposition, 'REJECT');
  assert.deepEqual(trace.riskAdjustedTarget.riskReasons, ['daily loss gate']);
  assert.equal(trace.riskAdjustedTarget.approvedDeltaNotional, 0);
  assert.equal(trace.parity.status, 'PASS');
});

test('EXIT maps the entire marked long position to an equal negative target delta', () => {
  const portfolio = portfolioWithLong();
  const trace = buildShadowTargetPipeline(baseInput(baseDecision({
    action: 'EXIT', side: 'SELL', notional: 10_000, quantity: 100,
  }), portfolio));

  assert.equal(trace.intent.action, 'CLOSE_LONG');
  assert.equal(trace.target.currentNotional, 10_000);
  assert.equal(trace.riskAdjustedTarget.approvedTargetNotional, 0);
  assert.equal(trace.riskAdjustedTarget.approvedDeltaNotional, -10_000);
  assert.equal(trace.riskAdjustedTarget.sideHint, 'SELL');
  assert.equal(trace.parity.expectedDeltaNotional, -10_000);
  assert.equal(trace.parity.status, 'PASS');
});
