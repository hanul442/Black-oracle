import React from 'react';
import { FlaskConical, ShieldCheck } from 'lucide-react';
import { InteractiveEquityPanel } from '../components/InteractiveEquityPanel';
import { RiskLabPanel } from '../components/RiskLabPanel';

export const LabView: React.FC = () => (
  <div className="h-full overflow-y-auto bg-[#05070A] pb-28 text-[#E9EDF1] md:pb-20">
    <div className="mx-auto max-w-[1520px] px-4 pt-5 md:px-6 xl:px-8">
      <header className="mb-4 flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.22em] text-[#C7A96B]">
            <FlaskConical className="h-3.5 w-3.5" /> Validation & experiment workspace
          </div>
          <h1 className="text-[28px] font-medium tracking-[-0.04em] md:text-[34px]">Lab</h1>
          <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-[#68737D] md:text-xs">
            Keep strategy validation, risk-profile comparison and experimental inspection outside the live supervision stream. Lab output has no direct order authority.
          </p>
        </div>

        <div className="flex items-center gap-2 border border-[#72B6A0]/20 bg-[#72B6A0]/[0.025] px-3 py-2 font-mono text-[6px] uppercase tracking-[0.12em] text-[#7DB6A4]">
          <ShieldCheck className="h-3 w-3" /> Human approval remains required for promotion
        </div>
      </header>
    </div>

    <RiskLabPanel />
    <InteractiveEquityPanel />

    <div className="mx-auto max-w-[1520px] px-4 pb-8 md:px-6 xl:px-8">
      <section className="border border-white/[0.065] bg-[#070A0E] p-4">
        <div className="font-mono text-[6px] uppercase tracking-[0.15em] text-[#59636D]">Experiment governance boundary</div>
        <div className="mt-3 grid gap-px bg-white/[0.04] sm:grid-cols-3">
          <LabBoundary title="EXPERIMENT" detail="Hypothesis, run and result contracts remain append-only and auditable." />
          <LabBoundary title="CHALLENGER" detail="Candidates may be evaluated but cannot automatically replace the Champion." />
          <LabBoundary title="PROMOTION" detail="Monte Carlo, reliability and explicit human approval remain mandatory gates." />
        </div>
      </section>
    </div>
  </div>
);

const LabBoundary = ({ title, detail }: { title: string; detail: string }) => (
  <div className="bg-[#070A0E] p-4">
    <div className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#C7A96B]">{title}</div>
    <p className="mt-2 text-[9px] leading-relaxed text-[#68737D]">{detail}</p>
  </div>
);
