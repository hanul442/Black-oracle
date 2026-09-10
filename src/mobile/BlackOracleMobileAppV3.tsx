import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bell, Bot, Brain, Briefcase, ChevronRight, Database, Eye, Home, ListTree, MoreHorizontal, Network, RefreshCw, ScrollText, Search, Settings, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { DecisionTapeItem, DetailRoute, EventsPayload, FactoryPayload, LedgerEvent, OpenPosition, OperationalEvidence, OperationsPayload, StrategyCard, Tab } from './v2/types';
import { actionKo, cn, pct, regimeKo, scoreText, strategyName, timeAgo } from './v2/types';
import { EmptyCard, Header, Metric, Pill, ScoreBar, ScoreGauge, Screen, SectionTitle, Sparkline, StatusChip } from './v2/ui';
import { AnalysisDetail, CouncilDetail, EventDetail, EvidenceItemDetail, EvidenceListDetail, LogDetail, StrategyDetail, TradeTimelineDetail } from './v2/details';
import { PositionDetailClarity } from './v2/PositionDetailClarity';
import { PortfolioTabClarity } from './v2/PortfolioTabClarity';
import { formatKrw } from './v2/financial';

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
      profile: [Math.max(0, item.metrics.regimeStability), Math.max(0, item.validation?.parameterRobustness ?? item.metrics.parameterRobustness), Math.max(0, item.validation?.monteCarloSurvivalRate ?? item.metrics.monteCarloSurvivalRate), Math.max(0, Math.min(1, 0.5 + item.metrics.oosExpectancy * 10)), Math.max(0, Math.min(1, item.evaluation.score / 100))],
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
    thesis: 'Paper runtime에서 관측된 전략 버전입니다. Strategy Factory의 공식 검증 결과와는 별개입니다.',
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

const HomeTab = ({ operations, events, loading, onRefresh, onRoute, onTab, onEvent }: { operations: OperationsPayload | null; events: LedgerEvent[]; loading: boolean; onRefresh: () => void; onRoute: (route: DetailRoute) => void; onTab: (tab: Tab) => void; onEvent: (event: LedgerEvent) => void }) => {
  const portfolio = operations?.portfolio;
  const initial = portfolio?.initialEquity ?? 0;
  const totalReturn = portfolio && initial > 0 ? portfolio.equity / initial - 1 : operations?.performance?.totalReturnPct ?? null;
  const equityValues = operations?.equityCurve?.map((item) => item.equity) ?? [];
  const latestEvent = events[0];
  const systemHealthy = operations?.status === 'OK' && !operations?.loop?.stale;
  const quick = [
    { label: '거래 현황', Icon: Activity, action: () => onRoute('trade') },
    { label: '전략 허브', Icon: Network, action: () => onTab('strategies') },
    { label: 'AI 리포트', Icon: Brain, action: () => onRoute('analysis') },
    { label: '근거', Icon: Database, action: () => onRoute('evidence') },
    { label: 'Council', Icon: Bot, action: () => onRoute('council') },
  ];
  return (
    <Screen>
      <div className="flex items-center justify-between pt-1"><div className="text-[23px] font-semibold tracking-[-0.05em]">Black Oracle</div><div className="flex gap-2"><button type="button" onClick={onRefresh} className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"><RefreshCw className={cn('h-4 w-4 text-[#5b6570]', loading && 'animate-spin')} /></button><button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"><Bell className="h-4 w-4 text-[#5b6570]" /></button></div></div>
      <div className="mt-7"><div className="text-[24px] font-medium leading-[1.2] tracking-[-0.05em]">한서님,<br />오늘의 판단을 설명해드릴게요.</div><div className="mt-4 flex gap-2"><Pill active={systemHealthy}>{systemHealthy ? 'Runtime 정상' : operations?.status ?? '확인 중'}</Pill><Pill>{operations?.mode ?? 'PAPER'}</Pill></div></div>
      <div className="mt-6 rounded-[24px] border border-[#edf0f2] bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)]"><div className="flex items-center justify-between"><div className="text-[11px] font-medium text-[#828b94]">총 자산 · Paper</div><Eye className="h-4 w-4 text-[#9ca3aa]" /></div><div className="mt-2 text-[30px] font-semibold tracking-[-0.05em]">{formatKrw(portfolio?.equity)}</div><div className="mt-1 text-[15px] font-semibold" style={{ color: (totalReturn ?? 0) >= 0 ? '#0aa77d' : '#dc5a66' }}>{pct(totalReturn, true)}</div><div className="mt-3"><Sparkline values={equityValues} positive={(totalReturn ?? 0) >= 0} /></div></div>
      <button type="button" onClick={() => onTab('portfolio')} className="mt-3 flex w-full items-center justify-between rounded-2xl border border-[#edf0f2] bg-white px-4 py-3.5"><div className="text-left"><div className="text-[13px] font-semibold">{portfolio?.openPositions.length ?? 0}개 진행 중 포지션</div><div className="mt-1 text-[10px] text-[#939ca5]">평균 진입가 · 수량 · 투입금액 · 현재가 · 평가손익을 구분해 표시</div></div><ChevronRight className="h-4 w-4 text-[#adb4bb]" /></button>
      <div className="mt-5 grid grid-cols-5 gap-2">{quick.map(({ label, Icon, action }) => <button type="button" key={label} onClick={action} className="flex min-w-0 flex-col items-center gap-2"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)]"><Icon className="h-[18px] w-[18px] text-[#26313a]" /></span><span className="truncate text-[9px] font-medium text-[#737d87]">{label}</span></button>)}</div>
      <div className="mt-7"><SectionTitle title="최근 활동" action="전체 로그" onAction={() => onRoute('log')} />{latestEvent ? <button type="button" onClick={() => onEvent(latestEvent)} className="w-full rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Pill>{latestEvent.eventType}</Pill>{latestEvent.market && <span className="text-[10px] font-semibold">{latestEvent.market}</span>}</div><span className="text-[9px] text-[#a0a7ae]">{timeAgo(latestEvent.occurredAt)}</span></div><div className="mt-3 text-[14px] font-semibold leading-5">{latestEvent.summary}</div><div className="mt-2 text-[10px] text-[#929aa2]">눌러서 상세 trace와 태그 보기</div></button> : <EmptyCard title="Canonical event 대기 중" body="새 이벤트가 기록되면 여기에서 가장 최근 활동을 설명합니다." />}</div>
    </Screen>
  );
};

const MarketTab = ({ decisions, selected, onSelect }: { decisions: DecisionTapeItem[]; selected: DecisionTapeItem | null; onSelect: (decision: DecisionTapeItem) => void }) => {
  const [sort, setSort] = useState<'recent' | 'score' | 'confidence'>('recent');
  const sorted = useMemo(() => [...decisions].sort((a, b) => sort === 'score' ? (b.oracleTradeScore ?? -1) - (a.oracleTradeScore ?? -1) : sort === 'confidence' ? (b.confidence ?? -1) - (a.confidence ?? -1) : b.timestamp - a.timestamp), [decisions, sort]);
  return <Screen><Header title="시장" subtitle="실제 Paper 판단입니다. 카드를 누르면 종목별 AI 리포트로 이동합니다." right={<Search className="mt-2 h-5 w-5 text-[#77818b]" />} /><div className="flex gap-2"><Pill active={sort === 'recent'} onClick={() => setSort('recent')}>최신순</Pill><Pill active={sort === 'score'} onClick={() => setSort('score')}>Score순</Pill><Pill active={sort === 'confidence'} onClick={() => setSort('confidence')}>Confidence순</Pill></div><div className="mt-5 space-y-3">{sorted.map((decision) => <button type="button" key={`${decision.market}-${decision.timestamp}`} onClick={() => onSelect(decision)} className={cn('w-full rounded-[20px] border bg-white p-4 text-left', selected?.market === decision.market ? 'border-[#cfd9de]' : 'border-[#edf0f2]')}><div className="flex items-start justify-between"><div><div className="text-[16px] font-semibold">{decision.market}</div><div className="mt-1 text-[10px] text-[#939ba3]">{regimeKo(decision.regime)} · {timeAgo(decision.timestamp)}</div></div><StatusChip value={actionKo(decision.decision)} /></div><div className="mt-4 grid grid-cols-2 gap-4"><ScoreBar label="Oracle Score" value={decision.oracleTradeScore} /><ScoreBar label="Confidence" value={decision.confidence} max={1} /></div></button>)}{!sorted.length && <EmptyCard title="시장 판단 대기 중" body="Paper Engine의 decisionTape에 시장 판단이 기록되면 표시합니다." />}</div></Screen>;
};

const StrategiesTab = ({ strategies, onSelect }: { strategies: StrategyCard[]; onSelect: (strategy: StrategyCard) => void }) => {
  const [sort, setSort] = useState<'score' | 'sharpe' | 'survival' | 'samples'>('score');
  const sorted = useMemo(() => [...strategies].sort((a, b) => sort === 'sharpe' ? (b.sharpe ?? -999) - (a.sharpe ?? -999) : sort === 'survival' ? (b.survival ?? -1) - (a.survival ?? -1) : sort === 'samples' ? b.samples - a.samples : (b.score ?? -1) - (a.score ?? -1)), [sort, strategies]);
  return <Screen><Header title="전략 허브" subtitle="공식 Grade Engine 전에는 임의 등급을 표시하지 않습니다. 실제 검증 수치만 보여줍니다." /><div className="flex gap-2 overflow-x-auto"><Pill active={sort === 'score'} onClick={() => setSort('score')}>Score</Pill><Pill active={sort === 'sharpe'} onClick={() => setSort('sharpe')}>Sharpe</Pill><Pill active={sort === 'survival'} onClick={() => setSort('survival')}>MC 생존</Pill><Pill active={sort === 'samples'} onClick={() => setSort('samples')}>표본수</Pill></div><div className="mt-4 space-y-3">{sorted.map((strategy) => <button type="button" key={strategy.id} onClick={() => onSelect(strategy)} className="w-full rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="text-[15px] font-semibold">{strategy.name}</div><div className="mt-1 text-[10px] text-[#929aa2]">{strategy.lifecycle} · {strategy.samples} samples</div></div><ScoreGauge label="Score" value={strategy.score} compact /></div><div className="mt-3 grid grid-cols-3 gap-3 border-t border-[#f1f2f4] pt-3"><Metric label="Sharpe" value={scoreText(strategy.sharpe)} /><Metric label="MDD" value={pct(strategy.mdd)} /><Metric label="MC 생존" value={pct(strategy.survival)} /></div></button>)}{!sorted.length && <EmptyCard title="전략 결과 없음" body="Strategy Factory 결과가 생성되면 표시합니다." />}</div></Screen>;
};

const MoreTab = ({ operations, events, onRoute }: { operations: OperationsPayload | null; events: LedgerEvent[]; onRoute: (route: DetailRoute) => void }) => {
  const menus = [
    { label: 'Canonical Log', body: '검색·정렬·태그·상세 trace', Icon: ScrollText, route: 'log' as DetailRoute },
    { label: 'Evidence', body: '출처·신뢰도·영향·rationale', Icon: Database, route: 'evidence' as DetailRoute },
    { label: 'Council Room', body: '누가 찬성·주의·반대했는지', Icon: Network, route: 'council' as DetailRoute },
    { label: 'AI 리포트', body: '종목·차트·판단 경로 설명', Icon: Brain, route: 'analysis' as DetailRoute },
    { label: '거래 현황', body: 'Decision→Risk→Trade→Outcome', Icon: ShieldCheck, route: 'trade' as DetailRoute },
  ];
  return <Screen><Header title="더보기" subtitle="핵심 감독·설명 기능" /><div className="rounded-[22px] border border-[#edf0f2] bg-white p-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#edf1f4]"><Bot className="h-5 w-5 text-[#33404b]" /></span><div><div className="text-[14px] font-semibold">Black Oracle</div><div className="mt-1 text-[10px] text-[#929aa2]">{operations?.mode ?? 'PAPER'} · {operations?.status ?? 'UNKNOWN'} · {events.length} canonical events</div></div></div></div><div className="mt-5 overflow-hidden rounded-[20px] border border-[#edf0f2] bg-white">{menus.map(({ label, body, Icon, route }, index) => <button type="button" key={label} onClick={() => onRoute(route)} className={cn('flex w-full items-center gap-3 px-4 py-4 text-left', index !== menus.length - 1 && 'border-b border-[#f0f2f4]')}><Icon className="h-[18px] w-[18px] text-[#48545f]" /><div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{label}</div><div className="mt-0.5 text-[10px] text-[#9aa2a9]">{body}</div></div><ChevronRight className="h-4 w-4 text-[#b4bac0]" /></button>)}</div><div className="mt-5 flex items-center gap-3 rounded-[18px] border border-[#edf0f2] bg-white px-4 py-4"><Settings className="h-[18px] w-[18px] text-[#48545f]" /><div className="flex-1 text-[13px] font-semibold">설정</div><ChevronRight className="h-4 w-4 text-[#b4bac0]" /></div></Screen>;
};

const BottomNavigation = ({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) => {
  const items: Array<{ id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'home', label: '홈', Icon: Home }, { id: 'market', label: '시장', Icon: Search }, { id: 'strategies', label: '전략', Icon: ListTree }, { id: 'portfolio', label: '포트폴리오', Icon: Briefcase }, { id: 'more', label: '더보기', Icon: MoreHorizontal },
  ];
  return <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#eceff1] bg-white/95 pb-[max(env(safe-area-inset-bottom),7px)] pt-1 backdrop-blur-xl"><div className="grid grid-cols-5">{items.map(({ id, label, Icon }) => { const active = id === tab; return <button type="button" key={id} onClick={() => onChange(id)} className="flex min-h-[58px] flex-col items-center justify-center gap-1"><Icon className={cn('h-[19px] w-[19px]', active ? 'text-[#171c21]' : 'text-[#a0a8af]')} /><span className={cn('text-[9px] font-medium', active ? 'text-[#171c21]' : 'text-[#a0a8af]')}>{label}</span></button>; })}</div></nav>;
};

export const BlackOracleMobileApp: React.FC = () => {
  const [tab, setTab] = useState<Tab>('home');
  const [route, setRoute] = useState<DetailRoute>(null);
  const [returnRoute, setReturnRoute] = useState<DetailRoute>(null);
  const [operations, setOperations] = useState<OperationsPayload | null>(null);
  const [factory, setFactory] = useState<FactoryPayload | null>(null);
  const [eventsPayload, setEventsPayload] = useState<EventsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDecision, setSelectedDecision] = useState<DecisionTapeItem | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyCard | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<OpenPosition | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<LedgerEvent | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<OperationalEvidence | null>(null);

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

  useEffect(() => { void load(); const interval = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(interval); }, [load]);

  const decisions = useMemo(() => [...(operations?.decisionTape ?? [])].sort((a, b) => b.timestamp - a.timestamp), [operations?.decisionTape]);
  const events = useMemo(() => [...(eventsPayload?.events ?? [])].sort((a, b) => b.occurredAt - a.occurredAt), [eventsPayload?.events]);
  const strategies = useMemo(() => buildStrategies(factory, operations), [factory, operations]);
  const evidenceItems = useMemo(() => operations?.evidenceFlow ?? [], [operations?.evidenceFlow]);

  useEffect(() => { if (!decisions.length) { setSelectedDecision(null); return; } if (!selectedDecision || !decisions.some((item) => item.market === selectedDecision.market && item.timestamp === selectedDecision.timestamp)) setSelectedDecision(decisions[0]); }, [decisions, selectedDecision]);

  const openRoute = (next: DetailRoute) => { setReturnRoute(null); setRoute(next); };
  const openChild = (next: DetailRoute, parent: DetailRoute) => { setReturnRoute(parent); setRoute(next); };
  const back = () => { if (returnRoute) { setRoute(returnRoute); setReturnRoute(null); } else setRoute(null); };
  const switchTab = (next: Tab) => { setRoute(null); setReturnRoute(null); setTab(next); };
  const chooseEvent = (event: LedgerEvent, parent: DetailRoute) => { setSelectedEvent(event); openChild('event', parent); };

  const detail = () => {
    if (route === 'strategy') return <StrategyDetail strategy={selectedStrategy} onBack={back} />;
    if (route === 'position') return <PositionDetailClarity position={selectedPosition} decision={selectedPosition ? decisions.find((item) => item.market === selectedPosition.market) ?? null : null} onBack={back} />;
    if (route === 'analysis') return <AnalysisDetail decisions={decisions} selected={selectedDecision} onSelect={setSelectedDecision} onCouncil={() => openChild('council', 'analysis')} onBack={back} />;
    if (route === 'evidence') return <EvidenceListDetail items={evidenceItems} events={events.filter((event) => event.eventType === 'EVIDENCE')} onSelectItem={(item) => { setSelectedEvidence(item); openChild('evidence-item', 'evidence'); }} onSelectEvent={(event) => chooseEvent(event, 'evidence')} onBack={back} />;
    if (route === 'evidence-item') return <EvidenceItemDetail item={selectedEvidence} onBack={back} />;
    if (route === 'council') return <CouncilDetail decisions={decisions} selected={selectedDecision} onSelect={setSelectedDecision} onBack={back} />;
    if (route === 'trade') return <TradeTimelineDetail decisions={decisions} selected={selectedDecision} onSelectDecision={setSelectedDecision} events={events} recentTrades={operations?.recentTrades ?? []} onSelectEvent={(event) => chooseEvent(event, 'trade')} onAnalysis={() => openChild('analysis', 'trade')} onBack={back} />;
    if (route === 'log') return <LogDetail events={events} onSelectEvent={(event) => chooseEvent(event, 'log')} onBack={back} />;
    if (route === 'event') return <EventDetail event={selectedEvent} onBack={back} />;
    return null;
  };

  const tabView = () => {
    if (tab === 'home') return <HomeTab operations={operations} events={events} loading={loading} onRefresh={load} onRoute={openRoute} onTab={switchTab} onEvent={(event) => chooseEvent(event, null)} />;
    if (tab === 'market') return <MarketTab decisions={decisions} selected={selectedDecision} onSelect={(decision) => { setSelectedDecision(decision); openRoute('analysis'); }} />;
    if (tab === 'strategies') return <StrategiesTab strategies={strategies} onSelect={(strategy) => { setSelectedStrategy(strategy); openRoute('strategy'); }} />;
    if (tab === 'portfolio') return <PortfolioTabClarity operations={operations} decisions={decisions} onSelectPosition={(position) => { setSelectedPosition(position); openRoute('position'); }} />;
    return <MoreTab operations={operations} events={events} onRoute={openRoute} />;
  };

  return <div className="relative h-[100dvh] w-full overflow-hidden bg-[#f7f8f9] text-[#111418]" style={{ colorScheme: 'light' }}><AnimatePresence mode="wait"><motion.div key={route ?? tab} initial={{ opacity: 0, x: route ? 10 : 0 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: route ? -8 : 0 }} transition={{ duration: 0.16 }} className="absolute inset-0">{route ? detail() : tabView()}</motion.div></AnimatePresence>{!route && <BottomNavigation tab={tab} onChange={switchTab} />}</div>;
};
