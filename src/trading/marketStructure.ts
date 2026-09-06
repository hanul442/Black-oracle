import type { Candle, MarketStructureEvent, MarketStructureSnapshot, SwingPoint } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const detectSwings = (candles: Candle[], leftBars: number, rightBars: number): SwingPoint[] => {
  const swings: SwingPoint[] = [];

  for (let index = leftBars; index < candles.length - rightBars; index += 1) {
    const candle = candles[index];
    const left = candles.slice(index - leftBars, index);
    const right = candles.slice(index + 1, index + 1 + rightBars);
    const highIsPivot = left.every((item) => candle.high > item.high) && right.every((item) => candle.high >= item.high);
    const lowIsPivot = left.every((item) => candle.low < item.low) && right.every((item) => candle.low <= item.low);
    const confirmedIndex = index + rightBars;

    if (highIsPivot) {
      swings.push({
        index,
        timestamp: candle.timestamp,
        confirmedAt: candles[confirmedIndex].timestamp,
        price: candle.high,
        type: 'HIGH',
      });
    }
    if (lowIsPivot) {
      swings.push({
        index,
        timestamp: candle.timestamp,
        confirmedAt: candles[confirmedIndex].timestamp,
        price: candle.low,
        type: 'LOW',
      });
    }
  }

  return swings.sort((a, b) => a.confirmedAt - b.confirmedAt || a.index - b.index);
};

const classifyEvents = (candles: Candle[], swings: SwingPoint[]): MarketStructureEvent[] => {
  const events: MarketStructureEvent[] = [];
  let bias: MarketStructureSnapshot['bias'] = 'NEUTRAL';
  let activeHigh: SwingPoint | null = null;
  let activeLow: SwingPoint | null = null;
  const brokenSwings = new Set<string>();

  for (const candle of candles) {
    for (const swing of swings) {
      if (swing.confirmedAt > candle.timestamp) break;
      if (swing.type === 'HIGH' && (!activeHigh || swing.confirmedAt >= activeHigh.confirmedAt)) activeHigh = swing;
      if (swing.type === 'LOW' && (!activeLow || swing.confirmedAt >= activeLow.confirmedAt)) activeLow = swing;
    }

    const highKey = activeHigh ? `H-${activeHigh.timestamp}` : null;
    const lowKey = activeLow ? `L-${activeLow.timestamp}` : null;

    if (activeHigh && highKey && !brokenSwings.has(highKey) && candle.timestamp > activeHigh.confirmedAt && candle.close > activeHigh.price) {
      const type: MarketStructureEvent['type'] = bias === 'BEARISH' ? 'CHOCH' : 'BOS';
      events.push({
        type,
        direction: 'BULLISH',
        breakPrice: candle.close,
        brokenSwingPrice: activeHigh.price,
        brokenSwingTimestamp: activeHigh.timestamp,
        confirmedAt: candle.timestamp,
      });
      brokenSwings.add(highKey);
      bias = 'BULLISH';
    }

    if (activeLow && lowKey && !brokenSwings.has(lowKey) && candle.timestamp > activeLow.confirmedAt && candle.close < activeLow.price) {
      const type: MarketStructureEvent['type'] = bias === 'BULLISH' ? 'CHOCH' : 'BOS';
      events.push({
        type,
        direction: 'BEARISH',
        breakPrice: candle.close,
        brokenSwingPrice: activeLow.price,
        brokenSwingTimestamp: activeLow.timestamp,
        confirmedAt: candle.timestamp,
      });
      brokenSwings.add(lowKey);
      bias = 'BEARISH';
    }
  }

  return events;
};

export interface MarketStructureOptions {
  leftBars?: number;
  rightBars?: number;
  equilibriumBand?: number;
}

export const buildMarketStructure = (
  candles: Candle[],
  options: MarketStructureOptions = {},
): MarketStructureSnapshot => {
  if (candles.length < 12) throw new Error('Market structure requires at least 12 candles.');
  const ordered = candles.slice().sort((a, b) => a.timestamp - b.timestamp);
  const leftBars = Math.max(2, Math.floor(options.leftBars ?? 3));
  const rightBars = Math.max(2, Math.floor(options.rightBars ?? 3));
  const equilibriumBand = clamp(options.equilibriumBand ?? 0.1, 0.02, 0.3);
  if (ordered.length < leftBars + rightBars + 3) throw new Error('Market structure window is too short for confirmed pivots.');

  const swings = detectSwings(ordered, leftBars, rightBars);
  const events = classifyEvents(ordered, swings);
  const latest = ordered[ordered.length - 1];
  const confirmedSwings = swings.filter((swing) => swing.confirmedAt <= latest.timestamp);
  const lastSwingHigh = [...confirmedSwings].reverse().find((swing) => swing.type === 'HIGH') ?? null;
  const lastSwingLow = [...confirmedSwings].reverse().find((swing) => swing.type === 'LOW') ?? null;
  const lastEvent = events.length ? events[events.length - 1] : null;
  const bias: MarketStructureSnapshot['bias'] = lastEvent?.direction ?? 'NEUTRAL';

  const rangeHigh = lastSwingHigh?.price ?? Math.max(...ordered.slice(-40).map((item) => item.high));
  const rangeLow = lastSwingLow?.price ?? Math.min(...ordered.slice(-40).map((item) => item.low));
  const rangeWidth = Math.max(Number.EPSILON, rangeHigh - rangeLow);
  const percentile = clamp((latest.close - rangeLow) / rangeWidth, 0, 1);
  const lowerEq = 0.5 - equilibriumBand / 2;
  const upperEq = 0.5 + equilibriumBand / 2;
  const location: MarketStructureSnapshot['location']['zone'] = percentile < lowerEq
    ? 'DISCOUNT'
    : percentile > upperEq
      ? 'PREMIUM'
      : 'EQUILIBRIUM';

  let liquiditySweep: MarketStructureSnapshot['liquiditySweep'] = null;
  if (lastSwingHigh && latest.high > lastSwingHigh.price && latest.close <= lastSwingHigh.price) {
    liquiditySweep = {
      direction: 'BEARISH',
      sweptPrice: lastSwingHigh.price,
      extremePrice: latest.high,
      confirmedAt: latest.timestamp,
    };
  } else if (lastSwingLow && latest.low < lastSwingLow.price && latest.close >= lastSwingLow.price) {
    liquiditySweep = {
      direction: 'BULLISH',
      sweptPrice: lastSwingLow.price,
      extremePrice: latest.low,
      confirmedAt: latest.timestamp,
    };
  }

  const recentEvents = events.filter((event) => event.confirmedAt >= ordered[Math.max(0, ordered.length - 60)].timestamp);
  const eventClarity = recentEvents.length === 0
    ? 0
    : Math.abs(recentEvents.reduce((sum, event) => sum + (event.direction === 'BULLISH' ? 1 : -1), 0)) / recentEvents.length;
  const swingCoverage = clamp(confirmedSwings.length / 8, 0, 1);
  const confidence = clamp(0.3 + swingCoverage * 0.35 + eventClarity * 0.25 + (lastEvent ? 0.1 : 0), 0, 0.95);

  const reasons = [
    `${confirmedSwings.length} confirmed swing point(s) use ${leftBars}/${rightBars} left/right bars; pivots are only emitted after right-side confirmation.`,
    lastEvent
      ? `${lastEvent.type} ${lastEvent.direction} confirmed on candle close at ${lastEvent.confirmedAt}.`
      : 'No confirmed close has broken the latest validated swing structure.',
    `Current price sits in ${location} at ${(percentile * 100).toFixed(1)}% of the latest confirmed range.`,
  ];
  if (liquiditySweep) reasons.push(`${liquiditySweep.direction} liquidity sweep detected without a confirming close beyond the swept swing.`);

  return {
    bias,
    confidence,
    lastSwingHigh,
    lastSwingLow,
    lastEvent,
    recentEvents: recentEvents.slice(-8),
    location: { zone: location, percentile, rangeLow, rangeHigh },
    liquiditySweep,
    reasons,
  };
};
