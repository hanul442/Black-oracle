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
const holdingLabel = (openedAt?: number | null) => {
  if (!finite(openedAt)) return 'DATA GAP';
  const elapsed = Math.max(0, Date.now() - openedAt);
  if (elapsed < 60 * 60_000) return `${Math.max(1, Math.round(elapsed / 60_000))}m`;
  if (elapsed < 24 * 60 * 60_000) return `${(elapsed / 3_600_000).toFixed(1)}h`;
  return `${(elapsed / 86_400_000).toFixed(1)}d`;
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
  const activeCurrent = finite(finance?.markPrice) ? finance!.markPrice : live;

  const width = 340;
  const height = 190;
  const left = 10;
  const right = 330;
  const top = 12;
  const bottom = 152;
  const plotWidth = right - left;
  const values = candles.flatMap((item) => [item.low, item.high]);
  const tradeMap = decision?.tradeMap;
  const candidateStop = tradeMap?.stopLossPrice ?? tradeMap?.structuralInvalidationPrice;
  const levels = [position?.averageCost, position?.stopLossPrice, position?.takeProfit1Price ?? position?.takeProfitPrice, position?.takeProfit2Price, tradeMap?.entryPrice, candidateStop, tradeMap?.takeProfit1Price, tradeMap?.takeProfit2Price].filter(finite);
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
        {finite(position?.averageCost) && <g><line x1={left} x2={right} y1={yFor(position!.averageCost)} y2={yFor(position!.averageCost)} stroke={ink} strokeDasharray="4 4" /><text x={right - 2} y={yFor(position!.averageCost) - 3} textAnchor="end" fontSize="7" fill={ink}>ACTIVE ENTRY</text></g>}
        {finite(position?.stopLossPrice) && <g><line x1={left} x2={right} y1={yFor(position!.stopLossPrice!)} y2={yFor(position!.stopLossPrice!)} stroke={red} strokeDasharray="4 4" /><text x={right - 2} y={yFor(position!.stopLossPrice!) - 3} textAnchor="end" fontSize="7" fill={red}>ACTIVE SL</text></g>}
        {finite(position?.takeProfit1Price ?? position?.takeProfitPrice) && <g><line x1={left} x2={right} y1={yFor((position?.takeProfit1Price ?? position?.takeProfitPrice)!)} y2={yFor((position?.takeProfit1Price ?? position?.takeProfitPrice)!)} stroke={green} strokeDasharray="4 4" /><text x={right - 2} y={yFor((position?.takeProfit1Price ?? position?.takeProfitPrice)!) - 3} textAnchor="end" fontSize="7" fill={green}>ACTIVE TP1</text></g>}
        {finite(position?.takeProfit2Price) && <g><line x1={left} x2={right} y1={yFor(position!.takeProfit2Price!)} y2={yFor(position!.takeProfit2Price!)} stroke={blue} strokeDasharray="4 4" /><text x={right - 2} y={yFor(position!.takeProfit2Price!) - 3} textAnchor="end" fontSize="7" fill={blue}>ACTIVE TP2</text></g>}
        {finite(tradeMap?.entryPrice) && <g><line x1={left} x2={right} y1={yFor(tradeMap!.entryPrice!)} y2={yFor(tradeMap!.entryPrice!)} stroke={blue} strokeDasharray="2 5" opacity="0.72" /><text x={left + 2} y={yFor(tradeMap!.entryPrice!) - 3} fontSize="7" fill={blue}>CAND ENTRY</text></g>}
        {finite(candidateStop) && <g><line x1={left} x2={right} y1={yFor(candidateStop)} y2={yFor(candidateStop)} stroke={red} strokeDasharray="2 5" opacity="0.62" /><text x={left + 2} y={yFor(candidateStop) - 3} fontSize="7" fill={red}>CAND SL</text></g>}
        {finite(tradeMap?.takeProfit1Price) && <g><line x1={left} x2={right} y1={yFor(tradeMap!.takeProfit1Price!)} y2={yFor(tradeMap!.takeProfit1Price!)} stroke={green} strokeDasharray="2 5" opacity="0.62" /><text x={left + 2} y={yFor(tradeMap!.takeProfit1Price!) - 3} fontSize="7" fill={green}>CAND TP1</text></g>}
        {finite(tradeMap?.takeProfit2Price) && <g><line x1={left} x2={right} y1={yFor(tradeMap!.takeProfit2Price!)} y2={yFor(tradeMap!.takeProfit2Price!)} stroke={green} strokeDasharray="2 5" opacity="0.45" /><text x={left + 2} y={yFor(tradeMap!.takeProfit2Price!) - 3} fontSize="7" fill={green}>CAND TP2</text></g>}
      </svg>}
      <div className="grid gap-3 border-t border-[#eef1f3] bg-[#fbfcfc] p-4 lg:grid-cols-2">
        <div className="rounded-[17px] border border-[#dfe4e8] bg-white p-4">
          <div className="flex items-center justify-between gap-2"><div><div className="text-[8px] font-bold tracking-[0.13em] text-[#606974]">ACTIVE POSITION PROTECTION</div><div className="mt-1 text-[9px] text-[#9aa1aa]">이미 보유한 Paper 포지션의 실제 보호값</div></div><span className="rounded-full bg-[#3767d60d] px-2 py-1 text-[8px] font-semibold text-[#3767d6]">{position ? 'OPEN · PAPER' : 'NOT OPEN'}</span></div>
          {position ? <><div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3"><div><div className="text-[8px] text-[#9aa1aa]">Opened</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{dateTime(position.openedAt)}</div></div><div><div className="text-[8px] text-[#9aa1aa]">Holding</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{holdingLabel(position.openedAt)}</div></div><div><div className="text-[8px] text-[#9aa1aa]">Entry / avg cost</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{formatKrw(position.averageCost)}</div></div><div><div className="text-[8px] text-[#9aa1aa]">Current / mark</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{formatKrw(activeCurrent)}</div></div><div><div className="text-[8px] text-[#9aa1aa]">Unrealized P&L</div><div className="mt-1 text-[10px] font-semibold" style={{ color: (finance?.unrealizedPnl ?? 0) >= 0 ? green : red }}>{finance?.unrealizedPnl == null ? 'DATA GAP' : formatKrw(finance.unrealizedPnl, true)}</div></div><div><div className="text-[8px] text-[#9aa1aa]">Return</div><div className="mt-1 text-[10px] font-semibold" style={{ color: (finance?.unrealizedReturn ?? 0) >= 0 ? green : red }}>{finance?.unrealizedReturn == null ? 'DATA GAP' : formatPercent(finance.unrealizedReturn, true)}</div></div><div><div className="text-[8px] text-[#9aa1aa]">Stop loss</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{finite(position.stopLossPrice) ? formatKrw(position.stopLossPrice) : 'DATA GAP'}</div></div><div><div className="text-[8px] text-[#9aa1aa]">TP1 / TP2</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{finite(position.takeProfit1Price ?? position.takeProfitPrice) ? formatKrw(position.takeProfit1Price ?? position.takeProfitPrice) : 'DATA GAP'} · {finite(position.takeProfit2Price) ? formatKrw(position.takeProfit2Price) : 'NOT LINKED'}</div></div></div><div className="mt-4 rounded-[12px] bg-[#f7f8f9] px-3 py-2 text-[8px] leading-4 text-[#7e8790]">이 값은 기존 포지션 보호용입니다. 아래 신규 후보 진입안으로 덮어쓰거나 추론하지 않습니다.</div></> : <div className="mt-4 rounded-[12px] bg-[#f7f8f9] px-3 py-3 text-[9px] leading-5 text-[#838b94]">현재 Open Paper position이 없습니다. 후보 trade map이 있어도 기존 포지션으로 간주하지 않습니다.</div>}
        </div>
        <div className="rounded-[17px] border border-[#dfe4e8] bg-white p-4">
          <div className="flex items-center justify-between gap-2"><div><div className="text-[8px] font-bold tracking-[0.13em] text-[#606974]">FRESH CANDIDATE PLAN</div><div className="mt-1 text-[9px] text-[#9aa1aa]">최신 Oracle 판단이 제안한 신규 진입 지도</div></div><span className="rounded-full bg-[#a46b170d] px-2 py-1 text-[8px] font-semibold text-[#a46b17]">{tradeMap ? (tradeMap.status ?? 'AVAILABLE') : decision ? 'NOT LINKED' : 'NOT RUN'}</span></div>
          {tradeMap ? <><div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3"><div><div className="text-[8px] text-[#9aa1aa]">Analyzed</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{dateTime(decision?.timestamp)}</div></div><div><div className="text-[8px] text-[#9aa1aa]">Decision</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{decision?.decision ?? 'NOT REPORTED'}</div></div><div><div className="text-[8px] text-[#9aa1aa]">Candidate entry</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{finite(tradeMap.entryPrice) ? formatKrw(tradeMap.entryPrice) : 'DATA GAP'}</div></div><div><div className="text-[8px] text-[#9aa1aa]">Candidate stop</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{finite(candidateStop) ? formatKrw(candidateStop) : 'DATA GAP'}</div></div><div><div className="text-[8px] text-[#9aa1aa]">Candidate TP1</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{finite(tradeMap.takeProfit1Price) ? formatKrw(tradeMap.takeProfit1Price) : 'NOT LINKED'}</div></div><div><div className="text-[8px] text-[#9aa1aa]">Candidate TP2</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{finite(tradeMap.takeProfit2Price) ? formatKrw(tradeMap.takeProfit2Price) : 'NOT LINKED'}</div></div><div><div className="text-[8px] text-[#9aa1aa]">R/R 1</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{finite(tradeMap.riskReward1) ? tradeMap.riskReward1.toFixed(2) : 'NOT REPORTED'}</div></div><div><div className="text-[8px] text-[#9aa1aa]">R/R 2</div><div className="mt-1 text-[10px] font-semibold text-[#343a41]">{finite(tradeMap.riskReward2) ? tradeMap.riskReward2.toFixed(2) : 'NOT REPORTED'}</div></div></div><div className="mt-4 space-y-2 rounded-[12px] bg-[#fffaf2] px-3 py-3 text-[8px] leading-4 text-[#806238]"><div><strong>Risk:</strong> {decision?.riskReasons?.[0] ?? 'NOT REPORTED'}</div><div><strong>What changes decision:</strong> {decision?.aiCouncilReview?.whatWouldChangeMind ?? 'NOT REPORTED'}</div></div></> : <div className="mt-4 rounded-[12px] bg-[#f7f8f9] px-3 py-3 text-[9px] leading-5 text-[#838b94]">{decision ? '최신 Decision은 있지만 canonical trade map이 연결되지 않았습니다. NOT LINKED 상태로 유지합니다.' : '최신 Decision이 없어 candidate plan을 실행한 것으로 표시하지 않습니다. NOT RUN 상태입니다.'}</div>}
        </div>
      </div>
      <div className="border-t border-[#eef1f3] px-4 py-3 text-[8px] leading-4 text-[#929aa2]">{marketData?.reason ?? (marketData?.executionEligible === false ? '표시용/리서치 데이터 · 주문 권한 없음' : '시장 데이터 품질/사용 적합성은 보고된 값만 표시합니다.')}{payload?.warning ? ` · ${payload.warning}` : ''}</div>
    </div>
  </section>;
};
