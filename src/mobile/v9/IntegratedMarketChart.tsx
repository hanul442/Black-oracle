import React, { useEffect, useMemo, useState } from 'react';
import type { DecisionTapeItem, OpenPosition, PriceCandle } from '../v2/types';
import { cn, dateTime } from '../v2/types';
import { formatKrw, formatPercent, positionFinancials } from '../v2/financial';

const green = '#16845b';
const red = '#d14b55';
const blue = '#3767d6';
const amber = '#a46b17';
const ink = '#111318';

type MarketDataTruth = {
  provider?: string;
  source?: string;
  quality?: string;
  observedAt?: number | null;
  receivedAt?: number | null;
  freshnessAgeMinutes?: number | null;
  delayMinutes?: number | null;
  executionEligible?: boolean;
  researchOnly?: boolean;
  reason?: string;
};

type ChartPayload = {
  available?: boolean;
  market?: string;
  source?: string;
  asOf?: number | null;
  candles?: PriceCandle[];
  error?: string;
  warning?: string;
  marketData?: MarketDataTruth;
};

type Frame = { label: string; unit: number; count: number };
const FRAMES: Frame[] = [
  { label: '5m', unit: 5, count: 96 },
  { label: '15m', unit: 15, count: 96 },
  { label: '1H', unit: 60, count: 72 },
  { label: '일', unit: 1440, count: 90 },
];

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const sourceLabel = (source?: string) => source === 'UPBIT_PUBLIC' ? 'Upbit Public' : source === 'KIS_OFFICIAL' ? 'KIS Official' : source === 'YAHOO_FINANCE' ? 'Yahoo Finance' : source || 'Market data';
const qualityColor = (quality?: string) => {
  const normalized = String(quality ?? '').toUpperCase();
  if (normalized === 'LIVE') return green;
  if (normalized === 'UNAVAILABLE') return red;
  if (normalized === 'DELAYED' || normalized === 'EOD') return amber;
  return '#69717b';
};
const freshnessLabel = (marketData?: MarketDataTruth) => {
  if (finite(marketData?.freshnessAgeMinutes)) {
    const minutes = marketData!.freshnessAgeMinutes!;
    return minutes < 1 ? '<1m old' : `${Math.round(minutes)}m old`;
  }
  if (finite(marketData?.delayMinutes)) return `${Math.round(marketData!.delayMinutes!)}m delay`;
  return 'NOT REPORTED';
};
const suitabilityLabel = (marketData?: MarketDataTruth) => {
  if (marketData?.executionEligible === true) return 'EXECUTION-SUITABLE';
  if (marketData?.executionEligible === false) return 'DISPLAY / RESEARCH ONLY';
  return 'NOT REPORTED';
};

export const IntegratedMarketChart = ({ market, decision, position }: { market: string; decision: DecisionTapeItem | null; position: OpenPosition | null }) => {
  const [frame, setFrame] = useState<Frame>(FRAMES[2]);
  const [payload, setPayload] = useState<ChartPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/market-chart?market=${encodeURIComponent(market)}&unit=${frame.unit}&count=${frame.count}`, { cache: 'no-store' })
      .then((response) => response.json() as Promise<ChartPayload>)
      .then((next) => { if (active) setPayload(next); })
      .catch(() => { if (active) setPayload({ available: false, error: '시장 차트 요청에 실패했습니다.' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [market, frame.unit, frame.count]);

  const candles = useMemo(() => (payload?.candles ?? []).filter((item) => [item.timestamp, item.open, item.high, item.low, item.close, item.volume].every(Number.isFinite)), [payload]);
  const finance = position ? positionFinancials(position) : null;
  const live = candles.length ? candles[candles.length - 1].close : null;
  const first = candles.length ? candles[0].open : null;
  const periodReturn = finite(live) && finite(first) && first > 0 ? live / first - 1 : null;
  const marketData = payload?.marketData;
  const displayedSource = sourceLabel(marketData?.source ?? payload?.source);
  const displayedQuality = String(marketData?.quality ?? 'NOT REPORTED').toUpperCase();
  const displayedAsOf = marketData?.observedAt ?? payload?.asOf ?? (candles.length ? candles[candles.length - 1].timestamp : null);
  const displayedFreshness = freshnessLabel(marketData);
  const displayedSuitability = suitabilityLabel(marketData);

  const width = 340;
  const height = 190;
  const left = 10;
  const right = 330;
  const top = 12;
  const bottom = 152;
  const plotWidth = right - left;
  const values = candles.flatMap((item) => [item.low, item.high]);
  const tradeMap = decision?.tradeMap;
  const levels = [position?.averageCost, position?.stopLossPrice, position?.takeProfit1Price ?? position?.takeProfitPrice, position?.takeProfit2Price, tradeMap?.entryPrice, tradeMap?.stopLossPrice, tradeMap?.takeProfit1Price, tradeMap?.takeProfit2Price].filter(finite);
  const rawMin = values.length ? Math.min(...values, ...levels) : 0;
  const rawMax = values.length ? Math.max(...values, ...levels) : 1;
  const pad = Math.max((rawMax - rawMin) * 0.06, Math.abs(rawMax) * 0.0005, 0.000001);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const span = Math.max(max - min, 0.000001);
  const slot = candles.length ? plotWidth / candles.length : 1;
  const yFor = (value: number) => bottom - ((value - min) / span) * (bottom - top);
  const xFor = (index: number) => left + slot * (index + 0.5);

  return <section>
    <div className="mb-3 flex items-end justify-between gap-3">
      <div><div className="text-[17px] font-semibold tracking-[-0.025em] text-[#15171c]">Market chart</div><div className="mt-1 text-[10px] text-[#8c929a]">실제 OHLCV와 현재 Paper 포지션을 같은 화면에서 봅니다.</div></div>
      <div className="flex gap-1">{FRAMES.map((item) => <button key={item.unit} type="button" onClick={() => setFrame(item)} className={cn('rounded-full px-2.5 py-1 text-[9px] font-semibold', frame.unit === item.unit ? 'bg-[#17191e] text-white' : 'bg-[#eceff2] text-[#737b84]')}>{item.label}</button>)}</div>
    </div>
    <div className="overflow-hidden rounded-[24px] border border-[#e7e9ed] bg-white">
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
        <div><div className="text-[9px] text-[#929aa2]">{displayedSource}</div><div className="mt-1 text-[27px] font-semibold tracking-[-0.045em]">{formatKrw(live)}</div><div className="mt-1 text-[10px] font-semibold" style={{ color: (periodReturn ?? 0) >= 0 ? green : red }}>{formatPercent(periodReturn, true)} · {frame.label}</div></div>
        <div className="text-right"><div className="text-[8px] text-[#9aa2aa]">Market as-of</div><div className="mt-1 text-[9px] font-medium text-[#59636d]">{dateTime(displayedAsOf)}</div>{finance?.markPrice != null && <><div className="mt-2 text-[8px] text-[#9aa2aa]">Paper mark</div><div className="mt-1 text-[10px] font-semibold text-[#434950]">{formatKrw(finance.markPrice)}</div></>}</div>
      </div>
      <div className="mx-4 mb-3 grid grid-cols-3 gap-2 rounded-[16px] bg-[#f7f8f9] p-3">
        <div className="min-w-0"><div className="text-[8px] font-medium text-[#9aa1aa]">QUALITY</div><div className="mt-1 truncate text-[9px] font-semibold" style={{ color: qualityColor(displayedQuality) }}>{displayedQuality}</div></div>
        <div className="min-w-0"><div className="text-[8px] font-medium text-[#9aa1aa]">FRESHNESS</div><div className="mt-1 truncate text-[9px] font-semibold text-[#4d555e]">{displayedFreshness}</div></div>
        <div className="min-w-0"><div className="text-[8px] font-medium text-[#9aa1aa]">USE</div><div className="mt-1 truncate text-[9px] font-semibold text-[#4d555e]">{displayedSuitability}</div></div>
      </div>
      {loading ? <div className="flex h-48 items-center justify-center text-[10px] text-[#8d939b]">실제 시장 차트를 불러오는 중…</div> : candles.length < 2 ? <div className="flex h-48 flex-col items-center justify-center px-5 text-center text-[10px] leading-5 text-[#8d939b]"><div className="font-semibold text-[#6f7780]">{displayedQuality === 'UNAVAILABLE' ? 'DATA GAP' : 'NO CHART DATA'}</div><div className="mt-1">{payload?.error || marketData?.reason || '실제 OHLCV 데이터가 없습니다. 임의 가격은 그리지 않습니다.'}</div></div> : <svg viewBox={`0 0 ${width} ${height}`} className="h-[190px] w-full touch-pan-y" role="img" aria-label={`${market} market chart`}>
        {[0,1,2,3].map((row) => { const y = top + ((bottom - top) / 3) * row; return <line key={row} x1={left} x2={right} y1={y} y2={y} stroke="#eef1f3" strokeWidth="1" />; })}
        {candles.map((candle, index) => { const x = xFor(index); const color = candle.close >= candle.open ? green : red; const openY = yFor(candle.open); const closeY = yFor(candle.close); return <g key={`${candle.timestamp}-${index}`}><line x1={x} x2={x} y1={yFor(candle.high)} y2={yFor(candle.low)} stroke={color} strokeWidth="1" /><rect x={x - Math.max(1.2, slot * 0.25)} y={Math.min(openY, closeY)} width={Math.max(2.4, slot * 0.5)} height={Math.max(1, Math.abs(closeY - openY))} rx="0.5" fill={color} /></g>; })}
        {finite(position?.averageCost) && <g><line x1={left} x2={right} y1={yFor(position!.averageCost)} y2={yFor(position!.averageCost)} stroke={ink} strokeDasharray="4 4" /><text x={right - 2} y={yFor(position!.averageCost) - 3} textAnchor="end" fontSize="7" fill={ink}>ENTRY</text></g>}
        {finite(position?.stopLossPrice) && <g><line x1={left} x2={right} y1={yFor(position!.stopLossPrice!)} y2={yFor(position!.stopLossPrice!)} stroke={red} strokeDasharray="4 4" /><text x={right - 2} y={yFor(position!.stopLossPrice!) - 3} textAnchor="end" fontSize="7" fill={red}>SL</text></g>}
        {finite(position?.takeProfit1Price ?? position?.takeProfitPrice) && <g><line x1={left} x2={right} y1={yFor((position?.takeProfit1Price ?? position?.takeProfitPrice)!)} y2={yFor((position?.takeProfit1Price ?? position?.takeProfitPrice)!)} stroke={green} strokeDasharray="4 4" /><text x={right - 2} y={yFor((position?.takeProfit1Price ?? position?.takeProfitPrice)!) - 3} textAnchor="end" fontSize="7" fill={green}>TP1</text></g>}
        {finite(position?.takeProfit2Price) && <g><line x1={left} x2={right} y1={yFor(position!.takeProfit2Price!)} y2={yFor(position!.takeProfit2Price!)} stroke={blue} strokeDasharray="4 4" /><text x={right - 2} y={yFor(position!.takeProfit2Price!) - 3} textAnchor="end" fontSize="7" fill={blue}>TP2</text></g>}
      </svg>}
      <div className="border-t border-[#eef1f3] px-4 py-3 text-[8px] leading-4 text-[#929aa2]">{marketData?.reason ?? (marketData?.executionEligible === false ? '표시용/리서치 데이터 · 주문 권한 없음' : '시장 데이터 품질/사용 적합성은 보고된 값만 표시합니다.')}{payload?.warning ? ` · ${payload.warning}` : ''}</div>
    </div>
  </section>;
};
