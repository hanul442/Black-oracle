import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Clock3 } from 'lucide-react';

type Accumulation = {
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
type Daily = {
  date?: string;
  cycles?: { count?: number; scanned?: number; entered?: number; exited?: number; noTrade?: number; marketErrors?: number };
  evidence?: { linkRate?: number };
  outcomes?: { closedTrades?: number; winRate?: number; netPnl?: number };
  research?: { councilResolved?: number; strategyResolved?: number; experimentsStarted?: number; experimentsCompleted?: number };
  grade?: { closing?: string | null; closingRawScore?: number | null };
};
type EmpiricalPayload = {
  available?: boolean;
  accumulation?: Accumulation;
  daily?: Daily;
  qualification?: {
    creditActive?: boolean;
    legacyCreditAllowed?: false;
    window?: {
      id?: string | null;
      status?: string;
      armedAt?: number | null;
      startedAt?: number | null;
      sourceRevision?: string | null;
      invalidationReasons?: string[];
    };
    accumulation?: Accumulation;
    daily?: Daily;
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
const windowTone = (status?: string) => status === 'COLLECTING' ? 'text-[#62d49f]' : status === 'INVALIDATED' ? 'text-[#ff6262]' : 'text-[#f3b642]';

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
  const daily = payload?.daily;
  const qualification = payload?.qualification;
  const qualified = qualification?.accumulation;
  const qSamples = qualified?.samples;
  const qDaily = qualification?.daily;
  const qActive = qualification?.creditActive === true;
  const window = qualification?.window;
  const failedGate = accumulation?.operationalGates?.find((gate) => gate.status === 'FAIL');
  const windowFailure = window?.invalidationReasons?.[0];

  return (
    <section className="shrink-0 border-b border-[#24282c] bg-[#050607] font-mono">
      <div className="flex h-6 items-center gap-2 border-b border-[#1b1f23] px-2.5 text-[6px] uppercase tracking-[0.08em]">
        <Activity className="h-3 w-3 text-[#f3a312]" />
        <span className="text-[#69737b]">EMPIRICAL PAPER</span>
        <span className={tone(accumulation?.disposition)}>{accumulation?.disposition || (payload?.available === false ? 'UNAVAILABLE' : '—')}</span>
        <span className="text-[#343c43]">|</span>
        <span className="text-[#69737b]">WINDOW</span>
        <span className={windowTone(window?.status)}>{window?.id || 'UNCONFIGURED'} · {window?.status || 'NOT_CONFIGURED'}</span>
        <span className="hidden max-w-[220px] truncate text-[#465058] lg:inline">{window?.sourceRevision ? `rev ${window.sourceRevision.slice(0, 12)}` : 'legacy credit disabled'}</span>
        {error && <span className="truncate text-[#ff6262]">{error}</span>}
        <span className="ml-auto flex items-center gap-1 text-[#465058]"><Clock3 className="h-2.5 w-2.5" />{daily?.date || '—'} KST</span>
      </div>
      <div className="grid grid-cols-4 gap-px bg-[#24282c] sm:grid-cols-6 xl:grid-cols-12">
        <Cell label="CYCLE AGE" value={age(runtime?.latestCycleAgeMs)} warn={accumulation?.disposition === 'STALLED'} />
        <Cell label="CYCLES 24H" value={`${integer(runtime?.cycles24h)}/${integer(runtime?.expectedCycles24hWindow)}`} />
        <Cell label="CADENCE" value={pct(runtime?.cycleCoverage24h)} warn={(runtime?.cycleCoverage24h ?? 1) < 0.85} />
        <Cell label="ERROR RATE" value={pct(runtime?.cycleErrorRate24h)} warn={(runtime?.cycleErrorRate24h ?? 0) > 0.03} />
        <Cell label="Q PBO ALIGNED" value={qActive ? `${integer(qSamples?.strategyAligned)}/${integer(qSamples?.pboTarget)}` : '0 / 60'} warn={!qActive} />
        <Cell label="Q PBO ETA" value={qActive ? eta(qSamples?.pboEtaHours) : 'NOT STARTED'} warn={!qActive} />
        <Cell label="Q COUNCIL" value={qActive ? `${integer(qSamples?.councilResolved)}/30` : '0 / 30'} warn={!qActive} />
        <Cell label="Q CLOSED" value={qActive ? `${integer(qSamples?.closedTrades)}/60` : '0 / 60'} warn={!qActive} />
        <Cell label="Q GRADE HIST" value={qActive ? `${integer(qSamples?.gradeSnapshots)}/24` : '0 / 24'} warn={!qActive} />
        <Cell label="Q EXPERIMENT" value={qActive ? integer(qSamples?.experimentTriedEvents) : '0'} warn={!qActive} />
        <Cell label="Q TODAY EVID" value={qActive ? pct(qDaily?.evidence?.linkRate) : '—'} warn={qActive && (qDaily?.evidence?.linkRate ?? 1) < 0.95} />
        <Cell label="Q TODAY P&L" value={qActive ? krw(qDaily?.outcomes?.netPnl) : '—'} warn={qActive && (qDaily?.outcomes?.netPnl ?? 0) < 0} />
      </div>
      <div className="flex h-5 items-center gap-3 overflow-hidden px-2.5 text-[5.5px] uppercase tracking-[0.07em] text-[#505960]">
        <span>raw today cycles {integer(daily?.cycles?.count)}</span>
        <span>qualified cycles {qActive ? integer(qDaily?.cycles?.count) : '0'}</span>
        <span>q strategy resolved {qActive ? integer(qDaily?.research?.strategyResolved) : '0'}</span>
        <span className="hidden sm:inline">q council resolved {qActive ? integer(qDaily?.research?.councilResolved) : '0'}</span>
        <span className="hidden md:inline">q grade {qActive ? (qDaily?.grade?.closing || '—') : 'NOT STARTED'}</span>
        {(windowFailure || failedGate) && <span className="ml-auto truncate text-[#ff6262]">{windowFailure || `${failedGate?.key}: ${failedGate?.reason}`}</span>}
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
