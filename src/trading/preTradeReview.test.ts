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
  riskDisposition: 'APPROVE',
  riskReasons: ['All deterministic risk gates passed.'],
  reasons: ['Candidate passed deterministic gates.'],
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
});
