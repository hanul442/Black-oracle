import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  RefreshCw,
  Search,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import type { DecisionTapeItem, OpenPosition, OperationsPayload, PriceCandle } from './v2/types';
import { cn, dateTime, timeAgo } from './v2/types';
import {
  formatKrw,
  formatPercent,
  formatQuantity,
  positionFinancials,
  type MarkedOpenPosition,
} from './v2/financial';
import { PortfolioEquityChart } from './v2/PortfolioEquityChart';

const green = '#16845b';
const red = '#d14b55';
const blue = '#3767d6';
const ink = '#111318';
const card = 'rounded-[24px] border border-[#e7e9ed] bg-white';

type Tab = 'portfolio' | 'market' | 'history';
type Timeframe = { label: string; unit: number; count: number };
type OperationsWithCheckpoint = OperationsPayload & { checkpoint?: { savedAt?: number | null } };
type ChartPayload = {
  success?: boolean;
  available?: boolean;
  market?: string;
  source?: string;
  assetClass?: string;
  configured?: boolean;
  unit?: number;
  count?: number;
  asOf?: number | null;
  candles?: PriceCandle[];
  error?: string;
  warning?: string;
  marketData?: {
    provider?: string;
    source?: string;
    quality?: string;
    delayMinutes?: number;
    executionEligible?: boolean;
    researchOnly?: boolean;
  };
};

type PriceLevel = { label: string; value: number; color: string };

const CRYPTO_FRAMES: Timeframe[] = [
  { label: '1m', unit: 1, count: 120 },
  { label: '5m', unit: 5, count: 120 },
  { label: '15m', unit: 15, count: 96 },
  { label: '1H', unit: 60, count: 72 },
  { label: '4H', unit: 240, count: 60 },
  { label: '일', unit: 1_440, count: 90 },
  { label: '주', unit: 10_080, count: 104 },
  { label: '월', unit: 43_200, count: 60 },
];
const EQUITY_FRAMES: Timeframe[] = [
  { label: '1m', unit: 1, count: 120 },
  { label: '5m', unit: 5, count: 96 },
  { label: '15m', unit: 15, count: 80 },
  { label: '1H', unit: 60, count: 60 },
  { label: '일', unit: 1_440, count: 90 },
  { label: '주', unit: 10_080, count: 104 },
  { label: '월', unit: 43_200, count: 36 },
];

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const sourceLabel = (source?: string) => source === 'UPBIT_PUBLIC'
  ? 'Upbit Public'
  : source === 'KIS_OFFICIAL'
    ? 'KIS Official'
    : source === 'YAHOO_FINANCE'
      ? 'Yahoo Finance · delayed research'
      : source || 'Market data';

const Metric = ({ label, value, accent, note }: { label: string; value: React.ReactNode; accent?: string; note?: React.ReactNode }) => (
  <div className="min-w-0">
    <div className="text-[9px] font-medium text-[#969ca4]">{label}</div>
    <div className="mt-1 truncate text-[15px] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: accent ?? ink }}>{value}</div>
    {note && <div className="mt-1 text-[8px] leading-4 text-[#a0a5ac]">{note}</div>}
  </div>
);

const Pill = ({ children, color = '#737b86' }: { children: React.ReactNode; color?: string }) => (
  <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-semibold" style={{ color, borderColor: `${color}28`, background: `${color}0b` }}>{children}</span>
);

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-3">
    <div className="text-[17px] font-semibold tracking-[-0.025em] text-[#15171c]">{title}</div>
    {subtitle && <div className="mt-1 text-[10px] leading-5 text-[#8c929a]">{subtitle}</div>}
  </div>
);

const latestDecisionFor = (operations: OperationsPayload | null, market: string) => (
  (operations?.decisionTape ?? [])
    .filter((item) => item.market?.toUpperCase() === market.toUpperCase())
    .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
);

const latestPositionFor = (operations: OperationsPayload | null, market: string) => (
  (operations?.portfolio?.openPositions ?? []).find((item) => item.market?.toUpperCase() === market.toUpperCase()) ?? null
);

const MarketCandleChart = ({ payload, decision, position }: { payload: ChartPayload; decision: DecisionTapeItem | null; position: OpenPosition | null }) => {
  const candles = (payload.candles ?? []).filter((item) => [item.timestamp, item.open, item.high, item.low, item.close, item.volume].every(Number.isFinite));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  if (candles.length < 2) return <div className="flex min-h-52 items-center justify-center rounded-[20px] bg-[#f7f8fa] p-5 text-center text-[10px] leading-5 text-[#899099]">{payload.error || '실제 OHLCV 데이터가 없습니다. 임의 가격은 그리지 않습니다.'}</div>;

  const width = 340;
  const top = 20;
  const bottom = 188;
  const volumeTop = 205;
  const volumeBottom = 246;
  const left = 12;
  const right = 328;
  const plotWidth = right - left;
  const slot = plotWidth / candles.length;
  const candleWidth = Math.max(1.4, Math.min(5.4, slot * 0.62));
  const finance = position ? positionFinancials(position) : null;
  const tradeMap = decision?.tradeMap;
  const levels: PriceLevel[] = [
    finite(position?.averageCost) ? { label: 'ENTRY', value: position!.averageCost, color: ink } : finite(tradeMap?.entryPrice) ? { label: 'ENTRY', value: tradeMap!.entryPrice!, color: ink } : null,
    finite(position?.stopLossPrice) ? { label: 'SL', value: position!.stopLossPrice!, color: red } : finite(tradeMap?.stopLossPrice) ? { label: 'SL', value: tradeMap!.stopLossPrice!, color: red } : null,
    finite(position?.takeProfit1Price ?? position?.takeProfitPrice) ? { label: 'TP1', value: (position?.takeProfit1Price ?? position?.takeProfitPrice)!, color: green } : finite(tradeMap?.takeProfit1Price) ? { label: 'TP1', value: tradeMap!.takeProfit1Price!, color: green } : null,
    finite(position?.takeProfit2Price) ? { label: 'TP2', value: position!.takeProfit2Price!, color: blue } : finite(tradeMap?.takeProfit2Price) ? { label: 'TP2', value: tradeMap!.takeProfit2Price!, color: blue } : null,
  ].filter(Boolean) as PriceLevel[];

  const rawMin = Math.min(...candles.map((item) => item.low), ...levels.map((item) => item.value));
  const rawMax = Math.max(...candles.map((item) => item.high), ...levels.map((item) => item.value));
  const pad = Math.max((rawMax - rawMin) * 0.08, Math.abs(rawMax) * 0.0005, 0.00000001);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const span = Math.max(max - min, 0.00000001);
  const maxVolume = Math.max(...candles.map((item) => item.volume), 1);
  const xFor = (index: number) => left + slot * (index + 0.5);
  const yFor = (value: number) => bottom - ((value - min) / span) * (bottom - top);
  const volumeY = (value: number) => volumeBottom - (value / maxVolume) * (volumeBottom - volumeTop);
  const inspected = candles[selectedIndex ?? candles.length - 1];
  const periodReturn = candles[0].open > 0 ? candles[candles.length - 1].close / candles[0].open - 1 : null;
  const candleReturn = inspected.open > 0 ? inspected.close / inspected.open - 1 : null;
  const live = candles[candles.length - 1].close;
  const markGap = finance?.markPrice != null && live > 0 ? finance.markPrice / live - 1 : null;

  return <div className="overflow-hidden rounded-[22px] border border-[#e8ecef] bg-white">
    <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
      <div>
        <div className="text-[9px] font-medium text-[#929aa2]">{sourceLabel(payload.source)} · actual OHLCV</div>
        <div className="mt-1 text-[25px] font-semibold tracking-[-0.04em]">{formatKrw(live)}</div>
        <div className="mt-1 text-[10px] font-semibold" style={{ color: (periodReturn ?? 0) >= 0 ? green : red }}>{formatPercent(periodReturn, true)} · 표시 구간</div>
      </div>
      <div className="text-right">
        <div className="text-[8px] text-[#9aa2aa]">Market as-of</div>
        <div className="mt-1 text-[9px] font-medium text-[#59636d]">{dateTime(payload.asOf ?? candles[candles.length - 1].timestamp)}</div>
        {finance?.markPrice != null && <div className="mt-2 text-[8px] text-[#8e969e]">Paper mark {formatKrw(finance.markPrice)}{markGap != null ? ` · ${formatPercent(markGap, true)} vs market` : ''}</div>}
      </div>
    </div>

    <svg viewBox={`0 0 ${width} 258`} className="h-[258px] w-full touch-pan-y select-none" role="img" aria-label={`${payload.market ?? ''} 실제 시장 캔들 차트`} onPointerDown={(event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const localX = ((event.clientX - rect.left) / rect.width) * width;
      setSelectedIndex(Math.max(0, Math.min(candles.length - 1, Math.floor((localX - left) / slot))));
    }}>
      {[0, 1, 2, 3, 4].map((row) => { const y = top + ((bottom - top) / 4) * row; return <line key={row} x1={left} x2={right} y1={y} y2={y} stroke="#eef1f3" strokeWidth="1" />; })}
      <line x1={left} x2={right} y1="198" y2="198" stroke="#e6eaed" strokeWidth="1" />
      {candles.map((candle, index) => {
        const x = xFor(index);
        const color = candle.close >= candle.open ? green : red;
        const openY = yFor(candle.open);
        const closeY = yFor(candle.close);
        return <g key={`${candle.timestamp}-${index}`}>
          <line x1={x} x2={x} y1={yFor(candle.high)} y2={yFor(candle.low)} stroke={color} strokeWidth="1" />
          <rect x={x - candleWidth / 2} y={Math.min(openY, closeY)} width={candleWidth} height={Math.max(1.1, Math.abs(closeY - openY))} rx="0.6" fill={color} />
          <rect x={x - candleWidth / 2} y={volumeY(candle.volume)} width={candleWidth} height={Math.max(1, volumeBottom - volumeY(candle.volume))} rx="0.4" fill={color} opacity="0.3" />
        </g>;
      })}
      {levels.map((level) => { const y = yFor(level.value); return <g key={level.label}><line x1={left} x2={right} y1={y} y2={y} stroke={level.color} strokeWidth="1" strokeDasharray="4 4" opacity="0.8" /><text x={right - 2} y={y - 3} textAnchor="end" fontSize="7" fontWeight="600" fill={level.color}>{level.label}</text></g>; })}
      {selectedIndex != null && <line x1={xFor(selectedIndex)} x2={xFor(selectedIndex)} y1={top} y2={volumeBottom} stroke="#6f7983" strokeWidth="0.8" opacity="0.55" />}
    </svg>

    <div className="border-t border-[#eef1f3] px-4 py-3">
      <div className="mb-2 flex items-center justify-between"><div className="text-[9px] text-[#87919a]">{selectedIndex == null ? '최근 봉' : '선택 봉'} · {dateTime(inspected.timestamp)}</div><div className="text-[10px] font-semibold" style={{ color: (candleReturn ?? 0) >= 0 ? green : red }}>{formatPercent(candleReturn, true)}</div></div>
      <div className="grid grid-cols-5 gap-2 text-center">{[['시가', inspected.open], ['고가', inspected.high], ['저가', inspected.low], ['종가', inspected.close]].map(([label, value]) => <div key={String(label)}><div className="text-[8px] text-[#9aa2aa]">{label}</div><div className="mt-1 truncate text-[9px] font-semibold">{formatKrw(Number(value))}</div></div>)}<div><div className="text-[8px] text-[#9aa2aa]">거래량</div><div className="mt-1 truncate text-[9px] font-semibold">{new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(inspected.volume)}</div></div></div>
    </div>
  </div>;
};

export const ObservabilityRestore = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('portfolio');
  const [operations, setOperations] = useState<OperationsWithCheckpoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chart, setChart] = useState<ChartPayload | null>(null);
  const [market, setMarket] = useState('');
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/trading-status', { cache: 'no-store' });
      setOperations(await response.json() as OperationsWithCheckpoint);
    } catch {
      setOperations(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const positions = operations?.portfolio?.openPositions ?? [];
  const trades = operations?.recentTrades ?? [];
  const decisions = operations?.decisionTape ?? [];
  const markets = useMemo(() => Array.from(new Set([
    ...positions.map((item) => item.market),
    ...decisions.map((item) => item.market),
    ...trades.map((item) => item.market),
  ].filter(Boolean))).slice(0, 40), [positions, decisions, trades]);

  useEffect(() => {
    if (!market && markets.length) setMarket(markets[0]);
  }, [market, markets]);

  const equity = operations?.portfolio?.equity ?? null;
  const openCost = positions.reduce((sum, item) => sum + (positionFinancials(item).costBasis ?? 0), 0);
  const openValue = positions.reduce((sum, item) => sum + (positionFinancials(item).marketValue ?? 0), 0);
  const openPnl = positions.reduce((sum, item) => sum + (positionFinancials(item).unrealizedPnl ?? 0), 0);
  const exposure = finite(equity) && equity > 0 ? openValue / equity : null;
  const values = (operations?.equityCurve ?? []).map((item) => item.equity).filter(Number.isFinite);
  const equityPositive = values.length < 2 || values[values.length - 1] >= values[0];
  const isEquity = /^KRX-\d{6}$/.test(market);
  const frames = isEquity ? EQUITY_FRAMES : CRYPTO_FRAMES;
  const timeframe = frames.find((item) => item.unit === unit) ?? (isEquity ? EQUITY_FRAMES[4] : CRYPTO_FRAMES[3]);
  const decision = market ? latestDecisionFor(operations, market) : null;
  const position = market ? latestPositionFor(operations, market) : null;

  useEffect(() => {
    if (!frames.some((item) => item.unit === unit)) setUnit(isEquity ? 1_440 : 60);
  }, [isEquity]);

  useEffect(() => {
    if (!open || tab !== 'market' || !market || (!/^KRW-[A-Z0-9]+$/.test(market) && !/^KRX-\d{6}$/.test(market))) { setChart(null); return; }
    let active = true;
    setChartLoading(true);
    fetch(`/api/market-chart?market=${encodeURIComponent(market)}&unit=${timeframe.unit}&count=${timeframe.count}`, { cache: 'no-store' })
      .then((response) => response.json() as Promise<ChartPayload>)
      .then((payload) => { if (active) setChart(payload); })
      .catch(() => { if (active) setChart({ available: false, market, error: '시장 차트 요청에 실패했습니다.' }); })
      .finally(() => { if (active) setChartLoading(false); });
    return () => { active = false; };
  }, [open, tab, market, timeframe.unit, timeframe.count]);

  const submitMarket = () => {
    const normalized = query.trim().toUpperCase();
    if (/^KRW-[A-Z0-9]+$/.test(normalized) || /^KRX-\d{6}$/.test(normalized)) {
      setMarket(normalized);
      setQuery('');
    }
  };

  return <>
    {!open && <button type="button" onClick={() => setOpen(true)} className="fixed bottom-[204px] right-4 z-[70] flex h-12 items-center gap-2 rounded-full border border-[#dfe3e7] bg-white px-4 text-[10px] font-semibold text-[#25292f] shadow-[0_8px_26px_rgba(16,20,24,0.12)] active:scale-[0.985]" aria-label="차트와 포트폴리오 기록 열기"><BarChart3 className="h-4 w-4" />Charts</button>}

    {open && <div className="fixed inset-0 z-[97] overflow-y-auto overscroll-contain bg-[#f6f7f9] text-[#111318]">
      <div className="sticky top-0 z-30 border-b border-[#e8ebee] bg-white/96 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e7ea] bg-white"><ArrowLeft className="h-4 w-4" /></button><div><div className="text-[9px] font-semibold tracking-[0.16em] text-[#9ba1a9]">OBSERVABILITY</div><div className="mt-0.5 text-[19px] font-semibold tracking-[-0.035em]">Paper & Market Records</div></div></div>
          <button type="button" onClick={() => void load()} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e7ea] bg-white"><RefreshCw className={cn('h-4 w-4 text-[#626871]', loading && 'animate-spin')} /></button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-[14px] bg-[#f2f3f5] p-1">{(['portfolio', 'market', 'history'] as Tab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn('rounded-[11px] px-2 py-2 text-[9px] font-semibold', tab === item ? 'bg-white text-[#20242a] shadow-sm' : 'text-[#899099]')}>{item === 'portfolio' ? 'Portfolio' : item === 'market' ? 'Market' : 'History'}</button>)}</div>
      </div>

      <main className="px-4 pb-16 pt-4">
        <section className="grid grid-cols-2 gap-2">
          <div className={cn(card, 'p-4')}><div className="text-[9px] text-[#969ca4]">Trading account</div><div className="mt-2 flex items-center gap-2"><Pill color={blue}>PAPER</Pill><span className="text-[12px] font-semibold">Simulation portfolio</span></div><div className="mt-2 text-[9px] leading-4 text-[#8d949c]">현재 표시되는 자산·현금·포지션은 실제 증권계좌가 아닙니다.</div></div>
          <div className={cn(card, 'p-4')}><div className="text-[9px] text-[#969ca4]">Broker connection</div><div className="mt-2 flex items-center gap-2"><Pill color={red}>KIS LIVE</Pill><span className="text-[12px] font-semibold">Not connected</span></div><div className="mt-2 text-[9px] leading-4 text-[#8d949c]">KRX 차트는 별도 시장데이터 소스를 사용할 수 있으며 실계좌 연결을 뜻하지 않습니다.</div></div>
        </section>

        {tab === 'portfolio' && <>
          <section className="mt-6"><SectionTitle title="Paper portfolio" subtitle="실제 persisted Paper checkpoint와 equityCurve만 표시합니다." /><div className={cn(card, 'p-5')}><div className="text-[10px] text-[#8e959d]">Total Paper equity</div><div className="mt-2 text-[34px] font-semibold tracking-[-0.055em]">{formatKrw(equity)}</div><div className="mt-5"><PortfolioEquityChart values={values} positive={equityPositive} /></div><div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-[#eef0f2] pt-4"><Metric label="Paper cash" value={formatKrw(operations?.portfolio?.cash)} /><Metric label="투입원금 · Cost basis" value={positions.length ? formatKrw(openCost) : '—'} /><Metric label="현재 평가금액" value={positions.length ? formatKrw(openValue) : '—'} /><Metric label="포트폴리오 노출" value={formatPercent(exposure)} /><Metric label="미실현손익" value={positions.length ? formatKrw(openPnl, true) : '—'} accent={openPnl >= 0 ? green : red} /><Metric label="실현손익" value={formatKrw(operations?.portfolio?.realizedPnl, true)} /><Metric label="MDD" value={formatPercent(operations?.performance?.maxDrawdownPct)} /><Metric label="Snapshot" value={operations?.checkpoint?.savedAt ? timeAgo(operations.checkpoint.savedAt) : '—'} /></div></div></section>

          <section className="mt-7"><SectionTitle title="Open position allocation" subtitle="각 포지션에 실제로 얼마의 Paper 자본이 들어가 있는지 표시합니다." /><div className="space-y-2">{positions.map((item) => { const finance = positionFinancials(item); const weight = finite(equity) && equity > 0 && finance.marketValue != null ? finance.marketValue / equity : null; return <div key={`${item.market}-${item.openedAt}`} className={cn(card, 'p-4')}><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="text-[15px] font-semibold">{item.market}</span><Pill color={blue}>PAPER</Pill></div><div className="mt-1 text-[9px] text-[#9aa1a9]">{dateTime(item.openedAt)} 진입 · {formatQuantity(finance.quantity)} units</div></div><div className="text-right"><div className="text-[9px] text-[#969ca4]">수익률</div><div className="mt-1 text-[13px] font-semibold" style={{ color: (finance.unrealizedReturn ?? 0) >= 0 ? green : red }}>{formatPercent(finance.unrealizedReturn, true)}</div></div></div><div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-[#eef0f2] pt-4"><Metric label="투입원금" value={formatKrw(finance.costBasis)} /><Metric label="현재 평가액" value={formatKrw(finance.marketValue)} /><Metric label="포트폴리오 비중" value={formatPercent(weight)} /><Metric label="평가손익" value={formatKrw(finance.unrealizedPnl, true)} accent={(finance.unrealizedPnl ?? 0) >= 0 ? green : red} /><Metric label="평균단가" value={formatKrw(finance.averageCostPerUnit)} /><Metric label="Paper mark" value={formatKrw(finance.markPrice)} /></div></div>; })}{!positions.length && <div className={cn(card, 'p-5 text-[10px] text-[#8d939b]')}>현재 열린 Paper 포지션이 없습니다.</div>}</div></section>
        </>}

        {tab === 'market' && <>
          <section><SectionTitle title="Actual market chart" subtitle="Upbit/KIS/Yahoo 등 응답에 기록된 실제 데이터 소스를 그대로 표시합니다." /><div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ba1a9]" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitMarket(); }} placeholder="KRW-BTC or KRX-000660" className="h-11 w-full rounded-[16px] border border-[#e4e7ea] bg-white pl-10 pr-3 text-[12px] outline-none" /></div><button type="button" onClick={submitMarket} className="rounded-[16px] bg-[#17191e] px-4 text-[10px] font-semibold text-white">Load</button></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{markets.slice(0, 12).map((item) => <button key={item} type="button" onClick={() => setMarket(item)} className={cn('shrink-0 rounded-full border px-3 py-1.5 text-[9px] font-semibold', market === item ? 'border-[#17191e] bg-[#17191e] text-white' : 'border-[#e4e7ea] bg-white text-[#737b84]')}>{item}</button>)}</div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{frames.map((item) => <button key={item.unit} type="button" onClick={() => setUnit(item.unit)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-[9px] font-semibold', timeframe.unit === item.unit ? 'bg-[#30343a] text-white' : 'bg-[#eceff2] text-[#737b84]')}>{item.label}</button>)}</div></section>
          <section className="mt-4">{chartLoading ? <div className={cn(card, 'flex min-h-56 items-center justify-center text-[10px] text-[#8d939b]')}>실제 시장 차트를 불러오는 중…</div> : chart ? <MarketCandleChart payload={chart} decision={decision} position={position} /> : <div className={cn(card, 'p-5 text-[10px] text-[#8d939b]')}>시장 종목을 선택하세요.</div>}</section>
          {chart && <section className={cn(card, 'mt-3 p-4')}><div className="grid grid-cols-2 gap-x-5 gap-y-4"><Metric label="Market" value={market || '—'} /><Metric label="Source" value={sourceLabel(chart.source)} /><Metric label="Quality" value={chart.marketData?.quality ?? '—'} /><Metric label="Delay" value={finite(chart.marketData?.delayMinutes) ? `${chart.marketData!.delayMinutes}m` : '—'} /><Metric label="Execution eligible" value={chart.marketData?.executionEligible === true ? 'YES' : 'NO / DISPLAY'} /><Metric label="Paper position" value={position ? 'OPEN' : 'NONE'} /></div>{chart.warning && <div className="mt-3 rounded-[14px] bg-[#fff8ed] px-3 py-3 text-[9px] leading-4 text-[#8c6e3f]">{chart.warning}</div>}</section>}
        </>}

        {tab === 'history' && <>
          <section><SectionTitle title="Trade history" subtitle="완료된 Paper 거래의 진입·청산·손익을 시간순으로 다시 봅니다." /><div className="space-y-2">{trades.slice(0, 30).map((trade) => { const cost = finite(trade.quantity) ? trade.entryPrice * trade.quantity! : null; return <div key={trade.id} className={cn(card, 'p-4')}><div className="flex items-start justify-between gap-3"><div><div className="text-[14px] font-semibold">{trade.market}</div><div className="mt-1 text-[9px] text-[#9aa1a9]">{dateTime(trade.openedAt)} → {dateTime(trade.closedAt)}</div></div><div className="text-right"><div className="text-[13px] font-semibold" style={{ color: trade.returnPct >= 0 ? green : red }}>{formatPercent(trade.returnPct, true)}</div><div className="mt-1 text-[9px]" style={{ color: trade.netPnl >= 0 ? green : red }}>{formatKrw(trade.netPnl, true)}</div></div></div><div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-[#eef0f2] pt-4"><Metric label="진입가" value={formatKrw(trade.entryPrice)} /><Metric label="청산가" value={formatKrw(trade.exitPrice)} /><Metric label="투입원금" value={formatKrw(cost)} /><Metric label="수량" value={formatQuantity(trade.quantity)} /><Metric label="수수료" value={formatKrw(trade.fees)} /><Metric label="청산 이유" value={trade.exitReason || '—'} /></div></div>; })}{!trades.length && <div className={cn(card, 'p-5 text-[10px] text-[#8d939b]')}>완료된 Paper 거래가 없습니다.</div>}</div></section>
        </>}
      </main>
    </div>}
  </>;
};
