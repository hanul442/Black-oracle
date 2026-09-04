import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionTrace } from './decisionTrace';
import type { EvidenceAggregate } from './evidence';
import { buildExecutionDecision } from './executionPolicy';
import { PaperPortfolio } from './paperPortfolio';

const liquidity = {
  market: 'KRW-TEST',
  tradePrice: 100,
  accTradePrice24h: 1_000_000_000,
  signedChangeRate: 0.01,
  spreadBps: 2,
  top5BidDepthKrw: 100_000_000,
  top5AskDepthKrw: 100_000_000,
  orderbookImbalance: 0,
  warning: false,
  score: 90,
  eligible: true,
  reasons: [],
};

const oneHour = {
  market: 'KRW-TEST',
  timeframeMinutes: 60,
  candleCount: 200,
  asOf: 1_000,
  indicators: { atrPct: 0.02 },
  regime: { regime: 'UPTREND', confidence: 0.8, trendStrength: 0.6, highVolatility: false, reasons: [] },
};

const multiTimeframe = {
  market: 'KRW-TEST',
  asOf: 1_000,
  action: 'BUY',
  directionalScore: 70,
  oracleTradeScore: 85,
  confidence: 0.82,
  aligned: true,
  positionRiskMultiplier: 1,
  frames: { fourHour: oneHour, oneHour, fifteenMinute: oneHour },
  reasons: [],
};

const noEvidence: EvidenceAggregate = {
  market: 'KRW-TEST',
  score: 0,
  confidence: 0,
  activeCount: 0,
  bullishWeight: 0,
  bearishWeight: 0,
  contradictionCount: 0,
  asOf: 1_000,
  evidenceIds: [],
  reasons: ['No active structured trading evidence is available.'],
};

test('stale market data fails closed and persists as NO_TRADE with risk provenance', () => {
  const portfolio = new PaperPortfolio(1_000_000);
  const decision = buildExecutionDecision({
    liquidity: liquidity as any,
    multiTimeframe: multiTimeframe as any,
    oneHour: oneHour as any,
    portfolio: portfolio.snapshot({}),
    position: null,
    marketDataAgeMs: 10 * 60 * 1000,
  });

  assert.equal(decision.action, 'HOLD');
  assert.equal(decision.riskDisposition, 'REJECT');
  assert.match(decision.riskReasons.join(' '), /stale/i);

  const trace = buildDecisionTrace({
    market: 'KRW-TEST',
    decision,
    multiTimeframe: multiTimeframe as any,
    evidence: noEvidence,
    hasOpenPositionAfterStep: false,
  });

  assert.equal(trace.action, 'NO_TRADE');
  assert.equal(trace.riskDisposition, 'REJECT');
  assert.match(trace.riskReasons.join(' '), /stale/i);
  assert.equal(trace.forecast.available, false);
  assert.equal(trace.forecast.direction, 'UNAVAILABLE');
});

test('feed, ledger, and duplicate-order safety faults all reject new entries', () => {
  const portfolio = new PaperPortfolio(1_000_000);
  const cases = [
    { patch: { feedConnected: false }, expected: /disconnected/i },
    { patch: { ledgerInSync: false }, expected: /reconciled/i },
    { patch: { duplicateOrderDetected: true }, expected: /duplicate/i },
  ];

  for (const { patch, expected } of cases) {
    const decision = buildExecutionDecision({
      liquidity: liquidity as any,
      multiTimeframe: multiTimeframe as any,
      oneHour: oneHour as any,
      portfolio: portfolio.snapshot({}),
      position: null,
      ...patch,
    });
    assert.equal(decision.action, 'HOLD');
    assert.equal(decision.riskDisposition, 'REJECT');
    assert.match(decision.riskReasons.join(' '), expected);
  }
});
