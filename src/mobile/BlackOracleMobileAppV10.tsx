import React, { useState } from 'react';
import { ArrowLeft, Workflow } from 'lucide-react';
import { BlackOracleMobileApp as BlackOracleMobileAppV9 } from './BlackOracleMobileAppV9';
import { PositionMonitor } from './PositionMonitor';
import { InvestmentCyclePanel } from './v10/InvestmentCyclePanel';
import { InvestmentCycleLivePanel } from './v10/InvestmentCycleLivePanel';
import { V10ReadinessCard } from './v10/V10ReadinessCard';

export const BlackOracleMobileApp = () => {
  const [cycleOpen, setCycleOpen] = useState(false);

  return <div className="relative h-[100dvh] w-full overflow-hidden bg-[#f6f7f9]">
    <BlackOracleMobileAppV9 />
    <PositionMonitor />

    {!cycleOpen && <button
      type="button"
      onClick={() => setCycleOpen(true)}
      className="fixed bottom-[92px] right-4 z-[70] flex h-12 items-center gap-2 rounded-full border border-[#dfe3e7] bg-[#17191e] px-4 text-[10px] font-semibold text-white shadow-[0_8px_26px_rgba(16,20,24,0.16)] active:scale-[0.985]"
      aria-label="Investment Cycle 열기"
    >
      <Workflow className="h-4 w-4" />
      Cycle
    </button>}

    {cycleOpen && <div className="fixed inset-0 z-[90] overflow-y-auto overscroll-contain bg-[#f6f7f9]">
      <div className="sticky top-0 z-20 border-b border-[#e8ebee] bg-white/96 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setCycleOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e7ea] bg-white" aria-label="Investment Cycle 닫기"><ArrowLeft className="h-4 w-4" /></button>
          <div><div className="text-[9px] font-semibold tracking-[0.16em] text-[#9ba1a9]">DECISION SYSTEM</div><div className="mt-0.5 text-[19px] font-semibold tracking-[-0.035em] text-[#15171c]">Investment Cycle</div></div>
        </div>
      </div>
      <InvestmentCycleLivePanel />
      <div className="px-4"><V10ReadinessCard /></div>
      <InvestmentCyclePanel />
    </div>}
  </div>;
};
