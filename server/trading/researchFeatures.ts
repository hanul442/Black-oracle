import {
  buildCrossTimeframeShadowConsensus,
  buildTechnicalFeatureShadowSnapshot,
  type CrossTimeframeShadowConsensus,
  type RelativeStrengthPointInTime,
  type TechnicalFeatureShadowSnapshot,
} from '../../src/trading/research/shadowFeatures';
import type { LiquiditySnapshot } from '../../src/trading/types';
import { getMinuteCandles } from './upbitPublic';

export interface MarketShadowResearchSnapshot {
  market: string;
  asOf: number;
  authority: 'OBSERVATION_ONLY';
  frames: {
    fourHour: TechnicalFeatureShadowSnapshot;
    oneHour: TechnicalFeatureShadowSnapshot;
    fifteenMinute: TechnicalFeatureShadowSnapshot;
  };
  consensus: CrossTimeframeShadowConsensus;
}

export interface PointInTimeRelativeStrengthContext {
  universeAt: number;
  universeMarkets: string[];
  byMarket: Map<string, RelativeStrengthPointInTime>;
}

interface ReturnVector {
  market: string;
  return15m: number;
  return1h: number;
  return4h: number;
  return24h: number;
}

const safeReturn = (latest: number, previous: number) => previous > 0 ? latest / previous - 1 : 0;

const buildReturnVector = async (market: string): Promise<ReturnVector> => {
  const candles = await getMinuteCandles(market, 15, 97);
  if (candles.length < 97) throw new Error(`Relative strength requires 97 15-minute candles for ${market}.`);
  const close = candles.map((candle) => candle.close);
  const latest = close[close.length - 1];
  return {
    market,
    return15m: safeReturn(latest, close[close.length - 2]),
    return1h: safeReturn(latest, close[close.length - 5]),
    return4h: safeReturn(latest, close[close.length - 17]),
    return24h: safeReturn(latest, close[close.length - 97]),
  };
};

const percentileRanks = (values: Array<{ market: string; value: number }>) => {
  const sorted = values.slice().sort((a, b) => a.value - b.value || a.market.localeCompare(b.market));
  const output = new Map<string, number>();
  let cursor = 0;
  while (cursor < sorted.length) {
    let end = cursor + 1;
    while (end < sorted.length && sorted[end].value === sorted[cursor].value) end += 1;
    const averageIndex = (cursor + end - 1) / 2;
    const percentile = sorted.length <= 1 ? 0.5 : averageIndex / (sorted.length - 1);
    for (let index = cursor; index < end; index += 1) output.set(sorted[index].market, percentile);
    cursor = end;
  }
  return output;
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

export const buildPointInTimeRelativeStrengthContext = async (
  universe: LiquiditySnapshot[],
  universeAt = Date.now(),
): Promise<PointInTimeRelativeStrengthContext> => {
  const universeMarkets = [...new Set(universe.map((item) => item.market.toUpperCase()))];
  if (universeMarkets.length < 2) {
    return { universeAt, universeMarkets, byMarket: new Map() };
  }

  const settled = await Promise.allSettled(universeMarkets.map(buildReturnVector));
  const vectors = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  if (vectors.length < 2) return { universeAt, universeMarkets, byMarket: new Map() };

  // Point-in-time rule: rank only markets successfully observed in Universe(t).
  // No current/future universe is ever applied retroactively to an old cycle.
  const observedMarkets = vectors.map((item) => item.market);
  const rank15m = percentileRanks(vectors.map((item) => ({ market: item.market, value: item.return15m })));
  const rank1h = percentileRanks(vectors.map((item) => ({ market: item.market, value: item.return1h })));
  const rank4h = percentileRanks(vectors.map((item) => ({ market: item.market, value: item.return4h })));
  const rank24h = percentileRanks(vectors.map((item) => ({ market: item.market, value: item.return24h })));
  const median15m = median(vectors.map((item) => item.return15m));
  const median1h = median(vectors.map((item) => item.return1h));
  const median4h = median(vectors.map((item) => item.return4h));
  const median24h = median(vectors.map((item) => item.return24h));

  const liquidityRanks = percentileRanks(
    universe
      .filter((item) => observedMarkets.includes(item.market))
      .map((item) => ({ market: item.market, value: item.accTradePrice24h })),
  );

  const byMarket = new Map<string, RelativeStrengthPointInTime>();
  for (const vector of vectors) {
    const p15 = rank15m.get(vector.market) ?? 0.5;
    const p1 = rank1h.get(vector.market) ?? 0.5;
    const p4 = rank4h.get(vector.market) ?? 0.5;
    const p24 = rank24h.get(vector.market) ?? 0.5;
    const liquidityRank = liquidityRanks.get(vector.market) ?? 0.5;
    byMarket.set(vector.market, {
      universeAt,
      universeMarkets: observedMarkets.slice(),
      returns: {
        return15m: vector.return15m,
        return1h: vector.return1h,
        return4h: vector.return4h,
        return24h: vector.return24h,
      },
      percentiles: {
        percentileRank15m: p15,
        percentileRank1h: p1,
        percentileRank4h: p4,
        percentileRank24h: p24,
      },
      relativeReturns: {
        relativeReturn15m: vector.return15m - median15m,
        relativeReturn1h: vector.return1h - median1h,
        relativeReturn4h: vector.return4h - median4h,
        relativeReturn24h: vector.return24h - median24h,
      },
      liquidityAdjustedPercentile: p24 * 0.75 + liquidityRank * 0.25,
    });
  }

  return { universeAt, universeMarkets: observedMarkets, byMarket };
};

export const buildMarketShadowResearch = async (
  market: string,
  relativeStrength?: RelativeStrengthPointInTime | null,
): Promise<{ snapshot: MarketShadowResearchSnapshot; fifteenMinuteCandles: Awaited<ReturnType<typeof getMinuteCandles>> }> => {
  const normalized = market.toUpperCase();
  const [fourHourCandles, oneHourCandles, fifteenMinuteCandles] = await Promise.all([
    getMinuteCandles(normalized, 240, 200),
    getMinuteCandles(normalized, 60, 200),
    getMinuteCandles(normalized, 15, 200),
  ]);
  const fourHour = buildTechnicalFeatureShadowSnapshot(fourHourCandles, '4H', relativeStrength);
  const oneHour = buildTechnicalFeatureShadowSnapshot(oneHourCandles, '1H', relativeStrength);
  const fifteenMinute = buildTechnicalFeatureShadowSnapshot(fifteenMinuteCandles, '15M', relativeStrength);
  const frames = { fourHour, oneHour, fifteenMinute };

  return {
    snapshot: {
      market: normalized,
      asOf: Math.max(fourHour.asOf, oneHour.asOf, fifteenMinute.asOf),
      authority: 'OBSERVATION_ONLY',
      frames,
      consensus: buildCrossTimeframeShadowConsensus([fourHour, oneHour, fifteenMinute]),
    },
    fifteenMinuteCandles,
  };
};
