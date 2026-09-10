import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionTrace, classifyDecisionTraceAction } from './decisionTrace';
import type { EvidenceAggregate } from './evidence';
import type { PreTradeShadowReview } from './preTradeReview';
import type { ExecutionDecision, LiquiditySnapshot, MultiTimeframeSnapshot, PaperPortfolioSnapshot } from './types';

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

const liquidity: LiquiditySnapshot = {
  market: 'KRW-BTC',
  tradePrice: 100_000_000,
  accTradePrice24h: 80_000_000_000,
  signedChangeRate: 0.01,
  spreadBps: 2.1,
  top5BidDepthKrw: 500_000_000,
  top5AskDepthKrw: 480_000_000,
  orderbookImbalance: 0.02,
  warning: false,
  score: 92,
  eligible: true,
  reasons: ['liquid'],
  marketDataTimestamp: 900,
};

const portfolio = {
  initialEquity: 100_000_000,
  cash: 80_000_000,
  equity: 100_000_000,
  marketValue: 20_000_000,
  realizedPnl: 0,
  unrealizedPnl: 0,
  totalPnl: 0,
  feesPaid: 0,
  peakEquity: 100_000_000,
  drawdownPct: 0,
  dailyPnlPct: 0,
  positions: [],
  equityCurve: [],
} as PaperPortfolioSnapshot;

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
  assert.equal(trace.liquidity, null);
  assert.equal(trace.portfolioRisk, null);
  assert.equal(trace.positionSizing.requestedNotional, 0);
  assert.equal(trace.executionCosts, null);
});

test('copies supplied pre-trade liquidity, portfolio risk, and sizing facts without inference', () => {
  const trace = buildDecisionTrace({
    timestamp: 2_000,
    market: 'KRW-BTC',
    decision: {
      ...decision,
      action: 'ENTER',
      side: 'BUY',
      notional: 10_000_000,
      quantity: 0.1,
      positionSizingMode: 'FIXED_RISK_AT_STOP',
      expectedLossAtStop: 500_000,
      stopLossPrice: 95_000_000,
      takeProfit1Price: 105_000_000,
      takeProfit2Price: 110_000_000,
      takeProfitPrice: 110_000_000,
      takeProfit1Fraction: 0.5,
      protectionBasis: 'STRUCTURE_ATR',
      riskDisposition: 'APPROVE',
      riskReasons: ['Risk gates passed.'],
      reasons: ['Entry approved.'],
    },
    multiTimeframe,
    evidence,
    liquidity,
    portfolioRisk: portfolio,
    hasOpenPositionAfterStep: true,
  });

  assert.equal(trace.liquidity?.spreadBps, 2.1);
  assert.equal(trace.liquidity?.marketDataTimestamp, 900);
  assert.equal(trace.portfolioRisk?.equity, 100_000_000);
  assert.equal(trace.portfolioRisk?.grossExposurePct, 0.2);
  assert.equal(trace.portfolioRisk?.openPositionCount, 0);
  assert.equal(trace.positionSizing.mode, 'FIXED_RISK_AT_STOP');
  assert.equal(trace.positionSizing.requestedNotional, 10_000_000);
  assert.equal(trace.positionSizing.expectedLossAtStop, 500_000);
  assert.equal(trace.positionSizing.takeProfit2Price, 110_000_000);
  assert.equal(trace.executionCosts, null);
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

test('reuses an existing pre-trade shadow review instead of recomputing router/council/arbiter', () => {
  const preTradeReview = {
    stage: 'PRE_EXECUTION_SHADOW',
    executionAuthority: false,
    generatedAt: 1_500,
    market: 'KRW-BTC',
    reviewedAction: 'HOLD',
    forecast: {
      asOf: 1_000,
      available: false,
      direction: 'UNAVAILABLE',
      score: null,
      confidence: 0,
      uncertainty: 1,
      probabilityBullish: null,
      probabilityBearish: null,
      activeCount: 0,
      contradictionCount: 0,
      evidenceIds: [],
      reasons: ['pre-trade forecast'],
    },
    router: {
      route: 'TREND_MOMENTUM',
      confidence: 0.77,
      forecastAlignment: 'UNAVAILABLE',
      reasons: ['sentinel pre-trade router'],
    },
    council: {
      mode: 'SHADOW',
      executionAuthority: false,
      promotionAuthority: false,
      reviewedAction: 'HOLD',
      verdict: 'APPROVE',
      approveCount: 3,
      cautionCount: 0,
      rejectCount: 0,
      abstainCount: 2,
      members: [],
      summary: 'sentinel pre-trade council',
    },
    arbiter: {
      mode: 'SHADOW',
      executionAuthority: false,
      recommendation: 'NOT_APPLICABLE',
      reasons: ['sentinel pre-trade arbiter'],
      councilVerdict: 'APPROVE',
      cycleTiming: 'UNAVAILABLE',
      challengerAlignment: 'UNAVAILABLE',
    },
  } as PreTradeShadowReview;

  const trace = buildDecisionTrace({
    market: 'KRW-BTC',
    decision,
    multiTimeframe,
    evidence,
    preTradeReview,
    hasOpenPositionAfterStep: false,
  });

  assert.equal(trace.strategyDisposition, 'TREND_MOMENTUM');
  assert.equal(trace.router.reasons[0], 'sentinel pre-trade router');
  assert.equal(trace.council.summary, 'sentinel pre-trade council');
  assert.equal(trace.arbiter.reasons[0], 'sentinel pre-trade arbiter');
  assert.equal(trace.preTradeReview?.stage, 'PRE_EXECUTION_SHADOW');
});
