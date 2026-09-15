import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type MarketIdentity = {
  market: string;
  code: string;
  name: string;
  englishName?: string | null;
  assetClass: 'CRYPTO' | 'EQUITY';
  exchange: 'UPBIT' | 'KOSPI' | 'KOSDAQ';
  source: 'UPBIT_PUBLIC' | 'KIS_MASTER';
};

type SearchPayload = {
  success?: boolean;
  results?: MarketIdentity[];
};

const MarketIdentityContext = createContext<Record<string, MarketIdentity>>({});
const resolvedCache = new Map<string, MarketIdentity>();
const pendingCache = new Map<string, Promise<MarketIdentity | null>>();

const krxCode = (market: string) => {
  const match = /^KRX-(\d{6})$/.exec(String(market ?? '').toUpperCase());
  return match?.[1] ?? null;
};

const identitySourceLabel = (source: MarketIdentity['source']) => source === 'KIS_MASTER' ? 'KIS MASTER' : 'UPBIT MASTER';

const resolveKrxIdentity = (market: string) => {
  const normalized = String(market ?? '').toUpperCase();
  const cached = resolvedCache.get(normalized);
  if (cached) return Promise.resolve(cached);
  const pending = pendingCache.get(normalized);
  if (pending) return pending;
  const code = krxCode(normalized);
  if (!code) return Promise.resolve(null);

  const request = fetch(`/api/market-chart?search=1&q=${encodeURIComponent(code)}&assetClass=EQUITY&limit=20`, { cache: 'no-store' })
    .then((response) => response.json() as Promise<SearchPayload>)
    .then((payload) => {
      const exact = (payload.results ?? []).find((item) => item.market === normalized) ?? null;
      if (exact) resolvedCache.set(normalized, exact);
      return exact;
    })
    .catch(() => null)
    .finally(() => pendingCache.delete(normalized));

  pendingCache.set(normalized, request);
  return request;
};

export const MarketIdentityProvider = ({ markets, children }: { markets: Array<string | null | undefined>; children: React.ReactNode }) => {
  const krxMarkets = useMemo(() => [...new Set(markets.map((market) => String(market ?? '').toUpperCase()).filter((market) => /^KRX-\d{6}$/.test(market)))].slice(0, 48), [markets]);
  const [resolved, setResolved] = useState<Record<string, MarketIdentity>>(() => Object.fromEntries(krxMarkets.map((market) => [market, resolvedCache.get(market)]).filter((entry): entry is [string, MarketIdentity] => Boolean(entry[1]))));

  useEffect(() => {
    let active = true;
    const cached = Object.fromEntries(krxMarkets.map((market) => [market, resolvedCache.get(market)]).filter((entry): entry is [string, MarketIdentity] => Boolean(entry[1])));
    if (Object.keys(cached).length) setResolved((current) => ({ ...current, ...cached }));
    const missing = krxMarkets.filter((market) => !resolvedCache.has(market));
    if (!missing.length) return () => { active = false; };

    void Promise.all(missing.map(async (market) => [market, await resolveKrxIdentity(market)] as const)).then((entries) => {
      if (!active) return;
      const next = Object.fromEntries(entries.filter((entry): entry is readonly [string, MarketIdentity] => Boolean(entry[1])));
      if (Object.keys(next).length) setResolved((current) => ({ ...current, ...next }));
    });
    return () => { active = false; };
  }, [krxMarkets]);

  return <MarketIdentityContext.Provider value={resolved}>{children}</MarketIdentityContext.Provider>;
};

export const useMarketIdentity = (market: string | null | undefined) => {
  const identities = useContext(MarketIdentityContext);
  const normalized = String(market ?? '').toUpperCase();
  return identities[normalized] ?? resolvedCache.get(normalized) ?? null;
};

export const marketCodeLabel = (market: string | null | undefined) => {
  const value = String(market ?? '');
  const code = krxCode(value);
  return code ?? value;
};

export const MarketName = ({ market, className = '' }: { market: string | null | undefined; className?: string }) => {
  const identity = useMarketIdentity(market);
  return <span className={className}>{identity?.name ?? marketCodeLabel(market) ?? '—'}</span>;
};

export const MarketMeta = ({ market, className = '' }: { market: string | null | undefined; className?: string }) => {
  const identity = useMarketIdentity(market);
  if (identity) return <span className={className}>{identity.code} · {identity.exchange} · {identitySourceLabel(identity.source)}</span>;
  const value = String(market ?? '');
  if (/^KRX-\d{6}$/.test(value)) return <span className={className}>{marketCodeLabel(value)} · KRX · IDENTITY DATA GAP</span>;
  return <span className={className}>{value}</span>;
};
