import type { KisIndexSnapshot, KisRankedStock, KisStockProfile } from './kisMarketData';

const NAVER_FRONT = 'https://m.stock.naver.com/front-api';
const NAVER_MARKET_STOCK = 'https://stock.naver.com/api/domestic/market/stock/default';
const NAVER_POLLING = 'https://polling.finance.naver.com/api/realtime';
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_DISCOVERY_PER_MARKET = 100;
const POLLING_BATCH_SIZE = 40;
const SECTOR_SCAN_LIMIT = 24;

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? '').replace(/,/g, '').replace(/%/g, '').trim();
  if (!normalized || normalized === '-' || normalized.toUpperCase() === 'N/A') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const asPercentRatio = (value: unknown): number | null => {
  const parsed = asNumber(value);
  return parsed == null ? null : parsed / 100;
};

const text = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const symbolOf = (item: any) => text(
  item?.itemCode,
  item?.itemcode,
  item?.stockCode,
  item?.code,
  item?.cd,
).replace(/^A/, '').toUpperCase();

const nameOf = (item: any) => text(
  item?.stockName,
  item?.itemName,
  item?.itemname,
  item?.name,
  item?.nm,
);

const arraysIn = (value: unknown, depth = 0): any[][] => {
  if (depth > 4 || value == null) return [];
  if (Array.isArray(value)) return [value, ...value.flatMap((item) => arraysIn(item, depth + 1))];
  if (typeof value !== 'object') return [];
  return Object.values(value as Record<string, unknown>).flatMap((item) => arraysIn(item, depth + 1));
};

const stockArrayFrom = (payload: unknown) => {
  const candidates = arraysIn(payload)
    .map((items) => ({
      items,
      score: items.reduce((sum, item) => sum + (/^[A-Z0-9]{6}$/.test(symbolOf(item)) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.items.length - a.items.length);
  return candidates[0]?.items ?? [];
};

export const parseNaverStockListPayload = (
  payload: unknown,
  marketName: 'KOSPI' | 'KOSDAQ',
): KisRankedStock[] => stockArrayFrom(payload).flatMap((item, index) => {
  const symbol = symbolOf(item);
  const name = nameOf(item);
  const price = asNumber(
    item?.closePrice
      ?? item?.currentPrice
      ?? item?.tradePrice
      ?? item?.nowPrice
      ?? item?.price
      ?? item?.nv,
  );
  const volume = asNumber(
    item?.accumulatedTradingVolume
      ?? item?.tradingVolume
      ?? item?.tradeVolume
      ?? item?.volume
      ?? item?.quant
      ?? item?.aq,
  );
  const turnoverKrw = asNumber(
    item?.accumulatedTradingValue
      ?? item?.tradingValue
      ?? item?.turnoverKrw
      ?? item?.amount
      ?? item?.aa,
  ) ?? 0;
  const changeRate = asPercentRatio(
    item?.fluctuationsRatio
      ?? item?.changeRate
      ?? item?.prevChangeRate
      ?? item?.cr,
  );
  if (!/^[A-Z0-9]{6}$/.test(symbol) || !name || price == null || price <= 0 || volume == null || volume < 0) return [];
  return [{
    symbol,
    name,
    price,
    volume,
    turnoverKrw,
    changeRate,
    rank: index + 1,
    marketName,
  }];
});

export type NaverPollingQuote = {
  symbol: string;
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  turnoverKrw: number | null;
  changeRate: number | null;
  listedShares: number | null;
  eps: number | null;
  bps: number | null;
};

export const parseNaverPollingItems = (payload: unknown): NaverPollingQuote[] => arraysIn(payload)
  .flat()
  .flatMap((item) => {
    const symbol = symbolOf(item);
    if (!/^[A-Z0-9]{6}$/.test(symbol)) return [];
    const price = asNumber(item?.nv ?? item?.closePrice ?? item?.currentPrice);
    return [{
      symbol,
      price,
      open: asNumber(item?.ov ?? item?.openPrice),
      high: asNumber(item?.hv ?? item?.highPrice),
      low: asNumber(item?.lv ?? item?.lowPrice),
      volume: asNumber(item?.aq ?? item?.accumulatedTradingVolume),
      turnoverKrw: asNumber(item?.aa ?? item?.accumulatedTradingValue),
      changeRate: asPercentRatio(item?.cr ?? item?.fluctuationsRatio),
      listedShares: asNumber(item?.countOfListedStock ?? item?.listedShares),
      eps: asNumber(item?.eps),
      bps: asNumber(item?.bps),
    }];
  })
  .filter((item, index, all) => all.findIndex((candidate) => candidate.symbol === item.symbol) === index);

const sectorListFrom = (payload: unknown) => arraysIn(payload)
  .flat()
  .flatMap((item) => {
    const code = text(item?.sectorCode, item?.code, item?.no, item?.id);
    const name = text(item?.sectorName, item?.name, item?.title, item?.upjongName);
    return code && name ? [{ code, name }] : [];
  })
  .filter((item, index, all) => all.findIndex((candidate) => candidate.code === item.code) === index);

const sectorSymbolsFrom = (payload: unknown) => stockArrayFrom(payload)
  .map(symbolOf)
  .filter((symbol) => /^[A-Z0-9]{6}$/.test(symbol));

const kstDate = (timestamp: number) => {
  const date = new Date(timestamp + 9 * 60 * 60_000);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
};

const indexValue = (value: unknown) => {
  const parsed = asNumber(value);
  if (parsed == null) return null;
  // Naver polling encodes domestic index values as integer hundredths in its compact feed.
  return Math.abs(parsed) >= 10_000 ? parsed / 100 : parsed;
};

export const parseNaverIndexPolling = (payload: unknown, asOf: number): KisIndexSnapshot[] => arraysIn(payload)
  .flat()
  .flatMap((item) => {
    const rawCode = text(item?.cd, item?.code, item?.reutersCode).toUpperCase();
    const name: 'KOSPI' | 'KOSDAQ' | null = rawCode.includes('KOSDAQ') ? 'KOSDAQ' : rawCode.includes('KOSPI') ? 'KOSPI' : null;
    if (!name) return [];
    const value = indexValue(item?.nv ?? item?.closePrice);
    if (value == null || value <= 0) return [];
    return [{
      code: name === 'KOSPI' ? '0001' as const : '1001' as const,
      name,
      value,
      changeRate: asPercentRatio(item?.cr ?? item?.fluctuationsRatio),
      volume: asNumber(item?.aq ?? item?.accumulatedTradingVolume),
      previousVolume: null,
      turnoverKrw: asNumber(item?.aa ?? item?.accumulatedTradingValue),
      previousTurnoverKrw: null,
      open: indexValue(item?.ov ?? item?.openPrice),
      high: indexValue(item?.hv ?? item?.highPrice),
      low: indexValue(item?.lv ?? item?.lowPrice),
      advancingIssues: asNumber(item?.upCount ?? item?.advancingIssues),
      flatIssues: asNumber(item?.steadyCount ?? item?.flatIssues),
      decliningIssues: asNumber(item?.downCount ?? item?.decliningIssues),
      asOf,
    }];
  })
  .filter((item, index, all) => all.findIndex((candidate) => candidate.name === item.name) === index);

const getJson = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 BlackOracle/1.0 account-free-research',
      Referer: url.startsWith('https://stock.naver.com/') ? 'https://stock.naver.com/' : 'https://m.stock.naver.com/',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Naver Finance research source returned HTTP ${response.status} for ${new URL(url).pathname}.`);
  const payload = await response.json().catch(() => null);
  if (payload == null) throw new Error(`Naver Finance research source returned non-JSON payload for ${new URL(url).pathname}.`);
  return payload;
};

const chunk = <T,>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

const loadPollingQuotes = async (symbols: string[]) => {
  const quotes = new Map<string, NaverPollingQuote>();
  for (const batch of chunk(symbols, POLLING_BATCH_SIZE)) {
    const url = new URL(NAVER_POLLING);
    url.searchParams.set('query', `SERVICE_ITEM:${batch.join(',')}`);
    const payload = await getJson(url.toString());
    for (const item of parseNaverPollingItems(payload)) quotes.set(item.symbol, item);
  }
  return quotes;
};

const loadSectorMap = async (targetSymbols: Set<string>) => {
  const sectors = new Map<string, string>();
  try {
    const listUrl = new URL(`${NAVER_FRONT}/stock/sectors/all`);
    listUrl.searchParams.set('nationType', 'domestic');
    listUrl.searchParams.set('sectorType', 'upjong');
    const sectorList = sectorListFrom(await getJson(listUrl.toString())).slice(0, SECTOR_SCAN_LIMIT);
    for (const batch of chunk(sectorList, 6)) {
      const responses = await Promise.allSettled(batch.map(async (sector) => {
        const url = new URL(`${NAVER_FRONT}/domestic/sector/item/list`);
        url.searchParams.set('sectorCode', sector.code);
        url.searchParams.set('sectorType', 'upjong');
        url.searchParams.set('sectorSortType', 'CHANGE_RATE');
        url.searchParams.set('page', '1');
        url.searchParams.set('pageSize', '100');
        return { sector, payload: await getJson(url.toString()) };
      }));
      for (const response of responses) {
        if (response.status !== 'fulfilled') continue;
        for (const symbol of sectorSymbolsFrom(response.value.payload)) {
          if (targetSymbols.has(symbol) && !sectors.has(symbol)) sectors.set(symbol, response.value.sector.name);
        }
      }
      if ([...targetSymbols].every((symbol) => sectors.has(symbol))) break;
    }
  } catch {
    // Sector enrichment is optional. Missing sector provenance is surfaced as a DATA_GAP.
  }
  return sectors;
};

export interface NaverKrxResearchSnapshot {
  tradingDate: string;
  asOf: number;
  sourceIds: string[];
  rows: Map<string, KisStockProfile & { name: string; turnoverKrw: number }>;
  ranked: KisRankedStock[];
  indexObservations: KisIndexSnapshot[];
}

export class NaverKrxResearchMarketData {
  readonly source = 'NAVER_FINANCE_DELAYED' as const;
  private snapshotPromise: Promise<NaverKrxResearchSnapshot> | null = null;

  private async loadSnapshot(now = Date.now()): Promise<NaverKrxResearchSnapshot> {
    const listRequests = (['KOSPI', 'KOSDAQ'] as const).map(async (marketName) => {
      const url = new URL(NAVER_MARKET_STOCK);
      url.searchParams.set('tradeType', 'KRX');
      url.searchParams.set('marketType', marketName);
      url.searchParams.set('orderType', 'quantTop');
      url.searchParams.set('startIdx', '0');
      url.searchParams.set('pageSize', String(MAX_DISCOVERY_PER_MARKET));
      return { marketName, payload: await getJson(url.toString()) };
    });
    const indexUrl = new URL(NAVER_POLLING);
    indexUrl.searchParams.set('query', 'SERVICE_INDEX:KOSPI,KOSDAQ');

    const [lists, indexPayload] = await Promise.all([
      Promise.all(listRequests),
      getJson(indexUrl.toString()).catch(() => null),
    ]);
    const rankedRaw = lists.flatMap(({ marketName, payload }) => parseNaverStockListPayload(payload, marketName));
    const deduped = [...new Map(rankedRaw.map((item) => [item.symbol, item])).values()]
      .sort((a, b) => b.volume - a.volume || b.turnoverKrw - a.turnoverKrw)
      .slice(0, 100)
      .map((item, index) => ({ ...item, rank: index + 1 }));
    if (!deduped.length) throw new Error('Naver Finance KRX fallback returned no parseable volume-ranked stocks.');

    const targetSymbols = deduped.map((item) => item.symbol);
    const [quotes, sectors] = await Promise.all([
      loadPollingQuotes(targetSymbols),
      loadSectorMap(new Set(targetSymbols)),
    ]);
    const rows = new Map<string, KisStockProfile & { name: string; turnoverKrw: number }>();
    const ranked = deduped.map((item) => {
      const quote = quotes.get(item.symbol);
      const price = quote?.price ?? item.price;
      const volume = quote?.volume ?? item.volume;
      const turnoverKrw = quote?.turnoverKrw ?? item.turnoverKrw;
      const listedShares = quote?.listedShares ?? null;
      const marketCapKrw = price > 0 && listedShares != null && listedShares > 0 ? price * listedShares : null;
      const marketName = item.marketName;
      const sectorName = sectors.get(item.symbol) ?? null;
      rows.set(item.symbol, {
        symbol: item.symbol,
        name: item.name,
        price,
        open: quote?.open ?? null,
        high: quote?.high ?? null,
        low: quote?.low ?? null,
        volume,
        changeRate: quote?.changeRate ?? item.changeRate,
        asOf: now,
        marketName,
        sectorName,
        listedShares,
        marketCapKrw,
        htsMarketCapRaw: null,
        foreignNetBuyQty: null,
        programNetBuyQty: null,
        foreignHoldingQty: null,
        foreignExhaustionRate: null,
        volumeTurnoverRate: listedShares != null && listedShares > 0 && volume != null ? volume / listedShares * 100 : null,
        per: null,
        pbr: null,
        eps: quote?.eps ?? null,
        bps: quote?.bps ?? null,
        temporaryStop: null,
        investmentCaution: null,
        marketWarningCode: null,
        shortTermOverheat: null,
        liquidationTrading: null,
        managementIssueCode: null,
        turnoverKrw,
      });
      return { ...item, price, volume: volume ?? item.volume, turnoverKrw, changeRate: quote?.changeRate ?? item.changeRate };
    });

    return {
      tradingDate: kstDate(now),
      asOf: now,
      sourceIds: [
        'NAVER:STOCK:DOMESTIC_MARKET:QUANT_TOP:KOSPI',
        'NAVER:STOCK:DOMESTIC_MARKET:QUANT_TOP:KOSDAQ',
        'NAVER:POLLING:SERVICE_ITEM',
        'NAVER:POLLING:SERVICE_INDEX',
        'NAVER:FRONT:SECTOR_UPJONG:OPTIONAL',
      ],
      rows,
      ranked,
      indexObservations: indexPayload ? parseNaverIndexPolling(indexPayload, now) : [],
    };
  }

  snapshot() {
    if (!this.snapshotPromise) this.snapshotPromise = this.loadSnapshot();
    return this.snapshotPromise;
  }

  async volumeRank(limit = 100): Promise<KisRankedStock[]> {
    const snapshot = await this.snapshot();
    return snapshot.ranked.slice(0, Math.max(1, Math.min(100, Math.trunc(limit))));
  }

  async stockProfile(symbol: string): Promise<KisStockProfile> {
    const snapshot = await this.snapshot();
    const profile = snapshot.rows.get(symbol);
    if (!profile) throw new Error(`Naver Finance KRX research profile missing for ${symbol}.`);
    const { name: _name, turnoverKrw: _turnoverKrw, ...result } = profile;
    return result;
  }

  async sourceIds() {
    return (await this.snapshot()).sourceIds.slice();
  }

  async indexSnapshots() {
    return (await this.snapshot()).indexObservations.map((item) => ({ ...item }));
  }

  async qualificationDataGaps(symbol: string) {
    const snapshot = await this.snapshot();
    const profile = snapshot.rows.get(symbol);
    return [
      'Naver/Koscom account-free market data is a research fallback and has no execution authority.',
      'Current-session KRX suspension/designation warning metadata is not source-complete in this fallback; nomination remains blocked.',
      ...(profile?.sectorName ? [] : ['Naver/Koscom sector classification was not resolved for this symbol in the bounded sector scan.']),
    ];
  }
}
