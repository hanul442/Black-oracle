import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Brain,
  Briefcase,
  ChevronRight,
  Database,
  Home,
  ListTree,
  Network,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  DecisionTapeItem,
  DetailRoute,
  EventsPayload,
  FactoryPayload,
  LedgerEvent,
  OpenPosition,
  OperationalEvidence,
  OperationsPayload,
  StrategyCard,
  Tab,
} from './v2/types';
import {
  actionKo,
  cn,
  pct,
  reasonKo,
  regimeKo,
  scoreText,
  strategyName,
  timeAgo,
} from './v2/types';
import {
  EmptyCard,
  EventCard,
  Header,
  Metric,
  Pill,
  ScoreBar,
  ScoreGauge,
  Screen,
  SectionTitle,
  StatusChip,
} from './v2/ui';
import {
  CouncilDetail,
  EventDetail,
  EvidenceItemDetail,
  EvidenceListDetail,
  LogDetail,
  StrategyDetail,
  TradeTimelineDetail,
} from './v2/details';
import { AnalysisDetailV2 } from './v2/AnalysisDetailV2';
import { PositionDetailClarity } from './v2/PositionDetailClarity';
import { formatKrw } from './v2/financial';
import { PortfolioPerformanceChart } from './v4/PortfolioPerformanceChart';
import { PortfolioTabV4 } from './v4/PortfolioTabV4';

const buildStrategies = (factory: FactoryPayload | null, operations: OperationsPayload | null): StrategyCard[] => {
  const top = factory?.latestRun?.top_results ?? [];
  if (top.length) {
    return top.slice(0, 20).map((item, index) => ({
      id: item.genome.id,
      name: strategyName(item, index),
      lifecycle: item.evaluation.lifecycle ?? (item.evaluation.hardGatePassed ? 'CHALLENGER' : 'REJECT'),
      thesis: item.hypothesis?.thesis || item.genome.indicators.join(' + '),
      score: item.evaluation.score,
      sharpe: item.validation?.blind?.sharpe ?? item.metrics.sharpe,
      mdd: -(Math.abs(item.validation?.blind?.maxDrawdownPct ?? item.metrics.maxDrawdownPct)),
      survival: item.validation?.monteCarloSurvivalRate ?? item.metrics.monteCarloSurvivalRate,
      robustness: item.validation?.parameterRobustness ?? item.metrics.parameterRobustness,
      winRate: item.validation?.blind?.winRate ?? null,
      samples: item.validation?.blind?.samples ?? item.metrics.oosSamples ?? item.metrics.totalSamples,
      profile: [item.metrics.regimeStability, item.validation?.parameterRobustness ?? item.metrics.parameterRobustness, item.validation?.monteCarloSurvivalRate ?? item.metrics.monteCarloSurvivalRate],
      hardGatePassed: item.evaluation.hardGatePassed,
      reasons: item.evaluation.hardGateReasons ?? [],
    }));
  }
  const grouped = new Map<string, NonNullable<OperationsPayload['recentTrades']>>();
  for (const trade of operations?.recentTrades ?? []) {
    const version = trade.strategyVersion || 'UNVERSIONED';
    grouped.set(version, [...(grouped.get(version) ?? []), trade]);
  }
  return [...grouped.entries()].slice(0, 8).map(([version, trades], index) => ({
    id: version,
    name: `Observed ${index + 1}`,
    lifecycle: 'PAPER OBSERVED',
    thesis: 'Paper runtime에서 관측된 전략 버전입니다. 공식 Strategy Factory 검증 결과와는 별개입니다.',
    score: null,
    sharpe: null,
    mdd: null,
    survival: null,
    robustness: null,
    winRate: trades.length ? trades.filter((trade) => trade.netPnl > 0).length / trades.length : null,
    samples: trades.length,
    profile: trades.map((trade) => trade.returnPct),
    hardGatePassed: false,
    reasons: ['Factory validation unavailable for this observed runtime version.'],
  }));
};

type MarketHealth = {
  loading: boolean;
  available: boolean | null;
  configured: boolean | null;
  source: string | null;
  asOf: number | null;
  error: string | null;
};

const DataHealthCard = ({ operations, market, health, online }: { operations: OperationsPayload | null; market: string | null; health: MarketHealth; online: boolean }) => {
  const stale = Boolean(operations?.loop?.stale);
  const runtimeOk = operations?.status === 'OK' && !stale;
  const marketOk = market ? health.available === true : null;
  const state = !online ? 'OFFLINE' : !runtimeOk ? stale ? 'STALE' : operations?.status ?? 'WAITING' : market && marketOk === false ? 'MARKET DATA' : 'LIVE';
  const good = state === 'LIVE';
  return (
    <div className={cn('rounded-[20px] border p-4', good ? 'border-[#dbeee8] bg-[#f7fcfa]' : 'border-[#f0e5d6] bg-[#fffaf3]')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', good ? 'bg-[#e4f6ef] text-[#0a8f6d]' : 'bg-[#fff0dc] text-[#a56c20]')}>{online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}</span>
          <div>
            <div className="text-[12px] font-semibold text-[#37414a]">Data Health · {state}</div>
            <div className="mt-1 text-[11px] leading-5 text-[#78838d]">
              Runtime {runtimeOk ? '정상' : stale ? '지연' : operations?.status ?? '대기'}
              {market ? ` · ${market} ${health.loading ? '확인 중' : health.available ? '시장데이터 정상' : '시장데이터 확인 필요'}` : ''}
            </div>
          </div>
        </div>
        {health.source && <span className="text-[10px] font-medium text-[#89939d]">{health.source}</span>}
      </div>
      {market && !health.loading && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-black/[0.04] pt-3 text-[10px] text-[#87919a]">
          <span>마지막 가격봉 {health.asOf ? timeAgo(health.asOf) : '—'}</span>
          <span>자격증명 {health.configured === false ? '미설정' : '정상/불필요'}</span>
          {health.error && <span className="w-full text-[#a56c20]">{health.error}</span>}
        </div>
      )}
    </div>
  );
};

const RiskCard = ({ operations }: { operations: OperationsPayload | null }) => {
  const portfolio = operations?.portfolio;
  const equity = portfolio?.equity ?? 0;
  const exposureValue = (portfolio?.openPositions ?? []).reduce((sum, position) => sum + Math.max(0, position.averageCost * position.quantity), 0);
  const exposure = equity > 0 ? exposureValue / equity : null;
  return (
    <div className="rounded-[22px] border border-[#edf0f2] bg-white p-4">
      <div className="flex items-center justify-between"><div className="text-[14px] font-semibold">현재 리스크</div><ShieldCheck className="h-5 w-5 text-[#69747e]" /></div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="오늘 손익률" value={pct(portfolio?.dailyPnlPct, true)} />
        <Metric label="현재 Drawdown" value={pct(portfolio?.currentDrawdownPct)} />
        <Metric label="포지션 노출" value={pct(exposure)} />
      </div>
      <div className="mt-3 text-[11px] leading-5 text-[#87919a]">열린 포지션 {portfolio?.openPositions.length ?? 0}개 · 리스크 수치는 persisted Paper checkpoint 기준입니다.</div>
    </div>
  );
};

const DecisionCard = ({ decision, onOpen }: { decision: DecisionTapeItem | null; onOpen: () => void }) => {
  if (!decision) return <EmptyCard title="최신 판단 없음" body="Paper Engine이 decision trace를 남기면 최신 판단을 표시합니다." />;
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-[22px] border border-[#edf0f2] bg-white p-5 text-left shadow-[0_10px_30px_rgba(15,23,42,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-[12px] text-[#89939d]">{timeAgo(decision.timestamp)} · {regimeKo(decision.regime)}</div><div className="mt-1 text-[22px] font-semibold tracking-[-0.04em]">{decision.market}</div></div>
        <StatusChip value={actionKo(decision.decision)} />
      </div>
      <div className="mt-3 text-[13px] leading-6 text-[#66717b]">{reasonKo(decision.primaryReason || decision.reasons?.[0])}</div>
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-[#f0f2f4] pt-4 text-center">
        <div><div className="text-[10px] text-[#8f98a1]">Score</div><div className="mt-1 text-[13px] font-semibold">{scoreText(decision.oracleTradeScore)}</div></div>
        <div><div className="text-[10px] text-[#8f98a1]">Evidence</div><div className="mt-1 text-[13px] font-semibold">{decision.evidenceActiveCount ?? 0}</div></div>
        <div><div className="text-[10px] text-[#8f98a1]">Council</div><div className="mt-1 truncate text-[12px] font-semibold">{actionKo(decision.council?.verdict ?? '—')}</div></div>
        <div><div className="text-[10px] text-[#8f98a1]">Risk</div><div className="mt-1 truncate text-[12px] font-semibold">{decision.riskDisposition ?? '—'}</div></div>
      </div>
    </button>
  );
};

type HomeProps = {
  operations: OperationsPayload | null;
  decision: DecisionTapeItem | null;
  selectedMarket: string | null;
  health: MarketHealth;
  online: boolean;
  loading: boolean;
  events: LedgerEvent[];
  strategies: StrategyCard[];
  onRefresh: () => void;
  onAnalysis: () => void;
  onPortfolio: () => void;
  onEvidence: () => void;
  onCouncil: () => void;
  onLog: () => void;
};

const HomeTab = ({ operations, decision, selectedMarket, health, online, loading, events, strategies, onRefresh, onAnalysis, onPortfolio, onEvidence, onCouncil, onLog }: HomeProps) => {
  const portfolio = operations?.portfolio;
  const totalReturn = portfolio?.initialEquity ? portfolio.equity / portfolio.initialEquity - 1 : operations?.performance?.totalReturnPct ?? null;
  const ingestion = operations?.ingestion;
  const topStrategy = [...strategies].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0] ?? null;
  return (
    <Screen>
      <div className="flex items-center justify-between pt-1">
        <div><div className="text-[25px] font-semibold tracking-[-0.05em]">Black Oracle</div><div className="mt-1 text-[12px] text-[#87919a]">Decision OS · Paper Operations</div></div>
        <button type="button" onClick={onRefresh} aria-label="데이터 새로고침" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><RefreshCw className={cn('h-5 w-5 text-[#5b6570]', loading && 'animate-spin')} /></button>
      </div>

      <div className="mt-5"><DataHealthCard operations={operations} market={selectedMarket} health={health} online={online} /></div>

      <div className="mt-4 rounded-[24px] border border-[#edf0f2] bg-white p-5 shadow-[0_16px_48px_rgba(15,23,42,0.05)]">
        <div className="text-[13px] font-medium text-[#7f8992]">총 자산 · Paper</div>
        <div className="mt-2 text-[34px] font-semibold tracking-[-0.055em]">{formatKrw(portfolio?.equity)}</div>
        <div className="mt-1 text-[17px] font-semibold" style={{ color: (totalReturn ?? 0) >= 0 ? '#0aa77d' : '#dc5a66' }}>{pct(totalReturn, true)}</div>
        <div className="mt-4"><PortfolioPerformanceChart points={operations?.equityCurve ?? []} compact /></div>
        <button type="button" onClick={onPortfolio} className="mt-4 flex w-full items-center justify-between border-t border-[#f0f2f4] pt-4 text-left"><span className="text-[13px] font-semibold text-[#3b454e]">포트폴리오 전체 보기</span><ChevronRight className="h-4 w-4 text-[#a2abb3]" /></button>
      </div>

      <div className="mt-4"><RiskCard operations={operations} /></div>

      <section className="mt-7"><SectionTitle title="현재 Oracle 판단" action="AI 리포트" onAction={onAnalysis} /><DecisionCard decision={decision} onOpen={onAnalysis} /></section>

      <section className="mt-7">
        <SectionTitle title="운영 모듈" />
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onEvidence} className="rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left"><Database className="h-5 w-5 text-[#56626d]" /><div className="mt-4 text-[14px] font-semibold">Evidence</div><div className="mt-2 text-[12px] leading-5 text-[#7f8992]">활성 {ingestion?.evidenceActive ?? 0} · 외부 {ingestion?.externalEvidenceActive ?? 0}<br />NARS 최근 {ingestion?.narsInboxRecent ?? 0}</div></button>
          <button type="button" onClick={onCouncil} className="rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left"><Bot className="h-5 w-5 text-[#56626d]" /><div className="mt-4 text-[14px] font-semibold">Council</div><div className="mt-2 text-[12px] leading-5 text-[#7f8992]">{decision?.council?.verdict ? actionKo(decision.council.verdict) : '판단 대기'}<br />찬성 {decision?.council?.approveCount ?? 0} · 반대 {decision?.council?.rejectCount ?? 0}</div></button>
          <button type="button" onClick={onPortfolio} className="rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left"><Briefcase className="h-5 w-5 text-[#56626d]" /><div className="mt-4 text-[14px] font-semibold">포지션</div><div className="mt-2 text-[12px] leading-5 text-[#7f8992]">열린 포지션 {portfolio?.openPositions.length ?? 0}개<br />현금 {formatKrw(portfolio?.cash)}</div></button>
          <button type="button" onClick={onLog} className="rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left"><ScrollText className="h-5 w-5 text-[#56626d]" /><div className="mt-4 text-[14px] font-semibold">Canonical Log</div><div className="mt-2 text-[12px] leading-5 text-[#7f8992]">최근 로드 {events.length}개<br />전략 선두 {topStrategy?.name ?? '—'}</div></button>
        </div>
      </section>
    </Screen>
  );
};

const MarketTab = ({ decisions, selectedMarket, onSelectMarket }: { decisions: DecisionTapeItem[]; selectedMarket: string | null; onSelectMarket: (market: string) => void }) => {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'score' | 'confidence'>('recent');
  const latestByMarket = useMemo(() => {
    const map = new Map<string, DecisionTapeItem>();
    for (const decision of [...decisions].sort((a, b) => b.timestamp - a.timestamp)) if (!map.has(decision.market)) map.set(decision.market, decision);
    return [...map.values()];
  }, [decisions]);
  const filtered = useMemo(() => latestByMarket
    .filter((decision) => decision.market.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sort === 'score' ? (b.oracleTradeScore ?? -1) - (a.oracleTradeScore ?? -1) : sort === 'confidence' ? (b.confidence ?? -1) - (a.confidence ?? -1) : b.timestamp - a.timestamp), [latestByMarket, query, sort]);

  return (
    <Screen>
      <Header title="시장" subtitle="검색한 종목은 AI 리포트·Evidence·Council·로그의 공통 선택 종목으로 유지됩니다." />
      <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#e5e9ec] bg-white px-4 shadow-[0_6px_20px_rgba(15,23,42,0.03)]"><Search className="h-5 w-5 text-[#89939d]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="KRW-BTC, KRX-005930 검색" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#a4abb2]" /></label>
      <div className="mt-3 flex gap-2"><Pill active={sort === 'recent'} onClick={() => setSort('recent')}>최신순</Pill><Pill active={sort === 'score'} onClick={() => setSort('score')}>Score순</Pill><Pill active={sort === 'confidence'} onClick={() => setSort('confidence')}>Confidence순</Pill></div>
      <div className="mt-5 space-y-3">
        {filtered.map((decision) => (
          <button type="button" key={decision.market} onClick={() => onSelectMarket(decision.market)} className={cn('w-full rounded-[20px] border bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.03)]', selectedMarket === decision.market ? 'border-[#aebdc7] ring-1 ring-[#dce4e9]' : 'border-[#edf0f2]')}>
            <div className="flex items-start justify-between gap-3"><div><div className="text-[18px] font-semibold">{decision.market}</div><div className="mt-1 text-[12px] text-[#8f98a1]">{regimeKo(decision.regime)} · {timeAgo(decision.timestamp)}</div></div><StatusChip value={actionKo(decision.decision)} /></div>
            <div className="mt-3 line-clamp-2 text-[12px] leading-5 text-[#74808a]">{reasonKo(decision.primaryReason || decision.reasons?.[0])}</div>
            <div className="mt-4 grid grid-cols-2 gap-4"><ScoreBar label="Oracle Score" value={decision.oracleTradeScore} /><ScoreBar label="Confidence" value={decision.confidence} max={1} /></div>
            <div className="mt-4 grid grid-cols-4 gap-2 border-t border-[#f0f2f4] pt-3 text-center"><Metric label="Evidence" value={`${decision.evidenceActiveCount ?? 0}`} /><Metric label="Council" value={actionKo(decision.council?.verdict ?? '—')} /><Metric label="Risk" value={decision.riskDisposition ?? '—'} /><Metric label="Route" value={decision.strategyDisposition ?? decision.router?.route ?? '—'} /></div>
            {decision.tradeMap && decision.tradeMap.status !== 'NO_TRADE' && <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-[#f7f8f9] p-3"><Metric label="진입가 · 1개당" value={formatKrw(decision.tradeMap.entryPrice)} /><Metric label="손절가 · 1개당" value={formatKrw(decision.tradeMap.stopLossPrice)} accent="#dc5a66" /><Metric label="2차 익절가 · 1개당" value={formatKrw(decision.tradeMap.takeProfit2Price)} accent="#1687c7" /></div>}
          </button>
        ))}
        {!filtered.length && <EmptyCard title="검색 결과 없음" body="현재 decisionTape에 기록된 종목 기준으로 검색합니다." />}
      </div>
    </Screen>
  );
};

const StrategiesTab = ({ strategies, onSelect }: { strategies: StrategyCard[]; onSelect: (strategy: StrategyCard) => void }) => {
  const sorted = [...strategies].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return <Screen><Header title="전략 경쟁" subtitle="공식 Grade Engine 전에는 임의 등급을 표시하지 않습니다." /><div className="space-y-3">{sorted.map((strategy, index) => <button type="button" key={strategy.id} onClick={() => onSelect(strategy)} className="w-full rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1f4f6] text-[12px] font-semibold">{index + 1}</div><div className="min-w-0 flex-1"><div className="text-[16px] font-semibold">{strategy.name}</div><div className="mt-1 text-[12px] text-[#8f98a1]">{strategy.lifecycle} · {strategy.samples} samples</div></div><ScoreGauge label="Score" value={strategy.score} compact /></div><div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#f0f2f4] pt-4"><Metric label="Sharpe" value={scoreText(strategy.sharpe)} /><Metric label="MDD" value={pct(strategy.mdd)} /><Metric label="MC 생존" value={pct(strategy.survival)} /></div></button>)}{!sorted.length && <EmptyCard title="전략 결과 없음" body="Strategy Factory 결과를 기다리고 있습니다." />}</div></Screen>;
};

const LogHubTab = ({ operations, events, selectedMarket, onRoute, onClear }: { operations: OperationsPayload | null; events: LedgerEvent[]; selectedMarket: string | null; onRoute: (route: DetailRoute) => void; onClear: () => void }) => (
  <Screen>
    <Header title="로그 · 감독" subtitle="선택 종목을 유지한 채 Evidence·Council·거래 trace를 추적합니다." />
    {selectedMarket && <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#eef3f6] px-4 py-3"><div><div className="text-[10px] text-[#82909a]">현재 종목 필터</div><div className="mt-0.5 text-[14px] font-semibold">{selectedMarket}</div></div><button type="button" onClick={onClear} className="text-[12px] font-semibold text-[#60707c]">전체 보기</button></div>}
    <button type="button" onClick={() => onRoute('log')} className="w-full rounded-[22px] bg-[#121820] p-5 text-left text-white"><div className="flex items-center justify-between"><ScrollText className="h-5 w-5 text-white/75" /><ChevronRight className="h-4 w-4 text-white/45" /></div><div className="mt-4 text-[21px] font-semibold">Canonical Log</div><div className="mt-2 text-[12px] leading-5 text-white/65">{events.length}개 이벤트 · 검색·필터·상세 trace</div><div className="mt-4 text-[11px] text-white/45">Runtime {operations?.status ?? 'UNKNOWN'} · {operations?.mode ?? 'PAPER'}</div></button>
    <div className="mt-4 grid grid-cols-2 gap-3">{[
      ['Evidence', '근거·NARS·신뢰도', Database, 'evidence'], ['Council', '찬성·주의·반대', Network, 'council'], ['AI 리포트', '차트·판단·보호선', Brain, 'analysis'], ['거래 추적', 'Decision→Outcome', ShieldCheck, 'trade'],
    ].map(([label, body, Icon, route]) => { const C = Icon as React.ComponentType<{ className?: string }>; return <button type="button" key={String(label)} onClick={() => onRoute(route as DetailRoute)} className="rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left"><C className="h-5 w-5 text-[#56626d]" /><div className="mt-4 text-[14px] font-semibold">{label}</div><div className="mt-1 text-[12px] text-[#87919a]">{body}</div></button>; })}</div>
    <section className="mt-7"><SectionTitle title="최근 이벤트" action="전체 로그" onAction={() => onRoute('log')} /><div className="space-y-3">{events.slice(0, 5).map((event) => <EventCard key={event.id || event.eventKey} event={event} onClick={() => onRoute('log')} />)}{!events.length && <EmptyCard title="로그 없음" body="Canonical Ledger 이벤트를 기다리고 있습니다." />}</div></section>
  </Screen>
);

const BottomNavigation = ({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) => {
  const items: Array<{ id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'home', label: '홈', Icon: Home }, { id: 'market', label: '시장', Icon: Search }, { id: 'strategies', label: '전략', Icon: ListTree }, { id: 'portfolio', label: '포트폴리오', Icon: Briefcase }, { id: 'more', label: '로그', Icon: ScrollText },
  ];
  return <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#eceff1] bg-white/95 pb-[max(env(safe-area-inset-bottom),7px)] pt-1 backdrop-blur-xl"><div className="grid grid-cols-5">{items.map(({ id, label, Icon }) => { const active = id === tab; return <button type="button" key={id} onClick={() => onChange(id)} className="flex min-h-[62px] flex-col items-center justify-center gap-1"><Icon className={cn('h-5 w-5', active ? 'text-[#171c21]' : 'text-[#9aa3ab]')} /><span className={cn('text-[10px] font-semibold', active ? 'text-[#171c21]' : 'text-[#9aa3ab]')}>{label}</span></button>; })}</div></nav>;
};

export const BlackOracleMobileApp: React.FC = () => {
  const [tab, setTab] = useState<Tab>('home');
  const [route, setRoute] = useState<DetailRoute>(null);
  const [returnRoute, setReturnRoute] = useState<DetailRoute>(null);
  const [operations, setOperations] = useState<OperationsPayload | null>(null);
  const [factory, setFactory] = useState<FactoryPayload | null>(null);
  const [eventsPayload, setEventsPayload] = useState<EventsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyCard | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<OpenPosition | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<LedgerEvent | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<OperationalEvidence | null>(null);
  const [marketHealth, setMarketHealth] = useState<MarketHealth>({ loading: false, available: null, configured: null, source: null, asOf: null, error: null });

  const load = useCallback(async () => {
    setLoading(true);
    const [operationsResult, factoryResult, eventsResult] = await Promise.allSettled([
      fetch('/api/trading-status', { cache: 'no-store' }).then((response) => response.json() as Promise<OperationsPayload>),
      fetch('/api/strategy-factory-status', { cache: 'no-store' }).then((response) => response.json() as Promise<FactoryPayload>),
      fetch('/api/events?limit=300', { cache: 'no-store' }).then((response) => response.json() as Promise<EventsPayload>),
    ]);
    if (operationsResult.status === 'fulfilled') setOperations(operationsResult.value);
    if (factoryResult.status === 'fulfilled') setFactory(factoryResult.value);
    if (eventsResult.status === 'fulfilled') setEventsPayload(eventsResult.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const visible = () => document.visibilityState === 'visible' && void load();
    const onOnline = () => { setOnline(true); void load(); };
    const onOffline = () => setOnline(false);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', visible); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [load]);

  const decisions = useMemo(() => [...(operations?.decisionTape ?? [])].sort((a, b) => b.timestamp - a.timestamp), [operations?.decisionTape]);
  const allEvents = useMemo(() => [...(eventsPayload?.events ?? [])].sort((a, b) => b.occurredAt - a.occurredAt), [eventsPayload?.events]);
  const strategies = useMemo(() => buildStrategies(factory, operations), [factory, operations]);

  useEffect(() => { if (!selectedMarket && decisions[0]?.market) setSelectedMarket(decisions[0].market); }, [decisions, selectedMarket]);

  const selectedDecision = useMemo(() => selectedMarket ? decisions.find((item) => item.market === selectedMarket) ?? decisions[0] ?? null : decisions[0] ?? null, [decisions, selectedMarket]);
  const scopedDecisions = useMemo(() => selectedMarket ? decisions.filter((item) => item.market === selectedMarket) : decisions, [decisions, selectedMarket]);
  const scopedEvents = useMemo(() => selectedMarket ? allEvents.filter((event) => !event.market || event.market === selectedMarket) : allEvents, [allEvents, selectedMarket]);
  const evidenceItems = useMemo(() => (operations?.evidenceFlow ?? []).filter((item) => !selectedMarket || !item.market || item.market === selectedMarket), [operations?.evidenceFlow, selectedMarket]);
  const scopedTrades = useMemo(() => (operations?.recentTrades ?? []).filter((trade) => !selectedMarket || trade.market === selectedMarket), [operations?.recentTrades, selectedMarket]);

  useEffect(() => {
    if (!selectedMarket || !/^KRW-[A-Z0-9]+$|^KRX-\d{6}$/.test(selectedMarket)) {
      setMarketHealth({ loading: false, available: null, configured: null, source: null, asOf: null, error: null });
      return;
    }
    let active = true;
    setMarketHealth((current) => ({ ...current, loading: true, error: null }));
    fetch(`/api/market-chart?market=${encodeURIComponent(selectedMarket)}&unit=1440&count=12`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => { if (active) setMarketHealth({ loading: false, available: payload?.available === true, configured: payload?.configured ?? null, source: payload?.source ?? null, asOf: payload?.asOf ?? null, error: payload?.error ?? null }); })
      .catch(() => { if (active) setMarketHealth({ loading: false, available: false, configured: null, source: null, asOf: null, error: '시장 데이터 health 요청 실패' }); });
    return () => { active = false; };
  }, [selectedMarket, operations?.loop?.cycleCount]);

  const openRoute = (next: DetailRoute) => { setReturnRoute(null); setRoute(next); };
  const openChild = (next: DetailRoute, parent: DetailRoute) => { setReturnRoute(parent); setRoute(next); };
  const back = () => { if (returnRoute) { setRoute(returnRoute); setReturnRoute(null); } else setRoute(null); };
  const switchTab = (next: Tab) => { setRoute(null); setReturnRoute(null); setTab(next); };
  const selectDecision = (decision: DecisionTapeItem) => { setSelectedMarket(decision.market); };
  const selectMarketAndOpen = (market: string) => { setSelectedMarket(market); openRoute('analysis'); };
  const chooseEvent = (event: LedgerEvent, parent: DetailRoute) => { setSelectedEvent(event); if (event.market) setSelectedMarket(event.market); openChild('event', parent); };

  const detail = () => {
    if (route === 'strategy') return <StrategyDetail strategy={selectedStrategy} onBack={back} />;
    if (route === 'position') return <PositionDetailClarity position={selectedPosition} decision={selectedPosition ? decisions.find((item) => item.market === selectedPosition.market) ?? null : null} onBack={back} />;
    if (route === 'analysis') return <AnalysisDetailV2 decisions={decisions} selected={selectedDecision} onSelect={selectDecision} onCouncil={() => openChild('council', 'analysis')} onBack={back} />;
    if (route === 'evidence') return <EvidenceListDetail items={evidenceItems} events={scopedEvents.filter((event) => event.eventType === 'EVIDENCE')} onSelectItem={(item) => { setSelectedEvidence(item); if (item.market) setSelectedMarket(item.market); openChild('evidence-item', 'evidence'); }} onSelectEvent={(event) => chooseEvent(event, 'evidence')} onBack={back} />;
    if (route === 'evidence-item') return <EvidenceItemDetail item={selectedEvidence} onBack={back} />;
    if (route === 'council') return <CouncilDetail decisions={scopedDecisions.length ? scopedDecisions : decisions} selected={selectedDecision} onSelect={selectDecision} onBack={back} />;
    if (route === 'trade') return <TradeTimelineDetail decisions={scopedDecisions.length ? scopedDecisions : decisions} selected={selectedDecision} onSelectDecision={selectDecision} events={scopedEvents} recentTrades={scopedTrades} onSelectEvent={(event) => chooseEvent(event, 'trade')} onAnalysis={() => openChild('analysis', 'trade')} onBack={back} />;
    if (route === 'log') return <LogDetail events={scopedEvents} onSelectEvent={(event) => chooseEvent(event, 'log')} onBack={back} />;
    if (route === 'event') return <EventDetail event={selectedEvent} onBack={back} />;
    return null;
  };

  const tabView = () => {
    if (tab === 'home') return <HomeTab operations={operations} decision={selectedDecision} selectedMarket={selectedMarket} health={marketHealth} online={online} loading={loading} events={scopedEvents} strategies={strategies} onRefresh={load} onAnalysis={() => openRoute('analysis')} onPortfolio={() => switchTab('portfolio')} onEvidence={() => openRoute('evidence')} onCouncil={() => openRoute('council')} onLog={() => openRoute('log')} />;
    if (tab === 'market') return <MarketTab decisions={decisions} selectedMarket={selectedMarket} onSelectMarket={selectMarketAndOpen} />;
    if (tab === 'strategies') return <StrategiesTab strategies={strategies} onSelect={(strategy) => { setSelectedStrategy(strategy); openRoute('strategy'); }} />;
    if (tab === 'portfolio') return <PortfolioTabV4 operations={operations} decisions={decisions} onSelectPosition={(position) => { setSelectedPosition(position); setSelectedMarket(position.market); openRoute('position'); }} />;
    return <LogHubTab operations={operations} events={scopedEvents} selectedMarket={selectedMarket} onRoute={openRoute} onClear={() => setSelectedMarket(null)} />;
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#f7f8f9] text-[#111418]" style={{ colorScheme: 'light' }}>
      <AnimatePresence mode="wait"><motion.div key={route ?? tab} initial={{ opacity: 0, x: route ? 10 : 0 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: route ? -8 : 0 }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }} className="absolute inset-0">{route ? detail() : tabView()}</motion.div></AnimatePresence>
      {!route && <BottomNavigation tab={tab} onChange={switchTab} />}
    </div>
  );
};