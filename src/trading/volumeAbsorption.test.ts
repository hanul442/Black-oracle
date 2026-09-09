import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEquityIntradayTiming } from './equityIntradayTiming';
import { buildVolumeAbsorptionSnapshot } from './volumeAbsorption';
import type { Candle } from './types';

const dailySeries = (): Candle[] => {
  const bars: Candle[] = [];
  let price = 100;
  for (let i = 0; i < 100; i += 1) {
    const open = price;
    const isSurge = i === 55;
    const close = isSurge ? open * 1.09 : open * (1 + Math.sin(i / 12) * 0.002);
    const volume = isSurge ? 2_000_000 : 500_000 + (i % 7) * 25_000;
    bars.push({
      market: 'KRX-000001',
      timeframeMinutes: 1440,
      timestamp: 1_700_000_000_000 + i * 86_400_000,
      open,
      high: Math.max(open, close) * 1.01,
      low: Math.min(open, close) * 0.99,
      close,
      volume,
    });
    price = close;
  }
  // Simulate a later drawdown so the current intraday price is materially below the reference surge close.
  for (let i = 80; i < bars.length; i += 1) {
    bars[i] = { ...bars[i], open: 82, high: 83, low: 81, close: 82, volume: 520_000 };
  }
  return bars;
};

const intradayAbsorption = (): Candle[] => {
  const bars: Candle[] = [];
  for (let i = 0; i < 72; i += 1) {
    const recent = i >= 60;
    const open = 81.8 + (i % 4) * 0.03;
    const close = recent ? 81.9 + (i - 60) * 0.015 : open + 0.01;
    bars.push({
      market: 'KRX-000001',
      timeframeMinutes: 1,
      timestamp: 1_800_000_000_000 + i * 60_000,
      open,
      high: Math.max(open, close) + 0.25,
      low: Math.min(open, close) - (recent ? 0.28 : 0.12),
      close,
      volume: recent ? 240_000 : 70_000,
    });
  }
  return bars;
};

test('heavy volume with limited downside progress can classify as bullish absorption', () => {
  const absorption = buildVolumeAbsorptionSnapshot(dailySeries(), intradayAbsorption());
  assert.equal(absorption.absorptionCandidate, true);
  assert.equal(absorption.direction, 'BULLISH');
  assert.ok((absorption.recentVolumeRatio ?? 0) >= 2);
  assert.ok((absorption.historicalPriceDiscountPct ?? 0) >= 0.08);
  assert.ok(absorption.score >= 55);
});

test('intraday timing treats confirmed absorption as timing support, not execution authority', () => {
  const minute = intradayAbsorption();
  const absorption = buildVolumeAbsorptionSnapshot(dailySeries(), minute);
  const timing = buildEquityIntradayTiming(minute, absorption);
  assert.equal(timing.action, 'ENTER_NOW');
  assert.equal(timing.absorptionConfirmed, true);
  assert.ok(timing.confidence > 0);
});

test('high volume with downside follow-through is not mislabeled bullish absorption', () => {
  const minute = intradayAbsorption().map((bar, index) => index < 60 ? bar : {
    ...bar,
    open: 82 - (index - 60) * 0.15,
    close: 81.7 - (index - 60) * 0.18,
    high: 82.05 - (index - 60) * 0.15,
    low: 81.5 - (index - 60) * 0.2,
    volume: 260_000,
  });
  const absorption = buildVolumeAbsorptionSnapshot(dailySeries(), minute);
  const timing = buildEquityIntradayTiming(minute, absorption);
  assert.notEqual(absorption.direction, 'BULLISH');
  assert.notEqual(timing.action, 'ENTER_NOW');
});
