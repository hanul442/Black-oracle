import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Beaker,
  BriefcaseBusiness,
  ChevronRight,
  CircleDot,
  FlaskConical,
  Home,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type {
  ClosedTrade,
  DecisionTapeItem,
  EventsPayload,
  FactoryPayload,
  FactoryTop,
  LedgerEvent,
  OperationsPayload,
} from './v2/types';
import { actionKo, cn, dateTime, pct, reasonKo, regimeKo, strategyName, timeAgo } from './v2/types';
import { formatKrw } from './v2/financial';
import { PortfolioEquityChart } from './v2/PortfolioEquityChart';
import { deriveInstrumentCockpit, deriveInstrumentUniverse, type InstrumentSummary } from './v9/instrument';
import { IntegratedMarketChart } from './v9/IntegratedMarketChart';
import { PositionSummary } from './v9/PositionSummary';

const green = '#16845b';
const red = '#d14b55';
const amber = '#a46b17';
const blue = '#3767d6';
const ink = '#111318';
const page = '#f6f7f9';
const card = 'rounded-[24px] border border-[#e7e9ed] bg-white';

type Tab = 'home' | 'markets' | 'lab' | 'portfolio' | 'more';
type FactoryRun = NonNullable<FactoryPayload['latestRun']> & {
  finished_at?: string;
  started_at?: string;
  bars?: number;
  seed?: number;
  generation_count?: number;
  blind_fraction?: number;
  status_counts?: Record<string, number>;
};
type FactoryStatusPayload = Omit<FactoryPayload, 'latestRun'> & {
  latestRun?: FactoryRun | null;
  runs?: FactoryRun[];
  governance?: {
    automaticChampionPromotion?: boolean;
    automaticLiveDeployment?: boolean;
    humanApprovalRequired?: boolean;
  };
};
type TouchOrigin = { x: number; y: number; at: number };

const tabs: Tab[] = ['home', 'markets', 'lab', 'portfolio', 'more'];
const swipeDistance = 56;
const swipeRatio = 1.25;
const swipeDuration = 800;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const percent = (value: number | null | undefined, signed = false) => {
  if (!finite(value)) return '—';
  const points = Math.abs(value) <= 1 ? value * 100 : value;
  return `${signed && points > 0 ? '+' : ''}${points.toFixed(1)}%`;
};
const score = (value: number | null | undefined) => finite(value) ? value.toFixed(2) : '—';
const tone = (value: string | null | undefined) => {
  const text = String(value ?? '').toUpperCase();
  if (['ENTER', 'BUY', 'LONG', 'PASS', 'APPROVE', 'CHAMPION_CANDIDATE', 'OK', 'SUCCESS'].includes(text)) return green;
  if (['EXIT', 'SELL', 'SHORT', 'REJECT', 'FAIL', 'ERROR', 'LOSS'].includes(text)) return red;
  return amber;
};
const strategyDisplayName = (item: FactoryTop, index: number) => {
  const base = strategyName(item, index);
  const generation = item.genome.generation == null ? 'G?' : `G${item.genome.generation}`;
  const version = item.genome.id.slice(-6).toUpperCase() || String(index + 1).padStart(2, '0');
  return `${base} · ${generation}-${version}`;
};
const canonicalStrategySort = (a: FactoryTop, b: FactoryTop) => (
  (b.evaluation.score - a.evaluation.score)
  || (b.metrics.oosExpectancy - a.metrics.oosExpectancy)
  || (b.metrics.sharpe - a.metrics.sharpe)
  || a.genome.id.localeCompare(b.genome.id)
);

const Pill = ({ children, color = '#737b86' }: { children: React.ReactNode; color?: string }) => (
  <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold" style={{ color, borderColor: `${color}28`, background: `${color}0b` }}>{children}</span>
);
const SectionTitle = ({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) => (
  <div className="mb-3 flex items-end justify-between gap-4">
    <div><div className="text-[17px] font-semibold tracking-[-0.025em] text-[#15171c]">{title}</div>{subtitle && <div className="mt-1 text-[11px] leading-4 text-[#8c929a]">{subtitle}</div>}</div>
    {right}
  </div>
);
const Metric = ({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) => (
  <div className="min-w-0"><div className="text-[9px] font-medium text-[#969ca4]">{label}</div><div className="mt-1 truncate text-[15px] font-semibold tabular-nums tracking-[-0.02em]" style={{ color: accent ?? ink }}>{value}</div></div>
);

const Header = ({ tab, operations, loading, refresh }: { tab: Tab; operations: OperationsPayload | null; loading: boolean; refresh: () => void }) => {
  const labels: Record<Tab, string> = { home: 'Oracle', markets: 'Markets', lab: 'Strategy Lab', portfolio: 'Portfolio', more: 'More' };
  const statusColor = operations?.status === 'OK' ? green : operations?.status === 'ERROR' ? red : amber;
  return <div className="sticky top-0 z-40 border-b border-[#eceef1] bg-white/95 backdrop-blur-xl"><div className="flex items-center justify-between px-5 pb-3 pt-[max(env(safe-area-inset-top),14px)]"><div><div className="text-[9px] font-semibold tracking-[0.23em] text-[#9aa0a8]">BLACK ORACLE · V10 MOBILE</div><div className="mt-1 flex items-center gap-2"><span className="text-[21px] font-semibold tracking-[-0.045em] text-[#121419]">{labels[tab]}</span><span className="h-2 w-2 rounded-full" style={{ background: statusColor }} /></div></div><button type="button" onClick={refresh} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e8eaed] bg-white" aria-label="새로고침"><RefreshCw className={cn('h-4 w-4 text-[#626871]', loading && 'animate-spin')} /></button></div></div>;
};

const BottomNav = ({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) => {
  const items: Array<{ id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'home', label: 'Home', Icon: Home },
    { id: 'markets', label: 'Markets', Icon: Search },
    { id: 'lab', label: 'Lab', Icon: FlaskConical },
    { id: 'portfolio', label: 'Portfolio', Icon: BriefcaseBusiness },
    { id: 'more', label: 'More', Icon: MoreHorizontal },
  ];
  return <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e6e8eb] bg-white/96 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur-xl"><div className="mx-auto grid max-w-[720px] grid-cols-5 px-2 pt-2">{items.map(({ id, label, Icon }) => { const active = tab === id; return <button type="button" key={id} onClick={() => setTab(id)} className="flex min-h-12 flex-col items-center justify-center gap-1"><Icon className="h-[19px] w-[19px]" style={{ color: active ? ink : '#a0a5ad' }} /><span className="text-[9px] font-semibold" style={{ color: active ? ink : '#a0a5ad' }}>{label}</span></button>; })}</div></div>;
};

const DecisionBadge = ({ item }: { item: DecisionTapeItem | null }) => item ? <Pill color={tone(item.decision)}>{actionKo(item.decision)}</Pill> : <Pill>미분석</Pill>;

const InstrumentRow = ({ item, open }: { item: InstrumentSummary; open: () => void }) => {
  const decision = item.latestDecision;
  const lastAt = Math.max(item.latestDecisionAt ?? 0, item.latestEventAt ?? 0) || null;
  const position = item.openPosition;
  return <button type="button" onClick={open} className={cn(card, 'w-full px-4 py-4 text-left transition active:scale-[0.995]')}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[15px] font-semibold tracking-[-0.02em] text-[#17191e]">{item.market}</span>{position && <Pill color={blue}>OPEN</Pill>}{item.recentlyAnalyzed && <Pill color="#68717c">최근 AI 분석</Pill>}</div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#949aa2]"><span>{item.assetClass === 'EQUITY' ? 'Korea Equity' : item.assetClass === 'CRYPTO' ? 'Crypto' : 'Instrument'}</span><span>{lastAt ? timeAgo(lastAt) : '분석 기록 없음'}</span>{position && <span>진입 {dateTime(position.openedAt)}</span>}</div>{decision && <div className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#717881]">{reasonKo(decision.primaryReason ?? decision.reasons?.[0])}</div>}</div><div className="flex shrink-0 items-center gap-2"><DecisionBadge item={decision} /><ChevronRight className="h-4 w-4 text-[#b0b5bc]" /></div></div></button>;
};

const HomeView = ({ operations, instruments, openMarket, goMarkets }: { operations: OperationsPayload | null; instruments: InstrumentSummary[]; openMarket: (market: string) => void; goMarkets: () => void }) => {
  const p = operations?.portfolio;
  const perf = operations?.performance;
  const radar = instruments.filter((item) => item.recentlyAnalyzed || item.openPosition).slice(0, 4);
  const open = p?.openPositions ?? [];
  return <main className="px-4 pb-28 pt-4">
    <section className={cn(card, 'p-5')}><div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-medium text-[#8b9098]">PAPER · Simulation portfolio</div><div className="mt-2 text-[36px] font-semibold tabular-nums tracking-[-0.055em] text-[#101216]">{formatKrw(p?.equity)}</div><div className="mt-2 flex items-center gap-2"><span className="text-[14px] font-semibold" style={{ color: (p?.dailyPnlPct ?? 0) >= 0 ? green : red }}>{pct(p?.dailyPnlPct, true)} today</span><span className="text-[11px] text-[#a1a6ad]">· {pct(perf?.totalReturnPct, true)} total</span></div></div><Pill color={red}>KIS LIVE · NOT CONNECTED</Pill></div><div className="mt-5 grid grid-cols-3 gap-4 border-t border-[#eef0f2] pt-4"><Metric label="Cash" value={formatKrw(p?.cash)} /><Metric label="Win rate" value={pct(perf?.winRate)} /><Metric label="MDD" value={pct(perf?.maxDrawdownPct)} accent={(perf?.maxDrawdownPct ?? 0) > 0.05 ? red : undefined} /></div></section>
    <section className="mt-3 grid grid-cols-3 gap-1.5 rounded-[20px] border border-[#e9eaed] bg-white p-2"><div className="rounded-[14px] bg-[#f7f8fa] px-2 py-3"><div className="text-[8px] text-[#9ca1a8]">Runtime</div><div className="mt-1 text-[10px] font-semibold" style={{ color: tone(operations?.status) }}>{operations?.status ?? 'UNKNOWN'}</div></div><div className="rounded-[14px] bg-[#f7f8fa] px-2 py-3"><div className="text-[8px] text-[#9ca1a8]">Evidence</div><div className="mt-1 text-[10px] font-semibold text-[#34383e]">{operations?.ingestion?.evidenceActive ?? '—'} active</div></div><div className="rounded-[14px] bg-[#f7f8fa] px-2 py-3"><div className="text-[8px] text-[#9ca1a8]">Open</div><div className="mt-1 text-[10px] font-semibold text-[#34383e]">{open.length} positions</div></div></section>
    {open.length > 0 && <section className="mt-7"><SectionTitle title="Open now" subtitle="언제 진입했고 현재 얼마가 들어가 있는지 바로 확인합니다." /><div className="space-y-2">{open.slice(0, 2).map((position) => <button key={`${position.market}-${position.openedAt}`} type="button" onClick={() => openMarket(position.market)} className="block w-full text-left"><PositionSummary position={position} portfolioEquity={p?.equity} compact /></button>)}</div></section>}
    <section className="mt-7"><SectionTitle title="Oracle Radar" subtitle="최근 AI 분석 또는 현재 운용 중인 종목" right={<button type="button" onClick={goMarkets} className="text-[10px] font-semibold text-[#626a74]">전체 보기</button>} /><div className="space-y-2">{radar.length ? radar.map((item) => <InstrumentRow key={item.market} item={item} open={() => openMarket(item.market)} />) : <div className={cn(card, 'p-5 text-[11px] leading-5 text-[#899099]')}>아직 최근 분석 종목이 없습니다.</div>}</div></section>
    <section className="mt-7"><SectionTitle title="Capital discipline" subtitle="Crypto와 KRX는 하나의 Paper 자본을 공유합니다." /><div className={cn(card, 'p-4')}><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[#59616b]" /><div><div className="text-[12px] font-semibold text-[#24272d]">Shared ₩100M · sleeve-aware risk</div><div className="mt-1 text-[10px] leading-5 text-[#858c95]">시장 데이터 연결과 증권계좌 연결은 분리합니다. 현재 실계좌 주문 권한은 없습니다.</div></div></div></div></section>
  </main>;
};

const MarketsView = ({ instruments, openMarket }: { instruments: InstrumentSummary[]; openMarket: (market: string) => void }) => {
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState<'ALL' | 'CRYPTO' | 'EQUITY'>('ALL');
  const filtered = instruments.filter((item) => (classFilter === 'ALL' || item.assetClass === classFilter) && item.market.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className="px-4 pb-28 pt-4"><div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ba1a9]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="BTC, KRX-000660…" className="h-12 w-full rounded-[18px] border border-[#e4e7ea] bg-white pl-11 pr-4 text-[13px] outline-none placeholder:text-[#adb2b9] focus:border-[#aeb4bb]" /></div><div className="mt-3 flex gap-2">{(['ALL', 'CRYPTO', 'EQUITY'] as const).map((item) => <button type="button" key={item} onClick={() => setClassFilter(item)} className={cn('rounded-full px-3 py-1.5 text-[10px] font-semibold', classFilter === item ? 'bg-[#17191e] text-white' : 'border border-[#e5e7ea] bg-white text-[#7d848d]')}>{item === 'ALL' ? 'All' : item === 'CRYPTO' ? 'Crypto' : 'Korea Equity'}</button>)}</div><section className="mt-6"><SectionTitle title="Analyzed instruments" subtitle="종목을 누르면 실제 차트·현재가·진입정보·Council까지 한 화면에서 봅니다." /><div className="space-y-2">{filtered.map((item) => <InstrumentRow key={item.market} item={item} open={() => openMarket(item.market)} />)}{!filtered.length && <div className={cn(card, 'p-5 text-[11px] text-[#8b9199]')}>조건에 맞는 canonical instrument가 없습니다.</div>}</div></section></main>;
};

const CouncilBoardroom = ({ decision, events }: { decision: DecisionTapeItem | null; events: LedgerEvent[] }) => {
  const members = decision?.council?.members ?? [];
  const councilEvents = events.filter((event) => event.eventType === 'COUNCIL').slice(0, 8);
  return <section><SectionTitle title="Council Boardroom" subtitle="실제로 기록된 Council 판단만 보여줍니다." /><div className={cn(card, 'overflow-hidden')}><div className="border-b border-[#edf0f2] px-4 py-3"><div className="text-[9px] font-semibold tracking-[0.13em] text-[#9aa0a8]">ROUND 1 · INDEPENDENT REVIEW</div></div>{members.length ? <div className="divide-y divide-[#edf0f2]">{members.map((member, index) => <div key={`${member.role}-${index}`} className="px-4 py-4"><div className="flex items-center justify-between gap-3"><div className="text-[12px] font-semibold text-[#25282e]">{member.role}</div><Pill color={tone(member.vote)}>{actionKo(member.vote)} · {percent(member.confidence)}</Pill></div><div className="mt-2 text-[10px] leading-5 text-[#7e858e]">{member.reasons?.[0] ? reasonKo(member.reasons[0]) : '세부 사유가 기록되지 않았습니다.'}</div></div>)}</div> : <div className="px-4 py-5 text-[10px] leading-5 text-[#8d939b]">member-level Council 발언이 없습니다.</div>}{councilEvents.length > 0 && <div className="border-t border-[#edf0f2] bg-[#fafbfc] px-4 py-4"><div className="text-[9px] font-semibold tracking-[0.13em] text-[#969ca4]">RECORDED COUNCIL EVENTS</div><div className="mt-3 space-y-2">{councilEvents.slice(0, 3).map((event) => <div key={event.id} className="flex items-start gap-2"><CircleDot className="mt-1 h-3 w-3 shrink-0 text-[#8b929b]" /><div><div className="text-[10px] font-medium text-[#4d535b]">{event.summary || event.eventName}</div><div className="mt-0.5 text-[9px] text-[#a1a6ad]">{dateTime(event.occurredAt)}</div></div></div>)}</div></div>}<div className="border-t border-[#e8eaed] bg-white px-4 py-4"><div className="text-[9px] font-semibold tracking-[0.13em] text-[#999fa7]">ARBITER</div><div className="mt-2 flex items-center gap-2"><DecisionBadge item={decision} /><span className="text-[12px] font-semibold text-[#2b2f35]">{decision?.council?.verdict ?? 'Council verdict 미확인'}</span></div><div className="mt-2 text-[9px] text-[#a0a5ad]">executionAuthority={decision?.council?.members?.some((member) => member.executionAuthority === true) ? 'recorded true' : 'false / advisory'}</div></div></div></section>;
};

const InstrumentCockpit = ({ market, operations, events, back }: { market: string; operations: OperationsPayload | null; events: LedgerEvent[]; back: () => void }) => {
  const projection = useMemo(() => deriveInstrumentCockpit(market, operations, events), [market, operations, events]);
  const decision = projection.latestDecision;
  const position = operations?.portfolio?.openPositions?.find((item) => item.market.toUpperCase() === market.toUpperCase()) ?? null;
  const tradeMap = decision?.tradeMap;
  const forecast = decision?.forecast;
  const reasons = [decision?.primaryReason, ...(decision?.reasons ?? [])].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index).slice(0, 5);
  const latestEvidenceEvents = projection.evidence.slice(0, 5);
  const strategyVersion = projection.latestByType.STRATEGY?.strategyVersion;
  const strategyId = decision?.router?.route ?? decision?.strategyDisposition ?? projection.latestByType.STRATEGY?.strategyId ?? '선택 전략 미확인';
  return <div className="min-h-[100dvh] bg-[#f6f7f9] pb-12 text-[#111318]"><div className="sticky top-0 z-50 border-b border-[#e9ebee] bg-white/96 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-xl"><div className="flex items-center gap-3"><button type="button" onClick={back} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7e9ec]"><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0"><div className="text-[9px] font-semibold tracking-[0.16em] text-[#9ba1a9]">INSTRUMENT COCKPIT</div><div className="mt-0.5 truncate text-[19px] font-semibold tracking-[-0.035em]">{market}</div></div></div></div><main className="px-4 py-4">
    <section className={cn(card, 'p-5')}><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] text-[#90969e]">Latest Oracle decision</div><div className="mt-2 text-[28px] font-semibold tracking-[-0.045em]" style={{ color: tone(decision?.decision) }}>{decision ? actionKo(decision.decision) : '미분석'}</div></div><DecisionBadge item={decision} /></div><div className="mt-4 grid grid-cols-3 gap-4 border-t border-[#eef0f2] pt-4"><Metric label="Regime" value={regimeKo(decision?.regime)} /><Metric label="Trade score" value={finite(decision?.oracleTradeScore) ? decision?.oracleTradeScore : '—'} /><Metric label="Analyzed" value={decision?.timestamp ? timeAgo(decision.timestamp) : '—'} /></div><div className="mt-4 rounded-[16px] bg-[#f8f9fa] px-4 py-3 text-[10px] leading-5 text-[#727982]">{decision ? reasonKo(decision.primaryReason ?? decision.reasons?.[0]) : '이 종목에 대한 최신 deterministic decision이 없습니다.'}</div></section>
    {position && <section className="mt-4"><PositionSummary position={position} portfolioEquity={operations?.portfolio?.equity} /></section>}
    <section className="mt-7"><IntegratedMarketChart market={market} decision={decision} position={position} /></section>
    <section className="mt-7"><SectionTitle title={position ? 'Active protection & forecast' : 'Forecast & trade map'} subtitle={position ? '실제 보유 포지션의 진입/보호 정보와 신규 후보 trade map을 구분합니다.' : '존재하는 예측과 가격 규칙만 표시합니다.'} /><div className={cn(card, 'p-4')}><div className="grid grid-cols-2 gap-x-5 gap-y-4"><Metric label="Forecast" value={forecast?.available ? forecast.direction : '미확인'} /><Metric label="Bullish probability" value={forecast?.available ? percent(forecast.probabilityBullish) : '—'} /><Metric label="Oracle Entry" value={formatKrw(tradeMap?.entryPrice)} /><Metric label="Oracle Stop" value={formatKrw(tradeMap?.stopLossPrice ?? tradeMap?.structuralInvalidationPrice)} /><Metric label="Oracle TP1" value={formatKrw(tradeMap?.takeProfit1Price)} /><Metric label="Oracle TP2" value={formatKrw(tradeMap?.takeProfit2Price)} /><Metric label="R:R 1" value={finite(tradeMap?.riskReward1) ? `${score(tradeMap?.riskReward1)}×` : '—'} /><Metric label="R:R 2" value={finite(tradeMap?.riskReward2) ? `${score(tradeMap?.riskReward2)}×` : '—'} /></div>{!forecast?.available && <div className="mt-4 flex gap-2 rounded-[15px] border border-[#eee6d8] bg-[#fffaf2] px-3 py-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#a8772d]" /><div className="text-[9px] leading-4 text-[#8d7349]">없는 가격대는 임의 생성하지 않습니다.</div></div>}</div></section>
    <section className="mt-7"><SectionTitle title="Why this decision?" subtitle="찬성·반대·리스크 근거를 판단 기록에서 그대로 풉니다." /><div className={cn(card, 'divide-y divide-[#eef0f2]')}>{reasons.length ? reasons.map((reason, index) => <div key={`${index}-${reason}`} className="flex gap-3 px-4 py-3"><span className="mt-0.5 text-[9px] font-semibold text-[#a0a5ad]">{String(index + 1).padStart(2, '0')}</span><div className="text-[10px] leading-5 text-[#666e78]">{reasonKo(reason)}</div></div>) : <div className="px-4 py-5 text-[10px] text-[#8e949c]">판단 사유가 기록되지 않았습니다.</div>}</div></section>
    <section className="mt-7"><CouncilBoardroom decision={decision} events={projection.councilEvents} /></section>
    <section className="mt-7"><SectionTitle title="Strategy" subtitle="같은 전략명이라도 버전/ID를 구분합니다." /><div className={cn(card, 'p-4')}><div className="flex items-center gap-3"><Beaker className="h-5 w-5 text-[#59616b]" /><div className="min-w-0"><div className="truncate text-[12px] font-semibold text-[#2a2d33]">{strategyId}{strategyVersion ? ` · ${strategyVersion}` : ''}</div><div className="mt-1 text-[9px] text-[#9ba1a9]">{projection.strategyEvents.length} strategy events</div></div></div></div></section>
    <section className="mt-7"><SectionTitle title="Evidence" subtitle={`${projection.evidence.length} canonical evidence events linked`} /><div className={cn(card, 'divide-y divide-[#eef0f2]')}>{latestEvidenceEvents.length ? latestEvidenceEvents.map((event) => <div key={event.id} className="px-4 py-3"><div className="text-[10px] font-medium leading-5 text-[#4a5058]">{event.summary || event.eventName}</div><div className="mt-1 text-[9px] text-[#a0a5ad]">{dateTime(event.occurredAt)} · {event.source || 'source unknown'}</div></div>) : <div className="px-4 py-5 text-[10px] text-[#8e949c]">연결된 canonical Evidence가 없습니다.</div>}</div></section>
    <section className="mt-7"><SectionTitle title="Outcome & lineage" subtitle="Decision → Risk → Trade → Outcome" /><div className={cn(card, 'p-4')}><div className="grid grid-cols-4 gap-2">{(['DECISION', 'RISK', 'TRADE', 'OUTCOME'] as const).map((type) => { const event = projection.latestByType[type]; return <div key={type} className="rounded-[14px] bg-[#f7f8fa] px-2 py-3"><div className="text-[8px] text-[#9ca1a8]">{type}</div><div className="mt-1 text-[9px] font-semibold text-[#444a52]">{event ? timeAgo(event.occurredAt) : '—'}</div></div>; })}</div></div></section>
  </main></div>;
};

const StrategyDetail = ({ item, index, back }: { item: FactoryTop; index: number; back: () => void }) => {
  const validation = item.validation;
  return <div className="min-h-[100dvh] bg-[#f6f7f9] pb-12 text-[#111318]"><div className="sticky top-0 z-50 border-b border-[#e9ebee] bg-white/96 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-xl"><div className="flex items-center gap-3"><button type="button" onClick={back} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7e9ec]"><ArrowLeft className="h-4 w-4" /></button><div className="min-w-0"><div className="text-[9px] font-semibold tracking-[0.16em] text-[#9ba1a9]">STRATEGY LAB</div><div className="mt-0.5 truncate text-[18px] font-semibold tracking-[-0.035em]">{strategyDisplayName(item, index)}</div></div></div></div><main className="px-4 py-4"><section className={cn(card, 'p-5')}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] text-[#9298a0]">Lifecycle</div><div className="mt-2 text-[26px] font-semibold tracking-[-0.04em]">{item.evaluation.lifecycle ?? 'UNCLASSIFIED'}</div></div><Pill color={item.evaluation.hardGatePassed ? green : red}>{item.evaluation.hardGatePassed ? 'HARD GATE PASS' : 'HARD GATE BLOCK'}</Pill></div><div className="mt-5 grid grid-cols-3 gap-4 border-t border-[#eef0f2] pt-4"><Metric label="Score" value={score(item.evaluation.score)} /><Metric label="OOS samples" value={item.metrics.oosSamples} /><Metric label="OOS EV" value={percent(item.metrics.oosExpectancy, true)} /></div></section><section className="mt-7"><SectionTitle title="Validation" subtitle="원 수치 기반 검증" /><div className={cn(card, 'grid grid-cols-2 gap-x-5 gap-y-5 p-4')}><Metric label="Sharpe" value={score(item.metrics.sharpe)} /><Metric label="Sortino" value={score(item.metrics.sortino)} /><Metric label="Max drawdown" value={percent(item.metrics.maxDrawdownPct)} /><Metric label="Regime stability" value={percent(item.metrics.regimeStability)} /><Metric label="Parameter robustness" value={percent(item.metrics.parameterRobustness)} /><Metric label="Monte Carlo survival" value={percent(item.metrics.monteCarloSurvivalRate)} /><Metric label="Walk-forward positive" value={validation?.walkForward ? percent(validation.walkForward.positiveFoldRate) : '—'} /><Metric label="Blind expectancy" value={validation?.blind ? percent(validation.blind.expectancy, true) : '—'} /></div></section><section className="mt-7"><SectionTitle title="Genome & version" subtitle="동일 계열 전략도 고유 ID로 구분" /><div className={cn(card, 'p-4')}><div className="flex flex-wrap gap-2">{item.genome.indicators.map((indicator) => <Pill key={indicator} color="#626b76">{indicator}</Pill>)}</div><div className="mt-4 text-[10px] leading-5 text-[#707781]">{item.hypothesis?.thesis || '별도 hypothesis 텍스트가 기록되지 않았습니다.'}</div><div className="mt-3 text-[9px] font-semibold text-[#727982]">{strategyDisplayName(item, index)}</div><div className="mt-1 text-[9px] text-[#a0a5ad]">Genome {item.genome.id}</div></div></section><section className="mt-7"><SectionTitle title="Monte Carlo" /><div className={cn(card, 'p-4')}><div className="flex items-center justify-between"><div><div className="text-[10px] text-[#9298a0]">Survival probability</div><div className="mt-1 text-[28px] font-semibold tabular-nums tracking-[-0.04em]">{percent(item.metrics.monteCarloSurvivalRate)}</div></div><BarChart3 className="h-7 w-7 text-[#737b85]" /></div></div></section><section className="mt-7"><SectionTitle title="Hard gate audit" /><div className={cn(card, 'divide-y divide-[#eef0f2]')}>{item.evaluation.hardGateReasons?.length ? item.evaluation.hardGateReasons.map((reason, i) => <div key={`${i}-${reason}`} className="px-4 py-3 text-[10px] leading-5 text-[#747b84]">{reason}</div>) : <div className="px-4 py-4 text-[10px] text-[#8c929a]">기록된 hard-gate blocker가 없습니다.</div>}</div></section></main></div>;
};

const LabView = ({ factory, openStrategy }: { factory: FactoryStatusPayload | null; openStrategy: (item: FactoryTop, index: number) => void }) => {
  const run = factory?.latestRun;
  const tops = useMemo(() => [...(run?.top_results ?? [])].sort(canonicalStrategySort), [run?.top_results]);
  const counts = run?.status_counts ?? {};
  return <main className="px-4 pb-28 pt-4"><section className={cn(card, 'p-5')}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-semibold tracking-[0.13em] text-[#9aa0a8]">STRATEGY LAB</div><div className="mt-2 text-[28px] font-semibold tracking-[-0.045em]">Champion race</div><div className="mt-2 text-[10px] leading-5 text-[#858c95]">단일 canonical 순위: evaluation score → OOS expectancy → Sharpe → Genome ID.</div></div><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#f4f5f7]"><FlaskConical className="h-5 w-5 text-[#555d67]" /></div></div><div className="mt-5 grid grid-cols-3 gap-4 border-t border-[#eef0f2] pt-4"><Metric label="Candidates" value={run?.candidate_count ?? '—'} /><Metric label="Latest run" value={run?.finished_at ? timeAgo(Date.parse(run.finished_at)) : '—'} /><Metric label="Market" value={run?.market ?? '—'} /></div></section><section className="mt-3 grid grid-cols-3 gap-1.5 rounded-[20px] border border-[#e9eaed] bg-white p-2"><div className="rounded-[14px] bg-[#f7f8fa] px-2 py-3"><div className="text-[8px] text-[#9ca1a8]">Promotion</div><div className="mt-1 text-[10px] font-semibold text-[#34383e]">MANUAL</div></div><div className="rounded-[14px] bg-[#f7f8fa] px-2 py-3"><div className="text-[8px] text-[#9ca1a8]">Authority</div><div className="mt-1 text-[10px] font-semibold text-[#34383e]">SHADOW</div></div><div className="rounded-[14px] bg-[#f7f8fa] px-2 py-3"><div className="text-[8px] text-[#9ca1a8]">Rejected</div><div className="mt-1 text-[10px] font-semibold text-[#34383e]">{counts.REJECT ?? '—'}</div></div></section><section className="mt-7"><SectionTitle title="Ranked strategies" subtitle="같은 이름으로 뭉개지지 않도록 Generation + Genome ID를 항상 표시합니다." /><div className="space-y-2">{tops.length ? tops.map((item, index) => <button type="button" key={item.genome.id} onClick={() => openStrategy(item, index)} className={cn(card, 'w-full px-4 py-4 text-left')}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[11px] font-semibold text-[#727982]">#{index + 1}</span><span className="truncate text-[14px] font-semibold text-[#23262c]">{strategyDisplayName(item, index)}</span></div><div className="mt-2 flex items-center gap-2"><Pill color={item.evaluation.hardGatePassed ? green : red}>{item.evaluation.lifecycle ?? 'RESEARCH'}</Pill><span className="text-[9px] font-semibold text-[#6e7680]">Score {score(item.evaluation.score)}</span></div><div className="mt-3 grid grid-cols-4 gap-3"><Metric label="OOS EV" value={percent(item.metrics.oosExpectancy, true)} /><Metric label="Sharpe" value={score(item.metrics.sharpe)} /><Metric label="MDD" value={percent(item.metrics.maxDrawdownPct)} /><Metric label="MC" value={percent(item.metrics.monteCarloSurvivalRate)} /></div></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#b2b6bc]" /></div></button>) : <div className={cn(card, 'p-5 text-[10px] leading-5 text-[#8e949c]')}>최신 Factory run의 top_results가 없습니다.</div>}</div></section></main>;
};

const PortfolioView = ({ operations, openMarket }: { operations: OperationsPayload | null; openMarket: (market: string) => void }) => {
  const p = operations?.portfolio;
  const perf = operations?.performance;
  const trades = operations?.recentTrades ?? [];
  const equityValues = (operations?.equityCurve ?? []).map((item) => item.equity).filter(finite);
  const positive = equityValues.length < 2 || equityValues[equityValues.length - 1] >= equityValues[0];
  return <main className="px-4 pb-28 pt-4"><section className={cn(card, 'p-5')}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] text-[#8f959d]">PAPER · Simulation portfolio</div><div className="mt-2 text-[34px] font-semibold tabular-nums tracking-[-0.055em]">{formatKrw(p?.equity)}</div></div><Pill color={red}>KIS LIVE · NOT CONNECTED</Pill></div><div className="mt-4"><PortfolioEquityChart values={equityValues} positive={positive} /></div><div className="mt-5 grid grid-cols-3 gap-4 border-t border-[#eef0f2] pt-4"><Metric label="Return" value={pct(perf?.totalReturnPct, true)} accent={(perf?.totalReturnPct ?? 0) >= 0 ? green : red} /><Metric label="Expectancy" value={formatKrw(perf?.expectancy)} /><Metric label="Profit factor" value={finite(perf?.profitFactor) ? score(perf?.profitFactor) : '—'} /></div></section><section className="mt-7"><SectionTitle title="Open exposure" subtitle="현재가·투입원금·비중·진입시각을 포트폴리오 안에서 바로 표시합니다." /><div className="space-y-3">{(p?.openPositions ?? []).map((position) => <button type="button" key={`${position.market}-${position.openedAt}`} onClick={() => openMarket(position.market)} className="block w-full text-left"><PositionSummary position={position} portfolioEquity={p?.equity} /></button>)}{!(p?.openPositions?.length) && <div className={cn(card, 'p-5 text-[10px] text-[#8d939b]')}>열린 Paper 포지션이 없습니다.</div>}</div></section><section className="mt-7"><SectionTitle title="Recent outcomes" subtitle="진입 → 청산 시간을 함께 표시합니다." /><div className={cn(card, 'divide-y divide-[#eef0f2]')}>{trades.slice(0, 12).map((trade: ClosedTrade) => <button type="button" key={trade.id} onClick={() => openMarket(trade.market)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"><div><div className="text-[11px] font-semibold">{trade.market}</div><div className="mt-1 text-[9px] text-[#9ca1a8]">{dateTime(trade.openedAt)} → {dateTime(trade.closedAt)} · {trade.exitReason}</div><div className="mt-1 text-[9px] text-[#9ca1a8]">Entry {formatKrw(trade.entryPrice)} · Exit {formatKrw(trade.exitPrice)} · {trade.strategyVersion}</div></div><div className="text-[11px] font-semibold tabular-nums" style={{ color: trade.returnPct >= 0 ? green : red }}>{percent(trade.returnPct, true)}</div></button>)}{!trades.length && <div className="px-4 py-5 text-[10px] text-[#8d939b]">완료된 거래가 없습니다.</div>}</div></section></main>;
};

const MoreView = ({ operations, events, factory }: { operations: OperationsPayload | null; events: LedgerEvent[]; factory: FactoryStatusPayload | null }) => (
  <main className="px-4 pb-28 pt-4"><section className={cn(card, 'p-4')}><SectionTitle title="System integrity" subtitle="모르는 상태를 정상으로 표시하지 않습니다." /><div className="space-y-3">{[['Trading runtime', operations?.status ?? 'UNKNOWN'], ['Canonical events', String(events.length)], ['Evidence active', String(operations?.ingestion?.evidenceActive ?? 'UNKNOWN')], ['Strategy Lab', factory?.available === false ? 'UNAVAILABLE' : factory?.latestRun ? 'AVAILABLE' : 'UNKNOWN'], ['Broker account', 'KIS NOT CONNECTED'], ['Council authority', operations?.council?.executionAuthority === true ? 'EXECUTION ENABLED' : 'SHADOW / ADVISORY']].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-[#eef0f2] pb-3 last:border-b-0 last:pb-0"><span className="text-[10px] text-[#7d848d]">{label}</span><span className="text-[10px] font-semibold text-[#40464e]">{value}</span></div>)}</div></section><section className="mt-7"><SectionTitle title="What moved recently" /><div className={cn(card, 'divide-y divide-[#eef0f2]')}>{events.slice(0, 12).map((event) => <div key={event.id} className="px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-medium leading-5 text-[#4b5159]">{event.summary || event.eventName}</div><div className="mt-1 text-[9px] text-[#a0a5ad]">{event.market ?? 'SYSTEM'} · {dateTime(event.occurredAt)}</div></div><Pill color={event.severity === 'ERROR' || event.severity === 'CRITICAL' ? red : '#7b838d'}>{event.eventType}</Pill></div></div>)}</div></section></main>
);

export const BlackOracleMobileApp = () => {
  const [tab, setTab] = useState<Tab>('home');
  const [operations, setOperations] = useState<OperationsPayload | null>(null);
  const [factory, setFactory] = useState<FactoryStatusPayload | null>(null);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [market, setMarket] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<{ item: FactoryTop; index: number } | null>(null);
  const origin = useRef<TouchOrigin | null>(null);
  const suppressClickUntil = useRef(0);

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
  useEffect(() => { void load(); const timer = window.setInterval(() => { void load(); }, 30_000); return () => window.clearInterval(timer); }, [load]);

  const sortedEvents = useMemo(() => [...events].sort((a, b) => b.occurredAt - a.occurredAt), [events]);
  const instruments = useMemo(() => deriveInstrumentUniverse(operations, sortedEvents), [operations, sortedEvents]);

  if (market) return <InstrumentCockpit market={market} operations={operations} events={sortedEvents} back={() => setMarket(null)} />;
  if (strategy) return <StrategyDetail item={strategy.item} index={strategy.index} back={() => setStrategy(null)} />;

  return <div className="h-[100dvh] w-full overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y text-[#111318]" style={{ background: page, WebkitOverflowScrolling: 'touch' }} onTouchStart={(event) => { if (event.touches.length !== 1) { origin.current = null; return; } const touch = event.touches[0]; origin.current = { x: touch.clientX, y: touch.clientY, at: Date.now() }; }} onTouchCancel={() => { origin.current = null; }} onTouchEnd={(event) => { const start = origin.current; origin.current = null; if (!start || event.changedTouches.length !== 1) return; const touch = event.changedTouches[0]; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y; const horizontal = Math.abs(dx) >= swipeDistance && Math.abs(dx) > Math.abs(dy) * swipeRatio; if (!horizontal || Date.now() - start.at > swipeDuration) return; const current = tabs.indexOf(tab); const next = dx < 0 ? current + 1 : current - 1; if (next < 0 || next >= tabs.length) return; suppressClickUntil.current = Date.now() + 300; setTab(tabs[next]); }} onClickCapture={(event) => { if (Date.now() > suppressClickUntil.current) return; const target = event.target as HTMLElement; if (target.closest('[data-v9-nav="true"]')) return; event.preventDefault(); event.stopPropagation(); }}>
    <Header tab={tab} operations={operations} loading={loading} refresh={() => void load()} />
    {tab === 'home' && <HomeView operations={operations} instruments={instruments} openMarket={setMarket} goMarkets={() => setTab('markets')} />}
    {tab === 'markets' && <MarketsView instruments={instruments} openMarket={setMarket} />}
    {tab === 'lab' && <LabView factory={factory} openStrategy={(item, index) => setStrategy({ item, index })} />}
    {tab === 'portfolio' && <PortfolioView operations={operations} openMarket={setMarket} />}
    {tab === 'more' && <MoreView operations={operations} events={sortedEvents} factory={factory} />}
    <div data-v9-nav="true"><BottomNav tab={tab} setTab={setTab} /></div>
  </div>;
};
