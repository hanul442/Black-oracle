import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RISK_LIMITS } from './config';
import { evaluateRisk } from './risk';
import type { RiskCheckInput } from './types';

const baseInput = (patch: Partial<RiskCheckInput> = {}): RiskCheckInput => ({
  equity: 100_000_000,
  requestedNotional: 10_000_000,
  dailyPnlPct: 0,
  totalDrawdownPct: 0,
  estimatedSlippageBps: 8,
  marketDataAgeMs: 1_000,
  feedConnected: true,
  ledgerInSync: true,
  duplicateOrderDetected: false,
  entryPrice: 100,
  stopLossPrice: 98,
  takeProfit1Price: 102.5,
  takeProfit2Price: 106,
  expectedLossAtStop: 200_000,
  ...patch,
});

test('daily losses above throttle start reduce notional instead of immediately blocking', () => {
  const decision = evaluateRisk(baseInput({ dailyPnlPct: -0.015 }));
  assert.equal(decision.status, 'PASS');
  assert.ok(decision.notionalScale < 1);
  assert.ok(decision.notionalScale > DEFAULT_RISK_LIMITS.minDailyLossNotionalScale);
  assert.ok(decision.approvedNotional < 10_000_000);
  assert.match(decision.reasons.join(' '), /throttle/i);
});

test('emergency daily loss stop remains fail-closed at the hard boundary', () => {
  const decision = evaluateRisk(baseInput({ dailyPnlPct: -0.03 }));
  assert.equal(decision.status, 'REJECT');
  assert.equal(decision.approvedNotional, 0);
  assert.match(decision.reasons.join(' '), /emergency daily loss stop/i);
});

test('invalid candidate-specific stop and targets are rejected', () => {
  const decision = evaluateRisk(baseInput({ stopLossPrice: 101, takeProfit1Price: 99 }));
  assert.equal(decision.status, 'REJECT');
  assert.match(decision.reasons.join(' '), /stop-loss/i);
  assert.match(decision.reasons.join(' '), /TP1/i);
});

test('planned loss at stop cannot exceed per-trade equity risk budget', () => {
  const decision = evaluateRisk(baseInput({ expectedLossAtStop: 600_000 }));
  assert.equal(decision.status, 'REJECT');
  assert.match(decision.reasons.join(' '), /per-trade equity risk budget/i);
});
