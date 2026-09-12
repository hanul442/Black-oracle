import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  ClosedTrade,
  CouncilMember,
  DecisionTapeItem,
  EventsPayload,
  FactoryPayload,
  FactoryTop,
  LedgerEvent,
  OperationsPayload,
  OperationalEvidence,
} from './v2/types';
import { actionKo, cn, dateTime, eventTypeKo, pct, reasonKo, roleKo, timeAgo } from './v2/types';
import { formatKrw } from './v2/financial';

const bg = '#07090b';
const panel = 'rounded-[20px] border border-white/[0.07] bg-[#0c0f12]';
const panelSoft = 'rounded-[16px] border border-white/[0.06] bg-white/[0.018]';
const green = '#2ce17d';
const red = '#ff6570';
const amber = '#e9aa4a';
const textMuted = 'text-[#7d8891]';

type Tab = 'overview' | 'strategies' | 'council' | 'portfolio';
type ReplayPayload = {
  success?: boolean;
  canonical?: boolean;
  requestedTraceId?: string;
  found?: boolean;
  timelineCount?: number;
  completeThrough?: string;
  runtimeId?: string;
  timeline?: LedgerEvent[];
  error?: string;
};
type ShadowCandidate = {
  strategyId: string;
  market: string;
  lifecycle: string;
  score: number;
  generation: number | null;
  indicators: string[];
  metrics: Record<string, unknown> | null;
  occurredAt: number;
  executionAuthority: false;
  promotionAuthority: false;
};
type ShadowPoolPayload = {
  success?: boolean;
  available?: boolean;
  researchOnly?: boolean;
  runtimeId?: string;
  market?: string;
  candidateCount?: number;
  candidates?: ShadowCandidate[];
  reason?: string;
  executionAuthority?: boolean;
  promotionAuthority?: boolean;
  error?: string;
};
type FactoryStatusPayload = FactoryPayload & {
  runs?: Array<NonNullable<FactoryPayload['latestRun']>>;
  governance?: {
    automaticChampionPromotion?: boolean;
    automaticLiveDeployment?: boolean;
    humanApprovalRequired?: boolean;
  };
};

type ReplayTarget = { traceId: string; market: string | null; title: string };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const numberText = (value: number | null | undefined, digits = 2) => finite(value) ? value.toFixed(digits) : '—';
const percentPoint = (value: number | null | undefined) => finite(value)
  ? `${Math.abs(value) <= 1 ? (value * 100).toFixed(1) : value.toFixed(1)}%`
  : '—';
const shortId = (value: string | null | undefined) => {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  return text.length > 30 ? `${text.slice(0, 18)}…${text.slice(-7)}` : text;
};
const tone = (value: string | null | undefined) => {
  const upper = String(value ?? '').toUpperCase();
  if (['ENTER', 'BUY', 'LONG', 'APPROVE', 'PASS', 'CHAMPION_CANDIDATE'].includes(upper)) return green;
  if (['EXIT', 'SELL', 'SHORT', 'REJECT', 'FAIL', 'LOSS'].includes(upper)) return red;
  return amber;
};
const traceIdOf = (event: LedgerEvent | null | undefined) => {
  const sources = [event?.trace, event?.links].filter(Boolean) as Array<Record<string, unknown>>;
  for (const source of sources) {
    for (const key of ['traceId', 'trace_id', 'decisionTraceId', 'decision_trace_id']) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
};
const entryTraceIdOf = (event: LedgerEvent | null | undefined) => {
  const links = event?.links as Record<string, unknown> | undefined;
  for (const key of ['entryTraceId', 'entry_trace_id']) {
    const value = links?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};
const replayPhase = (event: LedgerEvent) => {
  const type = String(event.eventType ?? '').toUpperCase();
  const name = String(event.eventName ?? '').toUpperCase();
  if (type === 'EVIDENCE') return 'Evidence';
  if (type === 'STRATEGY') return 'Strategy';
  if (type === 'COUNCIL') return 'Council';
  if (type === 'RISK') return 'Risk';
  if (type === 'ORDER') return 'Order';
  if (type === 'TRADE') return 'Trade';
  if (type === 'OUTCOME') return 'Outcome';
  if (name.includes('ARBITER')) return 'Arbiter';
  if (type === 'DECISION') return 'Decision';
  return null;
};

const Metric = ({ label, value, accent, note }: {
  label: string;
  value: React.ReactNode;
  accent?: string;
  note?: React.ReactNode;
}) => (
  <div className="min-w-0">
    <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#626d76]">{label}</div>
    <div className="mt-1 truncate text-[15px] font-semibold tracking-[-0.02em]" style={{ color: accent ?? '#e8ecef' }}>{value}</div>
    {note && <div className="mt-1 text-[9px] leading-4 text-[#59636b]">{note}</div>}
  </div>
);

const StatePill = ({ children, color = '#8b959d' }: { children: React.ReactNode; color?: string }) => (
  <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-[0.05em]" style={{ color, borderColor: `${color}35`, background: `${color}0d` }}>{children}</span>
);

const SectionHeader = ({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) => (
  <div className="mb-3 flex items-end justify-between gap-3">
    <div>
      <div className="text-[14px] font-semibold tracking-[-0.02em] text-[#e5e9eb]">{title}</div>
      {subtitle && <div className="mt-1 text-[10px] leading-4 text-[#68737b]">{subtitle}</div>}
    </div>
    {right}
  </div>
);

const TopShell = ({ tab, onTab, operations, loading, onRefresh }: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  operations: OperationsPayload | null;
  loading: boolean;
  onRefresh: () => void;
}) => {
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'strategies', label: 'Strategies' },
    { id: 'council', label: 'Council' },
    { id: 'portfolio', label: 'Portfolio' },
  ];
  const runtimeTone = operations?.status === 'OK' ? green : operations?.status === 'ERROR' ? red : amber;
  return <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07090b]/95 backdrop-blur-xl">
    <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-[max(env(safe-area-inset-top),16px)]">
      <div>
        <div className="text-[9px] font-semibold tracking-[0.25em] text-white/35">BLACK ORACLE</div>
        <div className="mt-1 flex items-center gap-2">
          <div className="text-[19px] font-semibold tracking-[-0.035em] text-white">Paper Operations</div>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: runtimeTone }} />
        </div>
        <div className="mt-1 text-[10px] text-[#606b73]">{operations?.status ?? 'Loading'} · {operations?.loop ? `${operations.loop.cycleCount} cycles` : 'runtime pending'}</div>
      </div>
      <button type="button" onClick={onRefresh} className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025]" aria-label="새로고침">
        <RefreshCw className={cn('h-4 w-4 text-white/50', loading && 'animate-spin')} />
      </button>
    </div>
    <div className="grid grid-cols-4 px-3 pb-2">
      {tabs.map((item) => <button key={item.id} type="button" onClick={() => onTab(item.id)} className={cn('relative px-1 py-2.5 text-[10px] font-semibold transition', tab === item.id ? 'text-white' : 'text-[#66717a]')}>
        {item.label}
        {tab === item.id && <span className="absolute bottom-0 left-1/4 right-1/4 h-[1px] bg-white" />}
      </button>)}
    </div>
  </div>;
};

const DecisionRow = ({ decision, onReplay }: { decision: DecisionTapeItem; onReplay: (decision: DecisionTapeItem) => void }) => (
  <button type="button" onClick={() => onReplay(decision)} className={cn(panelSoft, 'w-full px-4 py-3 text-left')}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#e0e5e8]">{decision.market}</span>
          <StatePill color={tone(decision.decision)}>{actionKo(decision.decision)}</StatePill>
        </div>
        <div className="mt-2 line-clamp-2 text-[10px] leading-4 text-[#7d8891]">{reasonKo(decision.primaryReason ?? decision.reasons?.[0])}</div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[#59636b]">
          <span>{dateTime(decision.timestamp)}</span>
          <span>Strategy {decision.router?.route ?? decision.strategyDisposition ?? '—'}</span>
          <span>Council {decision.council?.verdict ?? '—'}</span>
        </div>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/20" />
    </div>
  </button>
);

const EvidenceRow = ({ item }: { item: OperationalEvidence }) => (
  <div className={cn(panelSoft, 'px-4 py-3')}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#d7dde0]">{item.title || item.rationale || 'Untitled evidence'}</div>
        <div className="mt-1 text-[9px] text-[#68737b]">{item.source || item.source_type || 'source unavailable'} · {item.observed_at ? dateTime(item.observed_at) : 'time unavailable'}</div>
      </div>
      <StatePill color={item.direction === 'BULLISH' ? green : item.direction === 'BEARISH' ? red : '#8b959d'}>{item.evidence_grade || item.direction || 'INFO'}</StatePill>
    </div>
    {item.rationale && item.rationale !== item.title && <div className="mt-2 line-clamp-2 text-[10px] leading-4 text-[#707b83]">{item.rationale}</div>}
  </div>
);

const OverviewScreen = ({ operations, decisions, onReplay }: {
  operations: OperationsPayload | null;
  decisions: DecisionTapeItem[];
  onReplay: (decision: DecisionTapeItem) => void;
}) => {
  const portfolio = operations?.portfolio;
  const performance = operations?.performance;
  const latest = decisions[0] ?? null;
  const recentEvidence = (operations?.evidenceFlow ?? []).slice(0, 5);
  const latestRoute = latest?.router?.route ?? latest?.strategyDisposition ?? '—';
  const lossAlert = (performance?.losses ?? 0) > (performance?.wins ?? 0) || (performance?.maxDrawdownPct ?? 0) > 0.03;
  return <div className="px-5 pb-14 pt-4">
    {lossAlert && <div className="mb-3 flex items-start gap-3 rounded-[16px] border border-[#ff6570]/20 bg-[#ff6570]/[0.05] px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6570]" />
      <div><div className="text-[11px] font-semibold text-[#ff8a92]">Loss control requires attention</div><div className="mt-1 text-[10px] leading-4 text-[#9d7478]">최근 Paper 성과가 손실 우위입니다. Strategies에서 테스트 후보와 실제 Paper 채택 상태를 분리해 확인하세요.</div></div>
    </div>}

    <section className={cn(panel, 'p-5')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#657078]">Paper Equity</div>
          <div className="mt-2 text-[31px] font-semibold tracking-[-0.05em] text-white">{formatKrw(portfolio?.equity)}</div>
          <div className="mt-1 text-[12px] font-semibold" style={{ color: (performance?.totalReturnPct ?? 0) >= 0 ? green : red }}>{pct(performance?.totalReturnPct, true)}</div>
        </div>
        <StatePill color={operations?.status === 'OK' ? green : amber}>{operations?.status ?? 'WAITING'}</StatePill>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-4">
        <Metric label="Max DD" value={pct(performance?.maxDrawdownPct)} accent={(performance?.maxDrawdownPct ?? 0) > 0.03 ? red : undefined} />
        <Metric label="Win rate" value={pct(performance?.winRate)} />
        <Metric label="Profit factor" value={numberText(performance?.profitFactor)} />
      </div>
    </section>

    <section className={cn(panel, 'mt-3 p-4')}>
      <SectionHeader title="Current operating truth" subtitle="실제 Paper와 실험 계층을 섞지 않습니다." />
      <div className="grid grid-cols-2 gap-4">
        <Metric label="Paper runtime" value={shortId(operations?.strategyVersion)} note="runtime strategyVersion" />
        <Metric label="Latest routed" value={latestRoute} note={latest?.market ?? 'no recent decision'} />
        <Metric label="Open positions" value={portfolio?.openPositions?.length ?? 0} />
        <Metric label="Evidence active" value={operations?.ingestion?.evidenceActive ?? '—'} />
      </div>
    </section>

    <section className="mt-5">
      <SectionHeader title="Recent decisions" subtitle="누르면 판단 근거부터 Outcome까지 canonical trace를 엽니다." />
      <div className="space-y-2">{decisions.slice(0, 6).map((decision) => <DecisionRow key={`${decision.market}-${decision.timestamp}`} decision={decision} onReplay={onReplay} />)}{!decisions.length && <div className={cn(panelSoft, 'p-4 text-[10px] text-[#67727a]')}>최근 판단 기록이 없습니다.</div>}</div>
    </section>

    <section className="mt-5">
      <SectionHeader title="Incoming evidence" subtitle="NARS·외부 근거 중 현재 운영 payload에 들어온 정보" right={<span className="text-[9px] text-[#58626a]">{operations?.ingestion?.evidenceActive ?? 0} active</span>} />
      <div className="space-y-2">{recentEvidence.map((item) => <EvidenceRow key={item.id} item={item} />)}{!recentEvidence.length && <div className={cn(panelSoft, 'p-4 text-[10px] text-[#67727a]')}>표시 가능한 활성 Evidence가 없습니다.</div>}</div>
    </section>
  </div>;
};

const lifecycleColor = (lifecycle: string | null | undefined) => {
  const value = String(lifecycle ?? '').toUpperCase();
  if (value === 'CHAMPION_CANDIDATE') return green;
  if (value === 'CHALLENGER') return '#69a7ff';
  if (value === 'INCUBATOR') return amber;
  if (value === 'REJECT') return red;
  return '#8b959d';
};

const CandidateCard = ({ item, index }: { item: FactoryTop; index: number }) => {
  const evaluation = item.evaluation;
  const metrics = item.metrics;
  return <div className={cn(panelSoft, 'p-4')}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[9px] text-[#59636b]">#{index + 1} · {shortId(item.genome.id)}</div>
        <div className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-[#dce1e4]">{item.hypothesis?.thesis || item.genome.indicators.join(' · ') || 'Strategy candidate'}</div>
      </div>
      <StatePill color={lifecycleColor(evaluation.lifecycle)}>{evaluation.lifecycle ?? (evaluation.hardGatePassed ? 'PASS' : 'REJECT')}</StatePill>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.05] pt-3">
      <Metric label="Score" value={numberText(evaluation.score, 1)} />
      <Metric label="OOS exp." value={numberText(metrics.oosExpectancy, 3)} accent={metrics.oosExpectancy >= 0 ? green : red} />
      <Metric label="Max DD" value={percentPoint(metrics.maxDrawdownPct)} />
      <Metric label="Sharpe" value={numberText(metrics.sharpe)} />
      <Metric label="MC survive" value={percentPoint(metrics.monteCarloSurvivalRate)} />
      <Metric label="Robust" value={percentPoint(metrics.parameterRobustness)} />
    </div>
    {!evaluation.hardGatePassed && evaluation.hardGateReasons?.length > 0 && <div className="mt-3 rounded-[12px] bg-[#ff6570]/[0.04] px-3 py-2 text-[9px] leading-4 text-[#9b7075]">Gate: {evaluation.hardGateReasons.slice(0, 2).join(' · ')}</div>}
  </div>;
};

const StrategiesScreen = ({ operations, factory, shadow }: {
  operations: OperationsPayload | null;
  factory: FactoryStatusPayload | null;
  shadow: ShadowPoolPayload | null;
}) => {
  const latest = factory?.latestRun ?? null;
  const counts = latest?.lifecycle_counts ?? {};
  const top = latest?.top_results ?? [];
  const performance = operations?.performance;
  const losses = (operations?.recentTrades ?? []).filter((trade) => trade.netPnl < 0);
  const totalLoss = losses.reduce((sum, trade) => sum + trade.netPnl, 0);
  const avgLoss = losses.length ? totalLoss / losses.length : 0;
  const worstLoss = losses.length ? Math.min(...losses.map((trade) => trade.netPnl)) : 0;
  const stopLosses = losses.filter((trade) => /stop/i.test(trade.exitReason ?? '')).length;
  const latestDecision = operations?.decisionTape?.[0] ?? null;
  const routed = latestDecision?.router?.route ?? latestDecision?.strategyDisposition ?? '—';
  const automaticPromotion = factory?.governance?.automaticChampionPromotion === true;
  const automaticDeploy = factory?.governance?.automaticLiveDeployment === true;

  const pipeline = [
    ['Tested', latest?.candidate_count ?? 0],
    ['Incubator', Number((counts as Record<string, number>).INCUBATOR ?? 0)],
    ['Challenger', Number((counts as Record<string, number>).CHALLENGER ?? 0)],
    ['Champion cand.', Number((counts as Record<string, number>).CHAMPION_CANDIDATE ?? 0)],
    ['Shadow eligible', shadow?.candidateCount ?? 0],
  ] as const;

  return <div className="px-5 pb-14 pt-4">
    <section className={cn(panel, 'p-4')}>
      <SectionHeader title="Strategy → Paper pipeline" subtitle="테스트됐다는 사실과 실제 Paper에서 쓰인다는 사실은 다릅니다." right={<StatePill color={automaticDeploy ? green : amber}>{automaticDeploy ? 'AUTO DEPLOY' : 'MANUAL GATE'}</StatePill>} />
      <div className="grid grid-cols-5 gap-1.5">{pipeline.map(([label, value], index) => <div key={label} className="min-w-0 text-center"><div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-1 py-3"><div className="text-[17px] font-semibold text-white">{value}</div><div className="mt-1 text-[8px] leading-3 text-[#606a72]">{label}</div></div>{index < pipeline.length - 1 && <div className="mx-auto mt-1 h-1 w-[1px] bg-white/10" />}</div>)}</div>
      <div className="mt-3 rounded-[14px] border border-[#e9aa4a]/15 bg-[#e9aa4a]/[0.035] px-3 py-3 text-[10px] leading-5 text-[#9a8059]">
        자동 Champion 승격: <b>{automaticPromotion ? 'ON' : 'OFF'}</b> · 자동 Paper/Live 배포: <b>{automaticDeploy ? 'ON' : 'OFF'}</b>. 현재 후보는 연구·Shadow 계층이며 승인 없이 S1R2에 자동 투입되지 않습니다.
      </div>
    </section>

    <section className={cn(panel, 'mt-3 p-4')}>
      <SectionHeader title="What is actually trading?" subtitle="현재 Paper와 실험 전략을 분리 표시" />
      <div className="grid grid-cols-2 gap-4">
        <Metric label="Paper version" value={shortId(operations?.strategyVersion)} note="S1R2 runtime" />
        <Metric label="Latest route" value={routed} note={latestDecision?.market ?? '—'} />
        <Metric label="Factory market" value={latest?.market ?? '—'} note={latest?.finished_at ? dateTime(latest.finished_at) : 'no recent run'} />
        <Metric label="Shadow market" value={shadow?.market ?? '—'} note={`${shadow?.candidateCount ?? 0} eligible`} />
      </div>
    </section>

    <section className={cn(panel, 'mt-3 p-4')}>
      <SectionHeader title="Loss reduction check" subtitle="최근 Paper 실제 손실을 기준으로 봅니다." right={<StatePill color={losses.length ? red : green}>{losses.length} losses</StatePill>} />
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Avg loss" value={formatKrw(avgLoss)} accent={losses.length ? red : undefined} />
        <Metric label="Worst loss" value={formatKrw(worstLoss)} accent={losses.length ? red : undefined} />
        <Metric label="Stop exits" value={`${stopLosses}/${losses.length}`} />
        <Metric label="Expectancy" value={formatKrw(performance?.expectancy)} accent={(performance?.expectancy ?? 0) >= 0 ? green : red} />
        <Metric label="Payoff" value={numberText(performance?.payoffRatio)} />
        <Metric label="Profit factor" value={numberText(performance?.profitFactor)} />
      </div>
      <div className="mt-3 text-[9px] leading-4 text-[#626d75]">Factory 후보의 백테스트 성과와 현재 Paper 손실은 동일 표본이 아니므로, 여기서는 개선 효과를 임의로 주장하지 않습니다. 다음 승격 기준은 OOS·MDD·비용 스트레스·Monte Carlo·Shadow outcome을 동시에 비교해야 합니다.</div>
    </section>

    <section className="mt-5">
      <SectionHeader title="Latest Strategy Factory run" subtitle={latest ? `${latest.market} · ${latest.timeframe_minutes}m · ${latest.candidate_count} candidates` : 'Factory run unavailable'} />
      <div className="space-y-2">{top.slice(0, 6).map((item, index) => <CandidateCard key={item.genome.id} item={item} index={index} />)}{!top.length && <div className={cn(panelSoft, 'p-4 text-[10px] text-[#67727a]')}>표시 가능한 Strategy Factory 결과가 없습니다.</div>}</div>
    </section>

    <section className="mt-5">
      <SectionHeader title="Shadow-eligible candidates" subtitle="Hard Gate 통과 후 S2 shadow에서 관찰 중인 후보만 표시" />
      <div className="space-y-2">{(shadow?.candidates ?? []).slice(0, 6).map((candidate) => <div key={candidate.strategyId} className={cn(panelSoft, 'p-4')}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[11px] font-semibold text-[#d8dde0]">{shortId(candidate.strategyId)}</div><div className="mt-1 line-clamp-2 text-[9px] leading-4 text-[#68737b]">{candidate.indicators.join(' · ') || 'indicator set unavailable'}</div></div><StatePill color={lifecycleColor(candidate.lifecycle)}>{candidate.lifecycle}</StatePill></div><div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/[0.05] pt-3"><Metric label="Score" value={numberText(candidate.score, 1)} /><Metric label="Generation" value={candidate.generation ?? '—'} /><Metric label="Authority" value="SHADOW" /></div></div>)}{shadow?.available === false && <div className={cn(panelSoft, 'p-4 text-[10px] leading-5 text-[#8d7475]')}>{shadow.reason || shadow.error || 'Shadow pool unavailable'}</div>}{shadow?.available !== false && !(shadow?.candidates?.length) && <div className={cn(panelSoft, 'p-4 text-[10px] text-[#67727a]')}>현재 market에서 Shadow 승격 조건을 통과한 후보가 없습니다.</div>}</div>
    </section>
  </div>;
};

const VoteRow = ({ member }: { member: CouncilMember }) => (
  <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] py-3 last:border-b-0">
    <div className="min-w-0"><div className="text-[11px] font-semibold text-[#d5dbde]">{roleKo(member.role)}</div><div className="mt-1 line-clamp-2 text-[9px] leading-4 text-[#68737b]">{member.reasons?.[0] || '별도 근거 없음'}</div></div>
    <div className="shrink-0 text-right"><StatePill color={tone(member.vote)}>{actionKo(member.vote)}</StatePill><div className="mt-1 text-[8px] text-[#59636b]">{percentPoint(member.confidence)}</div></div>
  </div>
);

const readNestedString = (value: unknown, paths: string[][]) => {
  for (const path of paths) {
    let cursor: unknown = value;
    for (const key of path) cursor = cursor && typeof cursor === 'object' ? (cursor as Record<string, unknown>)[key] : undefined;
    if (typeof cursor === 'string' && cursor.trim()) return cursor.trim();
  }
  return null;
};

const CouncilScreen = ({ operations, events }: { operations: OperationsPayload | null; events: LedgerEvent[] }) => {
  const latestDecision = operations?.decisionTape?.[0] ?? null;
  const deterministic = latestDecision?.council ?? operations?.council?.deterministicLatest ?? operations?.council?.latest ?? null;
  const ai = latestDecision?.aiCouncilReview ?? deterministic?.aiReview ?? operations?.council?.ai?.current ?? operations?.council?.ai?.historicalLatest ?? null;
  const latestCouncilEvent = events.find((event) => event.eventType === 'COUNCIL') ?? null;
  const redTeam = readNestedString(latestCouncilEvent?.trace, [
    ['redTeamResult'],
    ['red_team_result'],
    ['audit', 'redTeamResult'],
    ['council', 'redTeamResult'],
  ]);
  const members = deterministic?.members ?? [];
  return <div className="px-5 pb-14 pt-4">
    <section className={cn(panel, 'p-5')}>
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#657078]">Latest Council verdict</div><div className="mt-2 text-[27px] font-semibold tracking-[-0.04em]" style={{ color: tone(deterministic?.verdict) }}>{deterministic?.verdict ?? 'UNAVAILABLE'}</div><div className="mt-2 text-[11px] text-[#7a858d]">{latestDecision?.market ?? latestCouncilEvent?.market ?? 'market unavailable'} · {latestDecision ? actionKo(latestDecision.decision) : 'decision unavailable'}</div></div>
        <StatePill color={operations?.council?.executionAuthority ? red : green}>{operations?.council?.executionAuthority ? 'EXECUTION AUTH' : 'SHADOW ONLY'}</StatePill>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
        <Metric label="Approve" value={deterministic?.approveCount ?? 0} />
        <Metric label="Caution" value={deterministic?.cautionCount ?? 0} />
        <Metric label="Reject" value={deterministic?.rejectCount ?? 0} />
      </div>
    </section>

    <section className={cn(panel, 'mt-3 p-4')}>
      <SectionHeader title="What Council changed" subtitle="결정 권한과 의견을 분리해서 표시합니다." />
      <div className="grid grid-cols-2 gap-4"><Metric label="Reviewed action" value={deterministic?.reviewedAction ? actionKo(deterministic.reviewedAction) : '—'} /><Metric label="Red Team" value={redTeam ?? 'not recorded'} accent={redTeam === 'INVALIDATED' ? red : undefined} /></div>
      <div className="mt-3 rounded-[14px] border border-white/[0.05] bg-white/[0.015] px-3 py-3 text-[10px] leading-5 text-[#737e86]">{deterministic?.summary || latestCouncilEvent?.summary || 'Council summary가 아직 기록되지 않았습니다.'}</div>
    </section>

    <section className="mt-5"><SectionHeader title="Member votes" subtitle="의견 차이가 어디서 생겼는지 확인" /><div className={cn(panel, 'px-4')}>{members.length ? members.map((member, index) => <VoteRow key={`${member.role}-${index}`} member={member} />) : <div className="py-4 text-[10px] text-[#67727a]">멤버별 표결 데이터가 없습니다.</div>}</div></section>

    <section className={cn(panel, 'mt-5 p-4')}>
      <SectionHeader title="AI advisory" subtitle="AI는 현재 거래 실행 권한이 없습니다." right={<StatePill color={ai?.executionAuthority ? red : '#84909a'}>{ai?.executionAuthority ? 'AUTHORITY' : 'ADVISORY'}</StatePill>} />
      {ai ? <><div className="flex items-center gap-2"><StatePill color={tone(ai.stance)}>{ai.stance ?? 'NO STANCE'}</StatePill><span className="text-[9px] text-[#646f77]">confidence {percentPoint(ai.confidence)}</span></div><div className="mt-3 text-[10px] leading-5 text-[#7d8890]">{ai.rationale || 'rationale unavailable'}</div>{ai.concerns?.length ? <div className="mt-3 rounded-[12px] bg-white/[0.02] px-3 py-2 text-[9px] leading-4 text-[#6b767e]">Concern: {ai.concerns.slice(0, 2).join(' · ')}</div> : null}</> : <div className="text-[10px] text-[#67727a]">최근 AI Council advisory가 없습니다.</div>}
    </section>
  </div>;
};

const TradeRow = ({ trade, onReplay }: { trade: ClosedTrade; onReplay: (trade: ClosedTrade) => void }) => (
  <button type="button" onClick={() => onReplay(trade)} className={cn(panelSoft, 'w-full p-4 text-left')}>
    <div className="flex items-start justify-between gap-3"><div><div className="text-[12px] font-semibold text-[#dce1e4]">{trade.market}</div><div className="mt-1 text-[9px] text-[#657078]">{dateTime(trade.closedAt)} · {shortId(trade.strategyVersion)}</div></div><div className="text-right"><div className="text-[13px] font-semibold" style={{ color: trade.netPnl >= 0 ? green : red }}>{formatKrw(trade.netPnl)}</div><div className="mt-1 text-[9px]" style={{ color: trade.netPnl >= 0 ? green : red }}>{percentPoint(trade.returnPct)}</div></div></div>
    <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3"><span className="line-clamp-1 text-[9px] text-[#68737b]">{reasonKo(trade.exitReason)}</span><ChevronRight className="h-4 w-4 shrink-0 text-white/20" /></div>
  </button>
);

const PortfolioScreen = ({ operations, onReplay }: { operations: OperationsPayload | null; onReplay: (trade: ClosedTrade) => void }) => {
  const portfolio = operations?.portfolio;
  const performance = operations?.performance;
  const recentTrades = operations?.recentTrades ?? [];
  const lossesByStrategy = useMemo(() => {
    const map = new Map<string, { count: number; pnl: number }>();
    for (const trade of recentTrades.filter((trade) => trade.netPnl < 0)) {
      const key = trade.strategyVersion || 'unknown';
      const current = map.get(key) ?? { count: 0, pnl: 0 };
      current.count += 1;
      current.pnl += trade.netPnl;
      map.set(key, current);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].pnl - b[1].pnl);
  }, [recentTrades]);
  return <div className="px-5 pb-14 pt-4">
    <section className={cn(panel, 'p-5')}><div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#657078]">Total Equity</div><div className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-white">{formatKrw(portfolio?.equity)}</div><div className="mt-1 text-[12px] font-semibold" style={{ color: (performance?.totalReturnPct ?? 0) >= 0 ? green : red }}>{pct(performance?.totalReturnPct, true)}</div><div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4"><Metric label="Cash" value={formatKrw(portfolio?.cash)} /><Metric label="Realized" value={formatKrw(portfolio?.realizedPnl)} accent={(portfolio?.realizedPnl ?? 0) >= 0 ? green : red} /><Metric label="Drawdown" value={pct(portfolio?.currentDrawdownPct)} accent={(portfolio?.currentDrawdownPct ?? 0) > 0.03 ? red : undefined} /></div></section>

    <section className="mt-5"><SectionHeader title="Open positions" subtitle="포지션마다 전략·보호 가격이 보여야 합니다." /><div className="space-y-2">{portfolio?.openPositions?.map((position) => <div key={position.market} className={cn(panelSoft, 'p-4')}><div className="flex items-start justify-between"><div><div className="text-[13px] font-semibold text-[#dce1e4]">{position.market}</div><div className="mt-1 text-[9px] text-[#657078]">opened {timeAgo(position.openedAt)}</div></div><div className="text-right"><div className="text-[9px] text-[#657078]">Average</div><div className="mt-1 text-[12px] font-semibold">{formatKrw(position.averageCost)}</div></div></div><div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/[0.05] pt-3"><Metric label="Qty" value={numberText(position.quantity, 5)} /><Metric label="Stop" value={formatKrw(position.stopLossPrice)} accent={red} /><Metric label="Take profit" value={formatKrw(position.takeProfitPrice)} accent={green} /></div></div>)}{!portfolio?.openPositions?.length && <div className={cn(panelSoft, 'p-4 text-[10px] text-[#67727a]')}>현재 열린 포지션이 없습니다.</div>}</div></section>

    <section className="mt-5"><SectionHeader title="Recent closed trades" subtitle="거래 → 전략 → Decision Replay로 추적" /><div className="space-y-2">{recentTrades.slice(0, 10).map((trade) => <TradeRow key={trade.id} trade={trade} onReplay={onReplay} />)}{!recentTrades.length && <div className={cn(panelSoft, 'p-4 text-[10px] text-[#67727a]')}>완료된 거래가 없습니다.</div>}</div></section>

    {lossesByStrategy.length > 0 && <section className={cn(panel, 'mt-5 p-4')}><SectionHeader title="Loss concentration" subtitle="어떤 strategyVersion에서 손실이 쌓였는지" />{lossesByStrategy.map(([strategy, data]) => <div key={strategy} className="flex items-center justify-between border-b border-white/[0.05] py-2.5 last:border-b-0"><div className="min-w-0"><div className="truncate text-[10px] font-semibold text-[#cbd2d6]">{shortId(strategy)}</div><div className="mt-1 text-[8px] text-[#5f6971]">{data.count} losing trades</div></div><div className="text-[11px] font-semibold text-[#ff727b]">{formatKrw(data.pnl)}</div></div>)}</section>}
  </div>;
};

const phaseOrder = ['Evidence', 'Strategy', 'Council', 'Arbiter', 'Decision', 'Risk', 'Order', 'Trade', 'Outcome'];

const ReplayScreen = ({ target, replay, loading, onBack }: {
  target: ReplayTarget;
  replay: ReplayPayload | null;
  loading: boolean;
  onBack: () => void;
}) => {
  const timeline = replay?.timeline ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, LedgerEvent[]>();
    for (const event of timeline) {
      const phase = replayPhase(event);
      if (!phase) continue;
      map.set(phase, [...(map.get(phase) ?? []), event]);
    }
    return map;
  }, [timeline]);
  const decision = timeline.find((event) => event.eventType === 'DECISION') ?? null;
  const strategy = timeline.find((event) => event.eventType === 'STRATEGY') ?? null;
  const council = timeline.find((event) => event.eventType === 'COUNCIL') ?? null;
  const outcome = [...timeline].reverse().find((event) => event.eventType === 'OUTCOME') ?? null;
  const complete = replay?.found && timeline.length > 0;
  return <div className="min-h-[100dvh]" style={{ background: bg }}>
    <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07090b]/95 px-5 pb-3 pt-[max(env(safe-area-inset-top),16px)] backdrop-blur-xl"><div className="flex items-start gap-3"><button type="button" onClick={onBack} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08]" aria-label="뒤로"><ArrowLeft className="h-4 w-4 text-white/60" /></button><div className="min-w-0"><div className="text-[9px] font-semibold tracking-[0.18em] text-white/30">DECISION REPLAY</div><div className="mt-1 truncate text-[18px] font-semibold text-white">{target.title}</div><div className="mt-1 text-[9px] text-[#626d75]">{target.market ?? 'market unavailable'} · canonical trace {shortId(target.traceId)}</div></div></div></div>
    <div className="px-5 pb-16 pt-4">
      {loading && <div className={cn(panel, 'p-5 text-[10px] text-[#68737b]')}>Canonical trace를 불러오는 중입니다.</div>}
      {!loading && !complete && <div className="rounded-[18px] border border-[#e9aa4a]/20 bg-[#e9aa4a]/[0.04] p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#e9aa4a]" /><div><div className="text-[11px] font-semibold text-[#d9ad69]">Canonical replay unavailable</div><div className="mt-1 text-[10px] leading-5 text-[#8e7858]">trace_id로 연결된 판단 이력이 없습니다. 이전 UI처럼 ±12시간 market events를 같은 Decision Replay로 위장하지 않습니다.</div></div></div></div>}
      {!loading && complete && <>
        <section className={cn(panel, 'p-4')}>
          <SectionHeader title="What happened" subtitle="결론부터 읽고 아래에서 각 단계의 근거를 확인합니다." right={<StatePill color={outcome ? green : amber}>{replay?.completeThrough ?? 'CURRENT'}</StatePill>} />
          <div className="space-y-2 text-[10px] leading-5 text-[#7d8890]">
            <div><span className="text-[#a7b0b6]">Strategy</span> · {strategy?.strategyId ?? strategy?.summary ?? 'not recorded'}</div>
            <div><span className="text-[#a7b0b6]">Decision</span> · {decision?.action ? actionKo(decision.action) : decision?.eventName ?? 'not recorded'}{decision?.reason ? ` — ${reasonKo(decision.reason)}` : ''}</div>
            <div><span className="text-[#a7b0b6]">Council</span> · {council?.summary || council?.reason || 'not recorded'}</div>
            <div><span className="text-[#a7b0b6]">Outcome</span> · {outcome?.summary || outcome?.reason || '아직 Outcome 없음'}</div>
          </div>
        </section>

        <section className="mt-5"><SectionHeader title="Decision path" subtitle="Evidence → Strategy → Council → Risk → Execution → Outcome" /><div className="relative pl-6 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-[1px] before:bg-white/[0.08]">{phaseOrder.map((phase) => { const items = grouped.get(phase) ?? []; const present = items.length > 0; const primary = items[0]; return <div key={phase} className="relative mb-3"><span className={cn('absolute -left-6 top-4 z-10 h-3.5 w-3.5 rounded-full border-2 bg-[#07090b]', present ? 'border-[#9aa4ab]' : 'border-white/15')} />
          <div className={cn(panelSoft, 'p-4', !present && 'opacity-55')}><div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-semibold text-[#d7dde0]">{phase}</div>{present && <div className="mt-1 text-[8px] text-[#5e6870]">{dateTime(primary.occurredAt)} · {items.length} event{items.length === 1 ? '' : 's'}</div>}</div>{present ? <StatePill color={primary.executionAuthority ? red : '#84909a'}>{primary.executionAuthority ? 'EXECUTION' : 'OBSERVED'}</StatePill> : <StatePill>NOT RECORDED</StatePill>}</div>{present && <><div className="mt-3 text-[10px] leading-5 text-[#77828a]">{primary.summary || reasonKo(primary.reason) || primary.eventName}</div>{primary.strategyId && <div className="mt-2 text-[9px] text-[#59636b]">Strategy · {primary.strategyId}</div>}</>}</div>
        </div>; })}</div></section>

        <details className={cn(panel, 'mt-5 overflow-hidden')}><summary className="cursor-pointer px-4 py-4 text-[11px] font-semibold text-[#a4adb3]">Raw canonical trace · {timeline.length} events</summary><div className="border-t border-white/[0.06] px-4 py-2">{timeline.map((event) => <div key={event.id || event.eventKey} className="border-b border-white/[0.05] py-3 last:border-b-0"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-semibold text-[#bdc5ca]">{event.eventName}</div><div className="mt-1 text-[8px] text-[#59636b]">{eventTypeKo(event.eventType)} · {dateTime(event.occurredAt)}</div></div><span className="text-[8px] text-[#59636b]">{event.authority}</span></div></div>)}</div></details>
      </>}
    </div>
  </div>;
};

export const BlackOracleMobileApp = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [operations, setOperations] = useState<OperationsPayload | null>(null);
  const [factory, setFactory] = useState<FactoryStatusPayload | null>(null);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [shadow, setShadow] = useState<ShadowPoolPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [replayTarget, setReplayTarget] = useState<ReplayTarget | null>(null);
  const [replay, setReplay] = useState<ReplayPayload | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [operationsResult, factoryResult, eventsResult] = await Promise.allSettled([
        fetch('/api/trading-status', { cache: 'no-store' }).then((response) => response.json() as Promise<OperationsPayload>),
        fetch('/api/strategy-factory-status', { cache: 'no-store' }).then((response) => response.json() as Promise<FactoryStatusPayload>),
        fetch('/api/events?limit=500', { cache: 'no-store' }).then((response) => response.json() as Promise<EventsPayload>),
      ]);
      if (operationsResult.status === 'fulfilled') setOperations(operationsResult.value);
      if (factoryResult.status === 'fulfilled') setFactory(factoryResult.value);
      if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value.events ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const shadowMarket = factory?.latestRun?.market ?? operations?.decisionTape?.[0]?.market ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!shadowMarket) { setShadow(null); return; }
    fetch(`/api/strategy-shadow-pool?market=${encodeURIComponent(shadowMarket)}&limit=8`, { cache: 'no-store' })
      .then((response) => response.json() as Promise<ShadowPoolPayload>)
      .then((payload) => { if (!cancelled) setShadow(payload); })
      .catch((error) => { if (!cancelled) setShadow({ available: false, market: shadowMarket, candidateCount: 0, candidates: [], error: error instanceof Error ? error.message : 'Shadow pool read failed.' }); });
    return () => { cancelled = true; };
  }, [shadowMarket]);

  const sortedEvents = useMemo(() => [...events].sort((a, b) => b.occurredAt - a.occurredAt), [events]);
  const decisions = useMemo(() => [...(operations?.decisionTape ?? [])].sort((a, b) => b.timestamp - a.timestamp), [operations?.decisionTape]);

  const openReplayTrace = useCallback(async (target: ReplayTarget) => {
    setReplayTarget(target);
    setReplay(null);
    setReplayLoading(true);
    try {
      const runtimeId = operations?.decisionTape?.length
        ? sortedEvents.find((event) => traceIdOf(event) === target.traceId)?.runtimeId
        : null;
      const query = new URLSearchParams({ traceId: target.traceId });
      if (runtimeId) query.set('runtimeId', runtimeId);
      const response = await fetch(`/api/decision-replay?${query.toString()}`, { cache: 'no-store' });
      const payload = await response.json() as ReplayPayload;
      setReplay(payload);
    } catch (error) {
      setReplay({ success: false, found: false, error: error instanceof Error ? error.message : 'Decision Replay read failed.', timeline: [] });
    } finally {
      setReplayLoading(false);
    }
  }, [operations?.decisionTape?.length, sortedEvents]);

  const openDecisionReplay = useCallback((decision: DecisionTapeItem) => {
    const candidate = sortedEvents
      .filter((event) => event.market === decision.market && traceIdOf(event))
      .map((event) => ({ event, distance: Math.abs(event.occurredAt - decision.timestamp) }))
      .filter((item) => item.distance <= 10 * 60_000)
      .sort((a, b) => a.distance - b.distance)[0]?.event;
    const traceId = traceIdOf(candidate);
    if (!traceId) {
      setReplayTarget({ traceId: 'unavailable', market: decision.market, title: `${decision.market} · ${actionKo(decision.decision)}` });
      setReplay({ success: false, found: false, timeline: [], error: 'Canonical trace_id unavailable.' });
      return;
    }
    void openReplayTrace({ traceId, market: decision.market, title: `${decision.market} · ${actionKo(decision.decision)}` });
  }, [openReplayTrace, sortedEvents]);

  const openTradeReplay = useCallback((trade: ClosedTrade) => {
    const outcome = sortedEvents
      .filter((event) => event.market === trade.market && event.eventType === 'OUTCOME')
      .map((event) => ({ event, distance: Math.abs(event.occurredAt - trade.closedAt) }))
      .sort((a, b) => a.distance - b.distance)[0]?.event;
    const traceId = entryTraceIdOf(outcome) ?? traceIdOf(outcome);
    if (!traceId) {
      setReplayTarget({ traceId: 'unavailable', market: trade.market, title: `${trade.market} · ${formatKrw(trade.netPnl)}` });
      setReplay({ success: false, found: false, timeline: [], error: 'Outcome에 연결된 entry trace가 없습니다.' });
      return;
    }
    void openReplayTrace({ traceId, market: trade.market, title: `${trade.market} · ${formatKrw(trade.netPnl)}` });
  }, [openReplayTrace, sortedEvents]);

  if (replayTarget) return <ReplayScreen target={replayTarget} replay={replay} loading={replayLoading} onBack={() => { setReplayTarget(null); setReplay(null); }} />;

  return <div className="min-h-[100dvh] text-[#e8ecef]" style={{ background: bg }}>
    <TopShell tab={tab} onTab={setTab} operations={operations} loading={loading} onRefresh={() => void load()} />
    {tab === 'overview' && <OverviewScreen operations={operations} decisions={decisions} onReplay={openDecisionReplay} />}
    {tab === 'strategies' && <StrategiesScreen operations={operations} factory={factory} shadow={shadow} />}
    {tab === 'council' && <CouncilScreen operations={operations} events={sortedEvents} />}
    {tab === 'portfolio' && <PortfolioScreen operations={operations} onReplay={openTradeReplay} />}
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#07090b] to-transparent" />
  </div>;
};
