export interface MarketPriceSnapshot {
  timestamp: number;
  prices: Array<[string, number]>;
}

export interface AlignedMarketReturnSeries {
  market: string;
  returns: number[];
}

const normalizeMarket = (market: string) => market.trim().toUpperCase();

const snapshotPriceMap = (snapshot: MarketPriceSnapshot) => {
  const map = new Map<string, number>();
  for (const [market, price] of snapshot.prices ?? []) {
    const normalized = normalizeMarket(market);
    if (!/^KRW-[A-Z0-9]+$/.test(normalized)) continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    map.set(normalized, price);
  }
  return map;
};

export const buildAlignedMarketReturnSeries = (
  snapshots: MarketPriceSnapshot[],
  requestedMarkets: string[],
  maxSnapshots = 192,
): AlignedMarketReturnSeries[] => {
  const markets = [...new Set(requestedMarkets.map(normalizeMarket).filter((market) => /^KRW-[A-Z0-9]+$/.test(market)))];
  if (!markets.length) return [];

  const ordered = (snapshots ?? [])
    .filter((snapshot) => Number.isFinite(snapshot?.timestamp) && snapshot.timestamp > 0 && Array.isArray(snapshot.prices))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-Math.max(2, Math.min(512, Math.trunc(maxSnapshots) || 192)));

  const aligned = ordered.flatMap((snapshot) => {
    const prices = snapshotPriceMap(snapshot);
    if (!markets.every((market) => prices.has(market))) return [];
    return [{ timestamp: snapshot.timestamp, prices }];
  });

  if (aligned.length < 2) return markets.map((market) => ({ market, returns: [] }));

  const returnsByMarket = new Map(markets.map((market) => [market, [] as number[]]));
  for (let index = 1; index < aligned.length; index += 1) {
    const previous = aligned[index - 1].prices;
    const current = aligned[index].prices;
    for (const market of markets) {
      const previousPrice = previous.get(market)!;
      const currentPrice = current.get(market)!;
      const value = currentPrice / previousPrice - 1;
      if (Number.isFinite(value) && value > -1 && value < 10) returnsByMarket.get(market)!.push(value);
    }
  }

  const commonLength = Math.min(...markets.map((market) => returnsByMarket.get(market)!.length));
  return markets.map((market) => ({
    market,
    returns: commonLength > 0 ? returnsByMarket.get(market)!.slice(-commonLength) : [],
  }));
};
