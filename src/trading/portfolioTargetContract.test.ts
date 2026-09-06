import test from 'node:test';
import assert from 'node:assert/strict';
import { projectExecutionDecisionToPortfolioTarget } from './portfolioTargetContract';
import { PaperPortfolio } from './paperPortfolio';
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

const inputFor = (decision: ExecutionDecision, portfolio = new PaperPortfolio(1_000_000).snapshot({})) => ({
  market: 'KRW-TEST',
  strategyVersion: 'BO-TEST',
  generatedAt: 1_700_000_000_000,
  referencePrice: 100,
  portfolio,
  decision,
});

test('ENTER becomes a positive target delta without gaining execution authority', () => {
  const target = projectExecutionDecisionToPortfolioTarget(inputFor(baseDecision({
    action: 'ENTER', side: 'BUY', notional: 20_000, riskDisposition: 'APPROVE',
  })));
  assert.equal(target.intent, 'INCREASE_LONG');
  assert.equal(target.currentNotional, 0);
  assert.equal(target.targetNotional, 20_000);
  assert.equal(target.deltaNotional, 20_000);
  assert.equal(target.targetWeight, 0.02);
  assert.equal(target.sideHint, 'BUY');
  assert.equal(target.executionAuthority, false);
  assert.equal(target.source, 'LEGACY_EXECUTION_DECISION_SHADOW_V1');
});

test('HOLD preserves the current portfolio target', () => {
  const portfolio = new PaperPortfolio(1_000_000);
  portfolio.applyFill({
    orderId: 'seed', market: 'KRW-TEST', side: 'BUY', quantity: 100, referencePrice: 100,
    fillPrice: 100, notional: 10_000, fee: 0, slippageBps: 0, timestamp: 1_600_000_000_000, strategyVersion: 'BO-TEST',
  });
  const snapshot = portfolio.snapshot({ 'KRW-TEST': 100 }, 1_700_000_000_000);
  const target = projectExecutionDecisionToPortfolioTarget(inputFor(baseDecision(), snapshot));
  assert.equal(target.intent, 'MAINTAIN');
  assert.equal(target.currentNotional, 10_000);
  assert.equal(target.targetNotional, 10_000);
  assert.equal(target.deltaNotional, 0);
  assert.equal(target.sideHint, null);
});

test('EXIT expresses FLAT as target state rather than an order command', () => {
  const portfolio = new PaperPortfolio(1_000_000);
  portfolio.applyFill({
    orderId: 'seed', market: 'KRW-TEST', side: 'BUY', quantity: 100, referencePrice: 100,
    fillPrice: 100, notional: 10_000, fee: 0, slippageBps: 0, timestamp: 1_600_000_000_000, strategyVersion: 'BO-TEST',
  });
  const snapshot = portfolio.snapshot({ 'KRW-TEST': 100 }, 1_700_000_000_000);
  const target = projectExecutionDecisionToPortfolioTarget(inputFor(baseDecision({
    action: 'EXIT', side: 'SELL', notional: 10_000,
  }), snapshot));
  assert.equal(target.intent, 'FLAT');
  assert.equal(target.targetNotional, 0);
  assert.equal(target.deltaNotional, -10_000);
  assert.equal(target.targetWeight, 0);
  assert.equal(target.sideHint, 'SELL');
  assert.equal(target.executionAuthority, false);
});

test('contract rejects incompatible spot-side semantics', () => {
  assert.throws(() => projectExecutionDecisionToPortfolioTarget(inputFor(baseDecision({
    action: 'ENTER', side: 'SELL', notional: 10_000,
  }))), /only supports BUY/);
});
