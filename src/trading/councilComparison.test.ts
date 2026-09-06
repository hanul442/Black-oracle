import assert from 'node:assert/strict';
import test from 'node:test';
import { createCouncilComparisonObservation, resolveCouncilComparisonObservations, summarizeCouncilComparison } from './councilComparison.ts';
import { buildCouncilV2Challenger } from './councilV2.ts';
import type { EvidenceAggregate } from './evidence.ts';
import type { LiquiditySnapshot, MultiTimeframeSnapshot } from './types.ts';

const evidence: EvidenceAggregate = {
  market: 'KRW-BTC', score: 70, confidence: 0.85, activeCount: 3,
  bullishWeight: 2, bearishWeight: 0.1, contradictionCount: 0, asOf: 1_000_000,
  evidenceIds: ['a', 'b', 'c'], reasons: ['active'],
};
const mtf: MultiTimeframeSnapshot = {
  market: 'KRW-BTC', asOf: 1_000_000, action: 'BUY', directionalScore: 75, oracleTradeScore: 82,
  confidence: 0.88, aligned: true, positionRiskMultiplier: 1,
  frames: { fourHour: {} as any, oneHour: { indicators: { atrPct: 0.015 } } as any, fifteenMinute: {} as any }, reasons: [],
};
const liquidity: LiquiditySnapshot = {
  market: 'KRW-BTC', tradePrice: 100, accTradePrice24h: 1_000_000, signedChangeRate: 0.01,
  spreadBps: 4, top5BidDepthKrw: 100_000, top5AskDepthKrw: 90_000, orderbookImbalance: 0.08,
  warning: false, score: 90, eligible: true, reasons: [],
};

test('creates non-authoritative prospective council comparison observation', () => {
  const challenger = buildCouncilV2Challenger({ market: 'KRW-BTC', evidence, multiTimeframe: mtf, liquidity, now: 1_000_000 });
  const observation = createCouncilComparisonObservation(challenger, 100, 60_000)!;
  assert.equal(observation.market, 'KRW-BTC');
  assert.equal(observation.targetTimestamp, 1_060_000);
  assert.equal(observation.executionAuthority, false);
  assert.equal(observation.promotionAuthority, false);
  assert.ok(observation.v1.scenarioId);
  assert.ok(observation.v2.scenarioId);
});

test('resolves outcome only after target timestamp and scores both councils', () => {
  const challenger = buildCouncilV2Challenger({ market: 'KRW-BTC', evidence, multiTimeframe: mtf, liquidity, now: 1_000_000 });
  const observation = createCouncilComparisonObservation(challenger, 100, 60_000)!;
  const unresolved = resolveCouncilComparisonObservations([observation], [{ timestamp: 1_030_000, prices: [['KRW-BTC', 110]] }]);
  assert.equal(unresolved[0].resolvedAt, null);
  const resolved = resolveCouncilComparisonObservations([observation], [{ timestamp: 1_070_000, prices: [['KRW-BTC', 105]] }]);
  assert.equal(resolved[0].resolvedAt, 1_070_000);
  assert.equal(resolved[0].rawReturn, 0.05);
  assert.notEqual(resolved[0].v1DirectionalUtility, null);
  assert.notEqual(resolved[0].v2DirectionalUtility, null);
});

test('summary never grants promotion authority', () => {
  const summary = summarizeCouncilComparison([]);
  assert.equal(summary.recommendation, 'INSUFFICIENT_DATA');
  assert.equal(summary.executionAuthority, false);
  assert.equal(summary.promotionAuthority, false);
});
