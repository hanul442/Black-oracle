import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMicrostructureSnapshot, unavailableMicrostructure } from './microstructure';
import { buildMicrostructureChallenger } from './microstructureChallenger';
import { buildPaperPerformance, type ClosedPaperTrade } from './performance';
import type { MultiTimeframeSnapshot } from './types';
import { buildTradeVolumeProfile, type TradePrint } from './volumeProfile';

const trades = Array.from({ length: 120 }, (_, index): TradePrint => ({
  market: 'KRW-BTC',
  timestamp: 1_700_000_000_000 + index * 1_000,
  price: 100 + (index % 12) * 0.5,
  volume: index % 3 === 0 ? 2 : 1,
  side: index % 4 === 0 ? 'ASK' : 'BID',
  sequentialId: String(index),
}));

const levels = Array.from({ length: 30 }, (_, index) => ({
  bidPrice: 100 - index * 0.1,
  askPrice: 100.1 + index * 0.1,
  bidSize: 10 + (30 - index) * 0.4,
  askSize: 7 + index * 0.1,
}));

const baseline = {
  market: 'KRW-BTC',
  asOf: 1_700_000_200_000,
  action: 'BUY',
  directionalScore: 40,
  oracleTradeScore: 72,
  confidence: 0.7,
  aligned: true,
  positionRiskMultiplier: 1,
  frames: {},
  reasons: [],
} as unknown as MultiTimeframeSnapshot;

test('trade-sample volume profile identifies POC and contiguous value area', () => {
  const profile = buildTradeVolumeProfile(trades, { binCount: 12, currentPrice: 103 });
  assert.equal(profile.available, true);
  assert.equal(profile.sampleTrades, 120);
  assert.ok(profile.pointOfControl != null);
  assert.ok(profile.valueAreaLow != null);
  assert.ok(profile.valueAreaHigh != null);
  assert.ok(profile.valueAreaLow! <= profile.pointOfControl!);
  assert.ok(profile.valueAreaHigh! >= profile.pointOfControl!);
  assert.equal(profile.bins.length, 12);
});

test('microstructure combines taker flow with multiple orderbook depths without granting execution authority', () => {
  const snapshot = buildMicrostructureSnapshot({
    market: 'KRW-BTC',
    asOf: 1_700_000_200_000,
    currentPrice: 103,
    trades,
    orderbookLevels: levels,
  });
  assert.equal(snapshot.available, true);
  assert.ok((snapshot.takerImbalance ?? 0) > 0);
  assert.ok((snapshot.orderbookImbalanceTop30 ?? 0) > 0);
  assert.ok((snapshot.pressureScore ?? 0) > 0);
  assert.equal(snapshot.direction, 'BULLISH');

  const challenger = buildMicrostructureChallenger(baseline, snapshot);
  assert.equal(challenger.alignment, 'SUPPORTS');
  assert.equal(challenger.baselineOracleScore, 72);
  assert.ok(challenger.shadowOracleScore >= challenger.baselineOracleScore);
  assert.ok(challenger.shadowScoreAdjustment <= 12);
});

test('missing microstructure fails soft and leaves baseline score unchanged', () => {
  const unavailable = unavailableMicrostructure('KRW-BTC', 1_700_000_200_000, 'fixture unavailable');
  const challenger = buildMicrostructureChallenger(baseline, unavailable);
  assert.equal(challenger.available, false);
  assert.equal(challenger.alignment, 'UNAVAILABLE');
  assert.equal(challenger.shadowScoreAdjustment, 0);
  assert.equal(challenger.shadowOracleScore, baseline.oracleTradeScore);
});

test('closed Paper outcomes are bucketed by persisted challenger alignment', () => {
  const baseTrade: ClosedPaperTrade = {
    id: 'trade-1',
    market: 'KRW-BTC',
    openedAt: 1,
    closedAt: 2,
    entryPrice: 100,
    exitPrice: 102,
    quantity: 1,
    grossPnl: 2,
    fees: 0,
    netPnl: 2,
    returnPct: 0.02,
    exitReason: 'fixture',
    strategyVersion: 'fixture',
    entryOracleTradeScore: 72,
    exitOracleTradeScore: 60,
    entryAudit: {
      challenger: { alignment: 'SUPPORTS' },
    } as ClosedPaperTrade['entryAudit'],
  };
  const conflictTrade: ClosedPaperTrade = {
    ...baseTrade,
    id: 'trade-2',
    netPnl: -1,
    returnPct: -0.01,
    entryAudit: {
      challenger: { alignment: 'CONFLICTS' },
    } as ClosedPaperTrade['entryAudit'],
  };
  const performance = buildPaperPerformance(
    [baseTrade, conflictTrade],
    [{ timestamp: 1, equity: 100 }, { timestamp: 2, equity: 101 }],
    100,
    101,
    0,
  );
  assert.equal(performance.microstructureBuckets.find((bucket) => bucket.alignment === 'SUPPORTS')?.trades, 1);
  assert.equal(performance.microstructureBuckets.find((bucket) => bucket.alignment === 'CONFLICTS')?.trades, 1);
});
