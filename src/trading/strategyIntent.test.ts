import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExecutionDecision, type ExecutionPolicyInput } from './executionPolicy';
import { PaperPortfolio } from './paperPortfolio';
import { buildIndependentPolicyShadow, compareIndependentProjectionToLegacy } from './strategyIntent';
import type { PaperPosition } from './types';

const basePortfolio = () => new PaperPortfolio(1_000_000).snapshot({});

const makeInput = (patch: {
  action?: 'BUY' | 'SELL' | 'WAIT';
  directionalScore?: number;
  confidence?: number;
  positionRiskMultiplier?: number;
  eligible?: boolean;
  spreadBps?: number;
  atrPct?: number;
  portfolio?: ReturnType<typeof basePortfolio>;
  position?: PaperPosition | null;
  newEntryAllowed?: boolean;
  newEntryBlockReasons?: string[];
} = {}): ExecutionPolicyInput => ({
  liquidity: {
    market: 'KRW-TEST', tradePrice: 100, accTradePrice24h: 10_000_000_000, signedChangeRate: 0,
    spreadBps: patch.spreadBps ?? 10, top5BidDepthKrw: 1_000_000_000, top5AskDepthKrw: 1_000_000_000,
    orderbookImbalance: 0, warning: false, score: 90, eligible: patch.eligible ?? true, reasons: [],
  },
  multiTimeframe: {
    market: 'KRW-TEST', asOf: 1_700_000_000_000, action: patch.action ?? 'BUY', directionalScore: patch.directionalScore ?? 50,
    oracleTradeScore: 75, confidence: patch.confidence ?? 0.8, aligned: true, positionRiskMultiplier: patch.positionRiskMultiplier ?? 1,
  } as ExecutionPolicyInput['multiTimeframe'],
  oneHour: {
    indicators: { atrPct: patch.atrPct ?? 0.01 },
  } as ExecutionPolicyInput['oneHour'],
  portfolio: patch.portfolio ?? basePortfolio(),
  position: patch.position ?? null,
  marketDataAgeMs: 0,
  feedConnected: true,
  ledgerInSync: true,
  duplicateOrderDetected: false,
  newEntryAllowed: patch.newEntryAllowed ?? true,
  newEntryBlockReasons: patch.newEntryBlockReasons ?? [],
});

const compare = (input: ExecutionPolicyInput) => {
  const legacy = buildExecutionDecision(input);
  return { legacy, shadow: buildIndependentPolicyShadow(input, legacy) };
};

test('independent OPEN_LONG + risk projection matches an approved legacy entry', () => {
  const { legacy, shadow } = compare(makeInput());
  assert.equal(legacy.action, 'ENTER');
  assert.equal(shadow.intent.action, 'OPEN_LONG');
  assert.equal(shadow.intent.gate, 'RISK_CANDIDATE');
  assert.equal(shadow.riskProjection.action, 'ENTER');
  assert.equal(shadow.parity.status, 'PASS');
  assert.equal(shadow.executionAuthority, false);
});

test('weak signal independently resolves to MAINTAIN and matches legacy HOLD', () => {
  const { legacy, shadow } = compare(makeInput({ action: 'WAIT', directionalScore: 5, confidence: 0.5 }));
  assert.equal(legacy.action, 'HOLD');
  assert.equal(shadow.intent.action, 'MAINTAIN');
  assert.equal(shadow.riskProjection.action, 'HOLD');
  assert.equal(shadow.parity.status, 'PASS');
});

test('portfolio entry block independently preserves legacy REJECT semantics', () => {
  const { legacy, shadow } = compare(makeInput({ newEntryAllowed: false, newEntryBlockReasons: ['max open positions'] }));
  assert.equal(legacy.action, 'HOLD');
  assert.equal(legacy.riskDisposition, 'REJECT');
  assert.equal(shadow.intent.gate, 'BLOCKED');
  assert.equal(shadow.riskProjection.riskDisposition, 'REJECT');
  assert.equal(shadow.parity.status, 'PASS');
});

test('daily loss risk rejection independently matches legacy HOLD/REJECT', () => {
  const portfolio = { ...basePortfolio(), dailyPnlPct: -0.02 };
  const { legacy, shadow } = compare(makeInput({ portfolio }));
  assert.equal(legacy.action, 'HOLD');
  assert.equal(legacy.riskDisposition, 'REJECT');
  assert.equal(shadow.intent.action, 'OPEN_LONG');
  assert.equal(shadow.riskProjection.action, 'HOLD');
  assert.equal(shadow.riskProjection.riskDisposition, 'REJECT');
  assert.equal(shadow.parity.status, 'PASS');
});

test('protective stop independently becomes CLOSE_LONG and matches legacy EXIT', () => {
  const position: PaperPosition = {
    market: 'KRW-TEST', quantity: 100, averageCost: 100, entryPrice: 100,
    openedAt: 1_600_000_000_000, updatedAt: 1_600_000_000_000, stopLossPrice: 101, takeProfitPrice: 120,
  };
  const { legacy, shadow } = compare(makeInput({ position }));
  assert.equal(legacy.action, 'EXIT');
  assert.equal(shadow.intent.action, 'CLOSE_LONG');
  assert.equal(shadow.riskProjection.action, 'EXIT');
  assert.equal(shadow.parity.status, 'PASS');
});

test('healthy open position independently resolves to MAINTAIN and matches legacy HOLD', () => {
  const position: PaperPosition = {
    market: 'KRW-TEST', quantity: 100, averageCost: 100, entryPrice: 100,
    openedAt: 1_600_000_000_000, updatedAt: 1_600_000_000_000, stopLossPrice: 90, takeProfitPrice: 120,
  };
  const { legacy, shadow } = compare(makeInput({ action: 'WAIT', directionalScore: 0, confidence: 0.7, position }));
  assert.equal(legacy.action, 'HOLD');
  assert.equal(shadow.intent.action, 'MAINTAIN');
  assert.equal(shadow.parity.status, 'PASS');
});

test('parity comparator rejects a deliberately tampered shadow notional', () => {
  const input = makeInput();
  const legacy = buildExecutionDecision(input);
  const trace = buildIndependentPolicyShadow(input, legacy);
  const tampered = { ...trace.riskProjection, notional: trace.riskProjection.notional + 1_000 };
  const report = compareIndependentProjectionToLegacy(tampered, legacy, input.portfolio.equity);
  assert.equal(report.status, 'REJECT');
  assert.equal(report.notionalParity, false);
});
