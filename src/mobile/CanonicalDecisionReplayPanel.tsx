import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, GitBranch, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { LedgerEvent } from './v2/types';
import { cn, dateTime } from './v2/types';

type ReplayPayload = {
  success?: boolean;
  canonical?: boolean;
  replayVersion?: number;
  found?: boolean;
  runtimeId?: string;
  requestedTraceId?: string;
  completeThrough?: string;
  timeline?: LedgerEvent[];
  error?: string;
};

const traceIdFrom = (event: LedgerEvent): string | null => {
  const traceId = event.trace?.traceId;
  if (typeof traceId === 'string' && traceId.trim()) return traceId.trim();
  const linkedTraceId = event.links?.traceId;
  if (typeof linkedTraceId === 'string' && linkedTraceId.trim()) return linkedTraceId.trim();
  const entryTraceId = event.links?.entryTraceId;
  return typeof entryTraceId === 'string' && entryTraceId.trim() ? entryTraceId.trim() : null;
};

const tracePriority = (event: LedgerEvent) => {
  if (event.eventType === 'DECISION') return 5;
  if (event.eventType === 'RISK') return 4;
  if (event.eventType === 'ORDER') return 3;
  if (event.eventType === 'TRADE') return 2;
  if (event.eventType === 'OUTCOME') return 1;
  return 0;
};

const Row = ({ event, openEvent }: { event: LedgerEvent; openEvent: (event: LedgerEvent) => void }) => (
  <button
    type="button"
    onClick={() => openEvent(event)}
    className="flex min-h-12 w-full items-start gap-3 px-4 py-3 text-left active:bg-[#fafbfb]"
  >
    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#6f7b86]" />
    <div className="min-w-0 flex-1">
      <div className="text-[8px] font-semibold tracking-[0.1em] text-[#9aa1aa]">{event.eventType}</div>
      <div className="mt-1 line-clamp-2 text-[10px] leading-5 text-[#4f565f]">{event.summary || event.eventName}</div>
      <div className="mt-1 text-[8px] text-[#a3a9b0]">{dateTime(event.occurredAt)} · {event.source}</div>
    </div>
    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-[#b7bcc2]" />
  </button>
);

export const CanonicalDecisionReplayPanel = ({
  market,
  events,
  runtimeId,
  openEvent,
}: {
  market: string;
  events: LedgerEvent[];
  runtimeId?: string | null;
  openEvent: (event: LedgerEvent) => void;
}) => {
  const localContext = useMemo(
    () => events
      .filter((event) => event.market?.toUpperCase() === market.toUpperCase())
      .sort((a, b) => a.occurredAt - b.occurredAt)
      .slice(-16),
    [events, market],
  );

  const traceId = useMemo(() => {
    const candidates = localContext
      .map((event) => ({ event, traceId: traceIdFrom(event) }))
      .filter((item): item is { event: LedgerEvent; traceId: string } => Boolean(item.traceId))
      .sort((a, b) => tracePriority(b.event) - tracePriority(a.event) || b.event.occurredAt - a.event.occurredAt);
    return candidates[0]?.traceId ?? null;
  }, [localContext]);

  const [payload, setPayload] = useState<ReplayPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!traceId) {
      setPayload(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({ traceId });
        if (runtimeId) query.set('runtimeId', runtimeId);
        const response = await fetch(`/api/decision-replay?${query.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const next = await response.json() as ReplayPayload;
        if (!cancelled) setPayload(response.ok ? next : { ...next, found: false });
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === 'AbortError')) {
          setPayload({ found: false, error: error instanceof Error ? error.message : 'Decision Replay unavailable.' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [runtimeId, traceId]);

  const canonicalTimeline = payload?.canonical && payload.found ? (payload.timeline ?? []) : [];
  const canonicalReady = Boolean(traceId && payload?.canonical && payload.found);

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#e7e9ed] bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-[#eef0f2] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {canonicalReady ? <ShieldCheck className="h-4 w-4 text-[#16845b]" /> : <GitBranch className="h-4 w-4 text-[#6f7781]" />}
            <div className="text-[10px] font-semibold text-[#353b42]">
              {canonicalReady ? 'Canonical Decision Replay' : 'Market event context'}
            </div>
          </div>
          <div className="mt-1 text-[8px] leading-4 text-[#969da6]">
            {canonicalReady
              ? `Trace ${payload?.requestedTraceId ?? traceId} · complete through ${payload?.completeThrough ?? 'CURRENT_TRACE'}`
              : traceId
                ? loading
                  ? 'Canonical trace를 확인하는 중입니다.'
                  : 'Trace 후보는 있지만 canonical replay를 확인하지 못했습니다. 아래 항목을 Replay로 오인하지 않습니다.'
                : '이 시장의 현재 이벤트에는 replayable traceId가 없습니다. 아래는 종목 문맥용 canonical event 목록입니다.'}
          </div>
        </div>
        {canonicalReady && <span className="shrink-0 rounded-full border border-[#16845b]/20 bg-[#16845b]/[0.04] px-2.5 py-1 text-[8px] font-semibold text-[#16845b]">v{payload?.replayVersion ?? 2}</span>}
      </div>

      {!canonicalReady && traceId && !loading && payload?.error && (
        <div className="flex items-start gap-2 border-b border-[#efe3c9] bg-[#fffaf0] px-4 py-3 text-[8px] leading-4 text-[#8a6428]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{payload.error}</span>
        </div>
      )}

      <div className={cn('divide-y divide-[#eef0f2]', loading && 'opacity-70')}>
        {(canonicalReady ? canonicalTimeline : localContext).length
          ? (canonicalReady ? canonicalTimeline : localContext).map((event) => (
              <Row key={event.id} event={event} openEvent={openEvent} />
            ))
          : <div className="p-5 text-[10px] text-[#9299a2]">연결된 canonical event가 없습니다.</div>}
      </div>
    </div>
  );
};
