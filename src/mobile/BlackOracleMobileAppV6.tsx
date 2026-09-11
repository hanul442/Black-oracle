import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  ChevronRight,
  Clock3,
  Database,
  GitBranch,
  ListTree,
  Play,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  ClosedTrade,
  DecisionTapeItem,
  EventsPayload,
  FactoryPayload,
  LedgerEvent,
  OperationsPayload,
  PriceCandle,
  PriceChartPayload,
} from './v2/types';
import { actionKo, cn, dateTime, pct, regimeKo, timeAgo } from './v2/types';
import { formatKrw } from './v2/financial';

const panel = 'rounded-[22px] border border-white/[0.09] bg-[#0b0e11] shadow-[0_18px_60px_rgba(0,0,0,0.18)]';
const muted = 'text-[#7f8a93]';
const green = '#24e878';
const red = '#ff5c67';
const amber = '#e6a640';

type MobileTab = 'oracle' | 'traces' | 'portfolio' | 'system';
type View = 'root' | 'decision' | 'outcome';

type ChartState = {
  loading: boolean;
  payload: PriceChartPayload | null;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const percentLike = (value: number | null | undefined) => {
  if (!finite(value)) return '—';
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized.toFixed(normalized >= 10 ? 0 : 1)}%`;
};
const signedPct = (value: number | null | undefined) => {
  if (!finite(value)) return '—';
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(2)}%`;
};
const decisionTone = (value: string | null | undefined) => {
  const upper = String(value ?? '').toUpperCase();
  if (['ENTER', 'BUY', 'LONG', 'APPROVE'].includes(upper)) return green;
  if (['EXIT', 'SELL', 'SHORT', 'REJECT'].includes(upper)) return red;
  return amber;
};
const normalized01 = (value: number | null | undefined) => {
  if (!finite(value)) return null;
  const normalized = Math.abs(value) <= 1 ? value : value / 100;
  return Math.max(0, Math.min(1, normalized));
};
const marketLabel = (market: string | null | undefined) => market?.replace(/^KRW-/, '').replace(/^KRX-/, '') ?? '—';

const extractTraceId = (event: LedgerEvent | null | undefined) => {
  const records = [event?.trace, event?.links].filter(Boolean) as Array<Record<string, unknown>>;
  const keys = ['traceId', 'trace_id', 'decisionTraceId', 'decision_trace_id'];
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return null;
};

const Header = ({ title, subtitle, onBack, onRefresh, loading }: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}) => (
  <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-[max(env(safe-area-inset-top),18px)]">
    <div className="flex min-w-0 items-start gap-3">
      {onBack && <button type="button" onClick={onBack} className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]" aria-label="뒤로"><ArrowLeft className="h-4 w-4" /></button>}
      <div className="min-w-0">
        <div className="text-[10px] font-medium tracking-[0.28em] text-white/40">BLACK ORACLE</div>
        <h1 className="mt-1 truncate text-[21px] font-semibold tracking-[-0.035em] text-white">{title}</h1>
        {subtitle && <div className="mt-1 text-[11px] leading-4 text-[#77828b]">{subtitle}</div>}
      </div>
    </div>
    {onRefresh && <button type="button" onClick={onRefresh} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]" aria-label="새로고침"><RefreshCw className={cn('h-4 w-4 text-white/60', loading && 'animate-spin')} /></button>}
  </div>
);

const Metric = ({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) => (
  <div className="min-w-0">
    <div className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#65717a]">{label}</div>
    <div className="mt-1 truncate text-[14px] font-semibold tracking-[-0.02em]" style={{ color: accent ?? '#e9edef' }}>{value}</div>
  </div>
);

const MarketStateSurface = ({ decision }: { decision: DecisionTapeItem | null }) => {
  const values = [
    normalized01(decision?.regimeConfidence),
    normalized01(decision?.technicalEvidence?.confidence),
    normalized01(decision?.structure?.confidence),
    normalized01(decision?.cycle?.confidence),
    normalized01(decision?.microstructure?.confidence),
    normalized01(decision?.forecast?.confidence),
  ].filter((value): value is number => value != null);
  if (!values.length) {
    return <div className="flex h-[156px] items-center justify-center rounded-[18px] border border-dashed border-white/10 text-[11px] text-white/30">Market state inputs unavailable</div>;
  }
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const amp = 8 + avg * 17;
  const paths = Array.from({ length: 16 }, (_, row) => {
    const points = Array.from({ length: 28 }, (_, index) => {
      const x = 8 + index * 8.35;
      const source = values[index % values.length];
      const wave = Math.sin(index * 0.52 + row * 0.42) * amp * (0.4 + source * 0.7);
      const secondary = Math.cos(index * 0.23 - row * 0.36) * (5 + source * 7);
      const y = 42 + row * 3.4 + wave * 0.34 + secondary * 0.2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return <polyline key={row} points={points} fill="none" stroke="#ee8c22" strokeOpacity={0.18 + row * 0.018} strokeWidth="0.8" />;
  });
  return <svg viewBox="0 0 240 150" className="h-[156px] w-full" role="img" aria-label="실제 시장 상태 feature를 시각적으로 인코딩한 surface"><defs><radialGradient id="bo-surface-glow"><stop offset="0%" stopColor="#ff9a24" stopOpacity="0.34" /><stop offset="100%" stopColor="#ff9a24" stopOpacity="0" /></radialGradient></defs><ellipse cx="120" cy="78" rx="112" ry="65" fill="url(#bo-surface-glow)" />{paths}</svg>;
};

const OracleOrb = ({ decision }: { decision: DecisionTapeItem | null }) => {
  const confidence = normalized01(decision?.confidence ?? decision?.forecast?.confidence) ?? 0;
  const contradiction = Math.min(1, (decision?.evidenceContradictionCount ?? 0) / Math.max(1, decision?.evidenceActiveCount ?? 1));
  return <div className="relative mx-auto h-[150px] w-[150px] overflow-hidden rounded-full border border-[#f59a35]/20 bg-[#130e09] shadow-[inset_0_0_50px_rgba(255,143,31,0.15),0_0_45px_rgba(255,143,31,0.08)]"><div className="absolute inset-[18px] rounded-full border border-[#f59a35]/25" /><div className="absolute inset-[30px] rounded-full border border-[#f59a35]/20" />{Array.from({ length: 11 }, (_, i) => <div key={i} className="absolute left-1/2 top-1/2 h-[1px] origin-left bg-gradient-to-r from-[#ff9a24]/70 to-transparent" style={{ width: `${44 + confidence * 18}px`, transform: `rotate(${i * 32.7 + contradiction * 24}deg)` }} />)}<div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,163,64,0.18),transparent_58%)]" /><div className="absolute bottom-3 left-0 right-0 text-center text-[9px] tracking-[0.18em] text-[#d89347]/60">ORACLE STATE</div></div>;
};

const DecisionPriceChart = ({ candles, decision }: { candles: PriceCandle[]; decision: DecisionTapeItem | null }) => {
  const data = candles.filter((item) => [item.timestamp, item.close].every(Number.isFinite)).slice(-56);
  if (data.length < 2) return <div className="flex h-[220px] items-center justify-center text-[11px] text-white/30">실제 가격 데이터 없음</div>;
  const width = 360;
  const height = 220;
  const left = 10;
  const right = 350;
  const top = 16;
  const bottom = 194;
  const map = decision?.tradeMap;
  const planValues = [map?.entryPrice, map?.stopLossPrice, map?.takeProfit1Price, map?.takeProfit2Price].filter(finite);
  const values = [...data.map((item) => item.close), ...planValues];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max((rawMax - rawMin) * 0.08, Math.abs(rawMax) * 0.001);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const span = Math.max(max - min, 1e-9);
  const x = (index: number) => left + (index / Math.max(1, data.length - 1)) * (right - left) * 0.74;
  const nowX = left + (right - left) * 0.74;
  const y = (value: number) => bottom - ((value - min) / span) * (bottom - top);
  const actualPath = data.map((item, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(item.close).toFixed(1)}`).join(' ');
  const forecast = decision?.forecast;
  const last = data[data.length - 1]?.close;
  const bullish = normalized01(forecast?.probabilityBullish);
  const bearish = normalized01(forecast?.probabilityBearish);
  const expectedTarget = finite(map?.takeProfit1Price) ? map.takeProfit1Price : null;
  const invalidation = finite(map?.stopLossPrice) ? map.stopLossPrice : null;
  const futureX = right;
  const rangeTop = finite(map?.takeProfit2Price) ? y(map.takeProfit2Price) : finite(map?.takeProfit1Price) ? y(map.takeProfit1Price) : null;
  const rangeBottom = invalidation != null ? y(invalidation) : null;
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full" role="img" aria-label="실제 가격과 기록된 trade map"><defs><linearGradient id="bo-plan-fill" x1="0" x2="1"><stop offset="0%" stopColor={decisionTone(decision?.decision)} stopOpacity="0.16" /><stop offset="100%" stopColor={decisionTone(decision?.decision)} stopOpacity="0.03" /></linearGradient></defs>{[0, 1, 2, 3, 4].map((row) => { const gy = top + (bottom - top) * row / 4; return <line key={row} x1={left} x2={right} y1={gy} y2={gy} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />; })}<path d={actualPath} fill="none" stroke="#f0f3f4" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /><line x1={nowX} x2={nowX} y1={top} y2={bottom} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 4" /><text x={nowX - 10} y="12" fill="rgba(255,255,255,0.58)" fontSize="9">NOW</text>{rangeTop != null && rangeBottom != null && <path d={`M ${nowX} ${y(last)} L ${futureX} ${rangeTop} L ${futureX} ${rangeBottom} Z`} fill="url(#bo-plan-fill)" />}{expectedTarget != null && <line x1={nowX} x2={futureX} y1={y(last)} y2={y(expectedTarget)} stroke={decisionTone(decision?.decision)} strokeWidth="2" />}{invalidation != null && <line x1={nowX} x2={futureX} y1={y(invalidation)} y2={y(invalidation)} stroke={red} strokeOpacity="0.35" strokeDasharray="3 4" />}{bullish != null && <text x={futureX - 56} y={top + 13} fill={green} fontSize="9">UP {percentLike(bullish)}</text>}{bearish != null && <text x={futureX - 56} y={top + 28} fill={red} fontSize="9">DOWN {percentLike(bearish)}</text>}<text x={left} y={height - 5} fill="rgba(255,255,255,0.28)" fontSize="8">Actual</text><text x={nowX + 8} y={height - 5} fill="rgba(255,255,255,0.28)" fontSize="8">Recorded Trade Map · not a price quantile forecast</text></svg>;
};

const MarketPicker = ({ markets, selected, onSelect }: { markets: string[]; selected: string | null; onSelect: (market: string) => void }) => (
  <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{markets.map((market) => <button key={market} type="button" onClick={() => onSelect(market)} className={cn('shrink-0 rounded-full border px-3 py-2 text-[11px] font-semibold transition', market === selected ? 'border-white/35 bg-white text-black' : 'border-white/10 bg-white/[0.03] text-white/55')}>{market}</button>)}</div>
);

const OracleScreen = ({ operations, decision, markets, selectedMarket, candles, chartLoading, onSelectMarket, onDecision, onReplay }: {
  operations: OperationsPayload | null;
  decision: DecisionTapeItem | null;
  markets: string[];
  selectedMarket: string | null;
  candles: PriceCandle[];
  chartLoading: boolean;
  onSelectMarket: (market: string) => void;
  onDecision: () => void;
  onReplay: () => void;
}) => {
  const last = candles[candles.length - 1];
  const first = candles[0];
  const change = last && first?.close ? last.close / first.close - 1 : null;
  const activeEvidence = decision?.evidenceActiveCount ?? 0;
  const contradictions = decision?.evidenceContradictionCount ?? 0;
  const evidenceQuality = activeEvidence > 0 ? Math.max(0, 1 - contradictions / activeEvidence) : null;
  return <div className="h-full overflow-y-auto px-5 pb-28">
    <div className="flex items-start justify-between gap-3 pb-5 pt-[max(env(safe-area-inset-top),18px)]"><div><div className="text-[14px] font-semibold tracking-[0.22em] text-white">BLACK ORACLE</div><div className="mt-1 text-[9px] tracking-[0.18em] text-white/35">INTELLIGENCE FOR A HIGHER EDGE</div></div><div className="rounded-full border border-white/10 px-3 py-1.5 text-[9px] font-semibold text-[#6f7b84]">{operations?.mode ?? 'PAPER'}</div></div>
    <MarketPicker markets={markets} selected={selectedMarket} onSelect={onSelectMarket} />
    <div className="mt-5 flex items-end justify-between gap-4"><div><div className="flex items-center gap-2"><div className="text-[24px] font-semibold tracking-[-0.04em]">{selectedMarket ?? '시장 미선택'}</div>{operations?.status && <span className={cn('rounded-full px-2.5 py-1 text-[9px] font-bold', operations.status === 'OK' ? 'bg-[#0c2f1b] text-[#39e982]' : 'bg-[#302415] text-[#e6a640]')}>{operations.status}</span>}</div><div className="mt-1 text-[10px] text-[#68737c]">{decision?.assetClass ?? 'MARKET'} · {decision ? timeAgo(decision.timestamp) : 'Decision Trace 없음'}</div></div><div className="text-right"><div className="text-[22px] font-semibold tracking-[-0.04em]">{chartLoading ? '…' : formatKrw(last?.close)}</div><div className="mt-1 text-[12px] font-semibold" style={{ color: (change ?? 0) >= 0 ? green : red }}>{change == null ? '—' : signedPct(change)}</div></div></div>

    <section className={cn(panel, 'mt-5 overflow-hidden p-4')}>
      <div className="grid grid-cols-[1.35fr_0.9fr] gap-3"><div><div className="flex items-center justify-between"><div className="text-[11px] font-semibold text-white/75">Market State Surface</div><Activity className="h-3.5 w-3.5 text-white/25" /></div><MarketStateSurface decision={decision} /></div><div className="border-l border-white/[0.07] pl-3"><div className="text-[11px] font-semibold text-white/75">Oracle State</div><div className="mt-2"><OracleOrb decision={decision} /></div></div></div>
      <div className="mt-2 grid grid-cols-4 gap-3 border-t border-white/[0.06] pt-4"><Metric label="Regime" value={decision ? regimeKo(decision.regime) : '—'} accent="#eef2f3" /><Metric label="Trend" value={decision?.structure?.bias ?? '—'} accent={decisionTone(decision?.decision)} /><Metric label="Evidence" value={activeEvidence || '—'} /><Metric label="Conflict" value={activeEvidence ? percentLike(contradictions / activeEvidence) : '—'} accent={contradictions ? amber : '#a7b0b6'} /></div>
      {evidenceQuality != null && <div className="mt-4"><div className="mb-1.5 flex items-center justify-between text-[9px] text-[#69747d]"><span>Evidence coherence</span><span>{percentLike(evidenceQuality)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-[#24e878]" style={{ width: `${evidenceQuality * 100}%` }} /></div></div>}
    </section>

    <section className={cn(panel, 'mt-3 overflow-hidden')}>
      <div className="flex items-center justify-between px-4 pt-4"><div><div className="text-[14px] font-semibold">Price + Decision Map</div><div className="mt-1 text-[10px] text-[#66717a]">Actual market data + recorded SL/TP levels only</div></div><BarChart3 className="h-4 w-4 text-white/25" /></div>
      <DecisionPriceChart candles={candles} decision={decision} />
      <div className="grid grid-cols-4 gap-3 border-t border-white/[0.06] px-4 py-4"><Metric label="Decision" value={actionKo(decision?.decision)} accent={decisionTone(decision?.decision)} /><Metric label="Confidence" value={percentLike(decision?.confidence ?? decision?.forecast?.confidence)} /><Metric label="Bullish" value={percentLike(decision?.forecast?.probabilityBullish)} accent={green} /><Metric label="Bearish" value={percentLike(decision?.forecast?.probabilityBearish)} accent={red} /></div>
    </section>

    <button type="button" onClick={onDecision} className={cn(panel, 'mt-3 w-full p-4 text-left transition active:scale-[0.995]')}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[0.15em] text-[#69747c]">Trading Decision</div><div className="mt-2 text-[28px] font-semibold" style={{ color: decisionTone(decision?.decision) }}>{actionKo(decision?.decision)}</div></div><ChevronRight className="mt-1 h-5 w-5 text-white/35" /></div><div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4"><Metric label="Router" value={decision?.router?.route ?? decision?.strategyDisposition ?? '—'} /><Metric label="Council" value={actionKo(decision?.council?.verdict)} accent={decisionTone(decision?.council?.verdict)} /><Metric label="Risk" value={decision?.riskDisposition ?? '—'} /></div></button>

    <button type="button" onClick={onReplay} className="mt-3 flex w-full items-center justify-between rounded-[20px] border border-white/[0.09] bg-white/[0.025] px-4 py-4 text-left"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05]"><Play className="ml-0.5 h-4 w-4 text-white/60" /></div><div><div className="text-[12px] font-semibold">Decision Replay</div><div className="mt-1 text-[10px] text-[#65717a]">Evidence → Strategy → Council → Risk → Trade → Outcome</div></div></div><ChevronRight className="h-4 w-4 text-white/25" /></button>
  </div>;
};

const DecisionScreen = ({ decision, factory, onBack, onReplay }: { decision: DecisionTapeItem | null; factory: FactoryPayload | null; onBack: () => void; onReplay: () => void }) => {
  const members = decision?.council?.members ?? [];
  const selectedFactory = factory?.latestRun?.top_results?.find((item) => item.genome.id === decision?.strategyDisposition) ?? null;
  return <div className="h-full overflow-y-auto pb-28"><Header title="Decision" subtitle={decision?.market ?? 'Canonical trace unavailable'} onBack={onBack} /><div className="px-5">
    <section className={cn(panel, 'p-4')}><div className="flex items-start justify-between gap-4"><div><div className="text-[9px] uppercase tracking-[0.15em] text-[#66717a]">Final Decision</div><div className="mt-2 text-[31px] font-semibold" style={{ color: decisionTone(decision?.decision) }}>{actionKo(decision?.decision)}</div></div><div className="rounded-[16px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-right"><div className="text-[8px] uppercase tracking-[0.12em] text-[#67727a]">Authority</div><div className="mt-1 text-[11px] font-semibold text-[#e5e9eb]">{decision?.council?.members?.some((member) => member.executionAuthority) ? 'EXECUTION' : 'SHADOW / ADVISORY'}</div></div></div><div className="mt-4 grid grid-cols-4 gap-3 border-t border-white/[0.06] pt-4"><Metric label="Confidence" value={percentLike(decision?.confidence)} /><Metric label="Score" value={finite(decision?.oracleTradeScore) ? decision?.oracleTradeScore?.toFixed(1) : '—'} /><Metric label="Risk" value={decision?.riskDisposition ?? '—'} /><Metric label="Regime" value={regimeKo(decision?.regime)} /></div></section>

    <section className={cn(panel, 'mt-3 p-4')}><div className="flex items-center justify-between"><div className="text-[13px] font-semibold">Strategy Router</div><ListTree className="h-4 w-4 text-white/25" /></div><div className="mt-4 rounded-[16px] border border-[#24e878]/25 bg-[#24e878]/[0.05] p-3"><div className="text-[9px] uppercase tracking-[0.12em] text-[#69af83]">Selected route</div><div className="mt-1 text-[17px] font-semibold">{decision?.router?.route ?? decision?.strategyDisposition ?? '—'}</div></div>{decision?.router?.reasons?.length ? <div className="mt-3 space-y-2">{decision.router.reasons.slice(0, 4).map((reason, index) => <div key={index} className="flex gap-2 text-[11px] leading-5 text-[#879198]"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/25" />{reason}</div>)}</div> : <div className="mt-3 text-[11px] text-[#68737b]">Router reason 기록 없음</div>}{selectedFactory && <div className="mt-3 border-t border-white/[0.06] pt-3 text-[10px] text-[#6f7981]">Strategy Factory score {selectedFactory.evaluation.score.toFixed(1)} · {selectedFactory.evaluation.lifecycle ?? 'UNRATED'}</div>}</section>

    <section className={cn(panel, 'mt-3 p-4')}><div className="flex items-center justify-between"><div><div className="text-[13px] font-semibold">AI Council</div><div className="mt-1 text-[10px] text-[#69747c]">{members.length ? `${members.length} recorded members` : 'member-level votes unavailable'}</div></div><BrainCircuit className="h-4 w-4 text-white/25" /></div><div className="mt-4 space-y-2">{members.map((member, index) => <div key={`${member.role}-${index}`} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-3 py-3"><div><div className="text-[11px] font-semibold text-[#d6dbde]">{member.role}</div><div className="mt-1 text-[9px] text-[#66717a]">confidence {percentLike(member.confidence)} · {member.executionAuthority ? 'authority' : 'advisory'}</div></div><div className="text-[11px] font-bold" style={{ color: decisionTone(member.vote) }}>{actionKo(member.vote)}</div></div>)}{!members.length && <div className="rounded-[14px] border border-dashed border-white/10 p-4 text-[11px] text-[#66717a]">Council summary는 존재하지만 member vote가 현재 payload에 없습니다.</div>}</div><div className="mt-4 grid grid-cols-4 gap-3 border-t border-white/[0.06] pt-4"><Metric label="Approve" value={decision?.council?.approveCount ?? 0} accent={green} /><Metric label="Caution" value={decision?.council?.cautionCount ?? 0} accent={amber} /><Metric label="Reject" value={decision?.council?.rejectCount ?? 0} accent={red} /><Metric label="Abstain" value={decision?.council?.abstainCount ?? 0} /></div></section>

    <section className={cn(panel, 'mt-3 p-4')}><div className="flex items-center justify-between"><div className="text-[13px] font-semibold">Trade Map / Risk</div><ShieldCheck className="h-4 w-4 text-white/25" /></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Entry" value={formatKrw(decision?.tradeMap?.entryPrice)} /><Metric label="Stop" value={formatKrw(decision?.tradeMap?.stopLossPrice)} accent={red} /><Metric label="TP1" value={formatKrw(decision?.tradeMap?.takeProfit1Price)} accent={green} /><Metric label="TP2" value={formatKrw(decision?.tradeMap?.takeProfit2Price)} accent={green} /></div><div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4"><Metric label="RR1" value={finite(decision?.tradeMap?.riskReward1) ? `${decision?.tradeMap?.riskReward1?.toFixed(2)}R` : '—'} /><Metric label="RR2" value={finite(decision?.tradeMap?.riskReward2) ? `${decision?.tradeMap?.riskReward2?.toFixed(2)}R` : '—'} /><Metric label="Expected risk" value={percentLike(decision?.tradeMap?.expectedRiskPct)} /></div></section>

    <button type="button" onClick={onReplay} className="mt-3 flex w-full items-center justify-between rounded-[20px] border border-white/[0.1] bg-white/[0.035] px-4 py-4"><span className="text-[12px] font-semibold">Replay this decision lineage</span><ChevronRight className="h-4 w-4 text-white/30" /></button>
  </div></div>;
};

const replayPhase = (event: LedgerEvent) => {
  const type = event.eventType.toUpperCase();
  const name = event.eventName.toUpperCase();
  if (type === 'EVIDENCE' || name.includes('EVIDENCE')) return 'Evidence';
  if (type === 'STRATEGY' || name.includes('STRATEGY') || name.includes('ROUTER')) return 'Strategy';
  if (type === 'COUNCIL' || name.includes('COUNCIL')) return 'Council';
  if (name.includes('ARBITER') || name.includes('ADJUDICATOR')) return 'Arbiter';
  if (type === 'RISK' || name.includes('RISK')) return 'Risk';
  if (type === 'ORDER' || name.includes('ORDER')) return 'Order';
  if (type === 'TRADE' || name.includes('TRADE')) return 'Trade';
  if (type === 'OUTCOME' || name.includes('OUTCOME')) return 'Outcome';
  return null;
};

const ReplayScreen = ({ decision, events, onOutcome }: { decision: DecisionTapeItem | null; events: LedgerEvent[]; onOutcome: () => void }) => {
  const selectedMarket = decision?.market ?? null;
  const marketEvents = useMemo(() => events.filter((event) => !selectedMarket || event.market === selectedMarket), [events, selectedMarket]);
  const nearest = useMemo(() => {
    if (!decision || !marketEvents.length) return marketEvents[0] ?? null;
    return [...marketEvents].sort((a, b) => Math.abs(a.occurredAt - decision.timestamp) - Math.abs(b.occurredAt - decision.timestamp))[0] ?? null;
  }, [decision, marketEvents]);
  const traceId = extractTraceId(nearest);
  const replayEvents = useMemo(() => {
    const base = traceId ? marketEvents.filter((event) => extractTraceId(event) === traceId) : decision ? marketEvents.filter((event) => Math.abs(event.occurredAt - decision.timestamp) <= 12 * 60 * 60 * 1000) : marketEvents;
    return [...base].sort((a, b) => a.occurredAt - b.occurredAt).slice(-80);
  }, [decision, marketEvents, traceId]);
  const phases = ['Evidence', 'Strategy', 'Council', 'Arbiter', 'Risk', 'Order', 'Trade', 'Outcome'];
  const phaseMap = useMemo(() => new Map(phases.map((phase) => [phase, replayEvents.find((event) => replayPhase(event) === phase) ?? null])), [replayEvents]);
  const [cursor, setCursor] = useState(Math.max(0, replayEvents.length - 1));
  useEffect(() => setCursor(Math.max(0, replayEvents.length - 1)), [replayEvents.length, selectedMarket]);
  const current = replayEvents[cursor] ?? null;
  return <div className="h-full overflow-y-auto pb-28"><Header title="Decision Replay" subtitle={selectedMarket ? `${selectedMarket} · ${traceId ? 'canonical trace' : 'market-window fallback'}` : 'Trace unavailable'} /><div className="px-5">
    {!traceId && <div className="mb-3 rounded-[16px] border border-[#e6a640]/20 bg-[#e6a640]/[0.05] px-3 py-3 text-[10px] leading-5 text-[#b88f53]">이 시장 이벤트에서 explicit trace_id를 찾지 못했습니다. 현재 화면은 판단 시점 ±12시간의 market lineage이며 하나의 canonical trace라고 단정하지 않습니다.</div>}
    <section className={cn(panel, 'overflow-hidden p-4')}><div className="-mx-1 overflow-x-auto pb-1"><div className="flex min-w-[620px] items-start justify-between px-1">{phases.map((phase, index) => { const event = phaseMap.get(phase); const done = Boolean(event); return <div key={phase} className="flex w-[72px] flex-col items-center"><div className="relative flex w-full items-center justify-center">{index > 0 && <div className={cn('absolute right-1/2 h-[1px] w-full', done ? 'bg-[#24e878]/60' : 'bg-white/10')} />}<div className={cn('relative z-10 h-3 w-3 rounded-full border-2', done ? 'border-[#24e878] bg-[#0b0e11]' : 'border-white/20 bg-[#0b0e11]')} /></div><div className={cn('mt-2 text-[9px] font-semibold', done ? 'text-[#cbd2d6]' : 'text-[#4d575e]')}>{phase}</div><div className="mt-1 text-[8px] text-[#4f5960]">{event ? dateTime(event.occurredAt).split(' ').slice(-1)[0] : '—'}</div></div>; })}</div></div></section>

    <section className={cn(panel, 'mt-3 p-4')}><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] uppercase tracking-[0.13em] text-[#66717a]">Replay cursor</div><div className="mt-1 text-[18px] font-semibold">{current ? current.eventName : 'No lineage event'}</div></div>{current && <div className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] text-[#8a949b]">{replayPhase(current) ?? current.eventType}</div>}</div>{current && <><div className="mt-3 text-[11px] leading-5 text-[#8d979d]">{current.summary || current.reason || '별도 설명 없음'}</div><div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4"><Metric label="Authority" value={current.authority || '—'} /><Metric label="Execution" value={current.executionAuthority ? 'TRUE' : 'FALSE'} accent={current.executionAuthority ? green : '#8a949b'} /><Metric label="Source" value={current.source || '—'} /></div></>}</section>

    <section className={cn(panel, 'mt-3 p-4')}><div className="flex items-center justify-between"><div><div className="text-[13px] font-semibold">Timeline</div><div className="mt-1 text-[10px] text-[#66717a]">{replayEvents.length} canonical events in current replay scope</div></div><Clock3 className="h-4 w-4 text-white/25" /></div><input className="mt-5 w-full accent-white" type="range" min={0} max={Math.max(0, replayEvents.length - 1)} value={Math.min(cursor, Math.max(0, replayEvents.length - 1))} onChange={(event) => setCursor(Number(event.target.value))} disabled={!replayEvents.length} /><div className="mt-2 flex justify-between text-[9px] text-[#59636a]"><span>{replayEvents[0] ? dateTime(replayEvents[0].occurredAt) : '—'}</span><span>{replayEvents.at(-1) ? dateTime(replayEvents.at(-1)!.occurredAt) : '—'}</span></div></section>

    <section className="mt-3 space-y-2">{replayEvents.slice(Math.max(0, cursor - 2), cursor + 3).map((event, index) => <button type="button" key={event.id || event.eventKey} onClick={() => setCursor(replayEvents.indexOf(event))} className={cn('w-full rounded-[16px] border px-3 py-3 text-left', event === current ? 'border-white/20 bg-white/[0.05]' : 'border-white/[0.06] bg-white/[0.015]')}><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-semibold text-[#c8cfd3]">{event.eventName}</div><div className="mt-1 text-[9px] text-[#626d75]">{dateTime(event.occurredAt)} · {event.eventType}</div></div><span className="text-[9px]" style={{ color: event.executionAuthority ? green : '#69747c' }}>{event.executionAuthority ? 'AUTH' : 'SHADOW'}</span></div></button>)}</section>

    <button type="button" onClick={onOutcome} className="mt-4 flex w-full items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4"><span className="text-[12px] font-semibold">Open latest completed outcome</span><ChevronRight className="h-4 w-4 text-white/30" /></button>
  </div></div>;
};

const OutcomeScreen = ({ decision, trade, candles, onBack }: { decision: DecisionTapeItem | null; trade: ClosedTrade | null; candles: PriceCandle[]; onBack: () => void }) => {
  return <div className="h-full overflow-y-auto pb-28"><Header title="Trade Outcome" subtitle={trade?.market ?? decision?.market ?? 'Completed outcome unavailable'} onBack={onBack} /><div className="px-5">
    {!trade ? <div className={cn(panel, 'p-5 text-[12px] leading-6 text-[#7f8a92]')}>선택 시장에 완료된 거래가 없습니다. Outcome을 임의 생성하지 않습니다.</div> : <>
      <section className={cn(panel, 'p-4')}><div className="flex items-start justify-between"><div><div className="text-[9px] uppercase tracking-[0.13em] text-[#66717a]">Realized Return</div><div className="mt-1 text-[31px] font-semibold" style={{ color: trade.netPnl >= 0 ? green : red }}>{signedPct(trade.returnPct)}</div></div><div className={cn('rounded-full px-3 py-1.5 text-[9px] font-bold', trade.netPnl >= 0 ? 'bg-[#0c2f1b] text-[#39e982]' : 'bg-[#34171a] text-[#ff6973]')}>{trade.netPnl >= 0 ? 'PROFIT' : 'LOSS'}</div></div><div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-4"><Metric label="Entry" value={formatKrw(trade.entryPrice)} /><Metric label="Exit" value={formatKrw(trade.exitPrice)} /><Metric label="Net PnL" value={formatKrw(trade.netPnl)} accent={trade.netPnl >= 0 ? green : red} /><Metric label="Fees" value={formatKrw(trade.fees)} /></div></section>
      <section className={cn(panel, 'mt-3 overflow-hidden')}><div className="px-4 pt-4"><div className="text-[13px] font-semibold">Decision Map vs Actual</div><div className="mt-1 text-[10px] text-[#65717a]">현재 payload에서 확인 가능한 실제 가격·trade map만 비교합니다.</div></div><DecisionPriceChart candles={candles} decision={decision} /></section>
      <section className={cn(panel, 'mt-3 p-4')}><div className="text-[13px] font-semibold">Outcome evidence</div><div className="mt-4 grid grid-cols-2 gap-4"><Metric label="Opened" value={dateTime(trade.openedAt)} /><Metric label="Closed" value={dateTime(trade.closedAt)} /><Metric label="Exit reason" value={trade.exitReason || '—'} /><Metric label="Strategy version" value={trade.strategyVersion || '—'} /></div><div className="mt-4 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3 text-[10px] leading-5 text-[#7c878f]">수익 거래 여부는 실제 realized PnL로 표시합니다. 가격 분위수 containment·calibration error는 현재 payload에 해당 데이터가 없으므로 계산하지 않습니다.</div></section>
    </>}
  </div></div>;
};

const PortfolioScreen = ({ operations }: { operations: OperationsPayload | null }) => {
  const portfolio = operations?.portfolio;
  return <div className="h-full overflow-y-auto pb-28"><Header title="Portfolio" subtitle="Persisted Paper state" /><div className="px-5"><section className={cn(panel, 'p-5')}><div className="text-[10px] uppercase tracking-[0.14em] text-[#69747c]">Total Equity</div><div className="mt-2 text-[34px] font-semibold tracking-[-0.05em]">{formatKrw(portfolio?.equity)}</div><div className="mt-1 text-[13px] font-semibold" style={{ color: (operations?.performance?.totalReturnPct ?? 0) >= 0 ? green : red }}>{pct(operations?.performance?.totalReturnPct, true)}</div><div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4"><Metric label="Cash" value={formatKrw(portfolio?.cash)} /><Metric label="Drawdown" value={pct(portfolio?.currentDrawdownPct)} /><Metric label="Open" value={portfolio?.openPositions?.length ?? 0} /></div></section><section className="mt-4"><div className="mb-2 text-[11px] font-semibold text-[#89939a]">OPEN POSITIONS</div><div className="space-y-2">{portfolio?.openPositions?.map((position) => <div key={position.market} className={cn(panel, 'p-4')}><div className="flex items-start justify-between"><div><div className="text-[15px] font-semibold">{position.market}</div><div className="mt-1 text-[10px] text-[#68737b]">opened {timeAgo(position.openedAt)}</div></div><div className="text-right"><div className="text-[10px] text-[#68737b]">Average</div><div className="mt-1 text-[13px] font-semibold">{formatKrw(position.averageCost)}</div></div></div><div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4"><Metric label="Qty" value={position.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })} /><Metric label="Stop" value={formatKrw(position.stopLossPrice)} accent={red} /><Metric label="TP" value={formatKrw(position.takeProfitPrice)} accent={green} /></div></div>)}{!portfolio?.openPositions?.length && <div className={cn(panel, 'p-5 text-[11px] text-[#69747c]')}>열린 포지션이 없습니다.</div>}</div></section></div></div>;
};

const SystemScreen = ({ operations, factory, events }: { operations: OperationsPayload | null; factory: FactoryPayload | null; events: LedgerEvent[] }) => (
  <div className="h-full overflow-y-auto pb-28"><Header title="System" subtitle="Runtime · data · research observability" /><div className="px-5"><section className={cn(panel, 'p-4')}><div className="flex items-center justify-between"><div><div className="text-[13px] font-semibold">Runtime</div><div className="mt-1 text-[10px] text-[#69747c]">Read-only mobile operations shell</div></div><ShieldCheck className="h-4 w-4 text-white/25" /></div><div className="mt-4 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-4"><Metric label="Status" value={operations?.status ?? '—'} accent={operations?.status === 'OK' ? green : amber} /><Metric label="Mode" value={operations?.mode ?? '—'} /><Metric label="Cycles" value={operations?.loop?.cycleCount ?? '—'} /></div></section><section className={cn(panel, 'mt-3 p-4')}><div className="flex items-center justify-between"><div className="text-[13px] font-semibold">Data / Evidence</div><Database className="h-4 w-4 text-white/25" /></div><div className="mt-4 grid grid-cols-2 gap-4"><Metric label="Evidence active" value={operations?.ingestion?.evidenceActive ?? '—'} /><Metric label="External active" value={operations?.ingestion?.externalEvidenceActive ?? '—'} /><Metric label="NARS recent" value={operations?.ingestion?.narsInboxRecent ?? '—'} /><Metric label="Ledger events" value={events.length} /></div></section><section className={cn(panel, 'mt-3 p-4')}><div className="flex items-center justify-between"><div className="text-[13px] font-semibold">Strategy Factory</div><GitBranch className="h-4 w-4 text-white/25" /></div><div className="mt-4 grid grid-cols-2 gap-4"><Metric label="Latest market" value={factory?.latestRun?.market ?? '—'} /><Metric label="Candidates" value={factory?.latestRun?.candidate_count ?? '—'} /><Metric label="Timeframe" value={factory?.latestRun?.timeframe_minutes ? `${factory.latestRun.timeframe_minutes}m` : '—'} /><Metric label="Run ID" value={factory?.latestRun?.id ?? '—'} /></div></section><div className="mt-3 rounded-[16px] border border-white/[0.06] p-4 text-[10px] leading-5 text-[#657078]">이 UI는 Strategy Router, Council authority, Risk, Execution 또는 Paper runtime의 의사결정 규칙을 변경하지 않습니다. 누락 데이터는 추정하지 않고 비어 있는 상태로 표시합니다.</div></div></div>
);

const BottomNavigation = ({ tab, onChange }: { tab: MobileTab; onChange: (tab: MobileTab) => void }) => {
  const items: Array<{ id: MobileTab; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'oracle', label: 'Oracle', Icon: BrainCircuit },
    { id: 'traces', label: 'Traces', Icon: GitBranch },
    { id: 'portfolio', label: 'Portfolio', Icon: WalletCards },
    { id: 'system', label: 'System', Icon: Settings2 },
  ];
  return <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] bg-[#07090b]/95 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur-xl"><div className="grid grid-cols-4">{items.map(({ id, label, Icon }) => { const active = id === tab; return <button key={id} type="button" onClick={() => onChange(id)} className="flex min-h-[64px] flex-col items-center justify-center gap-1.5"><Icon className={cn('h-5 w-5', active ? 'text-white' : 'text-[#515b62]')} /><span className={cn('text-[9px] font-semibold', active ? 'text-white' : 'text-[#515b62]')}>{label}</span></button>; })}</div></nav>;
};

export const BlackOracleMobileApp: React.FC = () => {
  const [tab, setTab] = useState<MobileTab>('oracle');
  const [view, setView] = useState<View>('root');
  const [operations, setOperations] = useState<OperationsPayload | null>(null);
  const [factory, setFactory] = useState<FactoryPayload | null>(null);
  const [eventsPayload, setEventsPayload] = useState<EventsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [chart, setChart] = useState<ChartState>({ loading: false, payload: null });

  const load = useCallback(async () => {
    setLoading(true);
    const [operationsResult, factoryResult, eventsResult] = await Promise.allSettled([
      fetch('/api/trading-status', { cache: 'no-store' }).then((response) => response.json() as Promise<OperationsPayload>),
      fetch('/api/strategy-factory-status', { cache: 'no-store' }).then((response) => response.json() as Promise<FactoryPayload>),
      fetch('/api/events?limit=400', { cache: 'no-store' }).then((response) => response.json() as Promise<EventsPayload>),
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
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', visible); };
  }, [load]);

  const decisions = useMemo(() => [...(operations?.decisionTape ?? [])].sort((a, b) => b.timestamp - a.timestamp), [operations?.decisionTape]);
  const events = useMemo(() => [...(eventsPayload?.events ?? [])].sort((a, b) => b.occurredAt - a.occurredAt), [eventsPayload?.events]);
  const markets = useMemo(() => Array.from(new Set([
    ...decisions.map((item) => item.market),
    ...(operations?.portfolio?.openPositions ?? []).map((item) => item.market),
    ...(operations?.recentTrades ?? []).map((item) => item.market),
  ].filter(Boolean))).slice(0, 16), [decisions, operations?.portfolio?.openPositions, operations?.recentTrades]);

  useEffect(() => { if (!selectedMarket && markets[0]) setSelectedMarket(markets[0]); }, [markets, selectedMarket]);
  const decision = useMemo(() => selectedMarket ? decisions.find((item) => item.market === selectedMarket) ?? null : decisions[0] ?? null, [decisions, selectedMarket]);
  const latestTrade = useMemo(() => {
    const trades = (operations?.recentTrades ?? []).filter((item) => !selectedMarket || item.market === selectedMarket);
    return [...trades].sort((a, b) => b.closedAt - a.closedAt)[0] ?? null;
  }, [operations?.recentTrades, selectedMarket]);

  useEffect(() => {
    if (!selectedMarket || !/^KRW-[A-Z0-9]+$|^KRX-\d{6}$/.test(selectedMarket)) {
      setChart({ loading: false, payload: null });
      return;
    }
    let active = true;
    const isEquity = /^KRX-\d{6}$/.test(selectedMarket);
    const unit = isEquity ? 1440 : 240;
    setChart((current) => ({ ...current, loading: true }));
    fetch(`/api/market-chart?market=${encodeURIComponent(selectedMarket)}&unit=${unit}&count=80`, { cache: 'no-store' })
      .then((response) => response.json() as Promise<PriceChartPayload>)
      .then((payload) => { if (active) setChart({ loading: false, payload }); })
      .catch(() => { if (active) setChart({ loading: false, payload: { success: false, available: false, error: 'market chart request failed' } }); });
    return () => { active = false; };
  }, [selectedMarket]);

  const changeTab = (next: MobileTab) => { setTab(next); setView('root'); };
  const root = () => {
    if (tab === 'oracle') return <OracleScreen operations={operations} decision={decision} markets={markets} selectedMarket={selectedMarket} candles={chart.payload?.candles ?? []} chartLoading={chart.loading} onSelectMarket={setSelectedMarket} onDecision={() => setView('decision')} onReplay={() => changeTab('traces')} />;
    if (tab === 'traces') return <ReplayScreen decision={decision} events={events} onOutcome={() => setView('outcome')} />;
    if (tab === 'portfolio') return <PortfolioScreen operations={operations} />;
    return <SystemScreen operations={operations} factory={factory} events={events} />;
  };
  const screen = view === 'decision' ? <DecisionScreen decision={decision} factory={factory} onBack={() => setView('root')} onReplay={() => changeTab('traces')} /> : view === 'outcome' ? <OutcomeScreen decision={decision} trade={latestTrade} candles={chart.payload?.candles ?? []} onBack={() => setView('root')} /> : root();

  return <div className="relative h-[100dvh] w-full overflow-hidden bg-[#07090b] text-[#eef1f2]" style={{ colorScheme: 'dark' }}><AnimatePresence mode="wait"><motion.div key={`${tab}-${view}-${selectedMarket ?? 'none'}`} className="absolute inset-0" initial={{ opacity: 0, x: view === 'root' ? 0 : 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: view === 'root' ? 0 : -8 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>{screen}</motion.div></AnimatePresence><BottomNavigation tab={tab} onChange={changeTab} />{loading && <div className="pointer-events-none fixed right-4 top-[max(env(safe-area-inset-top),16px)] z-[70] rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[8px] font-semibold tracking-[0.12em] text-white/45 backdrop-blur">SYNC</div>}</div>;
};
