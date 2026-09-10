import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDeterministicRiskToCandidate,
  buildExecutionDecision,
  buildPreRiskExecutionCandidate,
} from './executionPolicy';
import { PaperPortfolio } from './paperPortfolio';

const liquidity = {
  market: 'KRW-TEST', tradePrice: 100, accTradePrice24h: 1_000_000_000,
  signedChangeRate: 0.01, spreadBps: 2, top5BidDepthKrw: 100_000_000,
  top5AskDepthKrw: 100_000_000, orderbookImbalance: 0, warning: false,
  score: 90, eligible: true, reasons: [], marketDataTimestamp: Date.now() - 1_000,
};

const oneHour = {
  market: 'KRW-TEST', timeframeMinutes: 60, candleCount: 200, asOf: Date.now() - 1_000,
  indicators: { atrPct: 0.02 },
  regime: { regime: 'UPTREND', confidence: 0.8, trendStrength: 0.6, highVolatility: false, reasons: [] },
  trend: { action: 'BUY', directionalScore: 70, strength: 70, confidence: 0.8, reasons: [] },
  momentum: { action: 'BUY', directionalScore: 65, strength: 65, confidence: 0.78, reasons: [] },
  meanReversion: { action: 'WAIT', state: 'NEUTRAL', score: 0, confidence: 0.5, rawExtremeScore: 0, trendPenalty: 1, reasons: [] },
};

const multiTimeframe = {
  market: 'KRW-TEST', asOf: oneHour.asOf, action: 'BUY', directionalScore: 70,
  oracleTradeScore: 85, confidence: 0.82, aligned: true, positionRiskMultiplier: 1,
  frames: { fourHour: oneHour, oneHour, fifteenMinute: oneHour }, reasons: [],
};

const baseInput = () => ({
  liquidity: liquidity as any,
  multiTimeframe: multiTimeframe as any,
  oneHour: oneHour as any,
  portfolio: new PaperPortfolio(1_000_000).snapshot({}),
  position: null,
  marketDataAgeMs: 1_000,
});

test('entry candidate exists before risk and final decision remains wrapper-equivalent', () => {
  const input = baseInput();
  const candidate = buildPreRiskExecutionCandidate(input);

  assert.equal(candidate.stage, 'PRE_RISK_CANDIDATE');
  assert.equal(candidate.riskRequired, true);
  assert.equal(candidate.decision.action, 'ENTER');
  assert.equal(candidate.decision.riskDisposition, 'NOT_EVALUATED');
  assert.deepEqual(candidate.decision.riskReasons, []);
  assert.ok(candidate.riskInput);
  assert.ok(candidate.decision.notional > 0);
  assert.ok(candidate.decision.stopLossPrice);
  assert.ok(candidate.decision.expectedLossAtStop != null);
  assert.equal(candidate.decision.preRiskContext?.liquidity.tradePrice, liquidity.tradePrice);
  assert.equal(candidate.decision.preRiskContext?.portfolioRisk.initialEquity, 1_000_000);
  assert.equal(candidate.decision.preRiskContext?.riskInput?.requestedNotional, candidate.decision.notional);
  assert.equal(candidate.decision.preRiskContext?.riskInput?.estimatedSlippageBps, candidate.riskInput?.estimatedSlippageBps);

  const staged = applyDeterministicRiskToCandidate(candidate);
  const legacyWrapper = buildExecutionDecision(input);
  assert.deepEqual(staged, legacyWrapper);
  assert.equal(staged.action, 'ENTER');
  assert.equal(staged.riskDisposition, 'APPROVE');
  assert.equal(staged.preRiskContext?.riskInput?.requestedNotional, candidate.decision.notional);
});

test('risk rejection occurs only after the pre-risk candidate has been formed and keeps its provenance', () => {
  const input = {
    ...baseInput(),
    liquidity: { ...liquidity, marketDataTimestamp: Date.now() - 10 * 60 * 1000 } as any,
    marketDataAgeMs: 0,
  };
  const candidate = buildPreRiskExecutionCandidate(input);
  assert.equal(candidate.decision.action, 'ENTER');
  assert.equal(candidate.decision.riskDisposition, 'NOT_EVALUATED');

  const finalDecision = applyDeterministicRiskToCandidate(candidate);
  assert.equal(finalDecision.action, 'HOLD');
  assert.equal(finalDecision.riskDisposition, 'REJECT');
  assert.match(finalDecision.riskReasons.join(' '), /stale/i);
  assert.equal(finalDecision.preRiskContext?.liquidity.tradePrice, liquidity.tradePrice);
  assert.ok((finalDecision.preRiskContext?.riskInput?.marketDataAgeMs ?? 0) > 0);
});
