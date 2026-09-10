import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Brain,
  Briefcase,
  ChevronRight,
  Database,
  Eye,
  Home,
  ListTree,
  Network,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
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
  eventTypeKo,
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
  Sparkline,
  StatusChip,
} from './v2/ui';
import {
  AnalysisDetail,
  CouncilDetail,
  EventDetail,
  EvidenceItemDetail,
  EvidenceListDetail,
  LogDetail,
  StrategyDetail,
  TradeTimelineDetail,
} from './v2/details';
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

const clamp01 = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? null : Math.max(0, Math.min(1, value));

const averageConfidence = (decision: DecisionTapeItem | null) => {
  const values = (decision?.council?.members ?? [])
    .map((member) => clamp01(member.confidence))
    .filter((value): value is number => value != null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const DecisionRadar = ({ decision }: { decision: DecisionTapeItem | null }) => {
  if (!decision) return <EmptyCard title="판단 레이더 대기 중" body="최신 decision trace가 생성되면 판단 축별 confidence를 한눈에 보여줍니다." />;

  const metrics = [
    { label: '최종 판단', value: clamp01(decision.confidence) },
    { label: '시장 국면', value: clamp01(decision.regimeConfidence) },
    { label: '기술 근거', value: clamp01(decision.technicalEvidence?.confidence) },
    { label: 'Forecast', value: decision.forecast?.available ? clamp01(decision.forecast.confidence) : null },
    { label: 'Council', value: averageConfidence(decision) },
  ];
  const centerX = 110;
  const centerY = 90;
  const radius = 58;
  const labelRadius = 79;
  const count = metrics.length;
  const coordinate = (index: number, scale: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    return [centerX + Math.cos(angle) * radius * scale, centerY + Math.sin(angle) * radius * scale] as const;
  };
  const polygon = (scale: number) => metrics.map((_, index) => coordinate(index, scale).join(',')).join(' ');
  const dataPolygon = metrics
    .map((metric, index) => coordinate(index, metric.value ?? 0).join(','))
    .join(' ');
  const aria = metrics.map((metric) => `${metric.label} ${metric.value == null ? '자료 없음' : `${Math.round(metric.value * 100)}점`}`).join(', ');

  return (
    <div className="rounded-[22px] border border-[#edf0f2] bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold">판단 신뢰도 레이더</div>
          <div className="mt-1 text-[10px] text-[#929aa2]">{decision.market} 최신 판단 · 서로 다른 confidence 축을 비교합니다.</div>
        </div>
        <Pill>{actionKo(decision.decision)}</Pill>
      </div>
      <svg viewBox="0 0 220 184" className="mt-2 h-[184px] w-full" role="img" aria-label={aria}>
        {[0.33, 0.66, 1].map((level) => (
          <polygon key={level} points={polygon(level)} fill="none" stroke="#e7ebee" strokeWidth="1" />
        ))}
        {metrics.map((metric, index) => {
          const [x, y] = coordinate(index, 1);
          const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
          const lx = centerX + Math.cos(angle) * labelRadius;
          const ly = centerY + Math.sin(angle) * labelRadius;
          return (
            <g key={metric.label}>
              <line x1={centerX} y1={centerY} x2={x} y2={y} stroke="#e7ebee" strokeWidth="1" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#68727c">{metric.label}</text>
            </g>
          );
        })}
        <polygon points={dataPolygon} fill="rgba(20, 28, 36, 0.10)" stroke="#1b242c" strokeWidth="1.8" />
        {metrics.map((metric, index) => {
          const [x, y] = coordinate(index, metric.value ?? 0);
          return <circle key={`${metric.label}-point`} cx={x} cy={y} r="2.7" fill="#1b242c" />;
        })}
      </svg>
      <div className="grid grid-cols-5 gap-1 border-t border-[#f0f2f4] pt-3">
        {metrics.map((metric) => (
          <div key={`${metric.label}-value`} className="text-center">
            <div className="text-[8px] text-[#9aa2aa]">{metric.label}</div>
            <div className="mt-1 text-[11px] font-semibold">{metric.value == null ? '—' : Math.round(metric.value * 100)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

type HomeTabProps = {
  operations: OperationsPayload | null;
  decisions: DecisionTapeItem[];
  strategies: StrategyCard[];
  events: LedgerEvent[];
  loading: boolean;
  onRefresh: () => void;
  onRoute: (route: DetailRoute) => void;
  onTab: (tab: Tab) => void;
  onEvent: (event: LedgerEvent) => void;
};

const HomeTab = ({ operations, decisions, strategies, events, loading, onRefresh, onRoute, onTab, onEvent }: HomeTabProps) => {
  const portfolio = operations?.portfolio;
  const initial = portfolio?.initialEquity ?? 0;
  const totalReturn = portfolio && initial > 0 ? portfolio.equity / initial - 1 : operations?.performance?.totalReturnPct ?? null;
  const equityValues = operations?.equityCurve?.map((item) => item.equity) ?? [];
  const currentDecision = decisions[0] ?? null;
  const systemHealthy = operations?.status === 'OK' && !operations?.loop?.stale;
  const lastCycleAt = operations?.loop?.lastCycle?.finishedAt ?? null;
  const topStrategies = [...strategies].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 3);
  const ingestion = operations?.ingestion;
  const council = currentDecision?.council;
  const recentEvents = events.slice(0, 3);

  return (
    <Screen>
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="text-[23px] font-semibold tracking-[-0.05em]">Black Oracle</div>
          <div className="mt-1 text-[10px] text-[#9aa2aa]">Decision OS · Mobile Operations Monitor</div>
        </div>
        <button type="button" onClick={onRefresh} aria-label="데이터 새로고침" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <RefreshCw className={cn('h-4 w-4 text-[#5b6570]', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Pill active={systemHealthy}>{systemHealthy ? 'Runtime 정상' : operations?.loop?.stale ? '데이터 지연' : operations?.status ?? '확인 중'}</Pill>
        <Pill>{operations?.mode ?? 'PAPER'}</Pill>
        <Pill>{lastCycleAt ? `갱신 ${timeAgo(lastCycleAt)}` : 'Cycle 대기'}</Pill>
      </div>

      <div className="mt-5 rounded-[24px] border border-[#edf0f2] bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.055)]">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium text-[#828b94]">총 자산 · Paper</div>
          <Eye className="h-4 w-4 text-[#9ca3aa]" />
        </div>
        <div className="mt-2 text-[30px] font-semibold tracking-[-0.05em]">{formatKrw(portfolio?.equity)}</div>
        <div className="mt-1 text-[15px] font-semibold" style={{ color: (totalReturn ?? 0) >= 0 ? '#0aa77d' : '#dc5a66' }}>{pct(totalReturn, true)}</div>
        <div className="mt-3"><Sparkline values={equityValues} positive={(totalReturn ?? 0) >= 0} /></div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#f0f2f4] pt-4">
          <Metric label="오늘 손익률" value={pct(portfolio?.dailyPnlPct, true)} />
          <Metric label="현재 Drawdown" value={pct(portfolio?.currentDrawdownPct)} />
          <Metric label="진행 중" value={`${portfolio?.openPositions.length ?? 0}개`} />
        </div>
      </div>

      <button type="button" onClick={() => onTab('portfolio')} className="mt-3 flex w-full items-center justify-between rounded-2xl border border-[#edf0f2] bg-white px-4 py-3.5 text-left">
        <div>
          <div className="text-[13px] font-semibold">포지션 상세 보기</div>
          <div className="mt-1 text-[10px] text-[#939ca5]">진입가 · 수량 · 투입금액 · 현재가 · 평가손익 · SL/TP를 분리 표시</div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#adb4bb]" />
      </button>

      <section className="mt-7">
        <SectionTitle title="지금 무슨 판단을 하고 있나" action="AI 리포트" onAction={() => onRoute('analysis')} />
        {currentDecision ? (
          <button type="button" onClick={() => onRoute('analysis')} className="w-full rounded-[22px] border border-[#edf0f2] bg-white p-5 text-left shadow-[0_10px_32px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] text-[#929aa2]">{timeAgo(currentDecision.timestamp)} · {regimeKo(currentDecision.regime)}</div>
                <div className="mt-1 text-[20px] font-semibold tracking-[-0.035em]">{currentDecision.market}</div>
              </div>
              <StatusChip value={actionKo(currentDecision.decision)} />
            </div>
            <div className="mt-3 text-[11px] leading-5 text-[#6f7983]">{reasonKo(currentDecision.primaryReason || currentDecision.reasons?.[0])}</div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#f6f8f9] px-3 py-2.5"><div className="text-[8px] text-[#9aa2aa]">Evidence</div><div className="mt-1 text-[10px] font-semibold">활성 {currentDecision.evidenceActiveCount ?? 0} · 상충 {currentDecision.evidenceContradictionCount ?? 0}</div></div>
              <div className="rounded-xl bg-[#f6f8f9] px-3 py-2.5"><div className="text-[8px] text-[#9aa2aa]">Strategy Router</div><div className="mt-1 truncate text-[10px] font-semibold">{currentDecision.strategyDisposition ?? currentDecision.router?.route ?? '미확인'}</div></div>
              <div className="rounded-xl bg-[#f6f8f9] px-3 py-2.5"><div className="text-[8px] text-[#9aa2aa]">Council</div><div className="mt-1 text-[10px] font-semibold">{actionKo(council?.verdict ?? '미검토')}</div></div>
              <div className="rounded-xl bg-[#f6f8f9] px-3 py-2.5"><div className="text-[8px] text-[#9aa2aa]">Risk Gate</div><div className="mt-1 text-[10px] font-semibold">{currentDecision.riskDisposition ?? 'NOT_EVALUATED'}</div></div>
            </div>
          </button>
        ) : <EmptyCard title="최신 판단 없음" body="Paper Engine이 decision trace를 남기면 Evidence → Strategy → Council → Risk → Decision 흐름을 이곳에서 요약합니다." />}
      </section>

      <div className="mt-4"><DecisionRadar decision={currentDecision} /></div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onRoute('evidence')} className="rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left">
          <div className="flex items-center justify-between"><Database className="h-4 w-4 text-[#53606b]" /><ChevronRight className="h-4 w-4 text-[#b1b8be]" /></div>
          <div className="mt-4 text-[12px] font-semibold">Evidence 유입</div>
          <div className="mt-3 space-y-1.5 text-[10px] text-[#79838d]">
            <div className="flex justify-between"><span>활성</span><b className="text-[#303840]">{ingestion?.evidenceActive ?? 0}</b></div>
            <div className="flex justify-between"><span>외부 활성</span><b className="text-[#303840]">{ingestion?.externalEvidenceActive ?? 0}</b></div>
            <div className="flex justify-between"><span>NARS 최근</span><b className="text-[#303840]">{ingestion?.narsInboxRecent ?? 0}</b></div>
            <div className="flex justify-between"><span>요청</span><b className="text-[#303840]">{ingestion?.evidenceRequests ?? 0}</b></div>
          </div>
        </button>

        <button type="button" onClick={() => onRoute('council')} className="rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left">
          <div className="flex items-center justify-between"><Bot className="h-4 w-4 text-[#53606b]" /><ChevronRight className="h-4 w-4 text-[#b1b8be]" /></div>
          <div className="mt-4 text-[12px] font-semibold">Council 상태</div>
          <div className="mt-2 text-[18px] font-semibold">{actionKo(council?.verdict ?? '미검토')}</div>
          <div className="mt-3 grid grid-cols-3 gap-1 text-center">
            <div><div className="text-[8px] text-[#9aa2aa]">찬성</div><div className="mt-1 text-[11px] font-semibold">{council?.approveCount ?? 0}</div></div>
            <div><div className="text-[8px] text-[#9aa2aa]">주의</div><div className="mt-1 text-[11px] font-semibold">{council?.cautionCount ?? 0}</div></div>
            <div><div className="text-[8px] text-[#9aa2aa]">반대</div><div className="mt-1 text-[11px] font-semibold">{council?.rejectCount ?? 0}</div></div>
          </div>
        </button>
      </div>

      <section className="mt-7">
        <SectionTitle title="전략 경쟁" action="전략 허브" onAction={() => onTab('strategies')} />
        <div className="overflow-hidden rounded-[20px] border border-[#edf0f2] bg-white">
          {topStrategies.map((strategy, index) => (
            <button type="button" key={strategy.id} onClick={() => onTab('strategies')} className={cn('flex w-full items-center gap-3 px-4 py-3.5 text-left', index !== topStrategies.length - 1 && 'border-b border-[#f0f2f4]')}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f1f4f6] text-[10px] font-semibold">{index + 1}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold">{strategy.name}</div><div className="mt-0.5 text-[9px] text-[#929aa2]">{strategy.lifecycle} · {strategy.samples} samples</div></div>
              <div className="text-right"><div className="text-[8px] text-[#9aa2aa]">Score</div><div className="mt-0.5 text-[13px] font-semibold">{scoreText(strategy.score)}</div></div>
            </button>
          ))}
          {!topStrategies.length && <div className="p-4"><EmptyCard title="전략 경쟁 데이터 대기 중" body="Strategy Factory 결과가 생성되면 상위 후보를 순위로 보여줍니다." /></div>}
        </div>
      </section>

      <section className="mt-7">
        <SectionTitle title="최근 운영 로그" action="전체 로그" onAction={() => onRoute('log')} />
        <div className="space-y-3">
          {recentEvents.map((event) => <EventCard key={event.id || event.eventKey} event={event} onClick={() => onEvent(event)} />)}
          {!recentEvents.length && <EmptyCard title="Canonical event 대기 중" body="Evidence·Strategy·Council·Decision·Trade 이벤트가 기록되면 최근 활동을 이곳에서 볼 수 있습니다." />}
        </div>
      </section>
    </Screen>
  );
};

const MarketTab = ({ decisions, selected, onSelect }: { decisions: DecisionTapeItem[]; selected: DecisionTapeItem | null; onSelect: (decision: DecisionTapeItem) => void }) => {
  const [sort, setSort] = useState<'recent' | 'score' | 'confidence'>('recent');
  const sorted = useMemo(() => [...decisions].sort((a, b) => {
    if (sort === 'score') return (b.oracleTradeScore ?? -1) - (a.oracleTradeScore ?? -1);
    if (sort === 'confidence') return (b.confidence ?? -1) - (a.confidence ?? -1);
    return b.timestamp - a.timestamp;
  }), [decisions, sort]);

  return (
    <Screen>
      <Header title="시장" subtitle="점수만 보는 화면이 아니라, 각 종목의 근거·Council·Risk까지 한 번에 스캔합니다." right={<Search className="mt-2 h-5 w-5 text-[#77818b]" />} />
      <div className="flex gap-2">
        <Pill active={sort === 'recent'} onClick={() => setSort('recent')}>최신순</Pill>
        <Pill active={sort === 'score'} onClick={() => setSort('score')}>Score순</Pill>
        <Pill active={sort === 'confidence'} onClick={() => setSort('confidence')}>Confidence순</Pill>
      </div>
      <div className="mt-5 space-y-3">
        {sorted.map((decision) => (
          <button type="button" key={`${decision.market}-${decision.timestamp}`} onClick={() => onSelect(decision)} className={cn('w-full rounded-[20px] border bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.035)]', selected?.market === decision.market ? 'border-[#cfd9de]' : 'border-[#edf0f2]')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[16px] font-semibold">{decision.market}</div>
                <div className="mt-1 text-[10px] text-[#939ba3]">{regimeKo(decision.regime)} · {timeAgo(decision.timestamp)}</div>
              </div>
              <StatusChip value={actionKo(decision.decision)} />
            </div>
            <div className="mt-3 line-clamp-2 text-[10px] leading-4 text-[#77818b]">{reasonKo(decision.primaryReason || decision.reasons?.[0])}</div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <ScoreBar label="Oracle Score" value={decision.oracleTradeScore} />
              <ScoreBar label="Confidence" value={decision.confidence} max={1} />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 border-t border-[#f0f2f4] pt-3 text-center">
              <div><div className="text-[8px] text-[#9aa2aa]">Evidence</div><div className="mt-1 text-[10px] font-semibold">{decision.evidenceActiveCount ?? 0} / {decision.evidenceContradictionCount ?? 0}</div></div>
              <div><div className="text-[8px] text-[#9aa2aa]">Council</div><div className="mt-1 truncate text-[10px] font-semibold">{actionKo(decision.council?.verdict ?? '—')}</div></div>
              <div><div className="text-[8px] text-[#9aa2aa]">Risk</div><div className="mt-1 truncate text-[10px] font-semibold">{decision.riskDisposition ?? '—'}</div></div>
              <div><div className="text-[8px] text-[#9aa2aa]">Route</div><div className="mt-1 truncate text-[10px] font-semibold">{decision.strategyDisposition ?? decision.router?.route ?? '—'}</div></div>
            </div>
            {decision.tradeMap && decision.tradeMap.status !== 'NO_TRADE' && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f7f8f9] px-3 py-2 text-[9px] text-[#6f7983]">
                <span>Entry {formatKrw(decision.tradeMap.entryPrice)}</span>
                <span>SL {formatKrw(decision.tradeMap.stopLossPrice)}</span>
                <span>TP2 {formatKrw(decision.tradeMap.takeProfit2Price)}</span>
              </div>
            )}
          </button>
        ))}
        {!sorted.length && <EmptyCard title="시장 판단 대기 중" body="Paper Engine의 decisionTape에 시장 판단이 기록되면 표시합니다." />}
      </div>
    </Screen>
  );
};

const StrategiesTab = ({ strategies, onSelect }: { strategies: StrategyCard[]; onSelect: (strategy: StrategyCard) => void }) => {
  const [sort, setSort] = useState<'score' | 'sharpe' | 'survival' | 'samples'>('score');
  const sorted = useMemo(() => [...strategies].sort((a, b) => {
    if (sort === 'sharpe') return (b.sharpe ?? -999) - (a.sharpe ?? -999);
    if (sort === 'survival') return (b.survival ?? -1) - (a.survival ?? -1);
    if (sort === 'samples') return b.samples - a.samples;
    return (b.score ?? -1) - (a.score ?? -1);
  }), [sort, strategies]);

  return (
    <Screen>
      <Header title="전략 경쟁" subtitle="후보 전략을 실제 검증 지표로 경쟁시킵니다. 공식 Grade Engine 전에는 임의 AAA 등급을 표시하지 않습니다." />
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Pill active={sort === 'score'} onClick={() => setSort('score')}>Score</Pill>
        <Pill active={sort === 'sharpe'} onClick={() => setSort('sharpe')}>Sharpe</Pill>
        <Pill active={sort === 'survival'} onClick={() => setSort('survival')}>MC 생존</Pill>
        <Pill active={sort === 'samples'} onClick={() => setSort('samples')}>표본수</Pill>
      </div>
      <div className="mt-4 space-y-3">
        {sorted.map((strategy, index) => (
          <button type="button" key={strategy.id} onClick={() => onSelect(strategy)} className="w-full rounded-[20px] border border-[#edf0f2] bg-white p-4 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1f4f6] text-[11px] font-semibold">{index + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{strategy.name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5"><Pill>{strategy.lifecycle}</Pill><Pill active={strategy.hardGatePassed}>{strategy.hardGatePassed ? 'Hard Gate 통과' : 'Hard Gate 미통과'}</Pill></div>
              </div>
              <ScoreGauge label="Score" value={strategy.score} compact />
            </div>
            <div className="mt-3 line-clamp-2 text-[10px] leading-4 text-[#89939d]">{strategy.thesis}</div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#f1f2f4] pt-3">
              <Metric label="Sharpe" value={scoreText(strategy.sharpe)} />
              <Metric label="MDD" value={pct(strategy.mdd)} />
              <Metric label="MC 생존" value={pct(strategy.survival)} />
              <Metric label="강건성" value={pct(strategy.robustness)} />
              <Metric label="승률" value={pct(strategy.winRate)} />
              <Metric label="표본" value={String(strategy.samples)} />
            </div>
          </button>
        ))}
        {!sorted.length && <EmptyCard title="전략 결과 없음" body="Strategy Factory 결과가 생성되면 전략 경쟁 현황을 표시합니다." />}
      </div>
    </Screen>
  );
};

const LogHubTab = ({ operations, events, onRoute, onEvent }: { operations: OperationsPayload | null; events: LedgerEvent[]; onRoute: (route: DetailRoute) => void; onEvent: (event: LedgerEvent) => void }) => {
  const recent = events.slice(0, 5);
  const tools = [
    { label: 'Evidence', body: 'NARS·외부 근거·신뢰도·영향', Icon: Database, route: 'evidence' as DetailRoute },
    { label: 'Council', body: '심사 축별 찬성·주의·반대', Icon: Network, route: 'council' as DetailRoute },
    { label: 'AI 리포트', body: '판단 경로와 이유를 종목별로 설명', Icon: Brain, route: 'analysis' as DetailRoute },
    { label: '거래 추적', body: 'Decision → Risk → Trade → Outcome', Icon: ShieldCheck, route: 'trade' as DetailRoute },
  ];

  return (
    <Screen>
      <Header title="로그 · 감독" subtitle="기능 메뉴를 늘리는 대신 Canonical Log를 중심으로 Evidence·Council·거래를 추적합니다." />
      <button type="button" onClick={() => onRoute('log')} className="w-full rounded-[22px] bg-[#121820] p-5 text-left text-white">
        <div className="flex items-center justify-between"><ScrollText className="h-5 w-5 text-white/75" /><ChevronRight className="h-4 w-4 text-white/45" /></div>
        <div className="mt-4 text-[20px] font-semibold">Canonical Log</div>
        <div className="mt-2 text-[11px] leading-5 text-white/65">{events.length}개 이벤트 · 검색·필터·정렬·상세 trace 제공</div>
        <div className="mt-4 text-[10px] text-white/45">Runtime {operations?.status ?? 'UNKNOWN'} · {operations?.mode ?? 'PAPER'}</div>
      </button>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {tools.map(({ label, body, Icon, route }) => (
          <button type="button" key={label} onClick={() => onRoute(route)} className="rounded-[18px] border border-[#edf0f2] bg-white p-4 text-left">
            <div className="flex items-center justify-between"><Icon className="h-[18px] w-[18px] text-[#48545f]" /><ChevronRight className="h-4 w-4 text-[#b4bac0]" /></div>
            <div className="mt-4 text-[12px] font-semibold">{label}</div>
            <div className="mt-1 text-[9px] leading-4 text-[#929aa2]">{body}</div>
          </button>
        ))}
      </div>

      <section className="mt-7">
        <SectionTitle title="최근 5개 이벤트" action="전체 로그" onAction={() => onRoute('log')} />
        <div className="space-y-3">
          {recent.map((event) => <EventCard key={event.id || event.eventKey} event={event} onClick={() => onEvent(event)} />)}
          {!recent.length && <EmptyCard title="로그 없음" body="canonical ledger에 이벤트가 쌓이면 이곳에서 최근 활동을 확인할 수 있습니다." />}
        </div>
      </section>
    </Screen>
  );
};

const BottomNavigation = ({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) => {
  const items: Array<{ id: Tab; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'home', label: '홈', Icon: Home },
    { id: 'market', label: '시장', Icon: Search },
    { id: 'strategies', label: '전략', Icon: ListTree },
    { id: 'portfolio', label: '포트폴리오', Icon: Briefcase },
    { id: 'more', label: '로그', Icon: ScrollText },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#eceff1] bg-white/95 pb-[max(env(safe-area-inset-bottom),7px)] pt-1 backdrop-blur-xl">
      <div className="grid grid-cols-5">
        {items.map(({ id, label, Icon }) => {
          const active = id === tab;
          return (
            <button type="button" key={id} onClick={() => onChange(id)} className="flex min-h-[58px] flex-col items-center justify-center gap-1">
              <Icon className={cn('h-[19px] w-[19px]', active ? 'text-[#171c21]' : 'text-[#a0a8af]')} />
              <span className={cn('text-[9px] font-medium', active ? 'text-[#171c21]' : 'text-[#a0a8af]')}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
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

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const visible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', load);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', load);
    };
  }, [load]);

  const decisions = useMemo(() => [...(operations?.decisionTape ?? [])].sort((a, b) => b.timestamp - a.timestamp), [operations?.decisionTape]);
  const events = useMemo(() => [...(eventsPayload?.events ?? [])].sort((a, b) => b.occurredAt - a.occurredAt), [eventsPayload?.events]);
  const strategies = useMemo(() => buildStrategies(factory, operations), [factory, operations]);
  const evidenceItems = useMemo(() => operations?.evidenceFlow ?? [], [operations?.evidenceFlow]);

  useEffect(() => {
    if (!decisions.length) {
      setSelectedDecision(null);
      return;
    }
    if (!selectedDecision || !decisions.some((item) => item.market === selectedDecision.market && item.timestamp === selectedDecision.timestamp)) setSelectedDecision(decisions[0]);
  }, [decisions, selectedDecision]);

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
    if (tab === 'home') return <HomeTab operations={operations} decisions={decisions} strategies={strategies} events={events} loading={loading} onRefresh={load} onRoute={openRoute} onTab={switchTab} onEvent={(event) => chooseEvent(event, null)} />;
    if (tab === 'market') return <MarketTab decisions={decisions} selected={selectedDecision} onSelect={(decision) => { setSelectedDecision(decision); openRoute('analysis'); }} />;
    if (tab === 'strategies') return <StrategiesTab strategies={strategies} onSelect={(strategy) => { setSelectedStrategy(strategy); openRoute('strategy'); }} />;
    if (tab === 'portfolio') return <PortfolioTabClarity operations={operations} decisions={decisions} onSelectPosition={(position) => { setSelectedPosition(position); openRoute('position'); }} />;
    return <LogHubTab operations={operations} events={events} onRoute={openRoute} onEvent={(event) => chooseEvent(event, null)} />;
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#f7f8f9] text-[#111418]" style={{ colorScheme: 'light' }}>
      <AnimatePresence mode="wait">
        <motion.div key={route ?? tab} initial={{ opacity: 0, x: route ? 10 : 0 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: route ? -8 : 0 }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }} className="absolute inset-0">
          {route ? detail() : tabView()}
        </motion.div>
      </AnimatePresence>
      {!route && <BottomNavigation tab={tab} onChange={switchTab} />}
    </div>
  );
};
