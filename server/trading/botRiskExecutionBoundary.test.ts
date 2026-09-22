import assert from 'node:assert/strict';
import test from 'node:test';
import { BotRiskExecutionInput, evaluateBotRiskExecutionBoundary } from './botRiskExecutionBoundary';

const base = (): BotRiskExecutionInput => ({
  contractVersion: 'bot.risk-execution-boundary.v1', now: '2026-09-21T12:00:00.000Z', mode: 'PAPER',
  governance: { contractVersion: 'bot.governance-decision.v1', decisionId: 'gov-1', outcome: 'APPROVE', strategyId: 'strategy-a', strategyRevision: 'r1', evidenceFingerprint: 'gov-fp-1', decidedAt: '2026-09-21T11:59:30.000Z', executionAuthority: false, capitalAuthority: false, riskBypassAuthority: false, liveAuthority: false },
  orderIntent: { contractVersion: 'bot.canonical-order-intent.v1', intentId: 'intent-1', market: 'KRW-BTC', side: 'BUY', quantity: 0.001, referencePrice: 100_000_000, strategyId: 'strategy-a', strategyRevision: 'r1', observedAt: '2026-09-21T11:59:40.000Z', maxAgeMs: 60_000 },
  risk: { snapshotId: 'risk-1', strategyId: 'strategy-a', strategyRevision: 'r1', observedAt: '2026-09-21T11:59:45.000Z', maxAgeMs: 60_000, killSwitchEngaged: false, duplicateIntent: false, marketDataFresh: true, limitsSatisfied: true },
});

test('allows only Risk-attested canonical PAPER intent', () => { const d=evaluateBotRiskExecutionBoundary(base()); assert.equal(d.outcome,'ALLOW_INTENT'); assert.equal(d.orderIntent?.market,'KRW-BTC'); assert.equal(d.orderIntent?.quantity,0.001); assert.equal(d.orderIntentAuthority,false); assert.equal(d.brokerSubmissionAuthority,false); assert.equal(d.executionAuthority,false); assert.equal(d.capitalAuthority,false); assert.equal(d.liveAuthority,false); });
test('governance NO_TRADE is terminal',()=>{const i=base();i.governance.outcome='NO_TRADE';assert.deepEqual(evaluateBotRiskExecutionBoundary(i).reasonCodes,['GOVERNANCE_NO_TRADE']);});
test('missing canonical intent fails closed',()=>{const i=base();i.orderIntent=undefined;assert.deepEqual(evaluateBotRiskExecutionBoundary(i).reasonCodes,['ORDER_INTENT_MISSING']);});
test('stale canonical intent fails closed',()=>{const i=base();i.orderIntent!.observedAt='2026-09-21T11:00:00.000Z';assert.deepEqual(evaluateBotRiskExecutionBoundary(i).reasonCodes,['ORDER_INTENT_STALE']);});
test('order strategy mismatch fails closed',()=>{const i=base();i.orderIntent!.strategyRevision='r2';assert.deepEqual(evaluateBotRiskExecutionBoundary(i).reasonCodes,['ORDER_INTENT_STRATEGY_IDENTITY_MISMATCH']);});
test('missing and stale risk evidence fail closed',()=>{const m=base();m.risk=undefined;assert.equal(evaluateBotRiskExecutionBoundary(m).outcome,'NO_TRADE');const s=base();s.risk!.observedAt='2026-09-21T11:00:00.000Z';assert.deepEqual(evaluateBotRiskExecutionBoundary(s).reasonCodes,['RISK_SNAPSHOT_STALE']);});
test('risk identity mismatch, kill switch, duplicate intent and failed limits fail closed',()=>{const m=base();m.risk!.strategyRevision='r2';assert.deepEqual(evaluateBotRiskExecutionBoundary(m).reasonCodes,['RISK_STRATEGY_IDENTITY_MISMATCH']);const k=base();k.risk!.killSwitchEngaged=true;assert.deepEqual(evaluateBotRiskExecutionBoundary(k).reasonCodes,['KILL_SWITCH_ENGAGED']);const d=base();d.risk!.duplicateIntent=true;assert.deepEqual(evaluateBotRiskExecutionBoundary(d).reasonCodes,['DUPLICATE_INTENT']);const l=base();l.risk!.limitsSatisfied=false;assert.deepEqual(evaluateBotRiskExecutionBoundary(l).reasonCodes,['RISK_LIMITS_NOT_SATISFIED']);});
test('LIVE is not an Alpha mode',()=>{const i:unknown={...base(),mode:'LIVE'};assert.throws(()=>evaluateBotRiskExecutionBoundary(i as BotRiskExecutionInput),/unrestricted LIVE/);});
test('LIVE_SHADOW remains non-authoritative',()=>{const i=base();i.mode='LIVE_SHADOW';const d=evaluateBotRiskExecutionBoundary(i);assert.equal(d.outcome,'ALLOW_INTENT');assert.equal(d.liveAuthority,false);assert.equal(d.brokerSubmissionAuthority,false);});
