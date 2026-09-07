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
  lastCycle?: { startedAt: number | null; finishedAt: number | null; scanned: number; entered: number; exited: number; held: number; noTrade: number; errors: number } | null;
  scheduler?: { enabled: boolean; lastOk: boolean | null; lastHttpStatus: number | null } | null;
};

type RuntimeSlot = { key: 'legacy' | 'native'; label: string; runtime: string | null };
const DEFAULT_SUPABASE_URL = 'https://dzbsxxoumlylyfhtmjnk.supabase.co';
const STATUS_FUNCTION = '/functions/v1/black-oracle-runtime-status';
const SLOTS: RuntimeSlot[] = [
  { key: 'legacy', label: 'LEGACY', runtime: null },
  { key: 'native', label: 'NATIVE', runtime: 'black-oracle-paper-native-shadow' },
];

const ageText = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 60_000) return `${Math.max(0, Math.round(value / 1000))}s`;
  if (value < 3_600_000) return `${Math.round(value / 60_000)}m`;
  return `${(value / 3_600_000).toFixed(1)}h`;
};
const stateTone: Record<RuntimeState, string> = {
  RUNNING: 'text-[#62d49f]', DEGRADED: 'text-[#f3b642]', STALLED: 'text-[#ff6262]', BLOCKED: 'text-[#ff6262]', UNKNOWN: 'text-[#77818a]',
};

export const RuntimeHeartbeat: React.FC = () => {
  const [data, setData] = useState<Record<string, RuntimeHeartbeatPayload | null>>({ legacy: null, native: null });
  const [errors, setErrors] = useState<Record<string, string | null>>({ legacy: null, native: null });
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const baseEndpoint = useMemo(() => {
    const configured = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
    return `${configured || DEFAULT_SUPABASE_URL}${STATUS_FUNCTION}`;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(SLOTS.map(async (slot) => {
      try {
        const url = new URL(baseEndpoint);
        if (slot.runtime) url.searchParams.set('runtime', slot.runtime);
        const response = await fetch(url.toString(), { cache: 'no-store' });
        const payload = await response.json() as RuntimeHeartbeatPayload;
        if (!response.ok || payload.success !== true) throw new Error(payload.reason || `Heartbeat failed (${response.status}).`);
        return { slot, payload, error: null as string | null };
      } catch (error) {
        return { slot, payload: null, error: error instanceof Error ? error.message : 'Heartbeat failed.' };
      }
    }));
    setData(Object.fromEntries(results.map((item) => [item.slot.key, item.payload])));
    setErrors(Object.fromEntries(results.map((item) => [item.slot.key, item.error])));
    setFetchedAt(Date.now());
    setLoading(false);
  }, [baseEndpoint]);

  useEffect(() => {
    void load();
    const timer = globalThis.window?.setInterval(() => void load(), 30_000);
    return () => { if (timer != null) globalThis.window?.clearInterval(timer); };
  }, [load]);

  return (
    <div className="flex min-h-8 shrink-0 items-center gap-2 overflow-x-auto border-b border-[#202429] bg-[#050607] px-2.5 font-mono text-[7px] uppercase tracking-[0.08em]">
      <span className="text-[#505960]">RUNTIME</span>
      {SLOTS.map((slot) => {
        const item = data[slot.key];
        const error = errors[slot.key];
        const state: RuntimeState = error ? 'UNKNOWN' : item?.state || 'UNKNOWN';
        const cycle = item?.lastCycle;
        return (
          <div key={slot.key} className="flex min-w-max items-center gap-2 border-l border-[#24282c] pl-2 first:border-l-0 first:pl-0">
            <span className="text-[#77818a]">{slot.label}</span>
            <span className={`font-semibold ${stateTone[state]}`}>● {loading && !item ? 'CHECKING' : state}</span>
            <span className="text-[#7b858d]">#{item?.cycleCount ?? '—'}</span>
            <span className={state === 'STALLED' ? 'text-[#ff6262]' : 'text-[#9ba3aa]'}>{ageText(item?.ageMs)}</span>
            <span className="text-[#7b858d]">{cycle ? `${cycle.entered}E/${cycle.exited}X/${cycle.noTrade}N/${cycle.errors}ERR` : '—'}</span>
            {error && <span className="max-w-52 truncate text-[#ff6262]">{error}</span>}
          </div>
        );
      })}
      <span className="ml-auto flex min-w-max items-center gap-2 text-[#545d65]">
        <span>{fetchedAt ? new Date(fetchedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span>
        <button type="button" onClick={() => void load()} className="flex items-center gap-1 border border-[#2a2f34] px-1.5 py-1 text-[#858e96] hover:border-[#5a4418] hover:text-[#f3a312]" aria-label="Refresh runtime heartbeats">
          <RefreshCw className={`h-2.5 w-2.5 ${loading ? 'animate-spin' : ''}`} />CHECK
        </button>
      </span>
    </div>
  );
};
