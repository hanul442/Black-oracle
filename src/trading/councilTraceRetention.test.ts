import assert from 'node:assert/strict';
import test from 'node:test';
import type { CouncilComparisonObservation } from './councilComparison.ts';
import { retainLatestCouncilTracePerMarket } from './councilTraceRetention.ts';

const makeObservation = (market: string, generatedAt: number, withTrace = true): CouncilComparisonObservation => ({
  id: `${market}:${generatedAt}`,
  market,
  generatedAt,
  targetTimestamp: generatedAt + 1,
  anchorPrice: 100,
  v1: { protocol: 'COUNCIL_V1', scenarioId: 's1', label: 'BASE', direction: 'FLAT', probability: 0.4, confidence: 0.6, disposition: 'MONITOR', score: 0.5 },
  v2: { protocol: 'COUNCIL_V2_CHALLENGER', scenarioId: 's1', label: 'BASE', direction: 'FLAT', probability: 0.4, confidence: 0.6, disposition: 'MONITOR', score: 0.5 },
  trace: withTrace ? ({ councilRunId: `c-${generatedAt}` } as any) : undefined,
  resolvedAt: null,
  targetPrice: null,
  rawReturn: null,
  v1DirectionalUtility: null,
  v2DirectionalUtility: null,
  v1Favorable: null,
  v2Favorable: null,
  executionAuthority: false,
  promotionAuthority: false,
});

test('retains at most one full Council trace per market', () => {
  const input = [
    makeObservation('KRW-BTC', 100),
    makeObservation('KRW-ETH', 110),
    makeObservation('KRW-BTC', 120),
    makeObservation('KRW-ETH', 130),
  ];
  const output = retainLatestCouncilTracePerMarket(input);
  assert.equal(output.filter((item) => item.trace).length, 2);
  assert.equal(output[0].trace, undefined);
  assert.equal(output[1].trace, undefined);
  assert.equal(output[2].trace?.councilRunId, 'c-120');
  assert.equal(output[3].trace?.councilRunId, 'c-130');
});

test('retention is ordered by generatedAt rather than array position', () => {
  const output = retainLatestCouncilTracePerMarket([
    makeObservation('KRW-BTC', 200),
    makeObservation('KRW-BTC', 100),
  ]);
  assert.equal(output[0].trace?.councilRunId, 'c-200');
  assert.equal(output[1].trace, undefined);
});

test('does not manufacture a trace when the newest observation has none', () => {
  const output = retainLatestCouncilTracePerMarket([
    makeObservation('KRW-BTC', 100),
    makeObservation('KRW-BTC', 200, false),
  ]);
  assert.equal(output[0].trace, undefined);
  assert.equal(output[1].trace, undefined);
});
