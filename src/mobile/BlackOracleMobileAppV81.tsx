import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Brain,
  Briefcase,
  ChevronRight,
  FileText,
  Home,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  Target,
} from 'lucide-react';
import type {
  ClosedTrade,
  DecisionTapeItem,
  EventsPayload,
  FactoryPayload,
  FactoryTop,
  LedgerEvent,
  OpenPosition,
  OperationsPayload,
  OperationalEvidence,
} from './v2/types';
import { actionKo, cn, dateTime, eventTypeKo, pct, reasonKo, regimeKo, roleKo, timeAgo } from './v2/types';
import { formatKrw } from './v2/financial';

const green = '#16845b';
const red = '#d14b55';
const amber = '#a46b17';
const blue = '#3767d6';
const ink = '#111318';
const page = '#f6f7f9';
const card = 'rounded-[24px] border border-[#e9eaed] bg-white';
const soft = 'rounded-[18px] border border-[#eceef1] bg-[#fbfbfc]';

type Tab = 'home' | 'portfolio' | 'positions' | 'activity' | 'more';
type Period = '1D' | '1W' | '1M' | 'ALL';
type FactoryRun = NonNullable<FactoryPayload['latestRun']> & { finished_at?: string };
type FactoryStatusPayload = Omit<FactoryPayload, 'latestRun'> & {
  latestRun?: FactoryRun | null;
  governance?: {
    automaticChampionPromotion?: boolean;
    automaticLiveDeployment?: boolean;
    humanApprovalRequired?: boolean;
  };
};
type ReplayPayload = {
  found?: boolean;
  completeThrough?: string;
  timeline?: LedgerEvent[];
  error?: string;
};
type ReplayTarget = { traceId: string; market: string | null; title: string };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const num = (value: number | null | undefined, digits = 2) => finite(value) ? value.toFixed(digits) : '—';
const percent = (value: number | null | undefined) => finite(value)
  ? `${Math.abs(value) <= 1 ? (value * 100).toFixed(1) : value.toFixed(1)}%`
  : '—';
const short = (value: string | null | undefined) => {
  const text = String(value ?? '').trim();
  return !text ? '—' : text.length > 28 ? `${text.slice(0, 17)}…${text.slice(-6)}` : text;
};
const tone = (value: string | null | undefined) => {
  const text = String(value ?? '').toUpperCase();
  if (['ENTER', 'BUY', 'APPROVE', 'PASS', 'CHAMPION_CANDIDATE', 'OK'].includes(text)) return green;
  if (['EXIT', 'SELL', 'REJECT', 'FAIL', 'LOSS', 'ERROR'].includes(text)) return red;
  return amber;
};
const traceIdOf = (event: LedgerEvent | null | undefined) => {
  for (const source of [event?.trace, event?.links].filter(Boolean) as Array<Record<string, unknown>>) {
    for (const key of ['traceId', 'trace_id', 'decisionTraceId', 'decision_trace_id']) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
};
const entryTraceIdOf = (event: LedgerEvent | null | undefined) => {
  for (const key of ['entryTraceId', 'entry_trace_id']) {
    const value = event?.links?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};
const phaseOf = (event: LedgerEvent) => {
  const type = String(event.eventType).toUpperCase();
  const name = String(event.eventName).toUpperCase();
  if (['EVIDENCE', 'STRATEGY', 'COUNCIL', 'RISK', 'ORDER', 'TRADE', 'OUTCOME'].includes(type)) {
    return `${type.slice(0, 1)}${type.slice(1).toLowerCase()}`;
  }
  if (name.includes('ARBITER')) return 'Arbiter';
  if (type === 'DECISION') return 'Decision';
  return null;
};

const Pill = ({ children, color = '#747b85' }: { children: React.ReactNode; color?: string }) => (
  <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold" style={{ color, borderColor: `${color}28`, background: `${color}0b` }}>{children}</span>
);
const Section = ({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) => (
  <div className="mb-3 flex items-end justify-between gap-4">
    <div><div className="text-[17px] font-semibold tracking-[-0.02em] text-[#15171c]">{title}</div>{subtitle && <div className="mt-1 text-[11px] leading-4 text-[#8b9098]">{subtitle}</div>}</div>
    {right}
  </div>
);
const Metric = ({ label, value, accent, note }: { label: string; value: React.ReactNode; accent?: string; note?: React.ReactNode }) => (
  <div className="min-w-0">
    <div className="text-[10px] font-medium text-[#959aa2]">{label}</div>
    <div className="mt-1 truncate text-[15px] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: accent ?? ink }}>{value}</div>
    {note && <div className="mt-1 text-[9px] leading-4 text-[#a0a5ac]">{note}</div>}
  </div>
);

const EquitySparkline = ({ points }: { points: Array<{ timestamp: number; equity: number }> }) => {
  const values = points.slice(-120).map((item) => item.equity).filter(Number.isFinite);
  if (values.length < 2) return <div className="h-24 rounded-[18px] bg-[#f6f7f9]" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const coords = values.map((value, index) => `${(index / (values.length - 1)) * 100},${72 - ((value - min) / range) * 62}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  return <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="h-24 w-full overflow-visible" aria-label="Equity curve">
    <polyline fill="none" stroke={up ? green : red} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={coords} vectorEffect="non-scaling-stroke" />
  </svg>;
};

const Header = ({ operations, loading, refresh }: { operations: OperationsPayload | null; loading: boolean; refresh: () => void }) => {
  const statusColor = operations?.status === 'OK' ? green : operations?.status === 'ERROR' ? red : amber;
  return <div className="sticky top-0 z-40 border-b border-[#eceef1] bg-white/95 backdrop-blur-xl">
    <div className="flex items-center justify-between px-5 pb-3 pt-[max(env(safe-area-inset-top),14px)]">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.22em] text-[#9a9fa7]">BLACK ORACLE</div>
        <div className="mt-1 flex items-center gap-2"><span className="text-[20px] font-semibold tracking-[-0.04em] text-[#121419]">Portfolio</span><span className="h-2 w-2 rounded-full" style={{ background: statusColor }} /></div>
      </div>
      <button type="button" onClick={refresh} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e8eaed] bg-white" aria-label="새로고침"><RefreshCw className={cn('h-4 w-4 text-[#626871]', loading && 'animate-spin')} /></button>
    </div>
  </div>;
};

const DecisionRow = ({ item, replay }: { item: DecisionTapeItem; replay: (item: DecisionTapeItem) => void }) => (
  <button type="button" onClick={() => replay(item)} className={cn(soft, 'w-full px-4 py-4 text-left')}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[14px] font-semibold text-[#1b1e24]">{item.market}</span><Pill color={tone(item.decision)}>{actionKo(item.decision)}</Pill></div><div className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#777e87]">{reasonKo(item.primaryReason ?? item.reasons?.[0])}</div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[#a0a5ac]"><span>{dateTime(item.timestamp)}</span><span>{item.router?.route ?? item.strategyDisposition ?? 'strategy —'}</span><span>Council {item.council?.verdict ?? '—'}</span></div></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#b2b6bc]" /></div>
  </button>
);

const EvidenceRow = ({ item }: { item: OperationalEvidence }) => (
  <div className="border-b border-[#eef0f2] py-3 last:border-b-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="line-clamp-2 text-[12px] font-medium leading-5 text-[#2a2d33]">{item.title || item.rationale || 'Untitled evidence'}</div><div className="mt-1 text-[9px] text-[#9a9fa7]">{item.source || item.source_type || 'source unavailable'} · {item.observed_at ? dateTime(item.observed_at) : 'time unavailable'}</div></div><Pill color={item.direction === 'BULLISH' ? green : item.direction === 'BEARISH' ? red : '#7f8790'}>{item.evidence_grade || item.direction || 'INFO'}</Pill></div></div>
);

const periodWindowMs: Record<Exclude<Period, 'ALL'>, number> = { '1D': 86_400_000, '1W': 7 * 86_400_000, '1M': 30 * 86_400_000 };
const HomeView = ({ operations, decisions, replay, goPositions, openPosition }: { operations: OperationsPayload | null; decisions: DecisionTapeItem[]; replay: (item: DecisionTapeItem) => void; goPositions: () => void; openPosition: (market: string) => void }) => {
  const [period, setPeriod] = useState<Period>('1M');
  const p = operations?.portfolio;
  const perf = operations?.performance;
  const latest = decisions[0];
  const alert = (perf?.maxDrawdownPct ?? 0) > 0.03 || (perf?.losses ?? 0) > (perf?.wins ?? 0);
  const curve = useMemo(() => {
    const all = operations?.equityCurve ?? [];
    if (period === 'ALL') return all;
    const cutoff = Date.now() - periodWindowMs[period];
    const filtered = all.filter((point) => point.timestamp >= cutoff);
    return filtered.length >= 2 ? filtered : all.slice(-80);
  }, [operations?.equityCurve, period]);
  return <main className="px-4 pb-28 pt-4">
    <section className={cn(card, 'overflow-hidden p-5')}>
      <div className="text-[11px] font-medium text-[#8b9098]">Total portfolio value</div>
      <div className="mt-2 text-[36px] font-semibold tabular-nums tracking-[-0.055em] text-[#101216]">{formatKrw(p?.equity)}</div>
      <div className="mt-2 flex items-center gap-2"><span className="text-[14px] font-semibold" style={{ color: (p?.dailyPnlPct ?? 0) >= 0 ? green : red }}>{pct(p?.dailyPnlPct, true)} today</span><span className="text-[11px] text-[#a1a6ad]">· {pct(perf?.totalReturnPct, true)} total</span></div>
      <div className="mt-4"><EquitySparkline points={curve} /></div>
      <div className="mt-1 flex justify-end gap-1">{(['1D', '1W', '1M', 'ALL'] as Period[]).map((item) => <button key={item} type="button" onClick={() => setPeriod(item)} className={cn('rounded-full px-2.5 py-1 text-[9px] font-semibold', period === item ? 'bg-[#17191e] text-white' : 'text-[#9a9fa7]')}>{item}</button>)}</div>
      <div className="mt-3 grid grid-cols-3 gap-4 border-t border-[#eef0f2] pt-4"><Metric label="Cash" value={formatKrw(p?.cash)} /><Metric label="Win rate" value={pct(perf?.winRate)} /><Metric label="Drawdown" value={pct(perf?.maxDrawdownPct)} accent={(perf?.maxDrawdownPct ?? 0) > 0.03 ? red : undefined} /></div>
    </section>

    <section className="mt-3 grid grid-cols-4 gap-1.5 rounded-[20px] border border-[#e9eaed] bg-white p-2">
      <div className="rounded-[14px] bg-[#f7f8fa] px-2 py-3"><div className="text-[8px] text-[#9ca1a8]">Runtime</div><div className="mt-1 truncate text-[10px] font-semibold" style={{ color: tone(operations?.status) }}>{operations?.status ?? 'WAITING'}</div></div>
      <div className="rounded-[14px] bg-[#f7f8fa] px-2 py-3"><div className="text-[8px] text-[#9ca1a8]">Regime</div><div className="mt-1 truncate text-[10px] font-semibold text-[#34383e]">{regimeKo(latest?.regime)}</div></div>
      <div className="rounded-[14px] bg-[#f7f8fa] px-2 py-3"><div className="text-[8px] text-[#9ca1a8]">Evidence</div><div className="mt-1 text-[10px] font-semibold text-[#34383e]">{operations?.ingestion?.evidenceActive ?? '—'}</div></div>
      <div className="rounded-[14px] bg-[#f7f8fa] px-2 py-3"><div className="text-[8px] text-[#9ca1a8]">Route</div><div className="mt-1 truncate text-[10px] font-semibold text-[#34383e]">{latest?.router?.route ?? latest?.strategyDisposition ?? '—'}</div></div>
    </section>

    {alert && <section className="mt-3 flex gap-3 rounded-[20px] border border-[#f1d8da] bg-[#fff8f8] p-4"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c75961]" /><div><div className="text-[12px] font-semibold text-[#9e333b]">Risk attention</div><div className="mt-1 text-[10px] leading-5 text-[#99686d]">최근 Paper 성과에서 손실 또는 낙폭 경고가 있습니다. 상세 성과와 포지션 보호 가격을 우선 확인하세요.</div></div></section>}

    <section className="mt-6"><Section title="Open positions" subtitle="현재 보유 중인 Paper 포지션" right={<button type="button" onClick={goPositions} className="text-[11px] font-semibold text-[#4c669e]">전체 보기</button>} />
      <div className="space-y-2">{(p?.openPositions ?? []).slice(0, 3).map((position) => <button type="button" onClick={() => openPosition(position.market)} key={position.market} className={cn(card, 'w-full p-4 text-left')}><div className="flex items-start justify-between"><div><div className="text-[15px] font-semibold text-[#17191e]">{position.market}</div><div className="mt-1 text-[10px] text-[#999ea6]">opened {timeAgo(position.openedAt)}</div></div><div className="flex items-center gap-2"><Pill color={blue}>PAPER</Pill><ChevronRight className="h-4 w-4 text-[#b5b9bf]" /></div></div><div className="mt-4 grid grid-cols-3 gap-3"><Metric label="Average" value={formatKrw(position.averageCost)} /><Metric label="Stop" value={formatKrw(position.stopLossPrice)} accent={red} /><Metric label="Take profit" value={formatKrw(position.takeProfit1Price ?? position.takeProfitPrice)} accent={green} /></div></button>)}{!p?.openPositions?.length && <div className={cn(card, 'p-5 text-[11px] text-[#8d9299]')}>현재 열린 포지션이 없습니다.</div>}</div>
    </section>

    <section className="mt-6"><Section title="Latest decision" subtitle="최근 Oracle 판단과 Council 상태" />{latest ? <DecisionRow item={latest} replay={replay} /> : <div className={cn(card, 'p-5 text-[11px] text-[#8d9299]')}>최근 판단 기록이 없습니다.</div>}</section>
  </main>;
};

const PortfolioView = ({ operations, replay }: { operations: OperationsPayload | null; replay: (trade: ClosedTrade) => void }) => {
  const p = operations?.portfolio;
  const perf = operations?.performance;
  const trades = operations?.recentTrades ?? [];
  return <main className="px-4 pb-28 pt-4">
    <section className={cn(card, 'p-5')}><div className="text-[11px] font-medium text-[#8b9098]">Performance</div><div className="mt-2 text-[34px] font-semibold tabular-nums tracking-[-0.05em] text-[#111318]">{pct(perf?.totalReturnPct, true)}</div><div className="mt-1 text-[12px] font-semibold" style={{ color: (perf?.netPnl ?? 0) >= 0 ? green : red }}>{formatKrw(perf?.netPnl)}</div><div className="mt-4"><EquitySparkline points={operations?.equityCurve ?? []} /></div></section>
    <section className="mt-3 grid grid-cols-2 gap-2"><div className={cn(card, 'p-4')}><Metric label="Win rate" value={pct(perf?.winRate)} /></div><div className={cn(card, 'p-4')}><Metric label="Profit factor" value={num(perf?.profitFactor)} /></div><div className={cn(card, 'p-4')}><Metric label="Expectancy" value={formatKrw(perf?.expectancy)} accent={(perf?.expectancy ?? 0) >= 0 ? green : red} /></div><div className={cn(card, 'p-4')}><Metric label="Max drawdown" value={pct(perf?.maxDrawdownPct)} accent={(perf?.maxDrawdownPct ?? 0) > 0.03 ? red : undefined} /></div></section>
    <section className={cn(card, 'mt-3 p-5')}><Section title="Capital" /><div className="grid grid-cols-3 gap-3"><Metric label="Equity" value={formatKrw(p?.equity)} /><Metric label="Cash" value={formatKrw(p?.cash)} /><Metric label="Realized" value={formatKrw(p?.realizedPnl)} accent={(p?.realizedPnl ?? 0) >= 0 ? green : red} /></div></section>
    <section className="mt-6"><Section title="Recent closed trades" subtitle="완료 거래에서 Decision Replay까지 연결" /><div className="space-y-2">{trades.slice(0, 10).map((item) => <button type="button" key={item.id} onClick={() => replay(item)} className={cn(card, 'w-full p-4 text-left')}><div className="flex items-start justify-between"><div><div className="text-[14px] font-semibold text-[#1b1e24]">{item.market}</div><div className="mt-1 text-[9px] text-[#9a9fa7]">{dateTime(item.closedAt)} · {short(item.strategyVersion)}</div></div><div className="text-right"><div className="text-[14px] font-semibold" style={{ color: item.netPnl >= 0 ? green : red }}>{formatKrw(item.netPnl)}</div><div className="mt-1 text-[10px]" style={{ color: item.netPnl >= 0 ? green : red }}>{percent(item.returnPct)}</div></div></div><div className="mt-3 flex items-center justify-between border-t border-[#eef0f2] pt-3"><span className="line-clamp-1 text-[10px] text-[#858b93]">{reasonKo(item.exitReason)}</span><ChevronRight className="h-4 w-4 text-[#b5b9bf]" /></div></button>)}{!trades.length && <div className={cn(card, 'p-5 text-[11px] text-[#8d9299]')}>완료된 거래가 없습니다.</div>}</div></section>
  </main>;
};

const PositionsView = ({ operations, openPosition }: { operations: OperationsPayload | null; openPosition: (market: string) => void }) => {
  const positions = operations?.portfolio?.openPositions ?? [];
  const decisions = operations?.decisionTape ?? [];
  return <main className="px-4 pb-28 pt-4">
    <Section title="Positions" subtitle="현재 운용 중인 포지션과 보호 가격" right={<Pill color={blue}>{positions.length} OPEN</Pill>} />
    <div className="space-y-3">{positions.map((position) => {
      const decision = decisions.find((item) => item.market === position.market);
      return <button type="button" onClick={() => openPosition(position.market)} key={position.market} className={cn(card, 'w-full p-5 text-left')}><div className="flex items-start justify-between"><div><div className="text-[18px] font-semibold tracking-[-0.025em] text-[#15171c]">{position.market}</div><div className="mt-1 text-[10px] text-[#999ea6]">opened {timeAgo(position.openedAt)}</div></div><div className="flex items-center gap-2"><Pill color={tone(decision?.decision)}>{decision ? actionKo(decision.decision) : 'ACTIVE'}</Pill><ChevronRight className="h-4 w-4 text-[#b5b9bf]" /></div></div><div className="mt-4 rounded-[16px] bg-[#f7f8fa] px-3 py-2.5 text-[10px] leading-5 text-[#707781]">{decision ? reasonKo(decision.primaryReason ?? decision.reasons?.[0]) : '최근 연결 판단이 확인되지 않았습니다.'}</div><div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#eef0f2] pt-4"><Metric label="Entry" value={formatKrw(position.entryPrice)} /><Metric label="Stop" value={formatKrw(position.stopLossPrice)} accent={red} /><Metric label="TP1" value={formatKrw(position.takeProfit1Price ?? position.takeProfitPrice)} accent={green} /></div></button>;
    })}{!positions.length && <div className={cn(card, 'p-6 text-[11px] leading-5 text-[#8d9299]')}>현재 열린 포지션이 없습니다. 새로운 진입이 발생하면 진입가·수량·SL/TP와 연결 판단을 여기서 확인할 수 있습니다.</div>}</div>
  </main>;
};

const ProtectionMap = ({ position }: { position: OpenPosition }) => {
  const levels = [
    { key: 'stop', label: 'SL', value: position.stopLossPrice, color: red },
    { key: 'entry', label: 'ENTRY', value: position.entryPrice || position.averageCost, color: ink },
    { key: 'tp1', label: 'TP1', value: position.takeProfit1Price ?? position.takeProfitPrice, color: green },
    { key: 'tp2', label: 'TP2', value: position.takeProfit2Price, color: green },
  ].filter((item): item is { key: string; label: string; value: number; color: string } => finite(item.value));
  if (levels.length < 2) return <div className="rounded-[16px] bg-[#f7f8fa] p-4 text-[10px] text-[#8d9299]">보호 가격 범위를 그릴 데이터가 충분하지 않습니다.</div>;
  const min = Math.min(...levels.map((item) => item.value));
  const max = Math.max(...levels.map((item) => item.value));
  const range = Math.max(1, max - min);
  return <div className="rounded-[18px] bg-[#f7f8fa] p-4"><div className="relative mx-2 h-16"><div className="absolute left-0 right-0 top-8 h-[2px] rounded-full bg-[#dfe2e6]" />{levels.map((item) => {
    const left = ((item.value - min) / range) * 100;
    return <div key={item.key} className="absolute top-3 -translate-x-1/2" style={{ left: `${left}%` }}><div className="text-center text-[8px] font-semibold" style={{ color: item.color }}>{item.label}</div><div className="mx-auto mt-1 h-7 w-[2px]" style={{ background: item.color }} /></div>;
  })}</div><div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2">{levels.map((item) => <div key={item.key} className="flex items-center justify-between text-[9px]"><span className="font-medium" style={{ color: item.color }}>{item.label}</span><span className="tabular-nums text-[#737a83]">{formatKrw(item.value)}</span></div>)}</div><div className="mt-3 text-[9px] leading-4 text-[#9ca1a8]">현재 시장가는 현재 운영 payload에 포함되지 않아 표시하지 않습니다.</div></div>;
};

const PositionDetailView = ({ position, operations, back, replay }: { position: OpenPosition; operations: OperationsPayload | null; back: () => void; replay: (item: DecisionTapeItem) => void }) => {
  const decision = useMemo(() => (operations?.decisionTape ?? []).find((item) => item.market === position.market) ?? null, [operations?.decisionTape, position.market]);
  const evidence = useMemo(() => (operations?.evidenceFlow ?? []).filter((item) => !item.market || item.market === position.market).slice(0, 6), [operations?.evidenceFlow, position.market]);
  const council = decision?.council;
  const tradeMap = decision?.tradeMap;
  const forecast = decision?.forecast;
  return <div className="min-h-[100dvh] bg-[#f6f7f9] text-[#111318]">
    <div className="sticky top-0 z-40 border-b border-[#eceef1] bg-white/95 px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)] backdrop-blur-xl"><div className="flex items-center gap-3"><button type="button" onClick={back} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e8eaed] bg-white"><ArrowLeft className="h-4 w-4 text-[#616872]" /></button><div className="min-w-0"><div className="text-[10px] font-semibold tracking-[0.14em] text-[#9a9fa7]">OPEN POSITION</div><div className="mt-1 flex items-center gap-2"><div className="truncate text-[19px] font-semibold tracking-[-0.03em]">{position.market}</div><Pill color={blue}>PAPER</Pill></div></div></div></div>
    <main className="px-4 pb-16 pt-4">
      <section className={cn(card, 'p-5')}><div className="flex items-start justify-between"><div><div className="text-[10px] text-[#969ba3]">Position opened</div><div className="mt-1 text-[13px] font-semibold text-[#33373d]">{dateTime(position.openedAt)}</div></div><Pill color={tone(decision?.decision)}>{decision ? actionKo(decision.decision) : 'ACTIVE'}</Pill></div><div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-[#eef0f2] pt-4"><Metric label="Entry" value={formatKrw(position.entryPrice)} /><Metric label="Average cost" value={formatKrw(position.averageCost)} /><Metric label="Quantity" value={num(position.quantity, 5)} /><Metric label="Current P&L" value="확인되지 않음" note="current price unavailable" /></div></section>

      <section className="mt-6"><Section title="Protection map" subtitle="손실 제한과 목표 가격을 먼저 확인" /><ProtectionMap position={position} /></section>

      <section className={cn(card, 'mt-6 p-5')}><div className="flex items-center gap-2"><Target className="h-4 w-4 text-[#5d6670]" /><div className="text-[14px] font-semibold">Why this position exists</div></div><div className="mt-3 text-[11px] leading-6 text-[#6f7680]">{decision ? reasonKo(decision.primaryReason ?? decision.reasons?.[0]) : '이 포지션과 연결된 최근 Decision이 확인되지 않았습니다.'}</div><div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#eef0f2] pt-4"><Metric label="Strategy route" value={decision?.router?.route ?? decision?.strategyDisposition ?? '—'} /><Metric label="Decision confidence" value={percent(decision?.confidence)} /><Metric label="Regime" value={regimeKo(decision?.regime)} /><Metric label="Oracle score" value={num(decision?.oracleTradeScore, 1)} /></div></section>

      <section className={cn(card, 'mt-3 p-5')}><div className="flex items-center gap-2"><Brain className="h-4 w-4 text-[#5d6670]" /><div className="text-[14px] font-semibold">Forecast & trade map</div></div><div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5"><Metric label="Forecast" value={forecast?.available ? forecast.direction : 'UNAVAILABLE'} /><Metric label="Forecast conf." value={percent(forecast?.confidence)} /><Metric label="R:R to TP1" value={num(tradeMap?.riskReward1)} /><Metric label="R:R to TP2" value={num(tradeMap?.riskReward2)} /></div>{(forecast?.reasons?.length || tradeMap?.reasons?.length) ? <div className="mt-4 rounded-[16px] bg-[#f7f8fa] p-4 text-[10px] leading-5 text-[#707781]">{(forecast?.reasons ?? tradeMap?.reasons ?? []).slice(0, 3).map((reason, index) => <div key={`${reason}-${index}`}>• {reasonKo(reason)}</div>)}</div> : null}</section>

      <section className={cn(card, 'mt-3 p-5')}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#5d6670]" /><div className="text-[14px] font-semibold">Council</div></div><Pill color={operations?.council?.executionAuthority ? red : green}>{operations?.council?.executionAuthority ? 'EXECUTION' : 'SHADOW'}</Pill></div><div className="mt-4 flex items-end justify-between"><div><div className="text-[9px] text-[#9a9fa7]">Verdict</div><div className="mt-1 text-[24px] font-semibold tracking-[-0.03em]" style={{ color: tone(council?.verdict) }}>{council?.verdict ?? 'UNAVAILABLE'}</div></div><div className="grid grid-cols-3 gap-3 text-center"><div><div className="text-[8px] text-[#9ca1a8]">Approve</div><div className="mt-1 text-[12px] font-semibold">{council?.approveCount ?? 0}</div></div><div><div className="text-[8px] text-[#9ca1a8]">Caution</div><div className="mt-1 text-[12px] font-semibold">{council?.cautionCount ?? 0}</div></div><div><div className="text-[8px] text-[#9ca1a8]">Reject</div><div className="mt-1 text-[12px] font-semibold">{council?.rejectCount ?? 0}</div></div></div></div>{council?.members?.length ? <details className="mt-4 border-t border-[#eef0f2] pt-3"><summary className="cursor-pointer text-[10px] font-semibold text-[#626971]">멤버 의견 보기</summary><div className="mt-2">{council.members.slice(0, 6).map((member, index) => <div key={`${member.role}-${index}`} className="flex items-start justify-between gap-3 border-b border-[#eef0f2] py-2.5 last:border-b-0"><div className="min-w-0"><div className="text-[10px] font-medium text-[#35383e]">{roleKo(member.role)}</div><div className="mt-0.5 line-clamp-2 text-[9px] leading-4 text-[#989da5]">{member.reasons?.[0] || '별도 근거 없음'}</div></div><Pill color={tone(member.vote)}>{actionKo(member.vote)}</Pill></div>)}</div></details> : <div className="mt-3 text-[10px] text-[#969ba3]">멤버별 표결은 확인되지 않습니다.</div>}</section>

      <section className="mt-6"><Section title="Attached evidence" subtitle={`${evidence.length} items linked to this market`} /><div className={cn(card, 'px-4')}>{evidence.length ? evidence.map((item) => <EvidenceRow key={item.id} item={item} />) : <div className="py-5 text-[11px] text-[#8d9299]">이 종목에 연결된 활성 Evidence가 확인되지 않습니다.</div>}</div></section>

      <section className="mt-6"><Section title="Decision replay" subtitle="진입 판단의 canonical lineage 확인" />{decision ? <button type="button" onClick={() => replay(decision)} className="flex w-full items-center justify-between rounded-[20px] bg-[#17191e] px-4 py-4 text-left text-white"><div className="flex items-center gap-3"><FileText className="h-4 w-4 text-white/70" /><div><div className="text-[12px] font-semibold">Open Decision Replay</div><div className="mt-1 text-[9px] text-white/50">Evidence → Strategy → Council → Risk → Execution</div></div></div><ChevronRight className="h-4 w-4 text-white/50" /></button> : <div className={cn(card, 'p-4 text-[10px] text-[#8d9299]')}>Replay를 열 수 있는 연결 Decision이 없습니다.</div>}</section>
    </main>
  </div>;
};

const ActivityView = ({ operations, decisions, replayDecision, replayTrade }: { operations: OperationsPayload | null; decisions: DecisionTapeItem[]; replayDecision: (item: DecisionTapeItem) => void; replayTrade: (item: ClosedTrade) => void }) => (
  <main className="px-4 pb-28 pt-4"><section><Section title="Decisions" subtitle="최근 판단과 canonical replay" /><div className="space-y-2">{decisions.slice(0, 8).map((item) => <DecisionRow key={`${item.market}-${item.timestamp}`} item={item} replay={replayDecision} />)}{!decisions.length && <div className={cn(card, 'p-5 text-[11px] text-[#8d9299]')}>최근 판단 기록이 없습니다.</div>}</div></section><section className="mt-6"><Section title="Evidence" subtitle="최근 운영 payload로 들어온 근거" right={<span className="text-[10px] font-medium text-[#9ba0a7]">{operations?.ingestion?.evidenceActive ?? 0} active</span>} /><div className={cn(card, 'px-4')}>{(operations?.evidenceFlow ?? []).slice(0, 8).map((item) => <EvidenceRow key={item.id} item={item} />)}{!(operations?.evidenceFlow?.length) && <div className="py-5 text-[11px] text-[#8d9299]">표시 가능한 활성 Evidence가 없습니다.</div>}</div></section><section className="mt-6"><Section title="Closed trades" subtitle="최근 실행 결과" /><div className="space-y-2">{(operations?.recentTrades ?? []).slice(0, 6).map((trade) => <button type="button" key={trade.id} onClick={() => replayTrade(trade)} className={cn(card, 'flex w-full items-center justify-between p-4 text-left')}><div><div className="text-[13px] font-semibold text-[#1b1e24]">{trade.market}</div><div className="mt-1 text-[9px] text-[#9a9fa7]">{dateTime(trade.closedAt)} · {short(trade.strategyVersion)}</div></div><div className="flex items-center gap-2"><div className="text-right"><div className="text-[13px] font-semibold" style={{ color: trade.netPnl >= 0 ? green : red }}>{formatKrw(trade.netPnl)}</div><div className="mt-1 text-[9px]" style={{ color: trade.netPnl >= 0 ? green : red }}>{percent(trade.returnPct)}</div></div><ChevronRight className="h-4 w-4 text-[#b5b9bf]" /></div></button>)}</div></section></main>
);

const Candidate = ({ item, index }: { item: FactoryTop; index: number }) => (
  <div className="border-b border-[#eef0f2] py-4 last:border-b-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[10px] text-[#a0a5ac]">#{index + 1} · {short(item.genome.id)}</div><div className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-[#272a30]">{item.hypothesis?.thesis || item.genome.indicators.join(' · ') || 'Strategy candidate'}</div></div><Pill color={item.evaluation.hardGatePassed ? green : red}>{item.evaluation.lifecycle ?? (item.evaluation.hardGatePassed ? 'PASS' : 'REJECT')}</Pill></div><div className="mt-3 grid grid-cols-3 gap-3"><Metric label="Score" value={num(item.evaluation.score, 1)} /><Metric label="Sharpe" value={num(item.metrics.sharpe)} /><Metric label="Max DD" value={percent(item.metrics.maxDrawdownPct)} /></div></div>
);
const MoreView = ({ operations, factory, events }: { operations: OperationsPayload | null; factory: FactoryStatusPayload | null; events: LedgerEvent[] }) => {
  const latest = factory?.latestRun;
  const decision = operations?.decisionTape?.[0];
  const council = decision?.council ?? operations?.council?.deterministicLatest ?? operations?.council?.latest;
  const latestCouncilEvent = events.find((event) => event.eventType === 'COUNCIL');
  return <main className="px-4 pb-28 pt-4"><section className={cn(card, 'p-5')}><Section title="System" subtitle="보조 정보는 메인에서 분리" /><div className="grid grid-cols-2 gap-x-4 gap-y-5"><Metric label="Runtime" value={operations?.status ?? 'WAITING'} accent={tone(operations?.status)} /><Metric label="Cycles" value={operations?.loop?.cycleCount ?? '—'} /><Metric label="Strategy version" value={short(operations?.strategyVersion)} /><Metric label="Evidence active" value={operations?.ingestion?.evidenceActive ?? '—'} /></div></section><section className={cn(card, 'mt-3 p-5')}><Section title="Council" subtitle="현재는 execution authority와 advisory를 분리" right={<Pill color={operations?.council?.executionAuthority ? red : green}>{operations?.council?.executionAuthority ? 'EXECUTION' : 'SHADOW'}</Pill>} /><div className="flex items-end justify-between"><div><div className="text-[10px] text-[#9a9fa7]">Latest verdict</div><div className="mt-1 text-[25px] font-semibold tracking-[-0.03em]" style={{ color: tone(council?.verdict) }}>{council?.verdict ?? 'UNAVAILABLE'}</div></div><div className="text-right text-[10px] text-[#9a9fa7]">{decision?.market ?? latestCouncilEvent?.market ?? 'market —'}</div></div><div className="mt-4 rounded-[16px] bg-[#f7f8fa] p-4 text-[11px] leading-5 text-[#6f7680]">{council?.summary || latestCouncilEvent?.summary || 'Council summary가 아직 기록되지 않았습니다.'}</div></section><section className={cn(card, 'mt-3 p-5')}><Section title="Strategy Factory" subtitle="후보 연구와 현재 Paper 운용은 분리" right={<Pill color={factory?.governance?.automaticLiveDeployment ? red : blue}>{factory?.governance?.automaticLiveDeployment ? 'AUTO' : 'MANUAL'}</Pill>} /><div className="grid grid-cols-3 gap-3"><Metric label="Market" value={latest?.market ?? '—'} /><Metric label="Candidates" value={latest?.candidate_count ?? 0} /><Metric label="Timeframe" value={latest ? `${latest.timeframe_minutes}m` : '—'} /></div><div className="mt-3 border-t border-[#eef0f2]">{(latest?.top_results ?? []).slice(0, 5).map((item, index) => <Candidate key={item.genome.id} item={item} index={index} />)}{!(latest?.top_results?.length) && <div className="py-5 text-[11px] text-[#8d9299]">표시 가능한 Strategy Factory 결과가 없습니다.</div>}</div></section></main>;
};

const phases = ['Evidence', 'Strategy', 'Council', 'Arbiter', 'Decision', 'Risk', 'Order', 'Trade', 'Outcome'];
const ReplayView = ({ target, payload, loading, back }: { target: ReplayTarget; payload: ReplayPayload | null; loading: boolean; back: () => void }) => {
  const timeline = payload?.timeline ?? [];
  const groups = useMemo(() => { const map = new Map<string, LedgerEvent[]>(); timeline.forEach((event) => { const phase = phaseOf(event); if (phase) map.set(phase, [...(map.get(phase) ?? []), event]); }); return map; }, [timeline]);
  const complete = payload?.found && timeline.length > 0;
  const strategy = timeline.find((event) => event.eventType === 'STRATEGY');
  const decision = timeline.find((event) => event.eventType === 'DECISION');
  const council = timeline.find((event) => event.eventType === 'COUNCIL');
  const outcome = [...timeline].reverse().find((event) => event.eventType === 'OUTCOME');
  return <div className="min-h-[100dvh] bg-[#f6f7f9] text-[#111318]"><div className="sticky top-0 z-40 border-b border-[#eceef1] bg-white/95 px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)] backdrop-blur-xl"><div className="flex items-center gap-3"><button type="button" onClick={back} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e8eaed] bg-white"><ArrowLeft className="h-4 w-4 text-[#616872]" /></button><div className="min-w-0"><div className="text-[10px] font-semibold tracking-[0.14em] text-[#9a9fa7]">DECISION REPLAY</div><div className="mt-1 truncate text-[18px] font-semibold tracking-[-0.025em]">{target.title}</div></div></div></div><main className="px-4 pb-16 pt-4">{loading && <div className={cn(card, 'p-5 text-[11px] text-[#858b93]')}>Canonical trace를 불러오는 중입니다.</div>}{!loading && !complete && <div className="rounded-[20px] border border-[#efdfbd] bg-[#fffaf1] p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#a46b17]" /><div><div className="text-[12px] font-semibold text-[#855713]">Canonical replay unavailable</div><div className="mt-1 text-[10px] leading-5 text-[#8b7959]">trace_id로 연결된 이력이 없습니다. 추정 이벤트를 같은 Replay처럼 표시하지 않습니다.</div></div></div></div>}{!loading && complete && <><section className={cn(card, 'p-5')}><Section title="What happened" subtitle="결론을 먼저, 내부 판단은 아래에서" right={<Pill color={outcome ? green : amber}>{payload?.completeThrough ?? 'CURRENT'}</Pill>} /><div className="space-y-2 text-[11px] leading-5 text-[#737a83]"><div><span className="font-medium text-[#353940]">Strategy</span> · {strategy?.strategyId ?? strategy?.summary ?? 'not recorded'}</div><div><span className="font-medium text-[#353940]">Decision</span> · {decision?.action ? actionKo(decision.action) : decision?.eventName ?? 'not recorded'}{decision?.reason ? ` — ${reasonKo(decision.reason)}` : ''}</div><div><span className="font-medium text-[#353940]">Council</span> · {council?.summary || council?.reason || 'not recorded'}</div><div><span className="font-medium text-[#353940]">Outcome</span> · {outcome?.summary || outcome?.reason || '아직 Outcome 없음'}</div></div></section><section className="mt-6"><Section title="Decision path" subtitle="Evidence → Strategy → Council → Risk → Execution → Outcome" /><div className="relative pl-6 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-[1px] before:bg-[#e2e4e8]">{phases.map((phase) => { const items = groups.get(phase) ?? []; const primary = items[0]; return <div key={phase} className="relative mb-3"><span className={cn('absolute -left-6 top-5 h-3.5 w-3.5 rounded-full border-2 bg-[#f6f7f9]', primary ? 'border-[#7a828c]' : 'border-[#d7dade]')} /><div className={cn(card, 'p-4', !primary && 'opacity-60')}><div className="flex items-start justify-between"><div><div className="text-[12px] font-semibold text-[#292c31]">{phase}</div>{primary && <div className="mt-1 text-[9px] text-[#a0a5ac]">{dateTime(primary.occurredAt)} · {items.length} event{items.length === 1 ? '' : 's'}</div>}</div>{primary ? <Pill color={primary.executionAuthority ? red : '#77808a'}>{primary.executionAuthority ? 'EXECUTION' : 'OBSERVED'}</Pill> : <Pill>NOT RECORDED</Pill>}</div>{primary && <div className="mt-3 text-[10px] leading-5 text-[#77828a]">{primary.summary || reasonKo(primary.reason) || primary.eventName}</div>}</div></div>; })}</div></section><details className={cn(card, 'mt-6 overflow-hidden')}><summary className="cursor-pointer px-4 py-4 text-[11px] font-semibold text-[#666d76]">Raw canonical trace · {timeline.length} events</summary><div className="border-t border-[#eef0f2] px-4 py-2">{timeline.map((event) => <div key={event.id || event.eventKey} className="border-b border-[#eef0f2] py-3 last:border-b-0"><div className="flex justify-between gap-3"><div><div className="text-[10px] font-semibold text-[#474c53]">{event.eventName}</div><div className="mt-1 text-[8px] text-[#59636b]">{eventTypeKo(event.eventType)} · {dateTime(event.occurredAt)}</div></div><span className="text-[8px] text-[#59636b]">{event.authority}</span></div></div>)}</div></details></>}</main></div>;
};

const BottomNav = ({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) => {
  const items: Array<[Tab, string, React.ComponentType<{ className?: string }>]> = [['home', 'Home', Home], ['portfolio', 'Portfolio', BarChart3], ['positions', 'Positions', Briefcase], ['activity', 'Activity', Activity], ['more', 'More', MoreHorizontal]];
  return <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e8eaed] bg-white/95 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur-xl"><div className="grid grid-cols-5 px-2 pt-2">{items.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setTab(id)} className="flex flex-col items-center gap-1 py-1.5"><Icon className={cn('h-[18px] w-[18px]', tab === id ? 'text-[#17191e]' : 'text-[#a5aab1]')} /><span className={cn('text-[9px] font-medium', tab === id ? 'text-[#17191e]' : 'text-[#a5aab1]')}>{label}</span></button>)}</div></div>;
};

export const BlackOracleMobileApp = () => {
  const [tab, setTab] = useState<Tab>('home');
  const [operations, setOperations] = useState<OperationsPayload | null>(null);
  const [factory, setFactory] = useState<FactoryStatusPayload | null>(null);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<ReplayTarget | null>(null);
  const [replay, setReplay] = useState<ReplayPayload | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [positionMarket, setPositionMarket] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, fac, evt] = await Promise.allSettled([
        fetch('/api/trading-status', { cache: 'no-store' }).then((r) => r.json() as Promise<OperationsPayload>),
        fetch('/api/strategy-factory-status', { cache: 'no-store' }).then((r) => r.json() as Promise<FactoryStatusPayload>),
        fetch('/api/events?limit=500', { cache: 'no-store' }).then((r) => r.json() as Promise<EventsPayload>),
      ]);
      if (ops.status === 'fulfilled') setOperations(ops.value);
      if (fac.status === 'fulfilled') setFactory(fac.value);
      if (evt.status === 'fulfilled') setEvents(evt.value.events ?? []);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const sortedEvents = useMemo(() => [...events].sort((a, b) => b.occurredAt - a.occurredAt), [events]);
  const decisions = useMemo(() => [...(operations?.decisionTape ?? [])].sort((a, b) => b.timestamp - a.timestamp), [operations?.decisionTape]);
  const selectedPosition = useMemo(() => (operations?.portfolio?.openPositions ?? []).find((position) => position.market === positionMarket) ?? null, [operations?.portfolio?.openPositions, positionMarket]);

  const openTrace = useCallback(async (next: ReplayTarget) => {
    setTarget(next); setReplay(null); setReplayLoading(true);
    try {
      const runtimeId = sortedEvents.find((event) => traceIdOf(event) === next.traceId)?.runtimeId;
      const query = new URLSearchParams({ traceId: next.traceId });
      if (runtimeId) query.set('runtimeId', runtimeId);
      const response = await fetch(`/api/decision-replay?${query.toString()}`, { cache: 'no-store' });
      setReplay(await response.json() as ReplayPayload);
    } catch (error) {
      setReplay({ found: false, timeline: [], error: error instanceof Error ? error.message : 'Decision Replay read failed.' });
    } finally { setReplayLoading(false); }
  }, [sortedEvents]);
  const replayDecision = useCallback((item: DecisionTapeItem) => {
    const event = sortedEvents.filter((row) => row.market === item.market && traceIdOf(row)).map((row) => ({ row, distance: Math.abs(row.occurredAt - item.timestamp) })).filter((row) => row.distance <= 10 * 60_000).sort((a, b) => a.distance - b.distance)[0]?.row;
    const traceId = traceIdOf(event);
    if (!traceId) { setTarget({ traceId: 'unavailable', market: item.market, title: `${item.market} · ${actionKo(item.decision)}` }); setReplay({ found: false, timeline: [], error: 'Canonical trace_id unavailable.' }); return; }
    void openTrace({ traceId, market: item.market, title: `${item.market} · ${actionKo(item.decision)}` });
  }, [openTrace, sortedEvents]);
  const replayTrade = useCallback((trade: ClosedTrade) => {
    const outcome = sortedEvents.filter((row) => row.market === trade.market && row.eventType === 'OUTCOME').map((row) => ({ row, distance: Math.abs(row.occurredAt - trade.closedAt) })).sort((a, b) => a.distance - b.distance)[0]?.row;
    const traceId = entryTraceIdOf(outcome) ?? traceIdOf(outcome);
    if (!traceId) { setTarget({ traceId: 'unavailable', market: trade.market, title: `${trade.market} · ${formatKrw(trade.netPnl)}` }); setReplay({ found: false, timeline: [], error: 'Outcome에 연결된 entry trace가 없습니다.' }); return; }
    void openTrace({ traceId, market: trade.market, title: `${trade.market} · ${formatKrw(trade.netPnl)}` });
  }, [openTrace, sortedEvents]);

  if (target) return <ReplayView target={target} payload={replay} loading={replayLoading} back={() => { setTarget(null); setReplay(null); }} />;
  if (selectedPosition) return <PositionDetailView position={selectedPosition} operations={operations} back={() => setPositionMarket(null)} replay={replayDecision} />;

  return <div className="min-h-[100dvh] text-[#111318]" style={{ background: page }}><Header operations={operations} loading={loading} refresh={() => void load()} />{tab === 'home' && <HomeView operations={operations} decisions={decisions} replay={replayDecision} goPositions={() => setTab('positions')} openPosition={setPositionMarket} />}{tab === 'portfolio' && <PortfolioView operations={operations} replay={replayTrade} />}{tab === 'positions' && <PositionsView operations={operations} openPosition={setPositionMarket} />}{tab === 'activity' && <ActivityView operations={operations} decisions={decisions} replayDecision={replayDecision} replayTrade={replayTrade} />}{tab === 'more' && <MoreView operations={operations} factory={factory} events={sortedEvents} />}<BottomNav tab={tab} setTab={setTab} /></div>;
};
