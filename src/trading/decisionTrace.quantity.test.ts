import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionTrace } from './decisionTrace';
import type { EvidenceAggregate } from './evidence';
import type { ExecutionDecision, LiquiditySnapshot, MultiTimeframeSnapshot } from './types';

const evidence: EvidenceAggregate = {
  market: 'KRW-STEEM',
  score: 0,
  confidence: 0,
  activeCount: 0,
  bullishWeight: 0,
  bearishWeight: 0,
  contradictionCount: 0,
  asOf: 1_000,
  evidenceIds: [],
  reasons: ['fixture'],
};

const multiTimeframe = {
  market: 'KRW-STEEM',
  asOf: 1_000,
  action: 'BUY',
  directionalScore: 40,
  oracleTradeScore: 83,
  confidence: 0.8,
  aligned: true,
  positionRiskMultiplier: 1,
  frames: {
    fourHour: { regime: { regime: 'UPTREND', confidence: 0.8 } },
    oneHour: { regime: { regime: 'UPTREND', confidence: 0.8 } },
    fifteenMinute: { regime: { regime: 'UPTREND', confidence: 0.8 } },
  },
  reasons: [],
} as unknown as MultiTimeframeSnapshot;

const liquidity = {
  market: 'KRW-STEEM',
  tradePrice: 100,
  accTradePrice24h: 10_000_000_000,
  signedChangeRate: 0.02,
  spreadBps: 4,
  top5BidDepthKrw: 100_000_000,
  top5AskDepthKrw: 100_000_000,
  orderbookImbalance: 0,
  warning: false,
  score: 90,
  eligible: true,
  reasons: ['fixture'],
  marketDataTimestamp: 900,
} as LiquiditySnapshot;

test('estimates requested quantity from approved notional when pre-fill decision quantity is zero', () => {
  const decision: ExecutionDecision = {
    action: 'ENTER',
    side: 'BUY',
    notional: 10_000_000,
    quantity: 0,
    confidence: 0.8,
    stopLossPrice: 95,
    takeProfitPrice: 112,
    takeProfit1Price: 105,
    takeProfit2Price: 112,
    takeProfit1Fraction: 0.4,
    protectionBasis: 'ATR',
    positionSizingMode: 'EQUAL_NOTIONAL_RISK_CAPPED',
    expectedLossAtStop: 500_000,
    riskDisposition: 'APPROVE',
    riskReasons: ['fixture'],
    reasons: ['fixture'],
  };

  const trace = buildDecisionTrace({
    timestamp: 2_000,
    market: 'KRW-STEEM',
    decision,
    multiTimeframe,
    evidence,
    liquidity,
    hasOpenPositionAfterStep: true,
  });

  assert.equal(trace.positionSizing.requestedQuantity, 100_000);
  assert.equal(trace.positionSizing.quantityBasis, 'REFERENCE_PRICE_ESTIMATE');
});
