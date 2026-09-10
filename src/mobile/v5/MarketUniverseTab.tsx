import React, { useEffect, useMemo, useState } from 'react';
import { Database, Search, X } from 'lucide-react';
import type { DecisionTapeItem } from '../v2/types';
import { actionKo, cn, reasonKo, regimeKo, scoreText, timeAgo } from '../v2/types';
import { EmptyCard, Header, Metric, Pill, ScoreBar, Screen, StatusChip } from '../v2/ui';

type UniverseItem = {
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
  query?: string;
  total?: number;
  universeSize?: number;
  coverage?: { crypto?: number; kospi?: number; kosdaq?: number };
  partial?: boolean;
  errors?: string[];
  results?: UniverseItem[];
  error?: string;
};

type AssetFilter = 'ALL' | 'CRYPTO' | 'EQUITY';

const latestByMarket = (decisions: DecisionTapeItem[]) => {
  const map = new Map<string, DecisionTapeItem>();
  for (const decision of [...decisions].sort((a, b) => b.timestamp - a.timestamp)) {
    if (!map.has(decision.market)) map.set(decision.market, decision);
  }
  return map;
};

export const MarketUniverseTab = ({ decisions, selectedMarket, onSelectMarket }: {
  decisions: DecisionTapeItem[];
  selectedMarket: string | null;
  onSelectMarket: (market: string) => void;
}) => {
  const [query, setQuery] = useState('');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('ALL');
  const [payload, setPayload] = useState<SearchPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<'recent' | 'score' | 'confidence'>('recent');
  const decisionMap = useMemo(() => latestByMarket(decisions), [decisions]);
  const tracked = useMemo(() => [...decisionMap.values()].sort((a, b) => {
    if (sort === 'score') return (b.oracleTradeScore ?? -1) - (a.oracleTradeScore ?? -1);
    if (sort === 'confidence') return (b.confidence ?? -1) - (a.confidence ?? -1);
    return b.timestamp - a.timestamp;
  }), [decisionMap, sort]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setPayload(null); setLoading(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/market-chart?search=1&q=${encodeURIComponent(q)}&assetClass=${assetFilter}&limit=30`, { cache: 'no-store', signal: controller.signal })
        .then((response) => response.json() as Promise<SearchPayload>)
        .then((result) => setPayload(result))
        .catch((error) => {
          if (error?.name !== 'AbortError') setPayload({ success: false, results: [], error: '시장 전체검색 요청에 실패했습니다.' });
        })
        .finally(() => setLoading(false));
    }, 280);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, assetFilter]);

  const results = payload?.results ?? [];
  const searching = Boolean(query.trim());
  const coverage = payload?.coverage;

  return (
    <Screen>
      <Header title="시장" subtitle="DecisionTape뿐 아니라 Upbit KRW 전체 시장과 KOSPI·KOSDAQ 공식 종목 마스터를 검색합니다." />
      <div className="sticky top-0 z-20 -mx-1 rounded-[22px] bg-[#f7f8f9]/95 px-1 pb-3 pt-1 backdrop-blur-xl">
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#dfe5e9] bg-white px-4 shadow-[0_7px_24px_rgba(15,23,42,0.04)]">
          <Search className="h-5 w-5 shrink-0 text-[#7f8a94]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="비트코인, BTC, 삼성전자, 005930" className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-[#a0a8af]" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="검색어 지우기" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1f3f5]"><X className="h-4 w-4 text-[#7b858e]" /></button>}
        </label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <Pill active={assetFilter === 'ALL'} onClick={() => setAssetFilter('ALL')}>전체</Pill>
          <Pill active={assetFilter === 'CRYPTO'} onClick={() => setAssetFilter('CRYPTO')}>코인</Pill>
          <Pill active={assetFilter === 'EQUITY'} onClick={() => setAssetFilter('EQUITY')}>국내주식</Pill>
          {!searching && <><Pill active={sort === 'recent'} onClick={() => setSort('recent')}>최근 판단</Pill><Pill active={sort === 'score'} onClick={() => setSort('score')}>Score순</Pill><Pill active={sort === 'confidence'} onClick={() => setSort('confidence')}>Confidence순</Pill></>}
        </div>
      </div>

      {searching ? (
        <section className="mt-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><div className="text-[16px] font-semibold">전체 시장 검색</div><div className="mt-1 text-[11px] text-[#87919a]">{loading ? '공식 시장 마스터 확인 중…' : payload?.success === false ? '검색 오류' : `${results.length}개 결과`}</div></div>
            {coverage && <div className="text-right text-[10px] leading-4 text-[#919aa3]">Upbit {coverage.crypto ?? 0}<br />KRX {(coverage.kospi ?? 0) + (coverage.kosdaq ?? 0)}</div>}
          </div>
          {payload?.partial && <div className="mb-3 rounded-2xl border border-[#f0e1ca] bg-[#fff8ee] px-4 py-3 text-[11px] leading-5 text-[#9b6c28]">일부 시장 소스를 불러오지 못했습니다. 가능한 소스 결과만 표시합니다.</div>}
          {payload?.error && <div className="mb-3 rounded-2xl border border-[#f0dadd] bg-[#fff5f6] px-4 py-3 text-[11px] text-[#b1535c]">{payload.error}</div>}
          <div className="space-y-2.5">
            {results.map((item) => {
              const decision = decisionMap.get(item.market);
              return (
                <button type="button" key={`${item.exchange}-${item.market}`} onClick={() => onSelectMarket(item.market)} className={cn('w-full rounded-[20px] border bg-white p-4 text-left transition active:scale-[0.995]', selectedMarket === item.market ? 'border-[#9fb1bd] ring-1 ring-[#d9e2e7]' : 'border-[#edf0f2]')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[17px] font-semibold">{item.name}</span><span className="rounded-md bg-[#f0f3f5] px-1.5 py-0.5 text-[9px] font-semibold text-[#68747e]">{item.exchange}</span></div><div className="mt-1 text-[12px] font-medium text-[#7d8791]">{item.market}{item.englishName ? ` · ${item.englishName}` : ''}</div></div>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold', decision ? 'bg-[#e8f6f1] text-[#0a8768]' : 'bg-[#f1f3f5] text-[#727c85]')}>{decision ? 'Oracle 추적 중' : '시장 데이터'}</span>
                  </div>
                  {decision ? <div className="mt-3 grid grid-cols-3 gap-3 border-t border-[#f0f2f4] pt-3"><Metric label="현재 판단" value={actionKo(decision.decision)} /><Metric label="Oracle Score" value={scoreText(decision.oracleTradeScore)} /><Metric label="최근 Trace" value={timeAgo(decision.timestamp)} /></div> : <div className="mt-3 flex items-center gap-2 border-t border-[#f0f2f4] pt-3 text-[11px] text-[#89939c]"><Database className="h-4 w-4" />가격 차트는 조회 가능 · Canonical Decision Trace는 아직 없음</div>}
                </button>
              );
            })}
            {!loading && payload && !results.length && <EmptyCard title="검색 결과 없음" body="종목명·종목코드·티커를 바꿔 검색해보세요. 검색 결과를 임의로 생성하지 않습니다." />}
            {loading && <div className="space-y-2.5">{[0, 1, 2].map((index) => <div key={index} className="h-[92px] animate-pulse rounded-[20px] bg-white" />)}</div>}
          </div>
        </section>
      ) : (
        <section className="mt-2">
          <div className="mb-3"><div className="text-[16px] font-semibold">Oracle 추적 시장</div><div className="mt-1 text-[11px] text-[#87919a]">현재 DecisionTape에 실제 판단이 존재하는 종목입니다.</div></div>
          <div className="space-y-3">
            {tracked.map((decision) => (
              <button type="button" key={decision.market} onClick={() => onSelectMarket(decision.market)} className={cn('w-full rounded-[20px] border bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.03)]', selectedMarket === decision.market ? 'border-[#aebdc7] ring-1 ring-[#dce4e9]' : 'border-[#edf0f2]')}>
                <div className="flex items-start justify-between gap-3"><div><div className="text-[18px] font-semibold">{decision.market}</div><div className="mt-1 text-[12px] text-[#8f98a1]">{regimeKo(decision.regime)} · {timeAgo(decision.timestamp)}</div></div><StatusChip value={actionKo(decision.decision)} /></div>
                <div className="mt-3 line-clamp-2 text-[12px] leading-5 text-[#74808a]">{reasonKo(decision.primaryReason || decision.reasons?.[0])}</div>
                <div className="mt-4 grid grid-cols-2 gap-4"><ScoreBar label="Oracle Score" value={decision.oracleTradeScore} /><ScoreBar label="Confidence" value={decision.confidence} max={1} /></div>
              </button>
            ))}
            {!tracked.length && <EmptyCard title="추적 시장 없음" body="검색창에서는 실제 Upbit·KRX 시장을 조회할 수 있습니다. Decision trace가 생성되면 여기에 자동으로 추가됩니다." />}
          </div>
        </section>
      )}
    </Screen>
  );
};
