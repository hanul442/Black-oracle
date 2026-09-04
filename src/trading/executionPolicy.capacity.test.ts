import test from 'node:test';
import assert from 'node:assert/strict';
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
  asOf: Date.now(),
  indicators: { atrPct: 0.02 },
};

const multiTimeframe = {
  market: 'KRW-TEST',
  asOf: Date.now(),
  action: 'BUY',
  directionalScore: 70,
  oracleTradeScore: 85,
  confidence: 0.82,
  aligned: true,
  positionRiskMultiplier: 1,
  frames: { fourHour: oneHour, oneHour, fifteenMinute: oneHour },
  reasons: [],
};

test('portfolio capacity rejects a flat candidate as an auditable no-entry decision', () => {
  const portfolio = new PaperPortfolio(1_000_000);
  const decision = buildExecutionDecision({
    liquidity: liquidity as any,
    multiTimeframe: multiTimeframe as any,
    oneHour: oneHour as any,
    portfolio: portfolio.snapshot({}),
    position: null,
    newEntryAllowed: false,
  });

  assert.equal(decision.action, 'HOLD');
  assert.equal(decision.side, null);
  assert.equal(decision.riskDisposition, 'REJECT');
  assert.equal(decision.notional, 0);
  assert.match(decision.riskReasons.join(' '), /open-position limit/i);
  assert.match(decision.reasons.join(' '), /open-position limit/i);
});
