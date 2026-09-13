import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  RefreshCw,
  ShieldCheck,
  Target,
} from 'lucide-react';
import type { DecisionTapeItem, OpenPosition, OperationsPayload } from './v2/types';
import { cn, dateTime, timeAgo } from './v2/types';
import {
  formatKrw,
  formatPercent,
  formatQuantity,
  positionFinancials,
  type MarkedOpenPosition,
} from './v2/financial';

const green = '#16845b';
const red = '#d14b55';
const amber = '#a46b17';
const blue = '#3767d6';
const ink = '#111318';
const card = 'rounded-[24px] border border-[#e7e9ed] bg-white';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const Metric = ({ label, value, accent, note }: { label: string; value: React.ReactNode; accent?: string; note?: React.ReactNode }) => (
  <div className="min-w-0">
    <div className="text-[9px] font-medium text-[#969ca4]">{label}</div>
    <div className="mt-1 truncate text-[15px] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: accent ?? ink }}>{value}</div>
    {note && <div className="mt-1 text-[9px] leading-4 text-[#a0a5ac]">{note}</div>}
  </div>
);

const Pill = ({ children, color = '#737b86' }: { children: React.ReactNode; color?: string }) => (
  <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold" style={{ color, borderColor: `${color}28`, background: `${color}0b` }}>{children}</span>
);

type OperationsWithCheckpoint = OperationsPayload & {
  checkpoint?: { savedAt?: number | null };
};

type PriceLevel = {
  key: string;
  label: string;
  value: number;
  color: string;
  emphasis?: boolean;
};

const latestDecisionFor = (operations: OperationsPayload | null, market: string) => (
  (operations?.decisionTape ?? [])
    .filter((item) => item.market?.toUpperCase() === market.toUpperCase())
    .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
);

const priceLocation = (position: OpenPosition, current: number | null) => {
  if (!finite(current)) return '현재가 미확인';
  const stop = position.stopLossPrice;
  const entry = finite(position.averageCost) ? position.averageCost : position.entryPrice;
  const tp1 = position.takeProfit1Price ?? position.takeProfitPrice;
  const tp2 = position.takeProfit2Price;
  if (finite(stop) && current <= stop) return '손절선 하회';
  if (finite(entry) && current < entry) return '진입가 아래';
  if (finite(tp1) && current < tp1) return '진입가 → TP1';
  if (finite(tp2) && current < tp2) return 'TP1 → TP2';
  if (finite(tp2) && current >= tp2) return 'TP2 상회';
  if (finite(tp1) && current >= tp1) return 'TP1 상회';
  return '보유 구간';
};

const targetDistance = (current: number | null, target: number | null | undefined) => (
  finite(current) && current > 0 && finite(target) ? (target - current) / current : null
);

const PriceTrack = ({ position, decision }: { position: OpenPosition; decision: DecisionTapeItem | null }) => {
  const marked = position as MarkedOpenPosition;
  const current = finite(marked.markPrice) ? marked.markPrice : null;
  const entry = finite(position.averageCost) ? position.averageCost : position.entryPrice;
  const stop = position.stopLossPrice;
  const tp1 = position.takeProfit1Price ?? position.takeProfitPrice;
  const tp2 = position.takeProfit2Price;
  const valueLow = decision?.microstructure?.valueAreaLow;
  const valueHigh = decision?.microstructure?.valueAreaHigh;
  const valueArea = finite(valueLow) && finite(valueHigh) && valueHigh >= valueLow
    ? { low: valueLow, high: valueHigh }
    : null;

  const levels = [
    finite(stop) ? { key: 'stop', label: 'SL', value: stop, color: red } : null,
    finite(entry) ? { key: 'entry', label: 'ENTRY', value: entry, color: ink } : null,
    finite(current) ? { key: 'current', label: 'NOW', value: current, color: blue, emphasis: true } : null,
    finite(tp1) ? { key: 'tp1', label: 'TP1', value: tp1, color: green } : null,
    finite(tp2) ? { key: 'tp2', label: 'TP2', value: tp2, color: green } : null,
  ].filter(Boolean) as PriceLevel[];

  const rangeValues = [...levels.map((item) => item.value), ...(valueArea ? [valueArea.low, valueArea.high] : [])];
  if (rangeValues.length < 2) return <div className="rounded-[18px] bg-[#f7f8fa] p-4 text-[10px] leading-5 text-[#8d939b]">가격 지도를 그릴 데이터가 충분하지 않습니다.</div>;
  const rawMin = Math.min(...rangeValues);
  const rawMax = Math.max(...rangeValues);
  const rawRange = Math.max(rawMax - rawMin, Math.max(Math.abs(rawMax), 1) * 0.002);
  const min = rawMin - rawRange * 0.06;
  const max = rawMax + rawRange * 0.06;
  const range = max - min;
  const leftOf = (value: number) => ((value - min) / range) * 100;

  return <div className="rounded-[20px] border border-[#eceef1] bg-[#fafbfc] p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[10px] font-semibold text-[#3a3f46]">Price map</div>
        <div className="mt-1 text-[9px] text-[#969ca4]">실행 포지션 보호가 + 현재 mark + 최신 Oracle 가격영역</div>
      </div>
      <Pill color={finite(current) && finite(stop) && current <= stop ? red : blue}>{priceLocation(position, current)}</Pill>
    </div>
    <div className="relative mx-2 mt-5 h-20">
      <div className="absolute left-0 right-0 top-10 h-[2px] rounded-full bg-[#dfe2e6]" />
      {valueArea && <div
        className="absolute top-[34px] h-3 rounded-full border border-[#d7dde6] bg-[#eef2f7]"
        style={{ left: `${leftOf(valueArea.low)}%`, width: `${Math.max(1, leftOf(valueArea.high) - leftOf(valueArea.low))}%` }}
      />}
      {levels.map((item) => <div key={item.key} className="absolute top-1 -translate-x-1/2" style={{ left: `${leftOf(item.value)}%` }}>
        <div className="text-center text-[8px] font-semibold" style={{ color: item.color }}>{item.label}</div>
        <div className={cn('mx-auto mt-1 w-[2px]', item.emphasis ? 'h-11' : 'h-8')} style={{ background: item.color }} />
      </div>)}
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">{levels.map((item) => <div key={item.key} className="flex items-center justify-between text-[9px]"><span className="font-semibold" style={{ color: item.color }}>{item.label}</span><span className="tabular-nums text-[#737a83]">{formatKrw(item.value)}</span></div>)}</div>
    <div className="mt-4 border-t border-[#e7eaee] pt-3">
      {valueArea ? <div className="flex items-start justify-between gap-4"><div><div className="text-[9px] font-semibold text-[#646c76]">관찰 적정 가격대 · Value Area</div><div className="mt-1 text-[9px] leading-4 text-[#969ca4]">미시구조 거래분포 기준이며 기업가치 적정가를 뜻하지 않습니다.</div></div><div className="shrink-0 text-right text-[10px] font-semibold tabular-nums text-[#3f4650]">{formatKrw(valueArea.low)}–{formatKrw(valueArea.high)}</div></div> : <div className="text-[9px] leading-4 text-[#969ca4]">현재 canonical microstructure에 Value Area 범위가 없습니다. 없는 가격대를 임의로 만들지 않고 Entry 기준만 표시합니다.</div>}
    </div>
  </div>;
};

const PositionCard = ({ position, operations }: { position: OpenPosition; operations: OperationsWithCheckpoint | null }) => {
  const financials = positionFinancials(position);
  const current = financials.markPrice;
  const decision = latestDecisionFor(operations, position.market);
  const tradeMap = decision?.tradeMap;
  const stop = position.stopLossPrice;
  const tp1 = position.takeProfit1Price ?? position.takeProfitPrice;
  const tp2 = position.takeProfit2Price;
  const checkpointAt = operations?.checkpoint?.savedAt ?? null;
  const portfolioEquity = operations?.portfolio?.equity;
  const portfolioWeight = finite(portfolioEquity) && portfolioEquity > 0 && financials.marketValue != null ? financials.marketValue / portfolioEquity : null;
  const pnlAccent = (financials.unrealizedPnl ?? 0) >= 0 ? green : red;
  const stopDistance = targetDistance(current, stop);
  const tp1Distance = targetDistance(current, tp1);

  return <section className={cn(card, 'overflow-hidden')}>
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><div className="text-[18px] font-semibold tracking-[-0.03em] text-[#15171c]">{position.market}</div><Pill color={blue}>PAPER</Pill></div>
          <div className="mt-1 text-[10px] text-[#969ca4]">매수 {dateTime(position.openedAt)} · {timeAgo(position.openedAt)}</div>
        </div>
        <Pill color={pnlAccent}>{financials.unrealizedReturn != null ? formatPercent(financials.unrealizedReturn, true) : 'P&L —'}</Pill>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-[9px] font-medium text-[#969ca4]">현재 가격 · Paper mark</div>
          <div className="mt-1 text-[30px] font-semibold tabular-nums tracking-[-0.045em] text-[#111318]">{formatKrw(current)}</div>
          <div className="mt-1 text-[9px] text-[#9ca1a8]">runtime snapshot {checkpointAt ? timeAgo(checkpointAt) : '시각 미확인'}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-[#969ca4]">평가손익</div>
          <div className="mt-1 text-[17px] font-semibold tabular-nums" style={{ color: pnlAccent }}>{formatKrw(financials.unrealizedPnl, true)}</div>
          <div className="mt-1 text-[9px] text-[#9ca1a8]">평가액 {formatKrw(financials.marketValue)}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-[#eef0f2] pt-4">
        <Metric label="투입원금 · Cost basis" value={formatKrw(financials.costBasis)} />
        <Metric label="포트폴리오 비중" value={formatPercent(portfolioWeight)} />
        <Metric label="현재 평가액" value={formatKrw(financials.marketValue)} />
        <Metric label="보유수량" value={formatQuantity(financials.quantity)} />
        <Metric label="진입가" value={formatKrw(position.entryPrice)} />
        <Metric label="평균단가" value={formatKrw(position.averageCost)} />
        <Metric label="손절가" value={formatKrw(stop)} accent={red} note={stopDistance != null ? `현재가 대비 ${formatPercent(stopDistance, true)}` : undefined} />
        <Metric label="1차 익절가" value={formatKrw(tp1)} accent={green} note={tp1Distance != null ? `현재가 대비 ${formatPercent(tp1Distance, true)}` : undefined} />
        <Metric label="2차 익절가" value={formatKrw(tp2)} accent={green} />
      </div>
    </div>

    <div className="border-t border-[#eef0f2] bg-[#fbfbfc] p-4"><PriceTrack position={position} decision={decision} /></div>

    <div className="border-t border-[#eef0f2] px-5 py-4">
      <div className="flex items-center gap-2"><Target className="h-4 w-4 text-[#606873]" /><div className="text-[11px] font-semibold text-[#343940]">현재 Oracle 계획</div></div>
      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
        <Metric label="Oracle Entry" value={formatKrw(tradeMap?.entryPrice)} />
        <Metric label="Oracle Stop" value={formatKrw(tradeMap?.stopLossPrice ?? tradeMap?.structuralInvalidationPrice)} accent={red} />
        <Metric label="Oracle TP1" value={formatKrw(tradeMap?.takeProfit1Price)} accent={green} />
        <Metric label="Oracle TP2" value={formatKrw(tradeMap?.takeProfit2Price)} accent={green} />
      </div>
      <div className="mt-3 rounded-[15px] bg-[#f7f8fa] px-3 py-3 text-[9px] leading-4 text-[#7d858e]">{decision?.primaryReason ?? decision?.reasons?.[0] ?? '최신 canonical decision 사유가 없습니다.'}</div>
    </div>
  </section>;
};

export const PositionMonitor = () => {
  const [operations, setOperations] = useState<OperationsWithCheckpoint | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/trading-status', { cache: 'no-store' });
      const payload = await response.json() as OperationsWithCheckpoint & { error?: string };
      if (!response.ok || payload.status === 'ERROR' || payload.status === 'UNAVAILABLE') {
        setError(payload.error ?? 'Trading status unavailable.');
      } else {
        setError(null);
      }
      setOperations(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Trading status unavailable.');
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
  const sorted = useMemo(() => [...positions].sort((a, b) => b.openedAt - a.openedAt), [positions]);
  const openCost = positions.reduce((sum, position) => sum + (positionFinancials(position).costBasis ?? 0), 0);
  const openValue = positions.reduce((sum, position) => sum + (positionFinancials(position).marketValue ?? 0), 0);
  const portfolioEquity = operations?.portfolio?.equity;
  const exposure = finite(portfolioEquity) && portfolioEquity > 0 ? openValue / portfolioEquity : null;

  return <>
    {!open && <button
      type="button"
      onClick={() => setOpen(true)}
      className="fixed bottom-[148px] right-4 z-[70] flex h-12 items-center gap-2 rounded-full border border-[#dfe3e7] bg-white px-4 text-[10px] font-semibold text-[#25292f] shadow-[0_8px_26px_rgba(16,20,24,0.12)] active:scale-[0.985]"
      aria-label="포지션 모니터 열기"
    >
      <BriefcaseBusiness className="h-4 w-4" />
      Positions · {positions.length}
    </button>}

    {open && <div className="fixed inset-0 z-[95] overflow-y-auto overscroll-contain bg-[#f6f7f9] text-[#111318]">
      <div className="sticky top-0 z-30 border-b border-[#e8ebee] bg-white/96 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e7ea] bg-white" aria-label="포지션 모니터 닫기"><ArrowLeft className="h-4 w-4" /></button>
            <div><div className="text-[9px] font-semibold tracking-[0.16em] text-[#9ba1a9]">POSITION CONTROL</div><div className="mt-0.5 text-[19px] font-semibold tracking-[-0.035em] text-[#15171c]">Open Paper Positions</div></div>
          </div>
          <button type="button" onClick={() => void load()} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e7ea] bg-white" aria-label="포지션 새로고침"><RefreshCw className={cn('h-4 w-4 text-[#626871]', loading && 'animate-spin')} /></button>
        </div>
      </div>

      <main className="px-4 pb-16 pt-4">
        <section className="grid grid-cols-2 gap-1.5 rounded-[20px] border border-[#e9eaed] bg-white p-2">
          <div className="rounded-[14px] bg-[#f7f8fa] px-3 py-3"><div className="text-[8px] text-[#9ca1a8]">Open</div><div className="mt-1 text-[12px] font-semibold text-[#34383e]">{positions.length}</div></div>
          <div className="rounded-[14px] bg-[#f7f8fa] px-3 py-3"><div className="text-[8px] text-[#9ca1a8]">Invested · Paper</div><div className="mt-1 truncate text-[11px] font-semibold text-[#34383e]">{positions.length ? formatKrw(openCost) : '—'}</div></div>
          <div className="rounded-[14px] bg-[#f7f8fa] px-3 py-3"><div className="text-[8px] text-[#9ca1a8]">Exposure</div><div className="mt-1 text-[11px] font-semibold text-[#34383e]">{formatPercent(exposure)}</div></div>
          <div className="rounded-[14px] bg-[#f7f8fa] px-3 py-3"><div className="text-[8px] text-[#9ca1a8]">Snapshot</div><div className="mt-1 text-[10px] font-semibold text-[#34383e]">{operations?.checkpoint?.savedAt ? timeAgo(operations.checkpoint.savedAt) : '—'}</div><div className="mt-1 text-[8px] text-[#9ca1a8]">{operations?.status ?? 'UNKNOWN'}</div></div>
        </section>

        {error && <section className="mt-3 flex gap-3 rounded-[20px] border border-[#f1d8da] bg-[#fff8f8] p-4"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c75961]" /><div><div className="text-[11px] font-semibold text-[#9e333b]">Position data warning</div><div className="mt-1 text-[9px] leading-4 text-[#99686d]">{error}</div></div></section>}

        <section className="mt-6 space-y-3">
          {sorted.map((position) => <PositionCard key={`${position.market}-${position.openedAt}`} position={position} operations={operations} />)}
          {!sorted.length && <div className={cn(card, 'p-6')}><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#6b747e]" /><div><div className="text-[12px] font-semibold text-[#30353c]">현재 열린 Paper 포지션이 없습니다.</div><div className="mt-1 text-[10px] leading-5 text-[#8a919a]">새 진입이 발생하면 투입원금, 포트폴리오 비중, 현재가, 매수시각, 진입가, SL, TP1/TP2, 평가손익, Oracle 가격지도를 여기에서 바로 확인할 수 있습니다.</div></div></div></div>}
        </section>
      </main>
    </div>}
  </>;
};