import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Beaker,
  Bot,
  BrainCircuit,
  ChevronRight,
  CircleDot,
  FlaskConical,
  Gauge,
  Home,
  Layers3,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type {
  ClosedTrade,
  DecisionTapeItem,
  EventsPayload,
  FactoryPayload,
  FactoryTop,
  LedgerEvent,
  OperationsPayload,
} from './v2/types';
import { actionKo, cn, dateTime, pct, reasonKo, regimeKo, timeAgo } from './v2/types';
import { formatKrw, formatPercent } from './v2/financial';
import { PortfolioEquityChart } from './v2/PortfolioEquityChart';
import { deriveInstrumentCockpit, deriveInstrumentUniverse, type InstrumentSummary } from './v9/instrument';
import { IntegratedMarketChart } from './v9/IntegratedMarketChart';
import { PositionSummary } from './v9/PositionSummary';

const ink = '#111318';
const green = '#16845b';
const red = '#d14b55';
const amber = '#a46b17';
const blue = '#3767d6';
const card = 'rounded-[22px] border border-[#e7e9ed] bg-white';

type View = 'command' | 'markets' | 'oracle' | 'trade' | 'lab' | 'system';
type Detail =
  | { kind: 'event'; event: LedgerEvent }
  | { kind: 'decision'; decision: DecisionTapeItem }
  | { kind: 'strategy'; strategy: FactoryTop; rank: number }
  | { kind: 'trade'; trade: ClosedTrade }
  | { kind: 'council'; decision: DecisionTapeItem }
  | null;

type FactoryStatusPayload = FactoryPayload & {
  runs?: Array<NonNullable<FactoryPayload['latestRun']>>;
  governance?: {
    automaticChampionPromotion?: boolean;
    automaticLiveDeployment?: boolean;
    humanApprovalRequired?: boolean;
  };
};

type NavItem = {
  id: View;
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { id: 'command', label: 'Command', short: 'Command', icon: Home },
  { id: 'markets', label: 'Markets', short: 'Markets', icon: Search },
  { id: 'oracle', label: 'Oracle', short: 'Oracle', icon: BrainCircuit },
  { id: 'trade', label: 'Trade', short: 'Trade', icon: WalletCards },
  { id: 'lab', label: 'Lab', short: 'Lab', icon: FlaskConical },
  { id: 'system', label: 'System', short: 'System', icon: Settings2 },
];

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const tone = (value: string | null | undefined) => {
  const text = String(value ?? '').toUpperCase();
  if (['OK', 'SUCCESS', 'PASS', 'APPROVE', 'ENTER', 'BUY', 'LONG', 'CHAMPION_CANDIDATE'].includes(text)) return green;
  if (['ERROR', 'FAIL', 'REJECT', 'EXIT', 'SELL', 'SHORT', 'LOSS', 'CRITICAL'].includes(text)) return red;
  return amber;
};
const percent = (value: number | null | undefined, signed = false) => {
  if (!finite(value)) return '—';
  const points = Math.abs(value) <= 1 ? value * 100 : value;
  return `${signed && points > 0 ? '+' : ''}${points.toFixed(1)}%`;
};
const score = (value: number | null | undefined) => finite(value) ? value.toFixed(2) : '—';
const motionTransition = { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.7 };

const StatusDot = ({ status, pulse = false }: { status?: string | null; pulse?: boolean }) => (
  <span className="relative flex h-2.5 w-2.5 shrink-0">
    {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-25" style={{ background: tone(status) }} />}
    <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: tone(status) }} />
  </span>
);

const Pill = ({ children, color = '#69717b' }: { children: React.ReactNode; color?: string }) => (
  <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-semibold" style={{ color, borderColor: `${color}28`, background: `${color}0b` }}>{children}</span>
);

const Metric = ({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) => (
  <div className="min-w-0">
    <div className="text-[9px] font-medium text-[#969ca4]">{label}</div>
    <div className="mt-1 truncate text-[15px] font-semibold tabular-nums tracking-[-0.025em]" style={{ color: accent ?? ink }}>{value}</div>
  </div>
);

const Section = ({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="mt-7 first:mt-0">
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-[-0.035em] text-[#15171c]">{title}</h2>
        {subtitle && <p className="mt-1 text-[10px] leading-4 text-[#8d949d]">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const AnimatedCard = ({ children, index = 0, className = '' }: { children: React.ReactNode; index?: number; className?: string }) => {
  const reduced = useReducedMotion();
  return <motion.div
    initial={reduced ? false : { opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, delay: reduced ? 0 : Math.min(index * 0.045, 0.18) }}
    className={className}
  >{children}</motion.div>;
};

const Header = ({ view, operations, loading, refresh, goSystem }: { view: View; operations: OperationsPayload | null; loading: boolean; refresh: () => void; goSystem: () => void }) => {
  const meta: Record<View, { eyebrow: string; title: string }> = {
    command: { eyebrow: 'BLACK ORACLE', title: 'Command Center' },
    markets: { eyebrow: 'MARKET INTELLIGENCE', title: 'Markets' },
    oracle: { eyebrow: 'DECISION ENGINE', title: 'Oracle' },
    trade: { eyebrow: 'PAPER EXECUTION', title: 'Trade' },
    lab: { eyebrow: 'STRATEGY FACTORY', title: 'Lab' },
    system: { eyebrow: 'RUNTIME CONTROL', title: 'System' },
  };
  return <header className="sticky top-0 z-40 border-b border-[#e9ebee] bg-[#f6f7f9]/90 backdrop-blur-2xl">
    <div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] lg:px-7 lg:py-5">
      <div>
        <div className="flex items-center gap-2 text-[8px] font-semibold tracking-[0.2em] text-[#9aa1aa]"><StatusDot status={operations?.status} pulse={operations?.status === 'OK'} />{meta[view].eyebrow}</div>
        <div className="mt-1 text-[22px] font-semibold tracking-[-0.05em] text-[#121419] lg:text-[26px]">{meta[view].title}</div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={refresh} aria-label="새로고침" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e7ea] bg-white shadow-[0_3px_12px_rgba(20,24,28,0.03)] active:scale-[0.97]"><RefreshCw className={cn('h-4 w-4 text-[#626a74]', loading && 'animate-spin')} /></button>
        <button type="button" onClick={goSystem} aria-label="시스템 상태" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e7ea] bg-white shadow-[0_3px_12px_rgba(20,24,28,0.03)] active:scale-[0.97]"><Settings2 className="h-4 w-4 text-[#626a74]" /></button>
      </div>
    </div>
  </header>;
};

const DesktopRail = ({ view, setView, operations }: { view: View; setView: (view: View) => void; operations: OperationsPayload | null }) => (
  <aside className="fixed inset-y-0 left-0 z-50 hidden w-[220px] border-r border-[#e4e7ea] bg-white lg:flex lg:flex-col">
    <div className="px-5 pb-5 pt-7"><div className="text-[10px] font-bold tracking-[0.22em] text-[#17191e]">BLACK ORACLE</div><div className="mt-2 flex items-center gap-2 text-[9px] text-[#8f969f]"><StatusDot status={operations?.status} pulse={operations?.status === 'OK'} />{operations?.status ?? 'UNKNOWN'} · PAPER</div></div>
    <nav className="flex-1 px-3">{navItems.map(({ id, label, icon: Icon }) => { const active = id === view; return <button key={id} type="button" onClick={() => setView(id)} className={cn('mb-1 flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left transition', active ? 'bg-[#111318] text-white' : 'text-[#6d747d] hover:bg-[#f5f6f8]')}><Icon className="h-4 w-4" /><span className="text-[11px] font-semibold">{label}</span></button>; })}</nav>
    <div className="m-4 rounded-[16px] bg-[#f6f7f9] p-3 text-[9px] leading-4 text-[#858d96]">Decision lineage, paper runtime and evidence stay observable. UI changes do not grant live execution authority.</div>
  </aside>
);

const MobileNav = ({ view, setView }: { view: View; setView: (view: View) => void }) => {
  const items = navItems.filter((item) => item.id !== 'system');
  return <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e5e8eb] bg-white/96 pb-[max(env(safe-area-inset-bottom),7px)] backdrop-blur-xl lg:hidden"><div className="mx-auto grid max-w-[720px] grid-cols-5 px-2 pt-2">{items.map(({ id, short, icon: Icon }) => { const active = id === view; return <button key={id} type="button" onClick={() => setView(id)} className="flex min-h-12 flex-col items-center justify-center gap-1 active:scale-[0.97]"><Icon className="h-[18px] w-[18px]" style={{ color: active ? ink : '#a0a6ae' }} /><span className="text-[8px] font-semibold" style={{ color: active ? ink : '#a0a6ae' }}>{short}</span></button>; })}</div></nav>;
};

const DecisionFlow = ({ decision, open }: { decision: DecisionTapeItem | null; open: () => void }) => {
  const stages = decision ? [
    { label: 'Evidence', value: `${decision.evidenceActiveCount ?? 0} active`, state: decision.evidenceActiveCount ? 'PASS' : 'WAITING' },
    { label: 'Strategy', value: decision.router?.route ?? decision.strategyDisposition ?? 'Unresolved', state: decision.router?.route ? 'PASS' : 'WAITING' },
    { label: 'Council', value: decision.council?.verdict ?? 'Pending', state: decision.council?.verdict ?? 'WAITING' },
    { label: 'Risk', value: decision.riskDisposition ?? 'Pending', state: decision.riskDisposition ?? 'WAITING' },
    { label: 'Decision', value: actionKo(decision.decision), state: decision.decision },
  ] : [];
  return <button type="button" onClick={open} disabled={!decision} className={cn(card, 'w-full overflow-hidden p-4 text-left disabled:opacity-60')}>
    {decision ? <div className="space-y-1">{stages.map((stage, index) => <motion.div key={stage.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: index * 0.06 }} className="relative flex items-center gap-3 rounded-[15px] px-2 py-2.5">
      <div className="relative flex w-5 justify-center"><StatusDot status={stage.state} pulse={index === stages.length - 1} />{index < stages.length - 1 && <span className="absolute top-4 h-7 w-px bg-[#e3e7ea]" />}</div>
      <div className="min-w-0 flex-1"><div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#9da3ab]">{stage.label}</div><div className="mt-0.5 truncate text-[11px] font-semibold text-[#31363d]">{stage.value}</div></div>
      {index === stages.length - 1 && <ChevronRight className="h-4 w-4 text-[#aeb4bb]" />}
    </motion.div>)}</div> : <div className="py-8 text-center text-[10px] text-[#9299a2]">아직 최신 Decision이 없습니다.</div>}
  </button>;
};

const InstrumentRow = ({ item, open }: { item: InstrumentSummary; open: () => void }) => {
  const decision = item.latestDecision;
  return <button type="button" onClick={open} className={cn(card, 'flex w-full items-center gap-3 p-4 text-left transition active:scale-[0.992]')}>
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#f4f6f8]"><BarChart3 className="h-4 w-4 text-[#606974]" /></div>
    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-[13px] font-semibold text-[#17191e]">{item.market}</span>{item.openPosition && <Pill color={blue}>OPEN</Pill>}</div><div className="mt-1 truncate text-[9px] text-[#969da6]">{item.assetClass === 'EQUITY' ? 'Korea Equity' : item.assetClass === 'CRYPTO' ? 'Crypto' : 'Instrument'} · {item.latestDecisionAt ? timeAgo(item.latestDecisionAt) : '분석 기록 없음'}</div></div>
    <div className="text-right"><div className="text-[10px] font-semibold" style={{ color: tone(decision?.decision) }}>{decision ? actionKo(decision.decision) : '—'}</div><div className="mt-1 text-[8px] text-[#a0a6ae]">Score {finite(decision?.oracleTradeScore) ? decision?.oracleTradeScore : '—'}</div></div>
    <ChevronRight className="h-4 w-4 shrink-0 text-[#b2b7bd]" />
  </button>;
};

const CommandView = ({ operations, instruments, setView, openMarket, openDetail }: { operations: OperationsPayload | null; instruments: InstrumentSummary[]; setView: (view: View) => void; openMarket: (market: string) => void; openDetail: (detail: Detail) => void }) => {
  const portfolio = operations?.portfolio;
  const perf = operations?.performance;
  const latest = operations?.decisionTape?.[0] ?? null;
  const active = instruments.filter((item) => item.openPosition || item.recentlyAnalyzed).slice(0, 4);
  const equity = (operations?.equityCurve ?? []).map((item) => item.equity);
  const pnlColor = (portfolio?.dailyPnlPct ?? 0) >= 0 ? green : red;
  return <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-4 lg:px-7 lg:pb-10 lg:pt-6">
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <AnimatedCard><section className={cn(card, 'relative overflow-hidden p-5 lg:p-6')}>
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#3767d609] blur-2xl" />
        <div className="relative flex items-start justify-between gap-4"><div><div className="text-[10px] font-medium text-[#858d96]">₩100M PAPER QUALIFICATION</div><div className="mt-2 text-[38px] font-semibold tabular-nums tracking-[-0.06em] text-[#101216] lg:text-[46px]">{formatKrw(portfolio?.equity)}</div><div className="mt-2 flex items-center gap-2"><span className="text-[13px] font-semibold" style={{ color: pnlColor }}>{pct(portfolio?.dailyPnlPct, true)} today</span><span className="text-[10px] text-[#9ca2aa]">· {pct(perf?.totalReturnPct, true)} total</span></div></div><Pill color={operations?.status === 'OK' ? green : amber}>{operations?.status ?? 'UNKNOWN'}</Pill></div>
        <div className="relative mt-5 grid grid-cols-3 gap-4 border-t border-[#eef0f2] pt-4"><Metric label="Open" value={`${portfolio?.openPositions?.length ?? 0}`} /><Metric label="Evidence" value={`${operations?.ingestion?.evidenceActive ?? 0}`} /><Metric label="MDD" value={pct(perf?.maxDrawdownPct)} accent={(perf?.maxDrawdownPct ?? 0) > 0.05 ? red : undefined} /></div>
      </section></AnimatedCard>
      <AnimatedCard index={1}><button type="button" onClick={() => setView('system')} className={cn(card, 'flex h-full min-h-[160px] w-full flex-col justify-between p-5 text-left')}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-[#5f6872]" /><span className="text-[10px] font-semibold text-[#515860]">Runtime pulse</span></div><StatusDot status={operations?.status} pulse /></div><div><div className="text-[24px] font-semibold tracking-[-0.045em] text-[#16191e]">{operations?.loop?.stale ? 'Attention required' : 'System observing'}</div><div className="mt-2 text-[10px] leading-5 text-[#8a929b]">Cycle {operations?.loop?.cycleCount ?? '—'} · last {operations?.loop?.ageMs == null ? '—' : `${Math.round(operations.loop.ageMs / 1000)}s ago`} · {operations?.loop?.lastCycle?.errors?.length ?? 0} errors</div></div></button></AnimatedCard>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <AnimatedCard index={2}><Section title="What Oracle is doing" subtitle="Evidence → Strategy → Council → Risk → Decision을 한 흐름으로 봅니다." action={<button type="button" onClick={() => setView('oracle')} className="text-[9px] font-semibold text-[#626b75]">Oracle 열기</button>}><DecisionFlow decision={latest} open={() => latest && openDetail({ kind: 'decision', decision: latest })} /></Section></AnimatedCard>
      <AnimatedCard index={3}><Section title="Portfolio trajectory" subtitle="기존 Paper equity + drawdown 차트를 유지합니다."><div className={cn(card, 'p-2')}><PortfolioEquityChart values={equity} positive={(perf?.totalReturnPct ?? 0) >= 0} /></div></Section></AnimatedCard>
    </div>

    <Section title="Active radar" subtitle="현재 보유 또는 최근 24시간 내 분석한 종목" action={<button type="button" onClick={() => setView('markets')} className="text-[9px] font-semibold text-[#626b75]">전체 시장</button>}><div className="grid gap-2 lg:grid-cols-2">{active.length ? active.map((item, index) => <AnimatedCard index={index} key={item.market}><InstrumentRow item={item} open={() => openMarket(item.market)} /></AnimatedCard>) : <div className={cn(card, 'p-5 text-[10px] text-[#9299a2]')}>현재 Active radar 항목이 없습니다.</div>}</div></Section>
  </main>;
};

const MarketsView = ({ instruments, openMarket }: { instruments: InstrumentSummary[]; openMarket: (market: string) => void }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'CRYPTO' | 'EQUITY'>('ALL');
  const filtered = instruments.filter((item) => (filter === 'ALL' || item.assetClass === filter) && item.market.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-4 lg:px-7 lg:pb-10 lg:pt-6">
    <div className={cn(card, 'p-3')}><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a0a6ae]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="종목 검색" className="h-11 w-full rounded-[14px] bg-[#f6f7f9] pl-10 pr-3 text-[11px] outline-none placeholder:text-[#abb1b8]" /></div><div className="mt-2 flex gap-1.5">{(['ALL', 'CRYPTO', 'EQUITY'] as const).map((id) => <button key={id} type="button" onClick={() => setFilter(id)} className={cn('rounded-full px-3 py-1.5 text-[9px] font-semibold', filter === id ? 'bg-[#17191e] text-white' : 'bg-[#f1f3f5] text-[#747c86]')}>{id === 'ALL' ? 'All' : id === 'CRYPTO' ? 'Crypto' : 'Korea Equity'}</button>)}</div></div>
    <Section title="Canonical instruments" subtitle={`${filtered.length}개 · Open position과 최신 분석을 우선 정렬`}><div className="grid gap-2 lg:grid-cols-2">{filtered.map((item, index) => <AnimatedCard key={item.market} index={index}><InstrumentRow item={item} open={() => openMarket(item.market)} /></AnimatedCard>)}{!filtered.length && <div className={cn(card, 'p-6 text-center text-[10px] text-[#9098a1]')}>조건에 맞는 canonical instrument가 없습니다.</div>}</div></Section>
  </main>;
};

const OracleView = ({ operations, events, openDetail }: { operations: OperationsPayload | null; events: LedgerEvent[]; openDetail: (detail: Detail) => void }) => {
  const decisions = (operations?.decisionTape ?? []).slice(0, 8);
  const evidence = events.filter((event) => event.eventType?.toUpperCase() === 'EVIDENCE').slice(0, 8);
  const latest = decisions[0] ?? null;
  return <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-4 lg:px-7 lg:pb-10 lg:pt-6">
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Decision engine" subtitle="최신 판단을 우선 노출합니다."><DecisionFlow decision={latest} open={() => latest && openDetail({ kind: 'decision', decision: latest })} /></Section>
      <Section title="Council status" subtitle="Council은 판단 근거로 보이되 권한 상태를 숨기지 않습니다."><button type="button" onClick={() => latest && openDetail({ kind: 'council', decision: latest })} className={cn(card, 'w-full p-5 text-left')}><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] text-[#959ca5]">Latest verdict</div><div className="mt-2 text-[26px] font-semibold tracking-[-0.045em]" style={{ color: tone(latest?.council?.verdict) }}>{latest?.council?.verdict ?? 'PENDING'}</div></div><Bot className="h-5 w-5 text-[#5d6670]" /></div><div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#eef0f2] pt-4"><Metric label="Approve" value={latest?.council?.approveCount ?? '—'} /><Metric label="Caution" value={latest?.council?.cautionCount ?? '—'} /><Metric label="Reject" value={latest?.council?.rejectCount ?? '—'} /></div><div className="mt-4 flex items-center justify-between rounded-[14px] bg-[#f7f8f9] px-3 py-2.5 text-[9px] text-[#737b85]"><span>Execution authority</span><strong>{operations?.council?.executionAuthority ? 'ENABLED' : 'SHADOW / OFF'}</strong></div></button></Section>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Recent decisions" subtitle="누르면 판단 근거·trade map·Council 세부를 확인합니다."><div className="space-y-2">{decisions.map((decision, index) => <AnimatedCard key={`${decision.market}-${decision.timestamp}`} index={index}><button type="button" onClick={() => openDetail({ kind: 'decision', decision })} className={cn(card, 'flex w-full items-center gap-3 p-4 text-left')}><div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#f5f6f8]"><Target className="h-4 w-4 text-[#626b75]" /></div><div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold">{decision.market}</div><div className="mt-1 truncate text-[9px] text-[#969da6]">{regimeKo(decision.regime)} · {timeAgo(decision.timestamp)}</div></div><Pill color={tone(decision.decision)}>{actionKo(decision.decision)}</Pill><ChevronRight className="h-4 w-4 text-[#b2b7bd]" /></button></AnimatedCard>)}</div></Section>
      <Section title="Evidence stream" subtitle="Canonical evidence가 실제 판단에 연결되는지 확인합니다."><div className={cn(card, 'divide-y divide-[#eef0f2]')}>{evidence.length ? evidence.map((event) => <button key={event.id} type="button" onClick={() => openDetail({ kind: 'event', event })} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-[#fafbfb]"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#6f7781]" /><div className="min-w-0 flex-1"><div className="line-clamp-2 text-[10px] font-medium leading-5 text-[#4b525a]">{event.summary || event.eventName}</div><div className="mt-1 text-[8px] text-[#9fa5ad]">{event.market ?? 'MARKET-WIDE'} · {dateTime(event.occurredAt)} · {event.source}</div></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#b6bbc1]" /></button>) : <div className="p-5 text-[10px] text-[#9299a2]">Canonical Evidence 이벤트가 없습니다.</div>}</div></Section>
    </div>
  </main>;
};

const TradeView = ({ operations, openMarket, openDetail }: { operations: OperationsPayload | null; openMarket: (market: string) => void; openDetail: (detail: Detail) => void }) => {
  const positions = operations?.portfolio?.openPositions ?? [];
  const trades = operations?.recentTrades ?? [];
  return <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-4 lg:px-7 lg:pb-10 lg:pt-6">
    <Section title="Open positions" subtitle="진입가·현재가·손절·익절가를 바로 확인합니다."><div className="grid gap-3 lg:grid-cols-2">{positions.length ? positions.map((position, index) => <AnimatedCard key={`${position.market}-${position.openedAt}`} index={index}><button type="button" onClick={() => openMarket(position.market)} className="block w-full text-left"><PositionSummary position={position} portfolioEquity={operations?.portfolio?.equity} compact /></button></AnimatedCard>) : <div className={cn(card, 'p-6 text-[10px] text-[#9299a2]')}>현재 Open position이 없습니다.</div>}</div></Section>
    <Section title="Trade history" subtitle="손익만이 아니라 진입·청산 이유를 다시 열어볼 수 있게 합니다."><div className={cn(card, 'divide-y divide-[#eef0f2]')}>{trades.length ? trades.map((trade) => <button key={trade.id} type="button" onClick={() => openDetail({ kind: 'trade', trade })} className="flex w-full items-center gap-3 px-4 py-3 text-left"><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold text-[#32373e]">{trade.market}</div><div className="mt-1 text-[8px] text-[#9ba2aa]">{dateTime(trade.openedAt)} → {dateTime(trade.closedAt)} · {trade.exitReason}</div></div><div className="text-right"><div className="text-[11px] font-semibold tabular-nums" style={{ color: trade.netPnl >= 0 ? green : red }}>{formatKrw(trade.netPnl, true)}</div><div className="mt-1 text-[8px] font-semibold" style={{ color: trade.returnPct >= 0 ? green : red }}>{percent(trade.returnPct, true)}</div></div><ChevronRight className="h-4 w-4 text-[#b5bac0]" /></button>) : <div className="p-5 text-[10px] text-[#9299a2]">아직 종료된 거래가 없습니다.</div>}</div></Section>
  </main>;
};

const LabView = ({ factory, openDetail }: { factory: FactoryStatusPayload | null; openDetail: (detail: Detail) => void }) => {
  const run = factory?.latestRun ?? null;
  const ranked = [...(run?.top_results ?? [])].sort((a, b) => b.evaluation.score - a.evaluation.score);
  return <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-4 lg:px-7 lg:pb-10 lg:pt-6">
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <section className={cn(card, 'p-5')}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Beaker className="h-4 w-4 text-[#626b75]" /><span className="text-[10px] font-semibold text-[#555d66]">Latest experiment</span></div><Pill color={run ? green : amber}>{run ? 'RECORDED' : 'WAITING'}</Pill></div><div className="mt-5 text-[28px] font-semibold tracking-[-0.045em] text-[#17191e]">{run?.market ?? 'No run yet'}</div><div className="mt-2 text-[10px] text-[#8f969f]">{run ? `${run.candidate_count} candidates · ${run.timeframe_minutes}m timeframe` : 'Strategy Factory 결과를 기다리는 중입니다.'}</div><div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#eef0f2] pt-4"><Metric label="Candidates" value={run?.candidate_count ?? '—'} /><Metric label="Top results" value={run?.top_results?.length ?? '—'} /></div></section>
      <section className={cn(card, 'p-5')}><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#626b75]" /><span className="text-[10px] font-semibold text-[#555d66]">Promotion governance</span></div><div className="mt-4 space-y-2 text-[9px]"><div className="flex items-center justify-between rounded-[13px] bg-[#f7f8f9] px-3 py-2.5"><span className="text-[#858d96]">Automatic champion promotion</span><strong>{factory?.governance?.automaticChampionPromotion ? 'ON' : 'OFF'}</strong></div><div className="flex items-center justify-between rounded-[13px] bg-[#f7f8f9] px-3 py-2.5"><span className="text-[#858d96]">Automatic live deployment</span><strong>{factory?.governance?.automaticLiveDeployment ? 'ON' : 'OFF'}</strong></div><div className="flex items-center justify-between rounded-[13px] bg-[#f7f8f9] px-3 py-2.5"><span className="text-[#858d96]">Human approval</span><strong>{factory?.governance?.humanApprovalRequired ? 'REQUIRED' : 'NOT REPORTED'}</strong></div></div></section>
    </div>
    <Section title="Champion race" subtitle="점수 순으로 정렬하고, 표본·OOS·MDD·Monte Carlo를 함께 봅니다."><div className="space-y-2">{ranked.length ? ranked.map((strategy, index) => <AnimatedCard key={strategy.genome.id} index={index}><button type="button" onClick={() => openDetail({ kind: 'strategy', strategy, rank: index + 1 })} className={cn(card, 'flex w-full items-center gap-3 p-4 text-left')}><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#f4f6f8] text-[11px] font-bold text-[#5f6872]">#{index + 1}</div><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold text-[#2f343a]">{strategy.genome.id}</div><div className="mt-1 text-[8px] text-[#989fa7]">{strategy.evaluation.lifecycle ?? 'UNCLASSIFIED'} · {strategy.metrics.oosSamples} OOS samples</div></div><div className="text-right"><div className="text-[13px] font-semibold tabular-nums">{score(strategy.evaluation.score)}</div><div className="mt-1 text-[8px]" style={{ color: strategy.evaluation.hardGatePassed ? green : red }}>{strategy.evaluation.hardGatePassed ? 'GATE PASS' : 'GATE FAIL'}</div></div><ChevronRight className="h-4 w-4 text-[#b5bac0]" /></button></AnimatedCard>) : <div className={cn(card, 'p-6 text-[10px] text-[#9299a2]')}>Champion race 표본이 없습니다.</div>}</div></Section>
  </main>;
};

const SystemView = ({ operations, events, factory }: { operations: OperationsPayload | null; events: LedgerEvent[]; factory: FactoryStatusPayload | null }) => {
  const lastCycle = operations?.loop?.lastCycle;
  return <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-4 lg:px-7 lg:pb-10 lg:pt-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
      ['Runtime', operations?.status ?? 'UNKNOWN', operations?.loop?.stale ? red : green],
      ['Canonical events', String(events.length), ink],
      ['Evidence active', String(operations?.ingestion?.evidenceActive ?? '—'), ink],
      ['Factory', factory?.latestRun ? 'AVAILABLE' : 'WAITING', factory?.latestRun ? green : amber],
    ].map(([label, value, accent], index) => <AnimatedCard key={label as string} index={index}><div className={cn(card, 'p-4')}><Metric label={label as string} value={value} accent={accent as string} /></div></AnimatedCard>)}</div>
    <Section title="Runtime health" subtitle="상태의 의미를 숨기지 않고 원인과 수치를 같이 보여줍니다."><div className={cn(card, 'p-5')}><div className="grid grid-cols-2 gap-x-5 gap-y-5 lg:grid-cols-4"><Metric label="Cycle count" value={operations?.loop?.cycleCount ?? '—'} /><Metric label="Cycle age" value={operations?.loop?.ageMs == null ? '—' : `${Math.round(operations.loop.ageMs / 1000)}s`} /><Metric label="Scanned" value={lastCycle?.scanned ?? '—'} /><Metric label="Errors" value={lastCycle?.errors?.length ?? '—'} accent={(lastCycle?.errors?.length ?? 0) > 0 ? red : undefined} /><Metric label="Evidence requests" value={operations?.ingestion?.evidenceRequests ?? '—'} /><Metric label="NARS inbox" value={operations?.ingestion?.narsInboxRecent ?? '—'} /><Metric label="Council mode" value={operations?.council?.mode ?? '—'} /><Metric label="Execution authority" value={operations?.council?.executionAuthority ? 'ON' : 'OFF'} accent={operations?.council?.executionAuthority ? red : green} /></div></div></Section>
    <Section title="Execution boundary" subtitle="현재 UI는 관측·Paper 운용용이며 live 권한을 암시하지 않습니다."><div className={cn(card, 'p-5')}><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#59626c]" /><div><div className="text-[12px] font-semibold text-[#2c3137]">Paper first · explicit authority</div><p className="mt-2 text-[10px] leading-5 text-[#858d96]">UI 개편은 S1R2 qualification runtime, canonical ledger, Evidence/Council/Strategy lineage의 동작 권한을 변경하지 않습니다. 상태가 WAITING/BLOCKED이면 그대로 노출하고 정상처럼 꾸미지 않습니다.</p></div></div></div></Section>
  </main>;
};

const DetailSheet = ({ detail, close }: { detail: Detail; close: () => void }) => {
  const reduced = useReducedMotion();
  if (!detail) return null;
  const title = detail.kind === 'event' ? detail.event.eventName : detail.kind === 'decision' ? `${detail.decision.market} decision` : detail.kind === 'strategy' ? `Strategy #${detail.rank}` : detail.kind === 'trade' ? `${detail.trade.market} trade` : `${detail.decision.market} Council`;
  const kicker = detail.kind.toUpperCase();
  return <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#111318]/22 p-0 backdrop-blur-[2px] lg:items-center lg:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
    <motion.div onClick={(event) => event.stopPropagation()} initial={reduced ? false : { y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduced ? { opacity: 0 } : { y: 28, opacity: 0 }} transition={motionTransition} className="max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-[28px] bg-white pb-[max(env(safe-area-inset-bottom),18px)] shadow-[0_-12px_60px_rgba(17,19,24,0.12)] touch-pan-y lg:max-w-[620px] lg:rounded-[28px]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#eceef1] bg-white/95 px-5 py-4 backdrop-blur-xl"><div><div className="text-[8px] font-semibold tracking-[0.18em] text-[#9aa1aa]">{kicker}</div><div className="mt-1 text-[18px] font-semibold tracking-[-0.035em]">{title}</div></div><button type="button" onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2f4f5]"><X className="h-4 w-4" /></button></div>
      <div className="p-5">
        {detail.kind === 'event' && <div><div className="grid grid-cols-2 gap-4"><Metric label="Type" value={detail.event.eventType} /><Metric label="Severity" value={detail.event.severity} accent={tone(detail.event.severity)} /><Metric label="Market" value={detail.event.market ?? 'MARKET-WIDE'} /><Metric label="Occurred" value={dateTime(detail.event.occurredAt)} /><Metric label="Authority" value={detail.event.authority} /><Metric label="Execution" value={detail.event.executionAuthority ? 'YES' : 'NO'} /></div><div className="mt-5 rounded-[16px] bg-[#f7f8f9] p-4 text-[10px] leading-5 text-[#616a74]">{detail.event.summary || detail.event.reason || 'No summary recorded.'}</div></div>}
        {detail.kind === 'decision' && <div><div className="flex items-center justify-between"><div className="text-[30px] font-semibold tracking-[-0.05em]" style={{ color: tone(detail.decision.decision) }}>{actionKo(detail.decision.decision)}</div><Pill color={tone(detail.decision.decision)}>Score {detail.decision.oracleTradeScore ?? '—'}</Pill></div><div className="mt-5 grid grid-cols-2 gap-4"><Metric label="Regime" value={regimeKo(detail.decision.regime)} /><Metric label="Strategy" value={detail.decision.router?.route ?? detail.decision.strategyDisposition ?? '—'} /><Metric label="Council" value={detail.decision.council?.verdict ?? '—'} /><Metric label="Risk" value={detail.decision.riskDisposition ?? '—'} /><Metric label="Evidence" value={detail.decision.evidenceActiveCount ?? '—'} /><Metric label="Confidence" value={percent(detail.decision.confidence)} /></div><div className="mt-5 rounded-[16px] bg-[#f7f8f9] p-4 text-[10px] leading-5 text-[#616a74]">{reasonKo(detail.decision.primaryReason ?? detail.decision.reasons?.[0])}</div>{detail.decision.tradeMap && <div className="mt-5 grid grid-cols-2 gap-4 rounded-[16px] border border-[#e9ebee] p-4"><Metric label="Entry" value={formatKrw(detail.decision.tradeMap.entryPrice)} /><Metric label="Stop" value={formatKrw(detail.decision.tradeMap.stopLossPrice ?? detail.decision.tradeMap.structuralInvalidationPrice)} /><Metric label="TP1" value={formatKrw(detail.decision.tradeMap.takeProfit1Price)} /><Metric label="TP2" value={formatKrw(detail.decision.tradeMap.takeProfit2Price)} /></div>}</div>}
        {detail.kind === 'strategy' && <div><div className="text-[11px] font-semibold text-[#3b4148]">{detail.strategy.genome.id}</div><div className="mt-5 grid grid-cols-2 gap-4"><Metric label="Score" value={score(detail.strategy.evaluation.score)} /><Metric label="Lifecycle" value={detail.strategy.evaluation.lifecycle ?? '—'} /><Metric label="OOS samples" value={detail.strategy.metrics.oosSamples} /><Metric label="OOS expectancy" value={score(detail.strategy.metrics.oosExpectancy)} /><Metric label="Sharpe" value={score(detail.strategy.metrics.sharpe)} /><Metric label="MDD" value={percent(detail.strategy.metrics.maxDrawdownPct)} /><Metric label="Monte Carlo" value={percent(detail.strategy.metrics.monteCarloSurvivalRate)} /><Metric label="Robustness" value={percent(detail.strategy.metrics.parameterRobustness)} /></div><div className="mt-5 rounded-[16px] bg-[#f7f8f9] p-4 text-[9px] leading-5 text-[#68717b]">{detail.strategy.evaluation.hardGatePassed ? 'Hard Gate passed.' : detail.strategy.evaluation.hardGateReasons.join(' · ') || 'Hard Gate failed.'}</div></div>}
        {detail.kind === 'trade' && <div><div className="text-[31px] font-semibold tabular-nums tracking-[-0.05em]" style={{ color: detail.trade.netPnl >= 0 ? green : red }}>{formatKrw(detail.trade.netPnl, true)}</div><div className="mt-1 text-[11px] font-semibold" style={{ color: detail.trade.returnPct >= 0 ? green : red }}>{percent(detail.trade.returnPct, true)}</div><div className="mt-5 grid grid-cols-2 gap-4"><Metric label="Entry" value={formatKrw(detail.trade.entryPrice)} /><Metric label="Exit" value={formatKrw(detail.trade.exitPrice)} /><Metric label="Opened" value={dateTime(detail.trade.openedAt)} /><Metric label="Closed" value={dateTime(detail.trade.closedAt)} /><Metric label="Strategy" value={detail.trade.strategyVersion} /><Metric label="Exit reason" value={detail.trade.exitReason} /></div></div>}
        {detail.kind === 'council' && <div><div className="flex items-center justify-between"><div className="text-[28px] font-semibold tracking-[-0.05em]" style={{ color: tone(detail.decision.council?.verdict) }}>{detail.decision.council?.verdict ?? 'PENDING'}</div><Pill>{detail.decision.council?.members?.length ?? 0} members</Pill></div><div className="mt-5 space-y-2">{(detail.decision.council?.members ?? []).map((member, index) => <div key={`${member.role}-${index}`} className="rounded-[15px] border border-[#eceef1] p-3"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-[#424950]">{member.role}</span><Pill color={tone(member.vote)}>{member.vote}</Pill></div><div className="mt-2 text-[9px] leading-4 text-[#858d96]">Confidence {percent(member.confidence)} · {member.reasons?.[0] ?? 'No reason recorded.'}</div></div>)}</div></div>}
      </div>
    </motion.div>
  </motion.div>;
};

const InstrumentCockpit = ({ market, operations, events, back, openDetail }: { market: string; operations: OperationsPayload | null; events: LedgerEvent[]; back: () => void; openDetail: (detail: Detail) => void }) => {
  const projection = useMemo(() => deriveInstrumentCockpit(market, operations, events), [market, operations, events]);
  const decision = projection.latestDecision;
  const position = projection.openPosition;
  const replay = [...projection.events].sort((a, b) => a.occurredAt - b.occurredAt).slice(-16);
  return <motion.div className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[#f6f7f9] text-[#111318] touch-pan-y" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <div className="sticky top-0 z-30 border-b border-[#e9ebee] bg-white/95 backdrop-blur-xl"><div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] lg:px-7 lg:py-4"><button type="button" onClick={back} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e7ea] bg-white"><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0 flex-1"><div className="text-[8px] font-semibold tracking-[0.18em] text-[#9aa1aa]">INSTRUMENT COCKPIT</div><div className="mt-1 truncate text-[20px] font-semibold tracking-[-0.04em]">{market}</div></div>{position && <Pill color={blue}>OPEN · PAPER</Pill>}</div></div>
    <main className="mx-auto max-w-[1180px] px-4 pb-10 pt-4 lg:px-7 lg:pt-6">
      <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <section className={cn(card, 'p-5')}><div className="text-[9px] text-[#9299a2]">Latest Oracle decision</div><div className="mt-2 text-[34px] font-semibold tracking-[-0.055em]" style={{ color: tone(decision?.decision) }}>{decision ? actionKo(decision.decision) : '미분석'}</div><div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#eef0f2] pt-4"><Metric label="Regime" value={regimeKo(decision?.regime)} /><Metric label="Trade score" value={decision?.oracleTradeScore ?? '—'} /><Metric label="Council" value={decision?.council?.verdict ?? '—'} /><Metric label="Risk" value={decision?.riskDisposition ?? '—'} /></div>{decision && <button type="button" onClick={() => openDetail({ kind: 'decision', decision })} className="mt-5 flex w-full items-center justify-between rounded-[15px] bg-[#f6f7f9] px-4 py-3 text-left text-[9px] font-semibold text-[#606974]"><span>판단 상세 열기</span><ChevronRight className="h-4 w-4" /></button>}</section>
        <div>{position && <div className="mb-4"><PositionSummary position={position} portfolioEquity={operations?.portfolio?.equity} /></div>}<IntegratedMarketChart market={market} decision={decision} position={position} /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Decision Replay" subtitle="Canonical event lineage를 시간 순서로 재생 가능한 형태로 봅니다."><div className={cn(card, 'overflow-hidden')}><div className="flex gap-2 overflow-x-auto border-b border-[#eef0f2] px-4 py-3">{['EVIDENCE','STRATEGY','COUNCIL','RISK','ORDER','TRADE','OUTCOME'].map((type) => <span key={type} className="shrink-0 rounded-full bg-[#f3f5f6] px-2.5 py-1 text-[8px] font-semibold text-[#747d87]">{type}</span>)}</div><div className="divide-y divide-[#eef0f2]">{replay.length ? replay.map((event, index) => <motion.button key={event.id} type="button" onClick={() => openDetail({ kind: 'event', event })} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18, delay: Math.min(index * 0.035, 0.28) }} className="flex w-full items-start gap-3 px-4 py-3 text-left"><div className="mt-1 flex w-4 justify-center"><StatusDot status={event.severity === 'INFO' ? 'PASS' : event.severity} /></div><div className="min-w-0 flex-1"><div className="text-[8px] font-semibold tracking-[0.1em] text-[#9aa1aa]">{event.eventType}</div><div className="mt-1 line-clamp-2 text-[10px] leading-5 text-[#4f565f]">{event.summary || event.eventName}</div><div className="mt-1 text-[8px] text-[#a3a9b0]">{dateTime(event.occurredAt)}</div></div><ChevronRight className="mt-2 h-4 w-4 text-[#b7bcc2]" /></motion.button>) : <div className="p-5 text-[10px] text-[#9299a2]">연결된 canonical event가 없습니다.</div>}</div></div></Section>
        <Section title="Evidence & Council" subtitle="근거와 반대 의견을 같은 맥락에서 확인합니다."><div className="space-y-3"><button type="button" onClick={() => decision && openDetail({ kind: 'council', decision })} className={cn(card, 'w-full p-4 text-left')}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-[#626b75]" /><span className="text-[10px] font-semibold">Council</span></div><Pill color={tone(decision?.council?.verdict)}>{decision?.council?.verdict ?? 'PENDING'}</Pill></div><div className="mt-3 text-[9px] leading-5 text-[#858d96]">{decision?.council?.summary ?? 'Council summary가 기록되지 않았습니다.'}</div></button><div className={cn(card, 'divide-y divide-[#eef0f2]')}>{projection.evidence.slice(0, 6).map((event) => <button key={event.id} type="button" onClick={() => openDetail({ kind: 'event', event })} className="flex w-full items-start gap-3 px-4 py-3 text-left"><Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#69727c]" /><div className="min-w-0 flex-1"><div className="line-clamp-2 text-[9px] leading-4 text-[#59616b]">{event.summary || event.eventName}</div><div className="mt-1 text-[8px] text-[#a1a7ae]">{event.source} · {dateTime(event.occurredAt)}</div></div></button>)}{!projection.evidence.length && <div className="p-5 text-[10px] text-[#9299a2]">연결된 Evidence가 없습니다.</div>}</div></div></Section>
      </div>
    </main>
  </motion.div>;
};

export const BlackOracleMobileApp = () => {
  const [view, setView] = useState<View>('command');
  const [operations, setOperations] = useState<OperationsPayload | null>(null);
  const [factory, setFactory] = useState<FactoryStatusPayload | null>(null);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [market, setMarket] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail>(null);
  const reduced = useReducedMotion();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ops, fac, evt] = await Promise.allSettled([
        fetch('/api/trading-status', { cache: 'no-store' }).then((response) => response.json() as Promise<OperationsPayload>),
        fetch('/api/strategy-factory-status', { cache: 'no-store' }).then((response) => response.json() as Promise<FactoryStatusPayload>),
        fetch('/api/events?limit=500', { cache: 'no-store' }).then((response) => response.json() as Promise<EventsPayload>),
      ]);
      if (ops.status === 'fulfilled') setOperations(ops.value);
      if (fac.status === 'fulfilled') setFactory(fac.value);
      if (evt.status === 'fulfilled') setEvents(evt.value.events ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(timer); }, [load]);

  const instruments = useMemo(() => deriveInstrumentUniverse(operations, events), [operations, events]);
  const content = view === 'command' ? <CommandView operations={operations} instruments={instruments} setView={setView} openMarket={setMarket} openDetail={setDetail} />
    : view === 'markets' ? <MarketsView instruments={instruments} openMarket={setMarket} />
    : view === 'oracle' ? <OracleView operations={operations} events={events} openDetail={setDetail} />
    : view === 'trade' ? <TradeView operations={operations} openMarket={setMarket} openDetail={setDetail} />
    : view === 'lab' ? <LabView factory={factory} openDetail={setDetail} />
    : <SystemView operations={operations} events={events} factory={factory} />;

  return <div className="min-h-[100dvh] w-full overflow-x-hidden bg-[#f6f7f9] text-[#111318] antialiased">
    <DesktopRail view={view} setView={setView} operations={operations} />
    <div className="min-h-[100dvh] lg:pl-[220px]">
      <Header view={view} operations={operations} loading={loading} refresh={() => void load()} goSystem={() => setView('system')} />
      <AnimatePresence mode="wait" initial={false}><motion.div key={view} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>{content}</motion.div></AnimatePresence>
    </div>
    <MobileNav view={view} setView={setView} />
    <AnimatePresence>{market && <InstrumentCockpit market={market} operations={operations} events={events} back={() => setMarket(null)} openDetail={setDetail} />}</AnimatePresence>
    <AnimatePresence>{detail && <DetailSheet detail={detail} close={() => setDetail(null)} />}</AnimatePresence>
  </div>;
};
