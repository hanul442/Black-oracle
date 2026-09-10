import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  Brain,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  Eye,
  FileText,
  FlaskConical,
  Home,
  Layers,
  ListTree,
  Lock,
  MoreHorizontal,
  Network,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type DecisionTapeItem = {
  timestamp: number;
  market: string;
  decision: string;
  regime?: string | null;
  regimeConfidence?: number | null;
  oracleTradeScore: number | null;
  confidence?: number | null;
  strategyDisposition?: string | null;
  riskDisposition?: string | null;
  eventScore?: number | null;
  evidenceActiveCount?: number;
  evidenceContradictionCount?: number;
  evidenceIds?: string[];
  primaryReason?: string | null;
  reasons?: string[];
  riskReasons?: string[];
  forecast?: null | {
    available: boolean;
    direction: string;
    probabilityBullish: number | null;
    probabilityBearish: number | null;
    confidence: number;
    uncertainty: number;
  };
};

type ClosedTrade = {
  id: string;
  market: string;
  openedAt: number;
  closedAt: number;
  entryPrice: number;
  exitPrice: number;
  netPnl: number;
  returnPct: number;
  fees: number;
  exitReason: string;
  strategyVersion: string;
  entryOracleTradeScore: number;
  exitOracleTradeScore: number;
};

type OpenPosition = {
  market: string;
  quantity: number;
  averageCost: number;
  entryPrice: number;
  openedAt: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
};

type OperationsPayload = {
  success?: boolean;
  available?: boolean;
  status?: 'OK' | 'DEGRADED' | 'WAITING' | 'ERROR' | 'UNAVAILABLE';
  mode?: 'PAPER';
  strategyVersion?: string | null;
  loop?: {
    cycleCount: number;
    intervalMs: number;
    maxMarkets: number;
    maxOpenPositions: number;
    ageMs: number | null;
    stale: boolean;
    lastCycle: null | {
      startedAt: number;
      finishedAt: number;
      durationMs: number;
      scanned: number;
      entered: number;
      exited: number;
      held: number;
      noTrade?: number;
      errors: Array<{ market: string; error: string }>;
    };
  };
  portfolio?: {
    initialEquity: number;
    equity: number;
    cash: number;
    realizedPnl: number;
    feesPaid: number;
    dailyPnlPct: number;
    currentDrawdownPct: number;
    openPositions: OpenPosition[];
  };
  performance?: {
    trades: number;
    wins: number;
    losses: number;
    breakeven: number;
    winRate: number;
    grossProfit: number;
    grossLoss: number;
    netPnl: number;
    expectancy: number;
    avgWin: number;
    avgLoss: number;
    payoffRatio: number | null;
    profitFactor: number | null;
    avgReturnPct: number;
    totalReturnPct: number;
    maxDrawdownPct: number;
    currentDrawdownPct: number;
  };
  ingestion?: {
    markedMarkets: number;
    evidenceTotal: number;
    evidenceActive: number;
    evidenceExpired: number;
    scannedMarketsLastCycle: number;
    lastCycleErrors: number;
  };
  equityCurve?: Array<{ timestamp: number; equity: number }>;
  decisionTape?: DecisionTapeItem[];
  recentTrades?: ClosedTrade[];
};

type Lifecycle = 'REJECT' | 'INCUBATOR' | 'CHALLENGER' | 'CHAMPION_CANDIDATE';

type FactoryTop = {
  genome: { id: string; generation?: number; indicators: string[] };
  hypothesis?: { thesis?: string; parentIds?: string[]; origin?: string };
  metrics: {
    totalSamples: number;
    oosSamples: number;
    oosExpectancy: number;
    sharpe: number;
    sortino: number;
    maxDrawdownPct: number;
    monteCarloSurvivalRate: number;
    regimeStability: number;
    parameterRobustness: number;
  };
  evaluation: {
    score: number;
    lifecycle?: Lifecycle;
    hardGatePassed: boolean;
    hardGateReasons: string[];
  };
  validation?: {
    blind?: { samples: number; expectancy: number; sharpe: number; maxDrawdownPct: number; winRate: number };
    walkForward?: { eligibleFolds: number; positiveFoldRate: number; worstExpectancy: number };
    costStress?: { survivalRate: number; worstExpectancy: number };
    regimeStress?: { eligibleRegimes: number; positiveRegimeRate: number; worstExpectancy: number };
    monteCarloSurvivalRate?: number;
    parameterRobustness?: number;
  };
};

type FactoryPayload = {
  success?: boolean;
  available?: boolean;
  latestRun?: null | {
    id: string;
    market: string;
    timeframe_minutes: number;
    candidate_count: number;
    top_results: FactoryTop[];
    lifecycle_counts?: Partial<Record<Lifecycle, number>>;
    status_counts?: Record<string, number>;
  };
};

type LedgerEvent = {
  id: string;
  eventKey: string;
  occurredAt: number;
  eventType: string;
  eventName: string;
  market: string | null;
  strategyId: string | null;
  strategyVersion: string | null;
  action: string | null;
  summary: string;
  reason: string | null;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  authority: string;
  executionAuthority: boolean;
  source: string;
};

type EventsPayload = {
  success?: boolean;
  canonical?: boolean;
  appendOnly?: boolean;
  coverage?: string;
  source?: string;
  events?: LedgerEvent[];
};

type StrategyCard = {
  id: string;
  name: string;
  grade: string;
  lifecycle: string;
  thesis: string;
  score: number | null;
  sharpe: number | null;
  mdd: number | null;
  survival: number | null;
  robustness: number | null;
  winRate: number | null;
  samples: number;
  profile: number[];
  hardGatePassed: boolean;
  reasons: string[];
};

type Tab = 'home' | 'market' | 'strategies' | 'portfolio' | 'more';
type DetailRoute = 'strategy' | 'position' | 'analysis' | 'evidence' | 'council' | 'trade' | 'log' | null;

const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const money = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `₩${number.format(value)}`;
const pct = (value: number | null | undefined, signed = false) => {
  if (value == null || !Number.isFinite(value)) return '—';
  const points = value * 100;
  return `${signed && points > 0 ? '+' : ''}${decimal.format(points)}%`;
};
const scoreText = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : decimal.format(value);
const timeAgo = (timestamp: number | null | undefined) => {
  if (!timestamp) return '—';
  const delta = Math.max(0, Date.now() - timestamp);
  if (delta < 60_000) return `${Math.max(1, Math.round(delta / 1000))}초 전`;
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}분 전`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}시간 전`;
  return `${Math.round(delta / 86_400_000)}일 전`;
};

const gradeFor = (score: number, hardGatePassed: boolean) => {
  if (!hardGatePassed) {
    if (score >= 75) return 'BBB0';
    if (score >= 65) return 'BB0';
    if (score >= 55) return 'B0';
    if (score >= 45) return 'D+';
    return 'F0';
  }
  if (score >= 95) return 'AAA+';
  if (score >= 92) return 'AAA0';
  if (score >= 89) return 'AAA-';
  if (score >= 86) return 'AA+';
  if (score >= 83) return 'AA0';
  if (score >= 80) return 'AA-';
  if (score >= 77) return 'A+';
  if (score >= 74) return 'A0';
  if (score >= 70) return 'A-';
  if (score >= 66) return 'BBB+';
  if (score >= 62) return 'BBB0';
  return 'BBB-';
};

const strategyName = (item: FactoryTop, index: number) => {
  const haystack = `${item.hypothesis?.thesis ?? ''} ${item.genome.indicators.join(' ')}`.toLowerCase();
  if (haystack.includes('momentum') || haystack.includes('ema') || haystack.includes('trend')) return 'Momentum Pro';
  if (haystack.includes('mean') || haystack.includes('reversion') || haystack.includes('rsi')) return 'Mean Reversion';
  if (haystack.includes('volatility') || haystack.includes('atr') || haystack.includes('breakout')) return 'Volatility Breakout';
  if (haystack.includes('macro')) return 'Macro Trend';
  if (haystack.includes('event') || haystack.includes('news')) return 'Event Driven';
  return `Oracle Strategy ${index + 1}`;
};

const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

const Sparkline = ({ values, positive = true, className = '' }: { values: number[]; positive?: boolean; className?: string }) => {
  const cleaned = values.filter((value) => Number.isFinite(value));
  const data = cleaned.length >= 2 ? cleaned : [0.35, 0.48, 0.44, 0.61, 0.58, 0.72];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(max - min, 0.0001);
  const points = data.map((value, index) => `${(index / (data.length - 1)) * 100},${36 - ((value - min) / span) * 30}`).join(' ');
  const stroke = positive ? '#21b58a' : '#ef5b66';
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={cn('h-12 w-full overflow-visible', className)} aria-hidden="true">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const Pill = ({ children, active = false }: { children: React.ReactNode; active?: boolean }) => (
  <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium', active ? 'bg-[#101820] text-white' : 'bg-[#f2f4f6] text-[#68717a]')}>{children}</span>
);

const GradeBadge = ({ grade }: { grade: string }) => (
  <span className={cn('inline-flex min-w-10 items-center justify-center rounded-xl px-2 py-1.5 text-[12px] font-semibold', grade.startsWith('A') ? 'bg-[#e5f8f1] text-[#059669]' : grade.startsWith('B') ? 'bg-[#f0f2f4] text-[#4b5563]' : 'bg-[#fff0f1] text-[#d94d58]')}>{grade}</span>
);

const SectionTitle = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[#171a1f]">{title}</h2>
    {action && <button onClick={onAction} className="text-[12px] font-medium text-[#87909a]">{action} ›</button>}
  </div>
);

const EmptyCard = ({ title, body }: { title: string; body: string }) => (
  <div className="rounded-2xl border border-[#edf0f2] bg-white px-4 py-8 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
    <div className="text-[13px] font-semibold text-[#343a40]">{title}</div>
    <div className="mx-auto mt-2 max-w-[280px] text-[11px] leading-5 text-[#98a0a8]">{body}</div>
  </div>
);

export const BlackOracleMobileApp: React.FC = () => {
  const [tab, setTab] = useState<Tab>('home');
  const [route, setRoute] = useState<DetailRoute>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyCard | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<OpenPosition | null>(null);
  const [operations, setOperations] = useState<OperationsPayload | null>(null);
  const [factory, setFactory] = useState<FactoryPayload | null>(null);
  const [eventsPayload, setEventsPayload] = useState<EventsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('bo_mobile_product_onboarding_v1') !== 'done');

  const load = useCallback(async () => {
    setLoading(true);
    const [operationsResult, factoryResult, eventsResult] = await Promise.allSettled([
      fetch('/api/trading-status', { cache: 'no-store' }).then((response) => response.json() as Promise<OperationsPayload>),
      fetch('/api/strategy-factory-status', { cache: 'no-store' }).then((response) => response.json() as Promise<FactoryPayload>),
      fetch('/api/events?limit=160', { cache: 'no-store' }).then((response) => response.json() as Promise<EventsPayload>),
    ]);
    if (operationsResult.status === 'fulfilled') setOperations(operationsResult.value);
    if (factoryResult.status === 'fulfilled') setFactory(factoryResult.value);
    if (eventsResult.status === 'fulfilled') setEventsPayload(eventsResult.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', load);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', load);
    };
  }, [load]);

  const strategies = useMemo<StrategyCard[]>(() => {
    const top = factory?.latestRun?.top_results ?? [];
    if (top.length) {
      return top.slice(0, 12).map((item, index) => ({
        id: item.genome.id,
        name: strategyName(item, index),
        grade: gradeFor(item.evaluation.score, item.evaluation.hardGatePassed),
        lifecycle: item.evaluation.lifecycle ?? (item.evaluation.hardGatePassed ? 'CHALLENGER' : 'REJECT'),
        thesis: item.hypothesis?.thesis || item.genome.indicators.join(' + '),
        score: item.evaluation.score,
        sharpe: item.validation?.blind?.sharpe ?? item.metrics.sharpe,
        mdd: -(Math.abs(item.validation?.blind?.maxDrawdownPct ?? item.metrics.maxDrawdownPct)),
        survival: item.validation?.monteCarloSurvivalRate ?? item.metrics.monteCarloSurvivalRate,
        robustness: item.validation?.parameterRobustness ?? item.metrics.parameterRobustness,
        winRate: item.validation?.blind?.winRate ?? null,
        samples: item.validation?.blind?.samples ?? item.metrics.oosSamples ?? item.metrics.totalSamples,
        profile: [
          Math.max(0, item.metrics.regimeStability),
          Math.max(0, item.validation?.parameterRobustness ?? item.metrics.parameterRobustness),
          Math.max(0, item.validation?.monteCarloSurvivalRate ?? item.metrics.monteCarloSurvivalRate),
          Math.max(0, Math.min(1, 0.5 + item.metrics.oosExpectancy * 10)),
          Math.max(0, Math.min(1, item.evaluation.score / 100)),
        ],
        hardGatePassed: item.evaluation.hardGatePassed,
        reasons: item.evaluation.hardGateReasons ?? [],
      }));
    }

    const grouped = new Map<string, ClosedTrade[]>();
    for (const trade of operations?.recentTrades ?? []) {
      const version = trade.strategyVersion || 'UNVERSIONED';
      grouped.set(version, [...(grouped.get(version) ?? []), trade]);
    }
    return [...grouped.entries()].slice(0, 8).map(([version, trades], index) => {
      const wins = trades.filter((trade) => trade.netPnl > 0).length;
      const avg = trades.length ? trades.reduce((sum, trade) => sum + trade.returnPct, 0) / trades.length : 0;
      return {
        id: version,
        name: `Observed ${index + 1}`,
        grade: 'OBS',
        lifecycle: 'PAPER OBSERVED',
        thesis: 'Paper runtime에서 관측된 전략 버전입니다. Factory 검증등급과는 별개입니다.',
        score: null,
        sharpe: null,
        mdd: null,
        survival: null,
        robustness: null,
        winRate: trades.length ? wins / trades.length : null,
        samples: trades.length,
        profile: trades.map((trade) => trade.returnPct),
        hardGatePassed: false,
        reasons: [avg >= 0 ? 'Observed return non-negative' : 'Observed return negative'],
      };
    });
  }, [factory, operations?.recentTrades]);

  const decisions = useMemo(() => [...(operations?.decisionTape ?? [])].sort((a, b) => b.timestamp - a.timestamp), [operations?.decisionTape]);
  const latestDecision = decisions[0] ?? null;
  const events = useMemo(() => [...(eventsPayload?.events ?? [])].sort((a, b) => b.occurredAt - a.occurredAt), [eventsPayload?.events]);
  const equityValues = operations?.equityCurve?.map((item) => item.equity) ?? [];
  const portfolio = operations?.portfolio;
  const totalReturn = portfolio && portfolio.initialEquity ? portfolio.equity / portfolio.initialEquity - 1 : operations?.performance?.totalReturnPct ?? null;
  const openPositions = portfolio?.openPositions ?? [];
  const systemHealthy = operations?.status === 'OK' && !operations?.loop?.stale;

  const openRoute = (next: DetailRoute) => setRoute(next);
  const back = () => setRoute(null);
  const switchTab = (next: Tab) => {
    setRoute(null);
    setTab(next);
  };

  if (showOnboarding) {
    return (
      <div className="flex h-[100dvh] w-full flex-col bg-white px-7 pb-[max(env(safe-area-inset-bottom),28px)] pt-[max(env(safe-area-inset-top),28px)] text-[#111418]" style={{ colorScheme: 'light' }}>
        <div className="mt-auto mb-auto">
          <div className="text-[28px] font-semibold tracking-[-0.05em]">Black Oracle</div>
          <div className="mt-12 space-y-8">
            {[
              ['Market Intelligence', '실시간 운영·증거·시장 상태를 한 화면에서 읽습니다.'],
              ['AI Strategy', 'Strategy Factory의 경쟁과 검증 상태를 추적합니다.'],
              ['Evidence Based', 'NARS와 Canonical Event Ledger의 근거를 판단에 연결합니다.'],
              ['Better Decisions', 'Council·Risk·Decision이 왜 그런 결론을 냈는지 설명합니다.'],
            ].map(([title, body]) => (
              <div key={title} className="flex gap-4">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#1f2933]" />
                <div>
                  <div className="text-[15px] font-semibold tracking-[-0.02em]">{title}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[#9aa1a8]">{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.setItem('bo_mobile_product_onboarding_v1', 'done');
            setShowOnboarding(false);
          }}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#111820] text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
        >
          시작하기 <ChevronRight className="ml-2 h-4 w-4" />
        </button>
      </div>
    );
  }

  const renderDetail = () => {
    if (!route) return null;
    if (route === 'strategy') return <StrategyDetail strategy={selectedStrategy} onBack={back} />;
    if (route === 'position') return <PositionDetail position={selectedPosition} decision={selectedPosition ? decisions.find((item) => item.market === selectedPosition.market) ?? null : null} onBack={back} />;
    if (route === 'analysis') return <AnalysisDetail decision={latestDecision} onBack={back} />;
    if (route === 'evidence') return <EvidenceDetail events={events.filter((event) => event.eventType === 'EVIDENCE')} onBack={back} />;
    if (route === 'council') return <CouncilDetail decision={latestDecision} events={events.filter((event) => event.eventType === 'COUNCIL')} onBack={back} />;
    if (route === 'trade') return <TradeDetail decision={latestDecision} onBack={back} />;
    if (route === 'log') return <LogDetail events={events} onBack={back} />;
    return null;
  };

  const renderTab = () => {
    if (tab === 'home') return <HomeTab operations={operations} events={events} equityValues={equityValues} totalReturn={totalReturn} loading={loading} systemHealthy={systemHealthy} onRefresh={load} onRoute={openRoute} />;
    if (tab === 'market') return <MarketTab decisions={decisions} onAnalysis={() => openRoute('analysis')} />;
    if (tab === 'strategies') return <StrategiesTab strategies={strategies} onSelect={(strategy) => { setSelectedStrategy(strategy); openRoute('strategy'); }} />;
    if (tab === 'portfolio') return <PortfolioTab operations={operations} totalReturn={totalReturn} onSelectPosition={(position) => { setSelectedPosition(position); openRoute('position'); }} />;
    return <MoreTab operations={operations} events={events} onRoute={openRoute} />;
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#f7f8f9] text-[#111418]" style={{ colorScheme: 'light' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={route ?? tab}
          initial={{ opacity: 0, x: route ? 12 : 0 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: route ? -8 : 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          {route ? renderDetail() : renderTab()}
        </motion.div>
      </AnimatePresence>
      {!route && <BottomNavigation tab={tab} onChange={switchTab} />}
    </div>
  );
};

const Screen = ({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) => (
  <div className={cn('h-full overflow-y-auto pb-[calc(86px+env(safe-area-inset-bottom))] pt-[max(env(safe-area-inset-top),18px)]', padded && 'px-4')}>{children}</div>
);

const Header = ({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: () => void; right?: React.ReactNode }) => (
  <div className="mb-5 flex items-start justify-between gap-4">
    <div className="min-w-0">
      {back && <button onClick={back} className="mb-5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#111418] shadow-sm"><ArrowLeft className="h-5 w-5" /></button>}
      <h1 className="text-[26px] font-semibold tracking-[-0.05em] text-[#13171b]">{title}</h1>
      {subtitle && <p className="mt-1 text-[12px] leading-5 text-[#9299a1]">{subtitle}</p>}
    </div>
    {right}
  </div>
);

const HomeTab = ({ operations, events, equityValues, totalReturn, loading, systemHealthy, onRefresh, onRoute }: { operations: OperationsPayload | null; events: LedgerEvent[]; equityValues: number[]; totalReturn: number | null; loading: boolean; systemHealthy: boolean; onRefresh: () => void; onRoute: (route: DetailRoute) => void }) => {
  const portfolio = operations?.portfolio;
  const latestEvent = events[0];
  return (
    <Screen>
      <div className="flex items-center justify-between pt-1">
        <div className="text-[23px] font-semibold tracking-[-0.05em]">Black Oracle</div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"><RefreshCw className={cn('h-4 w-4 text-[#5b6570]', loading && 'animate-spin')} /></button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"><Bell className="h-4 w-4 text-[#5b6570]" /></button>
        </div>
      </div>

      <div className="mt-7">
        <div className="text-[24px] font-medium leading-[1.2] tracking-[-0.05em]">한서님,<br />오늘도 좋은 기회가 있습니다.</div>
        <div className="mt-4 flex gap-2">
          <Pill active={systemHealthy}>{systemHealthy ? 'Runtime 정상' : operations?.status ?? 'Runtime 확인 중'}</Pill>
          <Pill>{operations?.mode ?? 'PAPER'}</Pill>
          <Pill>{operations?.loop?.lastCycle ? `${operations.loop.lastCycle.scanned} markets` : 'No cycle'}</Pill>
        </div>
      </div>

      <div className="mt-6 rounded-[24px] border border-[#edf0f2] bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium text-[#828b94]">Total Portfolio (Paper)</div>
          <Eye className="h-4 w-4 text-[#9ca3aa]" />
        </div>
        <div className="mt-2 text-[30px] font-semibold tracking-[-0.05em]">{money(portfolio?.equity)}</div>
        <div className={cn('mt-1 text-[15px] font-semibold', (totalReturn ?? 0) >= 0 ? 'text-[#14a67b]' : 'text-[#e1515d]')}>{pct(totalReturn, true)}</div>
        <div className="mt-3"><Sparkline values={equityValues} positive={(totalReturn ?? 0) >= 0} /></div>
      </div>

      <button onClick={() => onRoute('trade')} className="mt-3 flex w-full items-center justify-between rounded-2xl border border-[#edf0f2] bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-3">
          <span className={cn('h-2.5 w-2.5 rounded-full', systemHealthy ? 'bg-[#20af88]' : 'bg-[#e5a84c]')} />
          <span className="text-[13px] font-semibold">{operations?.portfolio?.openPositions.length ?? 0}개 포지션 진행 중</span>
        </div>
        <ChevronRight className="h-4 w-4 text-[#adb4bb]" />
      </button>

      <div className="mt-5 grid grid-cols-5 gap-2">
        {[
          ['거래 현황', Activity, 'trade' as DetailRoute],
          ['전략 허브', Network, null],
          ['AI 리포트', Brain, 'analysis' as DetailRoute],
          ['근거', Database, 'evidence' as DetailRoute],
          ['더보기', MoreHorizontal, 'log' as DetailRoute],
        ].map(([label, Icon, route]) => (
          <button key={String(label)} onClick={() => route && onRoute(route as DetailRoute)} className="flex min-w-0 flex-col items-center gap-2 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)]"><Icon className="h-[18px] w-[18px] text-[#26313a]" /></span>
            <span className="truncate text-[9px] font-medium text-[#737d87]">{String(label)}</span>
          </button>
        ))}
      </div>

      <div className="mt-7">
        <SectionTitle title="오늘의 인사이트" action="로그 보기" onAction={() => onRoute('log')} />
        {latestEvent ? (
          <button onClick={() => onRoute(latestEvent.eventType === 'EVIDENCE' ? 'evidence' : latestEvent.eventType === 'COUNCIL' ? 'council' : 'log')} className="w-full rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left shadow-[0_8px_26px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-[#66717c]"><Pill>{latestEvent.eventType}</Pill><span>{timeAgo(latestEvent.occurredAt)}</span></div>
            <div className="mt-3 text-[14px] font-semibold leading-5 text-[#23282e]">{latestEvent.summary}</div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#929aa2]">{latestEvent.reason || `${latestEvent.source} · ${latestEvent.authority}`}</div>
          </button>
        ) : (
          <EmptyCard title="Canonical event 대기 중" body="Cutover 이후 첫 이벤트가 들어오면 Evidence, Strategy, Council, Trade 활동을 여기에서 요약합니다." />
        )}
      </div>
    </Screen>
  );
};

const MarketTab = ({ decisions, onAnalysis }: { decisions: DecisionTapeItem[]; onAnalysis: () => void }) => {
  const latestByMarket = new Map<string, DecisionTapeItem>();
  for (const decision of decisions) if (!latestByMarket.has(decision.market)) latestByMarket.set(decision.market, decision);
  const markets = [...latestByMarket.values()];
  return (
    <Screen>
      <Header title="시장" subtitle="가격 예측 화면이 아니라, Paper Engine이 실제로 읽고 있는 시장 판단을 보여줍니다." right={<button className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"><Search className="h-4 w-4" /></button>} />
      <div className="flex gap-2 overflow-x-auto pb-1"><Pill active>전체</Pill><Pill>코인</Pill><Pill>주식</Pill><Pill>관찰</Pill></div>
      <div className="mt-5 space-y-3">
        {markets.map((decision) => {
          const bullish = decision.decision === 'ENTER' || decision.forecast?.direction === 'BULLISH';
          return (
            <button key={decision.market} onClick={onAnalysis} className="w-full rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[16px] font-semibold tracking-[-0.02em]">{decision.market}</div>
                  <div className="mt-1 text-[10px] text-[#939ba3]">{decision.regime ?? 'Regime unknown'} · {timeAgo(decision.timestamp)}</div>
                </div>
                <Pill active={bullish}>{decision.decision}</Pill>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#f0f2f4] pt-4">
                <Metric label="Oracle Score" value={scoreText(decision.oracleTradeScore)} />
                <Metric label="Confidence" value={pct(decision.confidence)} />
                <Metric label="Evidence" value={`${decision.evidenceActiveCount ?? 0}/${decision.evidenceContradictionCount ?? 0}`} />
              </div>
            </button>
          );
        })}
        {!markets.length && <EmptyCard title="시장 판단 대기 중" body="Paper Engine의 decisionTape에 첫 시장 판단이 기록되면 종목별 최신 판단을 표시합니다." />}
      </div>
    </Screen>
  );
};

const StrategiesTab = ({ strategies, onSelect }: { strategies: StrategyCard[]; onSelect: (strategy: StrategyCard) => void }) => (
  <Screen>
    <Header title="전략 허브" subtitle="다양한 전략이 경쟁하고, 검증을 통과한 전략만 상위 라이프사이클로 올라갑니다." right={<button className="rounded-full bg-[#18202a] px-3 py-2 text-[11px] font-semibold text-white">+ 전략 추가</button>} />
    <div className="flex gap-2 overflow-x-auto pb-2"><Pill active>전체</Pill><Pill>성능순</Pill><Pill>최근 수익률</Pill><Pill>위험도</Pill></div>
    <div className="mt-4 space-y-3">
      {strategies.map((strategy) => (
        <button key={strategy.id} onClick={() => onSelect(strategy)} className="w-full rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold tracking-[-0.02em]">{strategy.name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5"><Pill>{strategy.lifecycle}</Pill><Pill>{strategy.samples} samples</Pill></div>
            </div>
            <GradeBadge grade={strategy.grade} />
          </div>
          <div className="mt-3 grid grid-cols-[1fr_86px] items-end gap-4">
            <div className="line-clamp-2 text-[11px] leading-5 text-[#8d969f]">{strategy.thesis}</div>
            <Sparkline values={strategy.profile} positive={(strategy.score ?? 50) >= 50} className="h-9" />
          </div>
          <div className="mt-3 flex gap-4 border-t border-[#f1f2f4] pt-3 text-[10px] text-[#6e7882]"><span>Score {scoreText(strategy.score)}</span><span>Sharpe {scoreText(strategy.sharpe)}</span><span>MDD {pct(strategy.mdd)}</span></div>
        </button>
      ))}
      {!strategies.length && <EmptyCard title="Strategy Factory 결과 대기 중" body="Factory run 또는 Paper 관측 거래가 들어오면 경쟁 전략을 카드 형태로 표시합니다." />}
    </div>
  </Screen>
);

const PortfolioTab = ({ operations, totalReturn, onSelectPosition }: { operations: OperationsPayload | null; totalReturn: number | null; onSelectPosition: (position: OpenPosition) => void }) => {
  const portfolio = operations?.portfolio;
  const performance = operations?.performance;
  const cashRatio = portfolio?.equity ? Math.max(0, Math.min(1, portfolio.cash / portfolio.equity)) : 1;
  return (
    <Screen>
      <Header title="포트폴리오" subtitle="실제 persisted Paper checkpoint 기준입니다." />
      <div className="rounded-[24px] border border-[#edf0f2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
        <div className="text-[11px] font-medium text-[#8b949d]">Total Portfolio (Paper)</div>
        <div className="mt-2 text-[30px] font-semibold tracking-[-0.05em]">{money(portfolio?.equity)}</div>
        <div className={cn('mt-1 text-[14px] font-semibold', (totalReturn ?? 0) >= 0 ? 'text-[#16a77d]' : 'text-[#e1515d]')}>{pct(totalReturn, true)}</div>
        <div className="mt-5 grid grid-cols-3 gap-3"><Metric label="Cash" value={money(portfolio?.cash)} /><Metric label="Realized" value={money(portfolio?.realizedPnl)} /><Metric label="MDD" value={pct(performance?.maxDrawdownPct)} /></div>
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-[10px] text-[#8a939c]"><span>현금 비중</span><span>{pct(cashRatio)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-[#edf1f3]"><div className="h-full rounded-full bg-[#1c8fdf]" style={{ width: `${cashRatio * 100}%` }} /></div>
        </div>
      </div>

      <div className="mt-7"><SectionTitle title="진행 중 포지션" /></div>
      <div className="space-y-3">
        {(portfolio?.openPositions ?? []).map((position) => (
          <button key={`${position.market}-${position.openedAt}`} onClick={() => onSelectPosition(position)} className="w-full rounded-[18px] border border-[#edf0f2] bg-white p-4 text-left shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between"><div><div className="text-[15px] font-semibold">{position.market}</div><div className="mt-1 text-[10px] text-[#969fa7]">{timeAgo(position.openedAt)} 진입 · Qty {decimal.format(position.quantity)}</div></div><ChevronRight className="h-4 w-4 text-[#b0b7be]" /></div>
            <div className="mt-4 grid grid-cols-3 gap-3"><Metric label="Entry" value={number.format(position.entryPrice)} /><Metric label="Stop" value={position.stopLossPrice == null ? '—' : number.format(position.stopLossPrice)} /><Metric label="Take Profit" value={position.takeProfitPrice == null ? '—' : number.format(position.takeProfitPrice)} /></div>
          </button>
        ))}
        {!portfolio?.openPositions?.length && <EmptyCard title="열린 포지션 없음" body="현재 Paper Engine은 신규 포지션을 보유하고 있지 않습니다. NO_TRADE도 정상적인 결정입니다." />}
      </div>

      <div className="mt-7"><SectionTitle title="성과" /></div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="승률" value={pct(performance?.winRate)} icon={<Target className="h-4 w-4" />} />
        <StatCard label="거래 수" value={String(performance?.trades ?? 0)} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Profit Factor" value={scoreText(performance?.profitFactor)} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Expectancy" value={money(performance?.expectancy)} icon={<BarChart3 className="h-4 w-4" />} />
      </div>
    </Screen>
  );
};

const MoreTab = ({ operations, events, onRoute }: { operations: OperationsPayload | null; events: LedgerEvent[]; onRoute: (route: DetailRoute) => void }) => (
  <Screen>
    <Header title="더보기" subtitle="핵심 5개 탭 밖의 감독·설명 기능을 한 곳에 모았습니다." />
    <div className="rounded-[22px] border border-[#edf0f2] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#edf1f4]"><Bot className="h-5 w-5 text-[#33404b]" /></span><div><div className="text-[14px] font-semibold">Black Oracle</div><div className="mt-1 text-[10px] text-[#929aa2]">{operations?.mode ?? 'PAPER'} · {operations?.status ?? 'UNKNOWN'} · {events.length} canonical events</div></div></div>
    </div>
    <div className="mt-5 overflow-hidden rounded-[20px] border border-[#edf0f2] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      {[
        ['Canonical Log', '모든 전략·근거·Council·거래 활동', ScrollText, 'log' as DetailRoute],
        ['Evidence', 'NARS 및 근거 이벤트', Database, 'evidence' as DetailRoute],
        ['Council', '판단 구성과 충돌 확인', Network, 'council' as DetailRoute],
        ['AI Analysis', '최근 판단 설명', Brain, 'analysis' as DetailRoute],
        ['Paper Decision', '실행 권한 없는 결정 검토', ShieldCheck, 'trade' as DetailRoute],
      ].map(([label, body, Icon, route], index) => (
        <button key={String(label)} onClick={() => onRoute(route as DetailRoute)} className={cn('flex w-full items-center gap-3 px-4 py-4 text-left', index !== 4 && 'border-b border-[#f0f2f4]')}>
          <Icon className="h-[18px] w-[18px] text-[#48545f]" /><div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{String(label)}</div><div className="mt-0.5 text-[10px] text-[#9aa2a9]">{String(body)}</div></div><ChevronRight className="h-4 w-4 text-[#b4bac0]" />
        </button>
      ))}
    </div>
    <div className="mt-5 overflow-hidden rounded-[20px] border border-[#edf0f2] bg-white">
      <div className="flex items-center gap-3 px-4 py-4"><Settings className="h-[18px] w-[18px] text-[#48545f]" /><div className="flex-1 text-[13px] font-semibold">설정</div><ChevronRight className="h-4 w-4 text-[#b4bac0]" /></div>
    </div>
  </Screen>
);

const StrategyDetail = ({ strategy, onBack }: { strategy: StrategyCard | null; onBack: () => void }) => {
  if (!strategy) return <DetailShell title="전략" onBack={onBack}><EmptyCard title="선택된 전략 없음" body="전략 허브에서 전략을 선택해 주세요." /></DetailShell>;
  return (
    <DetailShell title={strategy.name} subtitle={`${strategy.lifecycle} · BO Grade ${strategy.grade}`} onBack={onBack} right={<GradeBadge grade={strategy.grade} />}>
      <div className="rounded-[22px] border border-[#edf0f2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
        <div className="text-[11px] font-medium text-[#8d969f]">검증 프로파일</div>
        <div className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-[#16a77d]">{scoreText(strategy.score)}</div>
        <Sparkline values={strategy.profile} positive={(strategy.score ?? 50) >= 50} />
        <div className="mt-3 grid grid-cols-4 gap-2"><Metric label="Sharpe" value={scoreText(strategy.sharpe)} /><Metric label="MDD" value={pct(strategy.mdd)} /><Metric label="Survive" value={pct(strategy.survival)} /><Metric label="Samples" value={String(strategy.samples)} /></div>
      </div>
      <section className="mt-6"><SectionTitle title="전략 설명" /><p className="text-[12px] leading-6 text-[#707a84]">{strategy.thesis}</p></section>
      <section className="mt-6"><SectionTitle title="검증 상태" />
        <div className="space-y-2">
          <CheckRow good={strategy.hardGatePassed} label={strategy.hardGatePassed ? 'Hard Gate 통과' : 'Hard Gate 미통과 또는 관측 전용'} />
          <CheckRow good={(strategy.survival ?? 0) >= 0.8} label={`Monte Carlo survival ${pct(strategy.survival)}`} />
          <CheckRow good={(strategy.robustness ?? 0) >= 0.7} label={`Parameter robustness ${pct(strategy.robustness)}`} />
          {strategy.reasons.slice(0, 3).map((reason) => <CheckRow key={reason} good={false} label={reason} />)}
        </div>
      </section>
      <div className="mt-8 rounded-2xl bg-[#f0f3f5] px-4 py-3 text-[10px] leading-5 text-[#78828c]"><Lock className="mr-2 inline h-3.5 w-3.5" />자동 Champion 승격 및 LIVE 배포 권한은 없습니다. 인간 승인 규칙을 유지합니다.</div>
    </DetailShell>
  );
};

const PositionDetail = ({ position, decision, onBack }: { position: OpenPosition | null; decision: DecisionTapeItem | null; onBack: () => void }) => {
  if (!position) return <DetailShell title="포지션" onBack={onBack}><EmptyCard title="선택된 포지션 없음" body="포트폴리오에서 포지션을 선택해 주세요." /></DetailShell>;
  return (
    <DetailShell title={position.market} subtitle="Paper open position" onBack={onBack}>
      <div className="rounded-[22px] border border-[#edf0f2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
        <div className="text-[11px] text-[#8b949d]">Entry</div><div className="mt-1 text-[30px] font-semibold tracking-[-0.05em]">{number.format(position.entryPrice)}</div>
        <div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Quantity" value={decimal.format(position.quantity)} /><Metric label="Opened" value={timeAgo(position.openedAt)} /><Metric label="Stop Loss" value={position.stopLossPrice == null ? '—' : number.format(position.stopLossPrice)} /><Metric label="Take Profit" value={position.takeProfitPrice == null ? '—' : number.format(position.takeProfitPrice)} /></div>
      </div>
      <section className="mt-6"><SectionTitle title="최근 판단" />
        {decision ? <div className="rounded-[20px] border border-[#edf0f2] bg-white p-4"><div className="flex justify-between"><div className="text-[15px] font-semibold">{decision.decision}</div><Pill>{decision.regime ?? '—'}</Pill></div><div className="mt-3 grid grid-cols-3 gap-3"><Metric label="Oracle" value={scoreText(decision.oracleTradeScore)} /><Metric label="Confidence" value={pct(decision.confidence)} /><Metric label="Risk" value={decision.riskDisposition ?? '—'} /></div><p className="mt-4 text-[11px] leading-5 text-[#818b95]">{decision.primaryReason || decision.reasons?.[0] || '별도 사유가 기록되지 않았습니다.'}</p></div> : <EmptyCard title="최근 판단 없음" body="해당 포지션과 일치하는 최근 decisionTape가 없습니다." />}
      </section>
    </DetailShell>
  );
};

const AnalysisDetail = ({ decision, onBack }: { decision: DecisionTapeItem | null; onBack: () => void }) => (
  <DetailShell title="AI 분석" subtitle={decision ? `${decision.market}에 대한 최근 판단 설명` : '최근 판단 대기 중'} onBack={onBack}>
    {decision ? (
      <>
        <div className="rounded-[22px] border border-[#edf0f2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between"><div><div className="text-[10px] text-[#939ba3]">결론</div><div className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">{decision.decision}</div></div><Pill active>{decision.regime ?? 'REGIME —'}</Pill></div>
          <div className="mt-5 grid grid-cols-3 gap-3"><Metric label="Oracle Score" value={scoreText(decision.oracleTradeScore)} /><Metric label="Confidence" value={pct(decision.confidence)} /><Metric label="Event Score" value={scoreText(decision.eventScore)} /></div>
        </div>
        <section className="mt-6"><SectionTitle title="핵심 근거" /><div className="space-y-3">
          <ReasonCard icon={<Database className="h-4 w-4" />} title="Evidence" body={`활성 ${decision.evidenceActiveCount ?? 0} · 상충 ${decision.evidenceContradictionCount ?? 0}`} />
          <ReasonCard icon={<Brain className="h-4 w-4" />} title="Primary reason" body={decision.primaryReason || decision.reasons?.[0] || '별도 primary reason이 없습니다.'} />
          <ReasonCard icon={<ShieldCheck className="h-4 w-4" />} title="Risk" body={`${decision.riskDisposition ?? '—'}${decision.riskReasons?.length ? ` · ${decision.riskReasons[0]}` : ''}`} />
          <ReasonCard icon={<TrendingUp className="h-4 w-4" />} title="Forecast" body={decision.forecast?.available ? `${decision.forecast.direction} · confidence ${pct(decision.forecast.confidence)} · uncertainty ${pct(decision.forecast.uncertainty)}` : 'Forecast unavailable'} />
        </div></section>
      </>
    ) : <EmptyCard title="분석할 판단 없음" body="Paper Engine의 최신 decisionTape가 생성되면 AI 분석 화면이 자동으로 채워집니다." />}
  </DetailShell>
);

const EvidenceDetail = ({ events, onBack }: { events: LedgerEvent[]; onBack: () => void }) => (
  <DetailShell title="근거 (Evidence)" subtitle="Canonical Event Ledger의 Evidence 이벤트만 표시합니다." onBack={onBack}>
    <div className="flex gap-2 overflow-x-auto pb-3"><Pill active>전체</Pill><Pill>NARS</Pill><Pill>외부 근거</Pill><Pill>상충</Pill></div>
    <div className="space-y-3">
      {events.slice(0, 40).map((event) => (
        <div key={event.id || event.eventKey} className="rounded-[18px] border border-[#edf0f2] bg-white p-4 shadow-[0_7px_22px_rgba(15,23,42,0.035)]">
          <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef2f5]"><Database className="h-4 w-4 text-[#3f4b56]" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><div className="truncate text-[12px] font-semibold">{event.eventName}</div><span className="shrink-0 text-[9px] text-[#a0a7ae]">{timeAgo(event.occurredAt)}</span></div><div className="mt-1 text-[11px] leading-5 text-[#707b85]">{event.summary}</div><div className="mt-2 text-[9px] text-[#a0a7ae]">{event.source} · {event.authority}{event.market ? ` · ${event.market}` : ''}</div></div></div>
        </div>
      ))}
      {!events.length && <EmptyCard title="Evidence 이벤트 대기 중" body="NARS bridge와 external evidence가 canonical ledger에 기록되면 이 화면에서 추적할 수 있습니다." />}
    </div>
  </DetailShell>
);

const CouncilDetail = ({ decision, events, onBack }: { decision: DecisionTapeItem | null; events: LedgerEvent[]; onBack: () => void }) => {
  const votes = decision ? [
    ['Strategy', decision.strategyDisposition ?? '—', decision.strategyDisposition === 'APPROVE'],
    ['Evidence', `${decision.evidenceActiveCount ?? 0} active / ${decision.evidenceContradictionCount ?? 0} conflict`, (decision.evidenceContradictionCount ?? 0) === 0],
    ['Risk', decision.riskDisposition ?? '—', decision.riskDisposition === 'APPROVE'],
    ['Forecast', decision.forecast?.available ? decision.forecast.direction : 'UNAVAILABLE', decision.forecast?.available ?? false],
  ] : [];
  return (
    <DetailShell title="Council" subtitle="여러 판단 축을 한 화면에서 비교합니다. AI는 자문이며 execution authority는 없습니다." onBack={onBack}>
      {decision ? (
        <>
          <div className="rounded-[22px] border border-[#edf0f2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
            <div className="text-[10px] text-[#939ba3]">최종 의사결정</div><div className="mt-1 text-[29px] font-semibold tracking-[-0.05em] text-[#149a75]">{decision.decision}</div><div className="mt-1 text-[10px] text-[#9aa2a9]">{decision.market} · {timeAgo(decision.timestamp)}</div>
          </div>
          <div className="mt-5 overflow-hidden rounded-[20px] border border-[#edf0f2] bg-white">
            {votes.map(([name, value, good], index) => (
              <div key={String(name)} className={cn('flex items-center gap-3 px-4 py-4', index !== votes.length - 1 && 'border-b border-[#f0f2f4]')}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f3f5]"><Network className="h-4 w-4 text-[#47535e]" /></span><div className="flex-1"><div className="text-[12px] font-semibold">{String(name)}</div><div className="mt-0.5 text-[10px] text-[#8f98a1]">{String(value)}</div></div>{good ? <CheckCircle2 className="h-5 w-5 text-[#19a57d]" /> : <AlertTriangle className="h-5 w-5 text-[#d99b40]" />}</div>
            ))}
          </div>
        </>
      ) : <EmptyCard title="Council 판단 대기 중" body="최근 Paper decision이 생성되면 Strategy·Evidence·Risk·Forecast의 현재 상태를 비교합니다." />}
      <section className="mt-6"><SectionTitle title="최근 Council 이벤트" />
        <div className="space-y-2">{events.slice(0, 8).map((event) => <ReasonCard key={event.id || event.eventKey} icon={<Bot className="h-4 w-4" />} title={event.eventName} body={`${event.summary}${event.reason ? ` · ${event.reason}` : ''}`} />)}{!events.length && <div className="text-[11px] text-[#929aa2]">현재 canonical Council 이벤트가 없습니다.</div>}</div>
      </section>
    </DetailShell>
  );
};

const TradeDetail = ({ decision, onBack }: { decision: DecisionTapeItem | null; onBack: () => void }) => (
  <DetailShell title="거래 / 결정" subtitle="이 화면은 Paper 결정 검토용입니다. 수동 LIVE 주문 권한을 추가하지 않습니다." onBack={onBack}>
    <div className="rounded-[22px] border border-[#edf0f2] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between"><div><div className="text-[10px] text-[#929aa2]">최근 대상</div><div className="mt-1 text-[22px] font-semibold">{decision?.market ?? '—'}</div></div><Pill active>{decision?.decision ?? 'WAITING'}</Pill></div>
      <div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Oracle Score" value={scoreText(decision?.oracleTradeScore)} /><Metric label="Risk" value={decision?.riskDisposition ?? '—'} /><Metric label="Evidence active" value={String(decision?.evidenceActiveCount ?? 0)} /><Metric label="Conflicts" value={String(decision?.evidenceContradictionCount ?? 0)} /></div>
    </div>
    <section className="mt-6"><SectionTitle title="실행 권한" />
      <div className="rounded-[20px] border border-[#e7ebee] bg-[#f1f4f6] p-4"><div className="flex gap-3"><Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#48545f]" /><div><div className="text-[12px] font-semibold">Paper Engine 전용 실행</div><div className="mt-1 text-[11px] leading-5 text-[#78828c]">UI에서 임의 수동 주문을 생성하지 않습니다. Strategy → Evidence → Council/Risk → Decision → Paper execution의 기존 권한 경계를 유지합니다.</div></div></div></div>
    </section>
    <button disabled className="mt-8 flex h-14 w-full items-center justify-center rounded-2xl bg-[#dfe4e8] text-[13px] font-semibold text-[#8d969f]">수동 주문 비활성화</button>
  </DetailShell>
);

const LogDetail = ({ events, onBack }: { events: LedgerEvent[]; onBack: () => void }) => (
  <DetailShell title="Log" subtitle="append-only canonical ledger · 클릭 가능한 상세 로그의 모바일 요약" onBack={onBack}>
    <div className="space-y-2">
      {events.slice(0, 80).map((event) => (
        <div key={event.id || event.eventKey} className="rounded-[16px] border border-[#edf0f2] bg-white px-4 py-3.5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><Pill>{event.eventType}</Pill><span className="truncate text-[11px] font-semibold">{event.eventName}</span></div><div className="mt-2 text-[11px] leading-5 text-[#727c86]">{event.summary}</div>{event.reason && <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#9aa2a9]">{event.reason}</div>}</div><span className="shrink-0 text-[9px] text-[#a1a8af]">{timeAgo(event.occurredAt)}</span></div>
        </div>
      ))}
      {!events.length && <EmptyCard title="Canonical Log 대기 중" body="Cutover 이후 이벤트가 아직 없습니다." />}
    </div>
  </DetailShell>
);

const DetailShell = ({ title, subtitle, onBack, right, children }: { title: string; subtitle?: string; onBack: () => void; right?: React.ReactNode; children: React.ReactNode }) => (
  <div className="h-full overflow-y-auto bg-[#f7f8f9] px-4 pb-[max(env(safe-area-inset-bottom),28px)] pt-[max(env(safe-area-inset-top),18px)]">
    <Header title={title} subtitle={subtitle} back={onBack} right={right} />
    {children}
  </div>
);

const BottomNavigation = ({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) => {
  const items: Array<[Tab, string, React.ComponentType<{ className?: string }>]> = [
    ['home', '홈', Home],
    ['market', '시장', Search],
    ['strategies', '전략', ListTree],
    ['portfolio', '포트폴리오', Briefcase],
    ['more', '더보기', MoreHorizontal],
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#eceff1] bg-white/95 pb-[max(env(safe-area-inset-bottom),7px)] pt-1 backdrop-blur-xl">
      <div className="grid grid-cols-5">
        {items.map(([id, label, Icon]) => {
          const active = id === tab;
          return <button key={id} onClick={() => onChange(id)} className="flex min-h-[58px] flex-col items-center justify-center gap-1"><Icon className={cn('h-[19px] w-[19px]', active ? 'text-[#171c21]' : 'text-[#a0a8af]')} /><span className={cn('text-[9px] font-medium', active ? 'text-[#171c21]' : 'text-[#a0a8af]')}>{label}</span></button>;
        })}
      </div>
    </nav>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => <div><div className="text-[9px] font-medium text-[#9aa2aa]">{label}</div><div className="mt-1 text-[12px] font-semibold tracking-[-0.02em] text-[#2d343b]">{value}</div></div>;
const StatCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => <div className="rounded-[18px] border border-[#edf0f2] bg-white p-4"><div className="flex items-center justify-between text-[#89929b]"><span className="text-[10px] font-medium">{label}</span>{icon}</div><div className="mt-3 text-[21px] font-semibold tracking-[-0.04em]">{value}</div></div>;
const CheckRow = ({ good, label }: { good: boolean; label: string }) => <div className="flex items-start gap-2 rounded-xl bg-white px-3 py-3 text-[11px] leading-5 text-[#68727c]">{good ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16a57b]" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#d56b73]" />}<span>{label}</span></div>;
const ReasonCard = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => <div className="rounded-[18px] border border-[#edf0f2] bg-white p-4"><div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef2f5] text-[#43505b]">{icon}</span><div><div className="text-[11px] font-semibold text-[#343b42]">{title}</div><div className="mt-1 text-[11px] leading-5 text-[#7d8791]">{body}</div></div></div></div>;
