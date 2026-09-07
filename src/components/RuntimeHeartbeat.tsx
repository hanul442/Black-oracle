import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type RuntimeState = 'RUNNING' | 'DEGRADED' | 'STALLED' | 'BLOCKED' | 'UNKNOWN';

type RuntimeHeartbeatPayload = {
  success: boolean;
  state: RuntimeState;
  reason?: string;
  runtimeId?: string;
  transport?: 'LEGACY_VERCEL_BRIDGE' | 'SUPABASE_NATIVE_SHADOW' | 'UNKNOWN';
  lastActivityAt?: number | null;
  ageMs?: number | null;
  cycleCount?: number | null;
  lastCycle?: {
    startedAt: number | null;
    finishedAt: number | null;
    scanned: number;
    entered: number;
    exited: number;
    held: number;
    noTrade: number;
    errors: number;
  } | null;
  scheduler?: {
    enabled: boolean;
    lastOk: boolean | null;
    lastHttpStatus: number | null;
  } | null;
};

const DEFAULT_SUPABASE_URL = 'https://dzbsxxoumlylyfhtmjnk.supabase.co';
const STATUS_FUNCTION = '/functions/v1/black-oracle-runtime-status';

const ageText = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 60_000) return `${Math.max(0, Math.round(value / 1000))}s`;
  if (value < 3_600_000) return `${Math.round(value / 60_000)}m`;
  return `${(value / 3_600_000).toFixed(1)}h`;
};

const stateTone: Record<RuntimeState, string> = {
  RUNNING: 'text-[#62d49f]',
  DEGRADED: 'text-[#f3b642]',
  STALLED: 'text-[#ff6262]',
  BLOCKED: 'text-[#ff6262]',
  UNKNOWN: 'text-[#77818a]',
};

export const RuntimeHeartbeat: React.FC = () => {
  const [data, setData] = useState<RuntimeHeartbeatPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const endpoint = useMemo(() => {
    const configured = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
    return `${configured || DEFAULT_SUPABASE_URL}${STATUS_FUNCTION}`;
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const payload = await response.json() as RuntimeHeartbeatPayload;
      if (!response.ok || payload.success !== true) {
        throw new Error(payload.reason || `Runtime heartbeat failed (${response.status}).`);
      }
      setData(payload);
      setError(null);
      setFetchedAt(Date.now());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Runtime heartbeat request failed.');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
    const timer = globalThis.window?.setInterval(() => void load(), 30_000);
    return () => {
      if (timer != null) globalThis.window?.clearInterval(timer);
    };
  }, [load]);

  const state: RuntimeState = error ? 'UNKNOWN' : data?.state || 'UNKNOWN';
  const cycle = data?.lastCycle;
  const transport = data?.transport === 'SUPABASE_NATIVE_SHADOW'
    ? 'NATIVE SHADOW'
    : data?.transport === 'LEGACY_VERCEL_BRIDGE'
      ? 'LEGACY BRIDGE'
      : 'UNKNOWN';

  return (
    <div className="flex min-h-8 shrink-0 items-center gap-3 overflow-x-auto border-b border-[#202429] bg-[#050607] px-2.5 font-mono text-[7px] uppercase tracking-[0.08em]">
      <span className="text-[#505960]">ENGINE</span>
      <span className={`font-semibold ${stateTone[state]}`}>● {loading && !data ? 'CHECKING' : state}</span>
      <span className="text-[#30363b]">|</span>
      <span className="text-[#7b858d]">PATH <b className="font-normal text-[#c3c9ce]">{transport}</b></span>
      <span className="text-[#7b858d]">CYCLE <b className="font-normal text-[#c3c9ce]">#{data?.cycleCount ?? '—'}</b></span>
      <span className="text-[#7b858d]">AGE <b className={`font-normal ${state === 'STALLED' ? 'text-[#ff6262]' : 'text-[#c3c9ce]'}`}>{ageText(data?.ageMs)}</b></span>
      <span className="text-[#7b858d]">LAST <b className="font-normal text-[#c3c9ce]">{cycle ? `${cycle.entered}E/${cycle.exited}X/${cycle.noTrade}N/${cycle.errors}ERR` : '—'}</b></span>
      <span className="hidden max-w-[460px] truncate text-[#606a72] md:inline">{error || data?.reason || 'Waiting for persisted runtime telemetry.'}</span>
      <span className="ml-auto flex items-center gap-2 text-[#545d65]">
        <span>{fetchedAt ? new Date(fetchedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span>
        <button
          type="button"
          onClick={() => { setLoading(true); void load(); }}
          className="flex items-center gap-1 border border-[#2a2f34] px-1.5 py-1 text-[#858e96] hover:border-[#5a4418] hover:text-[#f3a312]"
          aria-label="Refresh runtime heartbeat"
        >
          <RefreshCw className={`h-2.5 w-2.5 ${loading ? 'animate-spin' : ''}`} />
          CHECK
        </button>
      </span>
    </div>
  );
};
