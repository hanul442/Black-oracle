import React, { useEffect, useMemo, useState } from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import type { DecisionTapeItem, PriceCandle } from '../v2/types';
import { dateTime, pct } from '../v2/types';
import { formatKrw } from '../v2/financial';
import { AnalysisDetailV2 } from '../v2/AnalysisDetailV2';
import { DetailShell, EmptyCard, Metric, Pill } from '../v2/ui';

type ChartPayload = {
  success?: boolean;
  available?: boolean;
  market?: string;
  source?: string;
  configured?: boolean;
  assetClass?: string;
  asOf?: number | null;
  candles?: PriceCandle[];
  error?: string;
};

type Frame = { label: string; unit: number; count: number };

const CRYPTO_FRAMES: Frame[] = [
  { label: '1m', unit: 1, count: 120 }, { label: '5m', unit: 5, count: 120 }, { label: '15m', unit: 15, count: 96 },
  { label: '1H', unit: 60, count: 72 }, { label: '4H', unit: 240, count: 60 }, { label: '일봉', unit: 1440, count: 90 },
  { label: '주봉', unit: 10080, count: 80 }, { label: '월봉', unit: 43200, count: 60 },
];
const EQUITY_FRAMES: Frame[] = [
  { label: '1m', unit: 1, count: 120 }, { label: '5m', unit: 5, count: 96 }, { label: '15m', unit: 15, count: 80 },
  { label: '1H', unit: 60, count: 60 }, { label: '일봉', unit: 1440, count: 90 }, { label: '주봉', unit: 10080, count: 80 }, { label: '월봉', unit: 43200, count: 60 },
];

const Candles = ({ candles }: { candles: PriceCandle[] }) => {
  const data = candles.filter((item) => [item.timestamp, item.open, item.high, item.low, item.close, item.volume].every(Number.isFinite));
  if (data.length < 2) return null;
  const width = 340;
  const top = 16;
  const priceBottom = 196;
  const volumeTop = 210;
  const bottom = 258;
  const left = 10;
  const right = 330;
  const slot = (right - left) / data.length;
  const bodyWidth = Math.max(1.4, Math.min(5.2, slot * 0.62));
  const rawMin = Math.min(...data.map((item) => item.low));
  const rawMax = Math.max(...data.map((item) => item.high));
  const pad = Math.max((rawMax - rawMin) * 0.07, rawMax * 0.0005);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const span = Math.max(max - min, 1e-9);
  const maxVolume = Math.max(...data.map((item) => item.volume), 1);
  const x = (index: number) => left + slot * (index + 0.5);
  const y = (value: number) => priceBottom - ((value - min) / span) * (priceBottom - top);
  const vy = (value: number) => bottom - (value / maxVolume) * (bottom - volumeTop);
  return (
    <svg viewBox={`0 0 ${width} 270`} className="h-[270px] w-full" role="img" aria-label="실제 OHLCV 캔들 차트">
      {[0, 1, 2, 3, 4].map((row) => { const gy = top + ((priceBottom - top) / 4) * row; return <line key={row} x1={left} x2={right} y1={gy} y2={gy} stroke="#edf0f2" strokeWidth="1" />; })}
      <line x1={left} x2={right} y1="204" y2="204" stroke="#e7ebee" strokeWidth="1" />
      {data.map((candle, index) => {
        const positive = candle.close >= candle.open;
        const color = positive ? '#0aa77d' : '#dc5a66';
        const openY = y(candle.open);
        const closeY = y(candle.close);
        return <g key={`${candle.timestamp}-${index}`}><line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="1" /><rect x={x(index) - bodyWidth / 2} y={Math.min(openY, closeY)} width={bodyWidth} height={Math.max(1.2, Math.abs(closeY - openY))} rx="0.6" fill={color} /><rect x={x(index) - bodyWidth / 2} y={vy(candle.volume)} width={bodyWidth} height={Math.max(1, bottom - vy(candle.volume))} fill={color} opacity="0.3" /></g>;
      })}
    </svg>
  );
};

const ChartOnly = ({ market, onBack }: { market: string; onBack: () => void }) => {
  const isEquity = /^KRX-\d{6}$/.test(market);
  const frames = isEquity ? EQUITY_FRAMES : CRYPTO_FRAMES;
  const [unit, setUnit] = useState(isEquity ? 1440 : 60);
  const frame = useMemo(() => frames.find((item) => item.unit === unit) ?? frames[0], [frames, unit]);
  const [payload, setPayload] = useState<ChartPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!frames.some((item) => item.unit === unit)) setUnit(isEquity ? 1440 : 60); }, [isEquity]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/market-chart?market=${encodeURIComponent(market)}&unit=${frame.unit}&count=${frame.count}`, { cache: 'no-store' })
      .then((response) => response.json() as Promise<ChartPayload>)
      .then((result) => { if (active) setPayload(result); })
      .catch(() => { if (active) setPayload({ success: false, available: false, error: '시장 데이터 요청 실패' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [market, frame.unit, frame.count]);

  const candles = payload?.candles ?? [];
  const last = candles[candles.length - 1];
  const first = candles[0];
  const change = first?.open > 0 && last ? last.close / first.open - 1 : null;

  return (
    <DetailShell title="시장 분석" subtitle="Canonical Decision Trace가 없는 시장은 실제 가격 데이터만 표시합니다. AI 판단을 임의 생성하지 않습니다." onBack={onBack}>
      <div className="rounded-[22px] border border-[#e8ecef] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-3"><div><div className="text-[12px] text-[#8c969f]">선택 시장</div><div className="mt-1 text-[24px] font-semibold tracking-[-0.04em]">{market}</div></div><span className="rounded-full bg-[#f1f3f5] px-3 py-1.5 text-[10px] font-semibold text-[#65717b]">NO DECISION TRACE</span></div>
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#f7f8f9] p-4"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#66727c]" /><div className="text-[12px] leading-5 text-[#6f7983]">이 종목은 시장 검색으로 선택됐지만 현재 decisionTape에는 대응하는 판단이 없습니다. 가격·거래량은 조회하되 Strategy/Council/Risk 판단은 없는 그대로 둡니다.</div></div>
      </div>

      <div className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">{frames.map((item) => <Pill key={item.unit} active={frame.unit === item.unit} onClick={() => setUnit(item.unit)}>{item.label}</Pill>)}</div>
      <div className="mt-3 overflow-hidden rounded-[22px] border border-[#e8ecef] bg-white">
        {loading ? <div className="p-4"><EmptyCard title="실제 차트 불러오는 중" body={`${market} ${frame.label} OHLCV를 가져오고 있습니다.`} /></div> : !payload?.available || candles.length < 2 ? <div className="p-4"><EmptyCard title="실제 가격 데이터 없음" body={payload?.error || '데이터가 없으며 임의 가격을 생성하지 않습니다.'} /></div> : <>
          <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-5"><div><div className="text-[11px] font-medium text-[#8a949d]">{payload.source ?? 'Market Data'} · 실제 OHLCV</div><div className="mt-1 text-[24px] font-semibold">{formatKrw(last?.close)}</div><div className="mt-1 text-[12px] font-semibold" style={{ color: (change ?? 0) >= 0 ? '#0aa77d' : '#dc5a66' }}>{pct(change, true)} · 표시 구간</div></div><div className="text-right text-[10px] leading-4 text-[#89939c]">최근 봉<br />{dateTime(payload.asOf ?? last?.timestamp)}</div></div>
          <Candles candles={candles} />
          <div className="grid grid-cols-3 gap-3 border-t border-[#eef1f3] px-5 py-4"><Metric label="시가 · 1개당" value={formatKrw(last?.open)} /><Metric label="종가 · 1개당" value={formatKrw(last?.close)} /><Metric label="거래량 · 개" value={last ? new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 2 }).format(last.volume) : '—'} /></div>
        </>}
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#edf0f2] bg-white p-4"><Database className="mt-0.5 h-4 w-4 shrink-0 text-[#69747e]" /><div className="text-[11px] leading-5 text-[#7d8791]">이 화면은 시장 탐색용 read-only 뷰입니다. 주문·Paper runtime·Council authority에는 영향을 주지 않습니다.</div></div>
    </DetailShell>
  );
};

export const MarketAnalysisV5 = ({ market, decisions, onSelectMarket, onCouncil, onBack }: {
  market: string | null;
  decisions: DecisionTapeItem[];
  onSelectMarket: (market: string) => void;
  onCouncil: () => void;
  onBack: () => void;
}) => {
  const selected = market ? decisions.find((item) => item.market === market) ?? null : decisions[0] ?? null;
  if (!market && !selected) return <DetailShell title="AI 리포트" subtitle="분석할 시장이 없습니다." onBack={onBack}><EmptyCard title="시장 선택 필요" body="시장 탭에서 종목을 선택하세요." /></DetailShell>;
  if (selected) return <AnalysisDetailV2 decisions={decisions} selected={selected} onSelect={(decision) => onSelectMarket(decision.market)} onCouncil={onCouncil} onBack={onBack} />;
  return <ChartOnly market={market!} onBack={onBack} />;
};
