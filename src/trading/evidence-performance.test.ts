import test from 'node:test';
import assert from 'node:assert/strict';
import { TradingEvidenceStore } from './evidence';
import { buildPaperPerformance, type ClosedPaperTrade } from './performance';

test('evidence aggregation applies reliability, expiry decay and contradiction suppression', () => {
  const store = new TradingEvidenceStore();
  const now = 1_000_000;

  store.upsert({
    id: 'bull-primary',
    market: 'KRW-BTC',
    title: 'Primary bullish catalyst',
    direction: 'BULLISH',
    strength: 90,
    reliability: 0.9,
    sourceType: 'PRIMARY',
    observedAt: now - 1_000,
    expiresAt: now + 100_000,
  });
  store.upsert({
    id: 'bear-contradiction',
    market: 'KRW-BTC',
    title: 'Contradicting evidence',
    direction: 'BEARISH',
    strength: 80,
    reliability: 0.95,
    sourceType: 'NEWS',
    observedAt: now,
    expiresAt: now + 100_000,
    contradictionOf: 'bull-primary',
  });

  const aggregate = store.aggregate('KRW-BTC', now + 1);
  assert.equal(aggregate.activeCount, 2);
  assert.equal(aggregate.contradictionCount, 1);
  assert.ok(aggregate.score < 0);
  assert.ok(aggregate.confidence > 0);
});

test('expired evidence is excluded from active event score', () => {
  const store = new TradingEvidenceStore();
  store.upsert({
    id: 'expired',
    market: 'KRW-ETH',
    title: 'Expired catalyst',
    direction: 'BULLISH',
    strength: 100,
    reliability: 1,
    sourceType: 'NEWS',
    observedAt: 100,
    expiresAt: 200,
  });

  const aggregate = store.aggregate('KRW-ETH', 300);
  assert.equal(aggregate.activeCount, 0);
  assert.equal(aggregate.score, 0);
});

test('paper performance reports win rate expectancy profit factor and score buckets', () => {
  const trades: ClosedPaperTrade[] = [
    {
      id: 't1', market: 'KRW-BTC', openedAt: 1, closedAt: 2, entryPrice: 100, exitPrice: 104, quantity: 10,
      grossPnl: 40, fees: 4, netPnl: 36, returnPct: 0.036, exitReason: 'TP', strategyVersion: 'test',
      entryOracleTradeScore: 82, exitOracleTradeScore: 55,
    },
    {
      id: 't2', market: 'KRW-ETH', openedAt: 3, closedAt: 4, entryPrice: 100, exitPrice: 98, quantity: 10,
      grossPnl: -20, fees: 4, netPnl: -24, returnPct: -0.024, exitReason: 'SL', strategyVersion: 'test',
      entryOracleTradeScore: 72, exitOracleTradeScore: 40,
    },
    {
      id: 't3', market: 'KRW-XRP', openedAt: 5, closedAt: 6, entryPrice: 100, exitPrice: 103, quantity: 10,
      grossPnl: 30, fees: 4, netPnl: 26, returnPct: 0.026, exitReason: 'REVERSAL', strategyVersion: 'test',
      entryOracleTradeScore: 84, exitOracleTradeScore: 45,
    },
  ];

  const performance = buildPaperPerformance(
    trades,
    [
      { timestamp: 1, equity: 1_000 },
      { timestamp: 2, equity: 1_050 },
      { timestamp: 3, equity: 980 },
      { timestamp: 4, equity: 1_038 },
    ],
    1_000,
    1_038,
    0.011,
  );

  assert.equal(performance.trades, 3);
  assert.equal(performance.wins, 2);
  assert.equal(performance.losses, 1);
  assert.equal(performance.winRate, 2 / 3);
  assert.equal(performance.netPnl, 38);
  assert.ok((performance.profitFactor ?? 0) > 2);
  assert.ok(performance.maxDrawdownPct > 0.06);
  const highScoreBucket = performance.buckets.find((bucket) => bucket.label === '80-89');
  assert.equal(highScoreBucket?.trades, 2);
  assert.equal(highScoreBucket?.wins, 2);
});
