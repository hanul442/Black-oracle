import assert from 'node:assert/strict';
import test from 'node:test';
import type { EvidenceAggregate } from './evidence.ts';
import {
  appendStrategyReturnObservation,
  buildAlignedStrategyReturnSeries,
  createStrategyReturnObservation,
  createStrategyReturnPanelCheckpoint,
  resolveStrategyReturnPanel,
  summarizeStrategyReturnPanel,
} from './strategyReturnPanel.ts';
import type { LiquiditySnapshot, MultiTimeframeSnapshot } from './types.ts';

const evidence: EvidenceAggregate = {
  market: 'KRW-BTC', score: 65, confidence: 0.82, activeCount: 3,
  bullishWeight: 1.8, bearishWeight: 0.1, contradictionCount: 0, asOf: 1_000_000,
  evidenceIds: ['e1', 'e2', 'e3'], reasons: ['active'],
};
const liquidity: LiquiditySnapshot = {
  market: 'KRW-BTC', tradePrice: 100, accTradePrice24h: 1_000_000, signedChangeRate: 0.01,
  spreadBps: 4, top5BidDepthKrw: 100_000, top5AskDepthKrw: 90_000, orderbookImbalance: 0.05,
  warning: false, score: 90, eligible: true, reasons: [],
};
const multiTimeframe = (): MultiTimeframeSnapshot => ({
  market: 'KRW-BTC', asOf: 1_000_000, action: 'BUY', directionalScore: 70, oracleTradeScore: 85,
  confidence: 0.85, aligned: true, positionRiskMultiplier: 1,
  frames: {
    fourHour: {} as any,
    oneHour: {
      trend: { action: 'BUY', directionalScore: 75, strength: 0.8, confidence: 0.85, reasons: [] },
      momentum: { action: 'BUY', directionalScore: 65, strength: 0.75, confidence: 0.82, reasons: [] },
      meanReversion: { action: 'WAIT', state: 'NEUTRAL', score: 10, confidence: 0.6, rawExtremeScore: 0, trendPenalty: 0, reasons: [] },
    } as any,
    fifteenMinute: {} as any,
  },
  reasons: [],
});

test('builds deterministic research cohort with no execution authority', () => {
  const checkpoint = createStrategyReturnPanelCheckpoint();
  assert.ok(checkpoint.cohort.candidates.length >= 3);
  assert.equal(checkpoint.cohort.executionAuthority, false);
  assert.equal(checkpoint.cohort.promotionAuthority, false);
});

test('creates same-time shadow predictions and resolves without lookahead', () => {
  let checkpoint = createStrategyReturnPanelCheckpoint();
  const observation = createStrategyReturnObservation(checkpoint, {
    market: 'KRW-BTC', generatedAt: 1_000_000, anchorPrice: 100,
    multiTimeframe: multiTimeframe(), evidence, liquidity, horizonMs: 60_000,
  });
  assert.ok(observation);
  checkpoint = appendStrategyReturnObservation(checkpoint, observation!);
  const early = resolveStrategyReturnPanel(checkpoint, [{ timestamp: 1_030_000, prices: [['KRW-BTC', 105]] }]);
  assert.equal(early.observations[0].resolvedAt, null);
  const resolved = resolveStrategyReturnPanel(checkpoint, [{ timestamp: 1_070_000, prices: [['KRW-BTC', 105]] }]);
  assert.equal(resolved.observations[0].resolvedAt, 1_070_000);
  assert.equal(resolved.observations[0].rawReturn, 0.05);
  assert.equal(resolved.observations[0].outcomes.length, resolved.cohort.candidates.length);
});

test('missing evidence makes every research candidate no-trade', () => {
  const checkpoint = createStrategyReturnPanelCheckpoint();
  const observation = createStrategyReturnObservation(checkpoint, {
    market: 'KRW-BTC', generatedAt: 1_000_000, anchorPrice: 100,
    multiTimeframe: multiTimeframe(), evidence: { ...evidence, activeCount: 0, evidenceIds: [], score: 0, confidence: 0 }, liquidity,
  })!;
  assert.ok(observation.predictions.every((prediction) => prediction.action === 'NO_TRADE'));
});

test('aligned panel returns one equal-length series per candidate', () => {
  let checkpoint = createStrategyReturnPanelCheckpoint();
  for (let index = 0; index < 3; index += 1) {
    const generatedAt = 1_000_000 + index * 100_000;
    const observation = createStrategyReturnObservation(checkpoint, {
      market: 'KRW-BTC', generatedAt, anchorPrice: 100,
      multiTimeframe: multiTimeframe(), evidence, liquidity, horizonMs: 60_000,
    })!;
    checkpoint = appendStrategyReturnObservation(checkpoint, observation);
  }
  checkpoint = resolveStrategyReturnPanel(checkpoint, [
    { timestamp: 1_070_000, prices: [['KRW-BTC', 101]] },
    { timestamp: 1_170_000, prices: [['KRW-BTC', 102]] },
    { timestamp: 1_270_000, prices: [['KRW-BTC', 103]] },
  ]);
  const series = buildAlignedStrategyReturnSeries(checkpoint);
  assert.equal(series.length, checkpoint.cohort.candidates.length);
  assert.ok(series.every((item) => item.returns.length === 3));
  const summary = summarizeStrategyReturnPanel(checkpoint);
  assert.equal(summary.alignedObservations, 3);
  assert.equal(summary.pboEligible, false);
});
