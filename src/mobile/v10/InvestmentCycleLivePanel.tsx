import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Check, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  projectInvestmentCycleEvents,
  type CanonicalCycleEventLike,
  type InvestmentCycleStageStatus,
} from '../../trading/investmentCycleReadModel';
import { HORIZON_STRATEGY_POLICIES } from '../../trading/horizonPolicy';

const card = 'rounded-[24px] border border-[#e6e9ed] bg-white';
const statusClass: Record<InvestmentCycleStageStatus, string> = {
  LIVE: 'border-[#d9e7dd] bg-[#f3f8f4] text-[#447151]',
  STALE: 'border-[#ebe1cc] bg-[#fffaf1] text-[#8a6a2f]',
  WAITING: 'border-[#e5e8eb] bg-[#f7f8f9] text-[#858d96]',
};

const relativeAge = (timestamp: number | null, now: number) => {
  if (!timestamp) return 'No event';
  const diff = Math.max(0, now - timestamp);
  if (diff < 60_000) return 'now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / 60 / 60_000)}h ago`;
  return `${Math.floor(diff / 24 / 60 / 60_000)}d ago`;
};

const shortRuntime = (value?: string | null) => {
  const text = String(value ?? '').trim();
  if (!text) return 'UNSCOPED';
  return text.replace('black-oracle-', '').replace('paper-', '');
};

export const InvestmentCycleLivePanel = () => {
  const [events, setEvents] = useState<CanonicalCycleEventLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/events?runtimeId=ALL&limit=500', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Canonical Ledger ${response.status}`);
      const payload = await response.json();
      if (!payload?.success || !Array.isArray(payload?.events)) throw new Error('Canonical Ledger response is invalid.');
      setEvents(payload.events);
      setError(null);
      setRefreshedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Canonical Ledger read failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const model = useMemo(() => projectInvestmentCycleEvents(events, { now: refreshedAt, activityLimit: 8 }), [events, refreshedAt]);
  const liveStages = model.stages.filter((stage) => stage.status === 'LIVE').length;
  const waitingStages = model.stages.filter((stage) => stage.status === 'WAITING').length;
  const runtimeCount = Object.keys(model.runtimeBreakdown).length;

  return <section className="mt-4 px-4 text-[#111318]">
    <div className={card + ' overflow-hidden'}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-semibold tracking-[0.16em] text-[#979ea7]"><Activity className="h-3.5 w-3.5" />CANONICAL LIVE READ MODEL</div>
            <div className="mt-2 text-[23px] font-semibold tracking-[-0.045em]">Cycle operations</div>
            <div className="mt-1.5 text-[10px] leading-5 text-[#808892]">설명용 상태가 아니라 Canonical Ledger에 실제 기록된 이벤트만 표시합니다.</div>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e3e6e9] bg-[#fafbfc] text-[#66707a] disabled:opacity-50" aria-label="Cycle 상태 새로고침"><RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')} /></button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#eef0f2] pt-4">
          <div><div className="text-[8px] text-[#a0a6ad]">Live stages</div><div className="mt-1 text-[18px] font-semibold tracking-[-0.04em]">{liveStages}<span className="text-[10px] font-medium text-[#a0a6ad]"> / {model.stages.length}</span></div></div>
          <div><div className="text-[8px] text-[#a0a6ad]">Waiting</div><div className="mt-1 text-[18px] font-semibold tracking-[-0.04em]">{waitingStages}</div></div>
          <div><div className="text-[8px] text-[#a0a6ad]">Runtimes seen</div><div className="mt-1 text-[18px] font-semibold tracking-[-0.04em]">{runtimeCount}</div></div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[8px] text-[#a0a6ad]"><span>Ledger refresh · {relativeAge(refreshedAt, Date.now())}</span><span>Latest event · {relativeAge(model.latestEventAt, refreshedAt)}</span></div>
      </div>

      {error && <div className="border-t border-[#eee3d6] bg-[#fffaf4] px-5 py-3 text-[9px] leading-4 text-[#8a6939]"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>Live read degraded: {error}. 기존 화면 값으로 실제 운용 상태를 추정하지 않습니다.</span></div></div>}
    </div>

    <div className="mt-6">
      <div className="mb-3 flex items-end justify-between"><div><div className="text-[16px] font-semibold tracking-[-0.025em]">Stage monitor</div><div className="mt-1 text-[9px] text-[#959ba3]">legacy deterministic Council은 V10 Committee로 계산하지 않습니다.</div></div><div className="text-[8px] font-semibold text-[#9ca2aa]">12 STAGES</div></div>
      <div className="space-y-2">{model.stages.map((stage, index) => <div key={stage.id} className={card + ' px-4 py-3.5'}>
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f4f6f8] text-[8px] font-semibold text-[#858c95]">{String(index + 1).padStart(2, '0')}</div>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-[11px] font-semibold text-[#33383f]">{stage.label}</span><span className={'rounded-full border px-2 py-0.5 text-[7px] font-bold ' + statusClass[stage.status]}>{stage.status}</span></div><div className="mt-1 text-[8px] text-[#9aa1a9]">{stage.count} event{stage.count === 1 ? '' : 's'} · {stage.markets} markets · {relativeAge(stage.latestAt, refreshedAt)}</div></div>
          {stage.status === 'LIVE' ? <Check className="h-3.5 w-3.5 text-[#5f8a69]" /> : <Clock3 className="h-3.5 w-3.5 text-[#aeb4bb]" />}
        </div>
      </div>)}</div>
    </div>

    <div className="mt-6">
      <div className="mb-3"><div className="text-[16px] font-semibold tracking-[-0.025em]">Candidate funnel</div><div className="mt-1 text-[9px] text-[#959ba3]">관측 후보가 Council을 거쳐 실제 생존 후보로 좁혀지는 정도.</div></div>
      <div className={card + ' p-4'}>
        <div className="grid grid-cols-5 gap-1.5">{[
          ['Observed', model.funnel.universeObserved],
          ['Nominated', model.funnel.nominated],
          ['Reviewed', model.funnel.crossReviewed],
          ['Survived', model.funnel.survived],
          ['Executable', model.funnel.executablePlan],
        ].map(([label, value]) => <div key={String(label)} className="rounded-[14px] border border-[#eceef1] bg-[#fafbfc] px-2 py-3 text-center"><div className="text-[15px] font-semibold tracking-[-0.035em]">{value}</div><div className="mt-1 text-[7px] text-[#9299a1]">{label}</div></div>)}</div>
        <div className="mt-3 flex items-center justify-between border-t border-[#eef0f2] pt-3 text-[9px]"><span className="text-[#8b929b]">Paper trades / outcomes in current ledger window</span><span className="font-semibold text-[#42484f]">{model.funnel.trades} / {model.funnel.outcomes}</span></div>
      </div>
    </div>

    <div className="mt-6">
      <div className="mb-3"><div className="text-[16px] font-semibold tracking-[-0.025em]">Horizon coverage</div><div className="mt-1 text-[9px] text-[#959ba3]">trace에 horizon이 명시된 이벤트만 집계합니다.</div></div>
      <div className="grid grid-cols-5 gap-1.5">{model.horizons.map((item) => <div key={item.horizon} className={card + ' px-2 py-3 text-center'}><div className="text-[9px] font-semibold leading-3 text-[#454b52]">{HORIZON_STRATEGY_POLICIES[item.horizon].label}</div><div className="mt-2 text-[14px] font-semibold">{item.count}</div><div className="mt-1 text-[7px] text-[#9ba2aa]">{item.count ? relativeAge(item.latestAt, refreshedAt) : 'No trace'}</div></div>)}</div>
    </div>

    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#69737d]" /><div className="text-[16px] font-semibold tracking-[-0.025em]">Current blockers</div></div>
      <div className={card + ' divide-y divide-[#eef0f2]'}>{model.blockers.length ? model.blockers.slice(0, 8).map((blocker, index) => <div key={`${blocker}-${index}`} className="flex gap-2 px-4 py-3"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a57a3e]" /><div className="text-[9px] leading-4 text-[#777f88]">{blocker}</div></div>) : <div className="flex gap-2 px-4 py-4"><Check className="h-3.5 w-3.5 text-[#5d8767]" /><div className="text-[9px] text-[#68716f]">No canonical V10 stage blocker is visible in the current event window.</div></div>}</div>
    </div>

    <div className="mt-6 pb-2">
      <div className="mb-3"><div className="text-[16px] font-semibold tracking-[-0.025em]">Latest canonical activity</div><div className="mt-1 text-[9px] text-[#959ba3]">최근 이벤트를 runtime과 함께 확인합니다.</div></div>
      <div className={card + ' divide-y divide-[#eef0f2]'}>{model.latestActivity.length ? model.latestActivity.map((event, index) => <div key={`${event.eventName}-${event.occurredAt}-${index}`} className="px-4 py-3"><div className="flex items-center justify-between gap-3"><div className="truncate text-[9px] font-semibold text-[#454b52]">{event.eventName}</div><div className="shrink-0 text-[7px] text-[#a0a6ad]">{relativeAge(Number(event.occurredAt), refreshedAt)}</div></div><div className="mt-1 flex items-center gap-2 text-[8px] text-[#939aa2]"><span>{event.market || 'SYSTEM'}</span><span>·</span><span>{event.action || event.eventType}</span><span>·</span><span className="truncate">{shortRuntime(event.runtimeId)}</span></div></div>) : <div className="px-4 py-5 text-[9px] text-[#949ba3]">Canonical event가 아직 없습니다. 빈 상태를 임의의 샘플 데이터로 채우지 않습니다.</div>}</div>
    </div>
  </section>;
};
