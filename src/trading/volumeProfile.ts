export type TradeAggressorSide = 'BID' | 'ASK';

export interface TradePrint {
  market: string;
  timestamp: number;
  price: number;
  volume: number;
  side: TradeAggressorSide;
  sequentialId?: string;
}

export interface VolumeProfileBin {
  index: number;
  low: number;
  high: number;
  midpoint: number;
  quoteVolume: number;
  tradeCount: number;
}

export interface VolumeProfileSnapshot {
  available: boolean;
  sampleTrades: number;
  sampleStart: number | null;
  sampleEnd: number | null;
  sampleCoverageMs: number | null;
  binCount: number;
  totalQuoteVolume: number;
  pointOfControl: number | null;
  valueAreaLow: number | null;
  valueAreaHigh: number | null;
  currentLocation: 'ABOVE_VALUE' | 'IN_VALUE' | 'BELOW_VALUE' | 'AT_POC' | 'UNAVAILABLE';
  highVolumeNodes: number[];
  lowVolumeNodes: number[];
  bins: VolumeProfileBin[];
  reasons: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface VolumeProfileOptions {
  binCount?: number;
  valueAreaFraction?: number;
  currentPrice?: number;
}

export const buildTradeVolumeProfile = (
  trades: TradePrint[],
  options: VolumeProfileOptions = {},
): VolumeProfileSnapshot => {
  const ordered = trades
    .filter((trade) => Number.isFinite(trade.price) && trade.price > 0 && Number.isFinite(trade.volume) && trade.volume > 0)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  const requestedBins = Math.floor(options.binCount ?? 24);
  const binCount = Math.max(8, Math.min(64, requestedBins));
  const valueAreaFraction = clamp(options.valueAreaFraction ?? 0.7, 0.5, 0.9);

  if (ordered.length < 20) {
    return {
      available: false,
      sampleTrades: ordered.length,
      sampleStart: ordered[0]?.timestamp ?? null,
      sampleEnd: ordered.at(-1)?.timestamp ?? null,
      sampleCoverageMs: ordered.length > 1 ? ordered.at(-1)!.timestamp - ordered[0].timestamp : null,
      binCount,
      totalQuoteVolume: 0,
      pointOfControl: null,
      valueAreaLow: null,
      valueAreaHigh: null,
      currentLocation: 'UNAVAILABLE',
      highVolumeNodes: [],
      lowVolumeNodes: [],
      bins: [],
      reasons: ['Trade-sample volume profile requires at least 20 valid prints.'],
    };
  }

  const prices = ordered.map((trade) => trade.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const span = Math.max(Number.EPSILON, maxPrice - minPrice);
  const width = span / binCount;

  const bins: VolumeProfileBin[] = Array.from({ length: binCount }, (_, index) => {
    const low = minPrice + width * index;
    const high = index === binCount - 1 ? maxPrice + Number.EPSILON : minPrice + width * (index + 1);
    return {
      index,
      low,
      high,
      midpoint: (low + high) / 2,
      quoteVolume: 0,
      tradeCount: 0,
    };
  });

  for (const trade of ordered) {
    const rawIndex = width > 0 ? Math.floor((trade.price - minPrice) / width) : 0;
    const index = Math.max(0, Math.min(binCount - 1, rawIndex));
    bins[index].quoteVolume += trade.price * trade.volume;
    bins[index].tradeCount += 1;
  }

  const totalQuoteVolume = bins.reduce((sum, bin) => sum + bin.quoteVolume, 0);
  const pocIndex = bins.reduce((best, bin, index) => bin.quoteVolume > bins[best].quoteVolume ? index : best, 0);
  const target = totalQuoteVolume * valueAreaFraction;
  const selected = new Set<number>([pocIndex]);
  let accumulated = bins[pocIndex].quoteVolume;
  let left = pocIndex - 1;
  let right = pocIndex + 1;

  while (accumulated < target && (left >= 0 || right < bins.length)) {
    const leftVolume = left >= 0 ? bins[left].quoteVolume : -1;
    const rightVolume = right < bins.length ? bins[right].quoteVolume : -1;
    if (rightVolume > leftVolume) {
      selected.add(right);
      accumulated += Math.max(0, rightVolume);
      right += 1;
    } else {
      selected.add(left);
      accumulated += Math.max(0, leftVolume);
      left -= 1;
    }
  }

  const selectedIndices = [...selected].sort((a, b) => a - b);
  const valueAreaLow = bins[selectedIndices[0]].low;
  const valueAreaHigh = bins[selectedIndices[selectedIndices.length - 1]].high;
  const pointOfControl = bins[pocIndex].midpoint;

  const nonZero = bins.filter((bin) => bin.quoteVolume > 0);
  const highVolumeNodes = nonZero
    .slice()
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, 3)
    .map((bin) => bin.midpoint);
  const lowVolumeNodes = nonZero
    .slice()
    .sort((a, b) => a.quoteVolume - b.quoteVolume)
    .slice(0, 3)
    .map((bin) => bin.midpoint);

  const currentPrice = options.currentPrice ?? ordered.at(-1)!.price;
  const nearPoc = Math.abs(currentPrice - pointOfControl) <= Math.max(width, pointOfControl * 0.0005);
  const currentLocation: VolumeProfileSnapshot['currentLocation'] = nearPoc
    ? 'AT_POC'
    : currentPrice > valueAreaHigh
      ? 'ABOVE_VALUE'
      : currentPrice < valueAreaLow
        ? 'BELOW_VALUE'
        : 'IN_VALUE';

  return {
    available: true,
    sampleTrades: ordered.length,
    sampleStart: ordered[0].timestamp,
    sampleEnd: ordered.at(-1)!.timestamp,
    sampleCoverageMs: ordered.at(-1)!.timestamp - ordered[0].timestamp,
    binCount,
    totalQuoteVolume,
    pointOfControl,
    valueAreaLow,
    valueAreaHigh,
    currentLocation,
    highVolumeNodes,
    lowVolumeNodes,
    bins,
    reasons: [
      `${ordered.length} actual trade prints are grouped into ${binCount} price bins; this is a sample profile, not an exchange-wide historical profile.`,
      `POC is the highest quote-volume bin and the value area expands contiguously from POC until ${(valueAreaFraction * 100).toFixed(0)}% of sampled quote volume is included.`,
      `Current price is ${currentLocation.replaceAll('_', ' ').toLowerCase()} relative to the sampled value area.`,
    ],
  };
};
