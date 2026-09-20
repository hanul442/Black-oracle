export interface UpbitMarketDescriptor {
  market: string;
  korean_name?: string;
  english_name?: string;
  market_event?: {
    warning?: boolean;
    caution?: Record<string, boolean>;
  };
}

export interface UpbitKrwUniverseEntry {
  market: string;
  symbol: string;
  koreanName: string | null;
  englishName: string | null;
  warning: boolean;
  cautionReasons: string[];
  eligible: boolean;
  exclusionReasons: string[];
}

export interface UpbitKrwUniverseSnapshot {
  observedAt: string;
  source: 'UPBIT_MARKET_ALL';
  totalObserved: number;
  krwObserved: number;
  eligibleCount: number;
  excludedCount: number;
  entries: UpbitKrwUniverseEntry[];
}

const normalizeMarket = (value: unknown) => String(value ?? '').trim().toUpperCase();

const activeCautionReasons = (market: UpbitMarketDescriptor) =>
  Object.entries(market.market_event?.caution ?? {})
    .filter(([, active]) => active === true)
    .map(([reason]) => reason)
    .sort();

/**
 * Converts Upbit's public market list into BOT's canonical KRW scan universe.
 *
 * This is discovery only: inclusion never grants execution authority. Markets carrying
 * an Upbit warning/caution flag are retained for auditability but fail closed from the
 * eligible scanner universe until the exchange clears the flag.
 */
export const buildUpbitKrwUniverse = (
  markets: readonly UpbitMarketDescriptor[],
  observedAt: Date = new Date(),
): UpbitKrwUniverseSnapshot => {
  if (!Array.isArray(markets)) throw new Error('Upbit market universe must be an array.');
  if (Number.isNaN(observedAt.getTime())) throw new Error('observedAt must be a valid Date.');

  const byMarket = new Map<string, UpbitKrwUniverseEntry>();

  for (const raw of markets) {
    const market = normalizeMarket(raw?.market);
    if (!market.startsWith('KRW-')) continue;

    const symbol = market.slice(4).trim();
    if (!symbol) continue;

    const warning = raw.market_event?.warning === true;
    const cautionReasons = activeCautionReasons(raw);
    const exclusionReasons: string[] = [];
    if (warning) exclusionReasons.push('UPBIT_WARNING');
    if (cautionReasons.length > 0) exclusionReasons.push('UPBIT_CAUTION');

    const entry: UpbitKrwUniverseEntry = {
      market,
      symbol,
      koreanName: raw.korean_name?.trim() || null,
      englishName: raw.english_name?.trim() || null,
      warning,
      cautionReasons,
      eligible: exclusionReasons.length === 0,
      exclusionReasons,
    };

    const existing = byMarket.get(market);
    if (!existing || (existing.eligible && !entry.eligible)) byMarket.set(market, entry);
  }

  const entries = [...byMarket.values()].sort((a, b) => a.market.localeCompare(b.market));
  const eligibleCount = entries.filter((entry) => entry.eligible).length;

  return {
    observedAt: observedAt.toISOString(),
    source: 'UPBIT_MARKET_ALL',
    totalObserved: markets.length,
    krwObserved: entries.length,
    eligibleCount,
    excludedCount: entries.length - eligibleCount,
    entries,
  };
};

export const eligibleUpbitKrwMarkets = (snapshot: UpbitKrwUniverseSnapshot) =>
  snapshot.entries.filter((entry) => entry.eligible).map((entry) => entry.market);
