import type { TradingInstrument } from '../../src/trading/assets';

export type DynamicInstrumentAlias = {
  market: string;
  assetClass: 'EQUITY' | 'CRYPTO_SPOT' | 'CRYPTO_PERP';
  symbol: string;
  displayName: string;
  aliases: string[];
  source: string;
  observedAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
};

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  return base && key ? { base, key, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } } : null;
};

const normalizeAliases = (values: string[]) => Array.from(new Set(values
  .map((value) => String(value || '').normalize('NFKC').trim())
  .filter(Boolean)));

export const upsertDynamicInstrumentAliases = async (records: DynamicInstrumentAlias[]) => {
  const db = dbConfig();
  if (!db || !records.length) return { persisted: false, count: 0 };
  const rows = records.map((record) => ({
    market: record.market,
    asset_class: record.assetClass,
    symbol: record.symbol,
    display_name: record.displayName,
    aliases: normalizeAliases([record.displayName, record.symbol, record.market, ...record.aliases]),
    source: record.source,
    observed_at: new Date(record.observedAt).toISOString(),
    expires_at: new Date(record.expiresAt).toISOString(),
    metadata: record.metadata ?? {},
    execution_authority: false,
    updated_at: new Date().toISOString(),
  }));
  const response = await fetch(`${db.base}/rest/v1/black_oracle_instrument_aliases?on_conflict=market`, {
    method: 'POST',
    headers: { ...db.headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`Instrument alias registry upsert failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  return { persisted: true, count: rows.length };
};

export const syncKrxUniverseAliases = async (stocks: Array<{ symbol: string; name: string; rank?: number; marketName?: string | null }>) => {
  const now = Date.now();
  return upsertDynamicInstrumentAliases(stocks
    .filter((stock) => /^\d{6}$/.test(stock.symbol) && Boolean(stock.name?.trim()))
    .map((stock) => ({
      market: `KRX-${stock.symbol}`,
      assetClass: 'EQUITY' as const,
      symbol: stock.symbol,
      displayName: stock.name.trim(),
      aliases: [stock.name, `${stock.name} ${stock.symbol}`],
      source: 'KIS_VOLUME_RANK',
      observedAt: now,
      expiresAt: now + 3 * 24 * 60 * 60_000,
      metadata: { rank: stock.rank ?? null, marketName: stock.marketName ?? null },
    })));
};

export const loadDynamicInstrumentAliases = async (limit = 2_500): Promise<TradingInstrument[]> => {
  const db = dbConfig();
  if (!db) return [];
  const query = new URL(`${db.base}/rest/v1/black_oracle_instrument_aliases`);
  query.searchParams.set('expires_at', `gt.${new Date().toISOString()}`);
  query.searchParams.set('select', 'market,asset_class,symbol,display_name,aliases');
  query.searchParams.set('order', 'observed_at.desc');
  query.searchParams.set('limit', String(Math.max(1, Math.min(5_000, Math.trunc(limit)))));
  const response = await fetch(query, { headers: db.headers, cache: 'no-store' });
  if (!response.ok) return [];
  const rows = await response.json() as any[];
  return rows.map((row) => ({
    id: `${String(row.asset_class)}:${String(row.market)}`,
    assetClass: String(row.asset_class) as TradingInstrument['assetClass'],
    market: String(row.market),
    symbol: String(row.symbol),
    displayName: String(row.display_name),
    aliases: normalizeAliases(Array.isArray(row.aliases) ? row.aliases.map(String) : []),
    exchange: String(row.market).startsWith('KRX-') ? 'KRX' : 'UPBIT',
    quoteCurrency: 'KRW',
    runtimeMode: 'RESEARCH',
    executionEnabled: false,
    shortEnabled: false,
  })).filter((item) => item.market && item.aliases.length > 0);
};
