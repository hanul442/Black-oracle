import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Clock3 } from 'lucide-react';

type EmpiricalPayload = {
  available?: boolean;
  accumulation?: {
    disposition?: string;
    runtime?: {
      latestCycleAgeMs?: number | null;
      cycles24h?: number;
      expectedCycles24hWindow?: number;
      cycleCoverage24h?: number;
      cycleErrorRate24h?: number;
    };
    samples?: {
      strategyAligned?: number;
      pboTarget?: number;
      pboEtaHours?: number | null;
      councilResolved?: number;
      closedTrades?: number;
      gradeSnapshots?: number;
      experimentTriedEvents?: number;
    };
    operationalGates?: Array<{ key: string; status: string; reason: string }>;
  };
  daily?: {
    date?: string;
    cycles?: { count?: number; scanned?: number; entered?: number; exited?: number; noTrade?: number; marketErrors?: number };
    evidence?: { linkRate?: number };
    outcomes?: { closedTrades?: number; winRate?: number; netPnl?: number };
    research?: { councilResolved?: number; strategyResolved?: number; experimentsStarted?: number; experimentsCompleted?: number };
    grade?: { closing?: string | null; closingRawScore?: number | null };
  };
};

const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(1)}%`;
const integer = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : Math.trunc(value).toLocaleString();
const krw = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${Math.round(value).toLocaleString()} KRW`;
const age = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return '—';
  const minutes = value / 60_000;
  return minutes < 90 ? `${minutes.toFixed(0)}m` : `${(minutes / 60).toFixed(1)}h`;
};
const eta = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : value <= 0 ? 'READY' : value < 48 ? `${value.toFixed(1)}h` : `${(value / 24).toFixed(1)}d`;
const tone = (disposition?: string) => disposition === 'HEALTHY' ? 'text-[#62d49f]' : disposition === 'STALLED' || disposition === 'DEGRADED' ? 'text-[#ff6262]' : 'text-[#f3b642]';

export const EmpiricalValidationStrip: React.FC = () => {
  const [payload, setPayload] = useState<EmpiricalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/trading-empirical-validation', { cache: 'no-store' });
      const next = await response.json() as EmpiricalPayload & { error?: string };
      setPayload(next);
      setError(response.ok ? null : next.error || 'Empirical validation unavailable.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Empirical validation unavailable.');
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const accumulation = payload?.accumulation;
  const runtime = accumulation?.runtime;
  const samples = accumulation?.samples;
  const daily = payload?.daily;
  const failedGate = accumulation?.operationalGates?.find((gate) => gate.status === 'FAIL');

  return (
    <section className="shrink-0 border-b border-[#24282c] bg-[#050607] font-mono">
      <div className="flex h-6 items-center gap-2 border-b border-[#1b1f23] px-2.5 text-[6px] uppercase tracking-[0.08em]">
        <Activity className="h-3 w-3 text-[#f3a312]" />
        <span className="text-[#69737b]">EMPIRICAL PAPER</span>
        <span className={tone(accumulation?.disposition)}>{accumulation?.disposition || (payload?.available === false ? 'UNAVAILABLE' : '—')}</span>
        <span className="hidden text-[#465058] sm:inline">operational cadence and research sample accumulation are evaluated separately</span>
        {error && <span className="truncate text-[#ff6262]">{error}</span>}
        <span className="ml-auto flex items-center gap-1 text-[#465058]"><Clock3 className="h-2.5 w-2.5" />{daily?.date || '—'} KST</span>
      </div>
      <div className="grid grid-cols-4 gap-px bg-[#24282c] sm:grid-cols-6 xl:grid-cols-12">
        <Cell label="CYCLE AGE" value={age(runtime?.latestCycleAgeMs)} warn={accumulation?.disposition === 'STALLED'} />
        <Cell label="CYCLES 24H" value={`${integer(runtime?.cycles24h)}/${integer(runtime?.expectedCycles24hWindow)}`} />
        <Cell label="CADENCE" value={pct(runtime?.cycleCoverage24h)} warn={(runtime?.cycleCoverage24h ?? 1) < 0.85} />
        <Cell label="ERROR RATE" value={pct(runtime?.cycleErrorRate24h)} warn={(runtime?.cycleErrorRate24h ?? 0) > 0.03} />
        <Cell label="PBO ALIGNED" value={`${integer(samples?.strategyAligned)}/${integer(samples?.pboTarget)}`} />
        <Cell label="PBO ETA" value={eta(samples?.pboEtaHours)} />
        <Cell label="COUNCIL RES" value={`${integer(samples?.councilResolved)}/30`} />
        <Cell label="CLOSED" value={`${integer(samples?.closedTrades)}/60`} />
        <Cell label="GRADE HIST" value={`${integer(samples?.gradeSnapshots)}/24`} />
        <Cell label="EXPERIMENT" value={integer(samples?.experimentTriedEvents)} />
        <Cell label="TODAY EVID" value={pct(daily?.evidence?.linkRate)} warn={(daily?.evidence?.linkRate ?? 1) < 0.95} />
        <Cell label="TODAY P&L" value={krw(daily?.outcomes?.netPnl)} warn={(daily?.outcomes?.netPnl ?? 0) < 0} />
      </div>
      <div className="flex h-5 items-center gap-3 overflow-hidden px-2.5 text-[5.5px] uppercase tracking-[0.07em] text-[#505960]">
        <span>today cycles {integer(daily?.cycles?.count)}</span>
        <span>scan {integer(daily?.cycles?.scanned)}</span>
        <span>enter {integer(daily?.cycles?.entered)}</span>
        <span>exit {integer(daily?.cycles?.exited)}</span>
        <span>no-trade {integer(daily?.cycles?.noTrade)}</span>
        <span>strategy resolved {integer(daily?.research?.strategyResolved)}</span>
        <span className="hidden sm:inline">council resolved {integer(daily?.research?.councilResolved)}</span>
        <span className="hidden md:inline">grade {daily?.grade?.closing || '—'} / {daily?.grade?.closingRawScore?.toFixed?.(1) ?? '—'}</span>
        {failedGate && <span className="ml-auto truncate text-[#ff6262]">{failedGate.key}: {failedGate.reason}</span>}
      </div>
    </section>
  );
};

const Cell = ({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) => (
  <div className="min-w-0 bg-[#070809] px-2 py-1.5">
    <div className="truncate text-[5px] uppercase tracking-[0.08em] text-[#505960]">{label}</div>
    <div className={`mt-0.5 truncate text-[7.5px] ${warn ? 'text-[#f3b642]' : 'text-[#b8c0c6]'}`}>{value}</div>
  </div>
);
