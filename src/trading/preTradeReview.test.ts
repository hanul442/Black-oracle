import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreTradeShadowReview } from './preTradeReview';
import type { EvidenceAggregate } from './evidence';
import type { ExecutionDecision, MultiTimeframeSnapshot } from './types';

const evidence: EvidenceAggregate = {
  market: 'KRW-ETH',
  score: 0,
  confidence: 0,
  activeCount: 0,
  bullishWeight: 0,
  bearishWeight: 0,
  contradictionCount: 0,
  asOf: 1_000,
  evidenceIds: [],
  reasons: ['No active evidence.'],
};

const decision: ExecutionDecision = {
  action: 'ENTER',
  side: 'BUY',
  notional: 10_000_000,
  quantity: 0,
  confidence: 0.81,
  stopLossPrice: 99,
  takeProfitPrice: 103,
  riskDisposition: 'NOT_EVALUATED',
  riskReasons: [],
  reasons: ['Candidate awaits deterministic Risk.'],
};

const multiTimeframe = {
  market: 'KRW-ETH',
  asOf: 1_000,
  action: 'BUY',
  directionalScore: 20,
  oracleTradeScore: 65,
  confidence: 0.81,
  aligned: true,
  positionRiskMultiplier: 1,
  cycle: {
    state: 'NEUTRAL',
    entryTiming: 'NO_EDGE',
    directionalScore: 3,
    confidence: 0.73,
    aligned: false,
    frames: { fourHour: -3, oneHour: 14, fifteenMinute: -2 },
    reasons: ['No timing edge.'],
  },
  frames: {
    fourHour: { regime: { regime: 'RANGE', confidence: 0.58 } },
    oneHour: {
      indicators: { atrPct: 0.02 },
      regime: { regime: 'RANGE', confidence: 0.58 },
      trend: { action: 'BUY', confidence: 0.7 },
      momentum: { action: 'WAIT', confidence: 0.5 },
      meanReversion: { action: 'WAIT', confidence: 0.4 },
    },
    fifteenMinute: { regime: { regime: 'RANGE', confidence: 0.58 } },
  },
  reasons: [],
} as unknown as MultiTimeframeSnapshot;

test('creates a pre-execution shadow review without execution authority', () => {
  const review = buildPreTradeShadowReview({
    timestamp: 1_500,
    market: 'krw-eth',
    decision,
    multiTimeframe,
    evidence,
    challenger: {
      available: true,
      baselineAction: 'BUY',
      baselineOracleScore: 65,
      alignment: 'CONFLICTS',
      pressureScore: -31,
      shadowScoreAdjustment: -3.3,
      shadowOracleScore: 61.7,
      confidence: 0.9,
      reasons: ['Bearish microstructure conflicts.'],
    },
  });

  assert.equal(review.stage, 'PRE_EXECUTION_SHADOW');
  assert.equal(review.executionAuthority, false);
  assert.equal(review.market, 'KRW-ETH');
  assert.equal(review.reviewedAction, 'ENTER');
  assert.equal(review.arbiter.recommendation, 'REVIEW');
  assert.equal(review.arbiter.executionAuthority, false);
  assert.equal(review.auditContext.liquidity, null);
  assert.equal(review.auditContext.proposedTradeMap, null);
});

test('records actual pre-risk liquidity, portfolio, sizing and a candidate-only trade map', () => {
  const contextualDecision: ExecutionDecision = {
    ...decision,
    positionSizingMode: 'EQUAL_NOTIONAL_RISK_CAPPED',
    expectedLossAtStop: 100_000,
    takeProfit1Price: 102,
    takeProfit2Price: 104,
    takeProfit1Fraction: 0.4,
    preRiskContext: {
      liquidity: {
        tradePrice: 100,
        accTradePrice24h: 50_000_000_000,
        signedChangeRate: 0.012,
        spreadBps: 3,
        top5BidDepthKrw: 500_000_000,
        top5AskDepthKrw: 450_000_000,
        orderbookImbalance: 0.0526,
        score: 91,
        eligible: true,
        warning: false,
        marketDataTimestamp: 1_000,
      },
      portfolioRisk: {
        initialEquity: 100_000_000,
        cash: 90_000_000,
        equity: 100_000_000,
        marketValue: 10_000_000,
        realizedPnl: 0,
        unrealizedPnl: 0,
        totalPnl: 0,
        feesPaid: 0,
        drawdownPct: 0,
        dailyPnlPct: 0,
        openPositionCount: 1,
        grossExposurePct: 0.1,
      },
      riskInput: {
        equity: 100_000_000,
        requestedNotional: 10_000_000,
        dailyPnlPct: 0,
        totalDrawdownPct: 0,
        estimatedSlippageBps: 8,
        marketDataAgeMs: 500,
        feedConnected: true,
        ledgerInSync: true,
        duplicateOrderDetected: false,
      },
    },
  };

  const review = buildPreTradeShadowReview({
    timestamp: 1_500,
    market: 'KRW-ETH',
    decision: contextualDecision,
    multiTimeframe,
    evidence,
  });

  assert.equal(review.executionAuthority, false);
  assert.equal(review.auditContext.liquidity?.tradePrice, 100);
  assert.equal(review.auditContext.portfolioRisk?.grossExposurePct, 0.1);
  assert.equal(review.auditContext.positionSizing?.requestedNotional, 10_000_000);
  assert.equal(review.auditContext.positionSizing?.expectedLossAtStop, 100_000);
  assert.equal(review.auditContext.riskInput?.estimatedSlippageBps, 8);
  assert.equal(review.auditContext.proposedTradeMap?.status, 'CANDIDATE');
  assert.equal(review.auditContext.proposedTradeMap?.direction, 'LONG');
  assert.match(review.auditContext.proposedTradeMap?.reasons.join(' ') ?? '', /Pre-risk candidate map only/i);
});
