import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronRight, RefreshCw } from 'lucide-react';
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
const soft = 'rounded-[16px] border border-white/[0.06] bg-white/[0.018]';
const green = '#2ce17d';
const red = '#ff6570';
const amber = '#e9aa4a';

type Tab = 'overview' | 'strategies' | 'council' | 'portfolio';
type FactoryRun = NonNullable<FactoryPayload['latestRun']> & { finished_at?: string };
type FactoryStatusPayload = Omit<FactoryPayload, 'latestRun'> & {
  latestRun?: FactoryRun | null;
  governance?: {
    automaticChampionPromotion?: boolean;
    automaticLiveDeployment?: boolean;
    humanApprovalRequired?: boolean;
  };
};
type ShadowCandidate = {
  strategyId: string;
  market: string;
  lifecycle: string;
  score: number;
  generation: number | null;
  indicators: string[];
  occurredAt: number;
};
type ShadowPayload = {
  available?: boolean;
  market?: string;
  candidateCount?: number;
  candidates?: ShadowCandidate[];
  reason?: string;
  error?: string;
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
  return !text ? '—' : text.length > 30 ? `${text.slice(0, 18)}…${text.slice(-7)}` : text;
};
const tone = (value: string | null | undefined) => {
  const text = String(value ?? '').toUpperCase();
  if (['ENTER', 'BUY', 'APPROVE', 'PASS', 'CHAMPION_CANDIDATE'].includes(text)) return green;
  if (['EXIT', 'SELL', 'REJECT', 'FAIL', 'LOSS'].includes(text)) return red;
  return amber;
};
const lifecycleTone = (value: string | null | undefined) => ({
  CHAMPION_CANDIDATE: green,
  CHALLENGER: '#69a7ff',
  INCUBATOR: amber,
  REJECT: red,
}[String(value ?? '').toUpperCase()] ?? '#8b959d');
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

const Pill = ({ children, color = '#8b959d' }: { children: React.ReactNode; color?: string }) => (
  <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-[0.04em]" style={{ color, borderColor: `${color}35`, background: `${color}0d` }}>{children}</span>
);
const Metric = ({ label, value, accent, note }: { label: string; value: React.ReactNode; accent?: string; note?: React.ReactNode }) => (
  <div className="min-w-0"><div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#626d76]">{label}</div><div className="mt-1 truncate text-[14px] font-semibold" style={{ color: accent ?? '#e8ecef' }}>{value}</div>{note && <div className="mt-1 text-[9px] leading-4 text-[#59636b]">{note}</div>}</div>
);
const Section = ({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) => (
  <div className="mb-3 flex items-end justify-between gap-3"><div><div className="text-[14px] font-semibold text-[#e5e9eb]">{title}</div>{subtitle && <div className="mt-1 text-[10px] leading-4 text-[#68737b]">{subtitle}</div>}</div>{right}</div>
);

const Top = ({ tab, setTab, operations, loading, refresh }: { tab: Tab; setTab: (tab: Tab) => void; operations: OperationsPayload | null; loading: boolean; refresh: () => void }) => {
  const tabs: Array<[Tab, string]> = [['overview', 'Overview'], ['strategies', 'Strategies'], ['council', 'Council'], ['portfolio', 'Portfolio']];
  const stateTone = operations?.status === 'OK' ? green : operations?.status === 'ERROR' ? red : amber;
  return <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07090b]/95 backdrop-blur-xl">
    <div className="flex items-start justify-between px-5 pb-3 pt-[max(env(safe-area-inset-top),16px)]"><div><div className="text-[9px] font-semibold tracking-[0.25em] text-white/35">BLACK ORACLE</div><div className="mt-1 flex items-center gap-2"><span className="text-[19px] font-semibold tracking-[-0.035em] text-white">Paper Operations</span><span className="h-1.5 w-1.5 rounded-full" style={{ background: stateTone }} /></div><div className="mt-1 text-[10px] text-[#606b73]">{operations?.status ?? 'Loading'} · {operations?.loop ? `${operations.loop.cycleCount} cycles` : 'runtime pending'}</div></div><button type="button" onClick={refresh} className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08]" aria-label="새로고침"><RefreshCw className={cn('h-4 w-4 text-white/50', loading && 'animate-spin')} /></button></div>
    <div className="grid grid-cols-4 px-3 pb-2">{tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={cn('relative py-2.5 text-[10px] font-semibold', tab === id ? 'text-white' : 'text-[#66717a]')}>{label}{tab === id && <span className="absolute bottom-0 left-1/4 right-1/4 h-[1px] bg-white" />}</button>)}</div>
  </div>;
};

const DecisionRow = ({ item, replay }: { item: DecisionTapeItem; replay: (item: DecisionTapeItem) => void }) => (
  <button type="button" onClick={() => replay(item)} className={cn(soft, 'w-full px-4 py-3 text-left')}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-[#e0e5e8]">{item.market}</span><Pill color={tone(item.decision)}>{actionKo(item.decision)}</Pill></div><div className="mt-2 line-clamp-2 text-[10px] leading-4 text-[#7d8891]">{reasonKo(item.primaryReason ?? item.reasons?.[0])}</div><div className="mt-2 flex flex-wrap gap-x-3 text-[9px] text-[#59636b]"><span>{dateTime(item.timestamp)}</span><span>Strategy {item.router?.route ?? item.strategyDisposition ?? '—'}</span><span>Council {item.council?.verdict ?? '—'}</span></div></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/20" /></div></button>
);
const EvidenceRow = ({ item }: { item: OperationalEvidence }) => (
  <div className={cn(soft, 'px-4 py-3')}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#d7dde0]">{item.title || item.rationale || 'Untitled evidence'}</div><div className="mt-1 text-[9px] text-[#68737b]">{item.source || item.source_type || 'source unavailable'} · {item.observed_at ? dateTime(item.observed_at) : 'time unavailable'}</div></div><Pill color={item.direction === 'BULLISH' ? green : item.direction === 'BEARISH' ? red : '#8b959d'}>{item.evidence_grade || item.direction || 'INFO'}</Pill></div></div>
);

const Overview = ({ operations, decisions, replay }: { operations: OperationsPayload | null; decisions: DecisionTapeItem[]; replay: (item: DecisionTapeItem) => void }) => {
  const p = operations?.portfolio;
  const perf = operations?.performance;
  const latest = decisions[0];
  const alert = (perf?.losses ?? 0) > (perf?.wins ?? 0) || (perf?.maxDrawdownPct ?? 0) > 0.03;
  return <div className="px-5 pb-14 pt-4">
    {alert && <div className="mb-3 flex gap-3 rounded-[16px] border border-[#ff6570]/20 bg-[#ff6570]/[0.05] p-4"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6570]" /><div><div className="text-[11px] font-semibold text-[#ff8a92]">Loss control requires attention</div><div className="mt-1 text-[10px] leading-4 text-[#9d7478]">최근 Paper 성과가 손실 우위입니다. Strategies에서 테스트 후보와 실제 Paper 채택 상태를 분리해 확인하세요.</div></div></div>}
    <section className={cn(panel, 'p-5')}><div className="flex items-start justify-between"><div><div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#657078]">Paper Equity</div><div className="mt-2 text-[31px] font-semibold tracking-[-0.05em]">{formatKrw(p?.equity)}</div><div className="mt-1 text-[12px] font-semibold" style={{ color: (perf?.totalReturnPct ?? 0) >= 0 ? green : red }}>{pct(perf?.totalReturnPct, true)}</div></div><Pill color={operations?.status === 'OK' ? green : amber}>{operations?.status ?? 'WAITING'}</Pill></div><div className="mt-5 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-4"><Metric label="Max DD" value={pct(perf?.maxDrawdownPct)} accent={(perf?.maxDrawdownPct ?? 0) > 0.03 ? red : undefined} /><Metric label="Win rate" value={pct(perf?.winRate)} /><Metric label="Profit factor" value={num(perf?.profitFactor)} /></div></section>
    <section className={cn(panel, 'mt-3 p-4')}><Section title="Current operating truth" subtitle="실제 Paper와 실험 계층을 섞지 않습니다." /><div className="grid grid-cols-2 gap-4"><Metric label="Paper version" value={short(operations?.strategyVersion)} /><Metric label="Latest routed" value={latest?.router?.route ?? latest?.strategyDisposition ?? '—'} note={latest?.market ?? '—'} /><Metric label="Open positions" value={p?.openPositions?.length ?? 0} /><Metric label="Evidence active" value={operations?.ingestion?.evidenceActive ?? '—'} /></div></section>
    <section className="mt-5"><Section title="Recent decisions" subtitle="누르면 판단 근거부터 Outcome까지 canonical trace를 엽니다." /><div className="space-y-2">{decisions.slice(0, 6).map((item) => <DecisionRow key={`${item.market}-${item.timestamp}`} item={item} replay={replay} />)}{!decisions.length && <div className={cn(soft, 'p-4 text-[10px] text-[#67727a]')}>최근 판단 기록이 없습니다.</div>}</div></section>
    <section className="mt-5"><Section title="Incoming evidence" subtitle="NARS·외부 근거 중 현재 운영 payload에 들어온 정보" right={<span className="text-[9px] text-[#58626a]">{operations?.ingestion?.evidenceActive ?? 0} active</span>} /><div className="space-y-2">{(operations?.evidenceFlow ?? []).slice(0, 5).map((item) => <EvidenceRow key={item.id} item={item} />)}{!(operations?.evidenceFlow?.length) && <div className={cn(soft, 'p-4 text-[10px] text-[#67727a]')}>표시 가능한 활성 Evidence가 없습니다.</div>}</div></section>
  </div>;
};

const Candidate = ({ item, index }: { item: FactoryTop; index: number }) => (
  <div className={cn(soft, 'p-4')}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[9px] text-[#59636b]">#{index + 1} · {short(item.genome.id)}</div><div className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-[#dce1e4]">{item.hypothesis?.thesis || item.genome.indicators.join(' · ') || 'Strategy candidate'}</div></div><Pill color={lifecycleTone(item.evaluation.lifecycle)}>{item.evaluation.lifecycle ?? (item.evaluation.hardGatePassed ? 'PASS' : 'REJECT')}</Pill></div><div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.05] pt-3"><Metric label="Score" value={num(item.evaluation.score, 1)} /><Metric label="OOS exp." value={num(item.metrics.oosExpectancy, 3)} accent={item.metrics.oosExpectancy >= 0 ? green : red} /><Metric label="Max DD" value={percent(item.metrics.maxDrawdownPct)} /><Metric label="Sharpe" value={num(item.metrics.sharpe)} /><Metric label="MC survive" value={percent(item.metrics.monteCarloSurvivalRate)} /><Metric label="Robust" value={percent(item.metrics.parameterRobustness)} /></div>{!item.evaluation.hardGatePassed && item.evaluation.hardGateReasons?.length > 0 && <div className="mt-3 rounded-[12px] bg-[#ff6570]/[0.04] px-3 py-2 text-[9px] leading-4 text-[#9b7075]">Gate: {item.evaluation.hardGateReasons.slice(0, 2).join(' · ')}</div>}</div>
);

const Strategies = ({ operations, factory, shadow }: { operations: OperationsPayload | null; factory: FactoryStatusPayload | null; shadow: ShadowPayload | null }) => {
  const latest = factory?.latestRun;
  const counts = (latest?.lifecycle_counts ?? {}) as Record<string, number>;
  const trades = operations?.recentTrades ?? [];
  const losses = trades.filter((trade) => trade.netPnl < 0);
  const avgLoss = losses.length ? losses.reduce((sum, trade) => sum + trade.netPnl, 0) / losses.length : 0;
  const worstLoss = losses.length ? Math.min(...losses.map((trade) => trade.netPnl)) : 0;
  const stopLosses = losses.filter((trade) => /stop/i.test(trade.exitReason ?? '')).length;
  const perf = operations?.performance;
  const latestDecision = operations?.decisionTape?.[0];
  const autoPromotion = factory?.governance?.automaticChampionPromotion === true;
  const autoDeploy = factory?.governance?.automaticLiveDeployment === true;
  const pipeline: Array<[string, number]> = [
    ['Tested', latest?.candidate_count ?? 0], ['Incubator', counts.INCUBATOR ?? 0], ['Challenger', counts.CHALLENGER ?? 0], ['Champion', counts.CHAMPION_CANDIDATE ?? 0], ['Shadow', shadow?.candidateCount ?? 0],
  ];
  return <div className="px-5 pb-14 pt-4">
    <section className={cn(panel, 'p-4')}><Section title="Strategy → Paper pipeline" subtitle="테스트됐다는 사실과 실제 Paper에서 쓰인다는 사실은 다릅니다." right={<Pill color={autoDeploy ? green : amber}>{autoDeploy ? 'AUTO DEPLOY' : 'MANUAL GATE'}</Pill>} /><div className="grid grid-cols-5 gap-1.5">{pipeline.map(([label, value]) => <div key={label} className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-1 py-3 text-center"><div className="text-[17px] font-semibold">{value}</div><div className="mt-1 text-[8px] leading-3 text-[#606a72]">{label}</div></div>)}</div><div className="mt-3 rounded-[14px] border border-[#e9aa4a]/15 bg-[#e9aa4a]/[0.035] px-3 py-3 text-[10px] leading-5 text-[#9a8059]">자동 Champion 승격 <b>{autoPromotion ? 'ON' : 'OFF'}</b> · 자동 Paper/Live 배포 <b>{autoDeploy ? 'ON' : 'OFF'}</b>. 현재 Factory 후보는 승인 없이 S1R2에 자동 투입되지 않습니다.</div></section>
    <section className={cn(panel, 'mt-3 p-4')}><Section title="What is actually trading?" subtitle="현재 Paper와 실험 전략을 분리 표시" /><div className="grid grid-cols-2 gap-4"><Metric label="Paper version" value={short(operations?.strategyVersion)} note="S1R2 runtime" /><Metric label="Latest route" value={latestDecision?.router?.route ?? latestDecision?.strategyDisposition ?? '—'} note={latestDecision?.market ?? '—'} /><Metric label="Factory market" value={latest?.market ?? '—'} note={latest?.finished_at ? dateTime(latest.finished_at) : 'no recent run'} /><Metric label="Shadow market" value={shadow?.market ?? '—'} note={`${shadow?.candidateCount ?? 0} eligible`} /></div></section>
    <section className={cn(panel, 'mt-3 p-4')}><Section title="Loss reduction check" subtitle="최근 Paper 실제 손실을 기준으로 봅니다." right={<Pill color={losses.length ? red : green}>{losses.length} losses</Pill>} /><div className="grid grid-cols-3 gap-3"><Metric label="Avg loss" value={formatKrw(avgLoss)} accent={losses.length ? red : undefined} /><Metric label="Worst loss" value={formatKrw(worstLoss)} accent={losses.length ? red : undefined} /><Metric label="Stop exits" value={`${stopLosses}/${losses.length}`} /><Metric label="Expectancy" value={formatKrw(perf?.expectancy)} accent={(perf?.expectancy ?? 0) >= 0 ? green : red} /><Metric label="Payoff" value={num(perf?.payoffRatio)} /><Metric label="Profit factor" value={num(perf?.profitFactor)} /></div><div className="mt-3 text-[9px] leading-4 text-[#626d75]">Factory 백테스트와 현재 Paper 손실은 같은 표본이 아니므로 개선 효과를 임의로 주장하지 않습니다. OOS·MDD·비용 스트레스·Monte Carlo·Shadow outcome을 같이 봐야 승격할 수 있습니다.</div></section>
    <section className="mt-5"><Section title="Latest Strategy Factory run" subtitle={latest ? `${latest.market} · ${latest.timeframe_minutes}m · ${latest.candidate_count} candidates` : 'Factory run unavailable'} /><div className="space-y-2">{(latest?.top_results ?? []).slice(0, 6).map((item, index) => <Candidate key={item.genome.id} item={item} index={index} />)}{!(latest?.top_results?.length) && <div className={cn(soft, 'p-4 text-[10px] text-[#67727a]')}>표시 가능한 Factory 결과가 없습니다.</div>}</div></section>
    <section className="mt-5"><Section title="Shadow-eligible candidates" subtitle="Hard Gate 통과 후 S2 shadow에서 관찰 중인 후보" /><div className="space-y-2">{(shadow?.candidates ?? []).slice(0, 6).map((item) => <div key={item.strategyId} className={cn(soft, 'p-4')}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[11px] font-semibold text-[#d8dde0]">{short(item.strategyId)}</div><div className="mt-1 line-clamp-2 text-[9px] leading-4 text-[#68737b]">{item.indicators.join(' · ') || 'indicator set unavailable'}</div></div><Pill color={lifecycleTone(item.lifecycle)}>{item.lifecycle}</Pill></div><div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/[0.05] pt-3"><Metric label="Score" value={num(item.score, 1)} /><Metric label="Generation" value={item.generation ?? '—'} /><Metric label="Authority" value="SHADOW" /></div></div>)}{shadow?.available === false && <div className={cn(soft, 'p-4 text-[10px] leading-5 text-[#8d7475]')}>{shadow.reason || shadow.error || 'Shadow pool unavailable'}</div>}{shadow?.available !== false && !(shadow?.candidates?.length) && <div className={cn(soft, 'p-4 text-[10px] text-[#67727a]')}>현재 Shadow 승격 조건을 통과한 후보가 없습니다.</div>}</div></section>
  </div>;
};

const Vote = ({ item }: { item: CouncilMember }) => (
  <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] py-3 last:border-b-0"><div className="min-w-0"><div className="text-[11px] font-semibold text-[#d5dbde]">{roleKo(item.role)}</div><div className="mt-1 line-clamp-2 text-[9px] leading-4 text-[#68737b]">{item.reasons?.[0] || '별도 근거 없음'}</div></div><div className="shrink-0 text-right"><Pill color={tone(item.vote)}>{actionKo(item.vote)}</Pill><div className="mt-1 text-[8px] text-[#59636b]">{percent(item.confidence)}</div></div></div>
);
const nestedString = (value: unknown, paths: string[][]) => {
  for (const path of paths) {
    let cursor: unknown = value;
    for (const key of path) cursor = cursor && typeof cursor === 'object' ? (cursor as Record<string, unknown>)[key] : undefined;
    if (typeof cursor === 'string' && cursor.trim()) return cursor.trim();
  }
  return null;
};
const Council = ({ operations, events }: { operations: OperationsPayload | null; events: LedgerEvent[] }) => {
  const decision = operations?.decisionTape?.[0];
  const deterministic = decision?.council ?? operations?.council?.deterministicLatest ?? operations?.council?.latest;
  const ai = decision?.aiCouncilReview ?? deterministic?.aiReview ?? operations?.council?.ai?.current ?? operations?.council?.ai?.historicalLatest;
  const event = events.find((item) => item.eventType === 'COUNCIL');
  const redTeam = nestedString(event?.trace, [['redTeamResult'], ['red_team_result'], ['audit', 'redTeamResult'], ['council', 'redTeamResult']]);
  return <div className="px-5 pb-14 pt-4">
    <section className={cn(panel, 'p-5')}><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#657078]">Latest Council verdict</div><div className="mt-2 text-[27px] font-semibold" style={{ color: tone(deterministic?.verdict) }}>{deterministic?.verdict ?? 'UNAVAILABLE'}</div><div className="mt-2 text-[11px] text-[#7a858d]">{decision?.market ?? event?.market ?? 'market unavailable'} · {decision ? actionKo(decision.decision) : 'decision unavailable'}</div></div><Pill color={operations?.council?.executionAuthority ? red : green}>{operations?.council?.executionAuthority ? 'EXECUTION AUTH' : 'SHADOW ONLY'}</Pill></div><div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4"><Metric label="Approve" value={deterministic?.approveCount ?? 0} /><Metric label="Caution" value={deterministic?.cautionCount ?? 0} /><Metric label="Reject" value={deterministic?.rejectCount ?? 0} /></div></section>
    <section className={cn(panel, 'mt-3 p-4')}><Section title="What Council changed" subtitle="결정 권한과 의견을 분리합니다." /><div className="grid grid-cols-2 gap-4"><Metric label="Reviewed" value={deterministic?.reviewedAction ? actionKo(deterministic.reviewedAction) : '—'} /><Metric label="Red Team" value={redTeam ?? 'not recorded'} accent={redTeam === 'INVALIDATED' ? red : undefined} /></div><div className="mt-3 rounded-[14px] border border-white/[0.05] bg-white/[0.015] p-3 text-[10px] leading-5 text-[#737e86]">{deterministic?.summary || event?.summary || 'Council summary가 아직 기록되지 않았습니다.'}</div></section>
    <section className="mt-5"><Section title="Member votes" subtitle="의견 차이가 어디서 생겼는지 확인" /><div className={cn(panel, 'px-4')}>{deterministic?.members?.length ? deterministic.members.map((item, index) => <Vote key={`${item.role}-${index}`} item={item} />) : <div className="py-4 text-[10px] text-[#67727a]">멤버별 표결 데이터가 없습니다.</div>}</div></section>
    <section className={cn(panel, 'mt-5 p-4')}><Section title="AI advisory" subtitle="AI는 현재 거래 실행 권한이 없습니다." right={<Pill color={ai?.executionAuthority ? red : '#84909a'}>{ai?.executionAuthority ? 'AUTHORITY' : 'ADVISORY'}</Pill>} />{ai ? <><div className="flex items-center gap-2"><Pill color={tone(ai.stance)}>{ai.stance ?? 'NO STANCE'}</Pill><span className="text-[9px] text-[#646f77]">confidence {percent(ai.confidence)}</span></div><div className="mt-3 text-[10px] leading-5 text-[#7d8890]">{ai.rationale || 'rationale unavailable'}</div></> : <div className="text-[10px] text-[#67727a]">최근 AI advisory가 없습니다.</div>}</section>
  </div>;
};

const Trade = ({ item, replay }: { item: ClosedTrade; replay: (item: ClosedTrade) => void }) => (
  <button type="button" onClick={() => replay(item)} className={cn(soft, 'w-full p-4 text-left')}><div className="flex items-start justify-between"><div><div className="text-[12px] font-semibold text-[#dce1e4]">{item.market}</div><div className="mt-1 text-[9px] text-[#657078]">{dateTime(item.closedAt)} · {short(item.strategyVersion)}</div></div><div className="text-right"><div className="text-[13px] font-semibold" style={{ color: item.netPnl >= 0 ? green : red }}>{formatKrw(item.netPnl)}</div><div className="mt-1 text-[9px]" style={{ color: item.netPnl >= 0 ? green : red }}>{percent(item.returnPct)}</div></div></div><div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3"><span className="line-clamp-1 text-[9px] text-[#68737b]">{reasonKo(item.exitReason)}</span><ChevronRight className="h-4 w-4 text-white/20" /></div></button>
);
const Portfolio = ({ operations, replay }: { operations: OperationsPayload | null; replay: (trade: ClosedTrade) => void }) => {
  const p = operations?.portfolio;
  const perf = operations?.performance;
  const trades = operations?.recentTrades ?? [];
  const lossGroups = useMemo(() => {
    const map = new Map<string, { count: number; pnl: number }>();
    trades.filter((trade) => trade.netPnl < 0).forEach((trade) => { const key = trade.strategyVersion || 'unknown'; const row = map.get(key) ?? { count: 0, pnl: 0 }; row.count += 1; row.pnl += trade.netPnl; map.set(key, row); });
    return Array.from(map.entries()).sort((a, b) => a[1].pnl - b[1].pnl);
  }, [trades]);
  return <div className="px-5 pb-14 pt-4">
    <section className={cn(panel, 'p-5')}><div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#657078]">Total Equity</div><div className="mt-2 text-[32px] font-semibold tracking-[-0.05em]">{formatKrw(p?.equity)}</div><div className="mt-1 text-[12px] font-semibold" style={{ color: (perf?.totalReturnPct ?? 0) >= 0 ? green : red }}>{pct(perf?.totalReturnPct, true)}</div><div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4"><Metric label="Cash" value={formatKrw(p?.cash)} /><Metric label="Realized" value={formatKrw(p?.realizedPnl)} accent={(p?.realizedPnl ?? 0) >= 0 ? green : red} /><Metric label="Drawdown" value={pct(p?.currentDrawdownPct)} accent={(p?.currentDrawdownPct ?? 0) > 0.03 ? red : undefined} /></div></section>
    <section className="mt-5"><Section title="Open positions" subtitle="보유 상태와 보호 가격을 우선 표시" /><div className="space-y-2">{p?.openPositions?.map((position) => <div key={position.market} className={cn(soft, 'p-4')}><div className="flex justify-between"><div><div className="text-[13px] font-semibold">{position.market}</div><div className="mt-1 text-[9px] text-[#657078]">opened {timeAgo(position.openedAt)}</div></div><div className="text-right"><div className="text-[9px] text-[#657078]">Average</div><div className="mt-1 text-[12px] font-semibold">{formatKrw(position.averageCost)}</div></div></div><div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/[0.05] pt-3"><Metric label="Qty" value={num(position.quantity, 5)} /><Metric label="Stop" value={formatKrw(position.stopLossPrice)} accent={red} /><Metric label="Take profit" value={formatKrw(position.takeProfitPrice)} accent={green} /></div></div>)}{!p?.openPositions?.length && <div className={cn(soft, 'p-4 text-[10px] text-[#67727a]')}>현재 열린 포지션이 없습니다.</div>}</div></section>
    <section className="mt-5"><Section title="Recent closed trades" subtitle="거래 → 전략 → Decision Replay로 추적" /><div className="space-y-2">{trades.slice(0, 10).map((item) => <Trade key={item.id} item={item} replay={replay} />)}{!trades.length && <div className={cn(soft, 'p-4 text-[10px] text-[#67727a]')}>완료된 거래가 없습니다.</div>}</div></section>
    {lossGroups.length > 0 && <section className={cn(panel, 'mt-5 p-4')}><Section title="Loss concentration" subtitle="어떤 strategyVersion에서 손실이 쌓였는지" />{lossGroups.map(([strategy, row]) => <div key={strategy} className="flex items-center justify-between border-b border-white/[0.05] py-2.5 last:border-b-0"><div><div className="text-[10px] font-semibold text-[#cbd2d6]">{short(strategy)}</div><div className="mt-1 text-[8px] text-[#5f6971]">{row.count} losing trades</div></div><div className="text-[11px] font-semibold text-[#ff727b]">{formatKrw(row.pnl)}</div></div>)}</section>}
  </div>;
};

const phases = ['Evidence', 'Strategy', 'Council', 'Arbiter', 'Decision', 'Risk', 'Order', 'Trade', 'Outcome'];
const Replay = ({ target, payload, loading, back }: { target: ReplayTarget; payload: ReplayPayload | null; loading: boolean; back: () => void }) => {
  const timeline = payload?.timeline ?? [];
  const groups = useMemo(() => { const map = new Map<string, LedgerEvent[]>(); timeline.forEach((event) => { const phase = phaseOf(event); if (phase) map.set(phase, [...(map.get(phase) ?? []), event]); }); return map; }, [timeline]);
  const strategy = timeline.find((event) => event.eventType === 'STRATEGY');
  const decision = timeline.find((event) => event.eventType === 'DECISION');
  const council = timeline.find((event) => event.eventType === 'COUNCIL');
  const outcome = [...timeline].reverse().find((event) => event.eventType === 'OUTCOME');
  const complete = payload?.found && timeline.length > 0;
  return <div className="min-h-[100dvh]" style={{ background: bg }}><div className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07090b]/95 px-5 pb-3 pt-[max(env(safe-area-inset-top),16px)] backdrop-blur-xl"><div className="flex gap-3"><button type="button" onClick={back} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08]"><ArrowLeft className="h-4 w-4 text-white/60" /></button><div className="min-w-0"><div className="text-[9px] font-semibold tracking-[0.18em] text-white/30">DECISION REPLAY</div><div className="mt-1 truncate text-[18px] font-semibold">{target.title}</div><div className="mt-1 text-[9px] text-[#626d75]">{target.market ?? 'market unavailable'} · canonical trace {short(target.traceId)}</div></div></div></div><div className="px-5 pb-16 pt-4">
    {loading && <div className={cn(panel, 'p-5 text-[10px] text-[#68737b]')}>Canonical trace를 불러오는 중입니다.</div>}
    {!loading && !complete && <div className="rounded-[18px] border border-[#e9aa4a]/20 bg-[#e9aa4a]/[0.04] p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#e9aa4a]" /><div><div className="text-[11px] font-semibold text-[#d9ad69]">Canonical replay unavailable</div><div className="mt-1 text-[10px] leading-5 text-[#8e7858]">trace_id로 연결된 이력이 없습니다. 이전처럼 ±12시간 market events를 같은 Replay로 보이게 하지 않습니다.</div></div></div></div>}
    {!loading && complete && <><section className={cn(panel, 'p-4')}><Section title="What happened" subtitle="결론을 먼저 보고 아래에서 단계별 근거를 확인합니다." right={<Pill color={outcome ? green : amber}>{payload?.completeThrough ?? 'CURRENT'}</Pill>} /><div className="space-y-2 text-[10px] leading-5 text-[#7d8890]"><div><span className="text-[#a7b0b6]">Strategy</span> · {strategy?.strategyId ?? strategy?.summary ?? 'not recorded'}</div><div><span className="text-[#a7b0b6]">Decision</span> · {decision?.action ? actionKo(decision.action) : decision?.eventName ?? 'not recorded'}{decision?.reason ? ` — ${reasonKo(decision.reason)}` : ''}</div><div><span className="text-[#a7b0b6]">Council</span> · {council?.summary || council?.reason || 'not recorded'}</div><div><span className="text-[#a7b0b6]">Outcome</span> · {outcome?.summary || outcome?.reason || '아직 Outcome 없음'}</div></div></section><section className="mt-5"><Section title="Decision path" subtitle="Evidence → Strategy → Council → Risk → Execution → Outcome" /><div className="relative pl-6 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-[1px] before:bg-white/[0.08]">{phases.map((phase) => { const items = groups.get(phase) ?? []; const primary = items[0]; return <div key={phase} className="relative mb-3"><span className={cn('absolute -left-6 top-4 h-3.5 w-3.5 rounded-full border-2 bg-[#07090b]', primary ? 'border-[#9aa4ab]' : 'border-white/15')} /><div className={cn(soft, 'p-4', !primary && 'opacity-55')}><div className="flex items-start justify-between"><div><div className="text-[11px] font-semibold">{phase}</div>{primary && <div className="mt-1 text-[8px] text-[#5e6870]">{dateTime(primary.occurredAt)} · {items.length} event{items.length === 1 ? '' : 's'}</div>}</div>{primary ? <Pill color={primary.executionAuthority ? red : '#84909a'}>{primary.executionAuthority ? 'EXECUTION' : 'OBSERVED'}</Pill> : <Pill>NOT RECORDED</Pill>}</div>{primary && <div className="mt-3 text-[10px] leading-5 text-[#77828a]">{primary.summary || reasonKo(primary.reason) || primary.eventName}</div>}</div></div>; })}</div></section><details className={cn(panel, 'mt-5 overflow-hidden')}><summary className="cursor-pointer px-4 py-4 text-[11px] font-semibold text-[#a4adb3]">Raw canonical trace · {timeline.length} events</summary><div className="border-t border-white/[0.06] px-4 py-2">{timeline.map((event) => <div key={event.id || event.eventKey} className="border-b border-white/[0.05] py-3 last:border-b-0"><div className="flex justify-between gap-3"><div><div className="text-[10px] font-semibold text-[#bdc5ca]">{event.eventName}</div><div className="mt-1 text-[8px] text-[#59636b]">{eventTypeKo(event.eventType)} · {dateTime(event.occurredAt)}</div></div><span className="text-[8px] text-[#59636b]">{event.authority}</span></div></div>)}</div></details></>}
  </div></div>;
};

export const BlackOracleMobileApp = () => {
  const [tab, setTab] = useState<Tab>('overview');
  const [operations, setOperations] = useState<OperationsPayload | null>(null);
  const [factory, setFactory] = useState<FactoryStatusPayload | null>(null);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [shadow, setShadow] = useState<ShadowPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<ReplayTarget | null>(null);
  const [replay, setReplay] = useState<ReplayPayload | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);

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

  const shadowMarket = factory?.latestRun?.market ?? operations?.decisionTape?.[0]?.market ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!shadowMarket) { setShadow(null); return; }
    fetch(`/api/strategy-shadow-pool?market=${encodeURIComponent(shadowMarket)}&limit=8`, { cache: 'no-store' })
      .then((r) => r.json() as Promise<ShadowPayload>)
      .then((value) => { if (!cancelled) setShadow(value); })
      .catch((error) => { if (!cancelled) setShadow({ available: false, market: shadowMarket, candidateCount: 0, candidates: [], error: error instanceof Error ? error.message : 'Shadow pool read failed.' }); });
    return () => { cancelled = true; };
  }, [shadowMarket]);

  const sortedEvents = useMemo(() => [...events].sort((a, b) => b.occurredAt - a.occurredAt), [events]);
  const decisions = useMemo(() => [...(operations?.decisionTape ?? [])].sort((a, b) => b.timestamp - a.timestamp), [operations?.decisionTape]);

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

  const decisionReplay = useCallback((item: DecisionTapeItem) => {
    const event = sortedEvents.filter((row) => row.market === item.market && traceIdOf(row)).map((row) => ({ row, distance: Math.abs(row.occurredAt - item.timestamp) })).filter((row) => row.distance <= 10 * 60_000).sort((a, b) => a.distance - b.distance)[0]?.row;
    const traceId = traceIdOf(event);
    if (!traceId) { setTarget({ traceId: 'unavailable', market: item.market, title: `${item.market} · ${actionKo(item.decision)}` }); setReplay({ found: false, timeline: [], error: 'Canonical trace_id unavailable.' }); return; }
    void openTrace({ traceId, market: item.market, title: `${item.market} · ${actionKo(item.decision)}` });
  }, [openTrace, sortedEvents]);
  const tradeReplay = useCallback((trade: ClosedTrade) => {
    const outcome = sortedEvents.filter((row) => row.market === trade.market && row.eventType === 'OUTCOME').map((row) => ({ row, distance: Math.abs(row.occurredAt - trade.closedAt) })).sort((a, b) => a.distance - b.distance)[0]?.row;
    const traceId = entryTraceIdOf(outcome) ?? traceIdOf(outcome);
    if (!traceId) { setTarget({ traceId: 'unavailable', market: trade.market, title: `${trade.market} · ${formatKrw(trade.netPnl)}` }); setReplay({ found: false, timeline: [], error: 'Outcome에 연결된 entry trace가 없습니다.' }); return; }
    void openTrace({ traceId, market: trade.market, title: `${trade.market} · ${formatKrw(trade.netPnl)}` });
  }, [openTrace, sortedEvents]);

  if (target) return <Replay target={target} payload={replay} loading={replayLoading} back={() => { setTarget(null); setReplay(null); }} />;
  return <div className="min-h-[100dvh] text-[#e8ecef]" style={{ background: bg }}><Top tab={tab} setTab={setTab} operations={operations} loading={loading} refresh={() => void load()} />{tab === 'overview' && <Overview operations={operations} decisions={decisions} replay={decisionReplay} />}{tab === 'strategies' && <Strategies operations={operations} factory={factory} shadow={shadow} />}{tab === 'council' && <Council operations={operations} events={sortedEvents} />}{tab === 'portfolio' && <Portfolio operations={operations} replay={tradeReplay} />}</div>;
};
