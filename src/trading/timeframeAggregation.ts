import type { Candle } from './types';
import type { CanonicalTimeframe } from './horizonPolicy';

export interface CanonicalTimeframeSet {
  frames: Partial<Record<CanonicalTimeframe, Candle[]>>;
  unavailable: CanonicalTimeframe[];
  reasons: string[];
}

const floorBucket = (timestamp: number, bucketMs: number, timezoneOffsetMinutes = 0) => {
  const shift = timezoneOffsetMinutes * 60_000;
  return Math.floor((timestamp + shift) / bucketMs) * bucketMs - shift;
};

const calendarBucket = (timestamp: number, unit: 'WEEK' | 'MONTH', timezoneOffsetMinutes: number) => {
  const shifted = new Date(timestamp + timezoneOffsetMinutes * 60_000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  if (unit === 'MONTH') return Date.UTC(year, month, 1) - timezoneOffsetMinutes * 60_000;
  const weekday = shifted.getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  return Date.UTC(year, month, day - mondayOffset) - timezoneOffsetMinutes * 60_000;
};

export const aggregateCandles = (
  candles: Candle[],
  target: { timeframeMinutes?: number; calendar?: 'WEEK' | 'MONTH' },
  timezoneOffsetMinutes = 540,
): Candle[] => {
  if (!candles.length) return [];
  const sorted = candles.slice().sort((a, b) => a.timestamp - b.timestamp);
  const groups = new Map<number, Candle[]>();
  const targetMinutes = target.timeframeMinutes ?? (target.calendar === 'WEEK' ? 10_080 : 43_200);

  for (const candle of sorted) {
    const bucket = target.calendar
      ? calendarBucket(candle.timestamp, target.calendar, timezoneOffsetMinutes)
      : floorBucket(candle.timestamp, targetMinutes * 60_000, timezoneOffsetMinutes);
    const group = groups.get(bucket) ?? [];
    group.push(candle);
    groups.set(bucket, group);
  }

  return [...groups.entries()].sort(([a], [b]) => a - b).map(([timestamp, group]) => {
    const first = group[0];
    const last = group[group.length - 1];
    return {
      market: first.market,
      timeframeMinutes: targetMinutes,
      timestamp,
      open: first.open,
      high: Math.max(...group.map((item) => item.high)),
      low: Math.min(...group.map((item) => item.low)),
      close: last.close,
      volume: group.reduce((sum, item) => sum + item.volume, 0),
      quoteVolume: group.some((item) => Number.isFinite(item.quoteVolume))
        ? group.reduce((sum, item) => sum + (item.quoteVolume ?? 0), 0)
        : undefined,
    } satisfies Candle;
  });
};

const enough = (candles: Candle[] | undefined, minimum: number) => Array.isArray(candles) && candles.length >= minimum;

/**
 * Builds the canonical frame family used by V10. The function never fabricates missing
 * history. Intraday 1H/4H quality is limited by the depth of the supplied minute history.
 */
export const buildCanonicalTimeframeSet = (input: {
  oneMinute?: Candle[];
  fiveMinute?: Candle[];
  fifteenMinute?: Candle[];
  daily?: Candle[];
  timezoneOffsetMinutes?: number;
}): CanonicalTimeframeSet => {
  const timezoneOffsetMinutes = input.timezoneOffsetMinutes ?? 540;
  const frames: Partial<Record<CanonicalTimeframe, Candle[]>> = {};
  const reasons: string[] = [];

  if (input.oneMinute?.length) frames['1M'] = input.oneMinute.slice();
  if (input.fiveMinute?.length) frames['5M'] = input.fiveMinute.slice();
  else if (enough(input.oneMinute, 5)) frames['5M'] = aggregateCandles(input.oneMinute!, { timeframeMinutes: 5 }, timezoneOffsetMinutes);

  if (input.fifteenMinute?.length) frames['15M'] = input.fifteenMinute.slice();
  else if (enough(input.oneMinute, 15)) frames['15M'] = aggregateCandles(input.oneMinute!, { timeframeMinutes: 15 }, timezoneOffsetMinutes);
  else if (enough(input.fiveMinute, 3)) frames['15M'] = aggregateCandles(input.fiveMinute!, { timeframeMinutes: 15 }, timezoneOffsetMinutes);

  const intradayBase = frames['15M'] ?? frames['5M'] ?? frames['1M'];
  if (enough(intradayBase, 4)) frames['1H'] = aggregateCandles(intradayBase!, { timeframeMinutes: 60 }, timezoneOffsetMinutes);
  if (enough(intradayBase, 16)) frames['4H'] = aggregateCandles(intradayBase!, { timeframeMinutes: 240 }, timezoneOffsetMinutes);

  if (input.daily?.length) {
    frames['1D'] = input.daily.slice();
    if (enough(input.daily, 10)) frames['1W'] = aggregateCandles(input.daily, { calendar: 'WEEK' }, timezoneOffsetMinutes);
    if (enough(input.daily, 40)) frames['1MO'] = aggregateCandles(input.daily, { calendar: 'MONTH' }, timezoneOffsetMinutes);
  }

  const all: CanonicalTimeframe[] = ['1M', '5M', '15M', '1H', '4H', '1D', '1W', '1MO'];
  const unavailable = all.filter((frame) => !frames[frame]?.length);
  if (!frames['1H'] || !frames['4H']) reasons.push('1H/4H history depends on supplied intraday depth; current-session-only minute data is not sufficient for robust multi-day structure.');
  if (!frames['1W'] || !frames['1MO']) reasons.push('Weekly/monthly frames require enough daily history; they remain unavailable rather than being inferred from shorter samples.');

  return { frames, unavailable, reasons };
};
