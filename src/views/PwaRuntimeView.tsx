import React from 'react';
import { RuntimeHeartbeat } from '../components/RuntimeHeartbeat';

const Tile: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <div className="border border-[#202429] bg-[#060708] p-3 font-mono">
    <div className="text-[7px] uppercase tracking-[0.12em] text-[#5f6971]">{label}</div>
    <div className="mt-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#dce1e5]">{value}</div>
    <div className="mt-2 text-[8px] leading-4 text-[#737d85]">{note}</div>
  </div>
);

export const PwaRuntimeView: React.FC = () => (
  <div className="min-h-[100dvh] bg-[#030405] text-[#d9dde1]">
    <header className="border-b border-[#202429] bg-[#050607] px-4 py-4 font-mono">
      <div className="text-[8px] uppercase tracking-[0.18em] text-[#f3a312]">BLACK ORACLE</div>
      <h1 className="mt-1 text-[18px] font-semibold uppercase tracking-[0.08em]">PAPER Runtime Console</h1>
      <p className="mt-2 max-w-2xl text-[9px] leading-5 text-[#737d85]">
        Supabase-native PAPER migration status. This PWA does not execute live orders and does not depend on Vercel for runtime heartbeat.
      </p>
    </header>

    <RuntimeHeartbeat />

    <main className="mx-auto max-w-5xl p-3 sm:p-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Mode" value="PAPER ONLY" note="No exchange credential or LIVE order authority is exposed to this PWA." />
        <Tile label="Native Cadence" value="15 MIN" note="Supabase Cron invokes the isolated native shadow runtime every 15 minutes." />
        <Tile label="Evidence" value="SOURCE-BACKED" note="No qualifying Evidence means no new entry. Ambiguous evidence remains neutral." />
        <Tile label="Cutover" value="NOT YET" note="Legacy Vercel PAPER remains active until native cadence and outputs are compared." />
      </div>

      <section className="mt-3 border border-[#202429] bg-[#050607] p-4 font-mono">
        <div className="text-[7px] uppercase tracking-[0.12em] text-[#f3a312]">How to read this screen</div>
        <div className="mt-3 grid gap-3 text-[9px] leading-5 text-[#8a949c] sm:grid-cols-2">
          <p><b className="text-[#62d49f]">RUNNING</b> means a persisted cycle was observed within the expected cadence. It is proof of runtime activity, not proof of profitability.</p>
          <p><b className="text-[#ff6262]">STALLED</b> means no persisted activity was seen for more than 25 minutes. The operator should investigate before trusting new PAPER results.</p>
          <p><b className="text-[#f3b642]">DEGRADED</b> means the latest scheduler or cycle reported an error. New entries remain fail-closed under the governed trading policy.</p>
          <p><b className="text-[#dce1e5]">LEGACY / NATIVE</b> are shown side-by-side until the Supabase-native runtime earns cutover approval.</p>
        </div>
      </section>

      <section className="mt-3 border border-[#202429] bg-[#050607] p-4 font-mono">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[7px] uppercase tracking-[0.12em] text-[#5f6971]">Authority boundary</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[#dce1e5]">PWA = OBSERVE / Supabase = PAPER RUNTIME</div>
          </div>
          <div className="border border-[#5a4418] px-2 py-1 text-[7px] uppercase tracking-[0.1em] text-[#f3a312]">LIVE DISABLED</div>
        </div>
      </section>
    </main>
  </div>
);
