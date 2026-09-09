import test from 'node:test';
import assert from 'node:assert/strict';
import { generateStrategyFactoryCandidates, type StrategyGenome } from './strategyFactory';
import { backtestStrategyGenome, buildStrategyFactoryFeatureFrames } from './strategyFactoryBacktest';
import type { Candle } from './types';

const syntheticCandles = (count = 760): Candle[] => {
  const rows: Candle[] = [];
  let previous = 100;
  for (let index = 0; index < count; index += 1) {
    const drift = 0.0012;
    const cycle = Math.sin(index / 19) * 0.006 + Math.sin(index / 53) * 0.003;
    const close = Math.max(10, previous * (1 + drift + cycle));
    const open = previous;
    const high = Math.max(open, close) * 1.006;
    const low = Math.min(open, close) * 0.994;
    rows.push({
      market: 'KRW-TEST',
      timeframeMinutes: 60,
      timestamp: 1_700_000_000_000 + index * 60 * 60_000,
      open,
      high,
      low,
      close,
      volume: 1_000 + (index % 31) * 35,
      quoteVolume: close * (1_000 + (index % 31) * 35),
    });
    previous = close;
  }
  return rows;
};

test('Strategy Factory generation is deterministic and explores reversible indicator polarity', () => {
  const first = generateStrategyFactoryCandidates({ seed: 4420623, candidates: 256, minIndicators: 3, maxIndicators: 6 });
  const second = generateStrategyFactoryCandidates({ seed: 4420623, candidates: 256, minIndicators: 3, maxIndicators: 6 });
  assert.deepEqual(first, second);
  assert.equal(first.length, 256);
  assert.ok(first.every((item) => item.executionAuthority === false && item.promotionAuthority === false));
  assert.ok(first.some((item) => Object.entries(item.indicatorWeights).some(([id, weight]) =>
    ['RSI14', 'BOLLINGER_PERCENT_B'].includes(id) && weight < 0,
  )));
});

test('Strategy Factory feature frames and backtest are deterministic on identical historical input', () => {
  const candles = syntheticCandles();
  const framesA = buildStrategyFactoryFeatureFrames(candles, { warmupBars: 220, maxWindowBars: 320 });
  const framesB = buildStrategyFactoryFeatureFrames(candles, { warmupBars: 220, maxWindowBars: 320 });
  assert.deepEqual(framesA, framesB);
  assert.ok(framesA.length > 400);

  const genome: StrategyGenome = {
    id: 'TEST-TREND-1',
    generation: 1,
    seed: 7,
    assetClass: 'CRYPTO_SPOT',
    indicators: ['EMA_STACK', 'MACD_HISTOGRAM', 'ROC20', 'MARKET_STRUCTURE'],
    indicatorWeights: { EMA_STACK: 0.4, MACD_HISTOGRAM: 0.2, ROC20: 0.2, MARKET_STRUCTURE: 0.2 },
    entryThreshold: 0.2,
    exitThreshold: 0.1,
    maxHoldingBars: 48,
    stopAtrMultiple: 1.6,
    takeProfitR: 2.2,
    correlationPenalty: 0.06,
    executionAuthority: false,
    promotionAuthority: false,
  };

  const first = backtestStrategyGenome(genome, candles, { oosFraction: 0.3, costPerSideBps: 13 }, framesA);
  const second = backtestStrategyGenome(genome, candles, { oosFraction: 0.3, costPerSideBps: 13 }, framesA);
  assert.deepEqual(first, second);
  assert.ok(first.trades.length > 0);
  assert.ok(first.trades.every((trade) => trade.entryIndex > 220));
  assert.ok(first.reasons.some((reason) => /next bar open/i.test(reason)));
  assert.equal(first.genome.executionAuthority, false);
});
