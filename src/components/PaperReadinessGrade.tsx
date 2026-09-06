import React, { useCallback, useEffect, useState } from 'react';
import type { OracleRatingResult } from '../trading';

type GradePayload = {
  available?: boolean;
  current?: { rating?: OracleRatingResult };
  surveillance?: {
    trend?: 'UP' | 'STABLE' | 'DOWN' | 'NEW';
    gradeStepChange?: number;
    consecutiveDowngrades?: number;
    downgradeEvents?: number;
  };
};

export const PaperReadinessGrade: React.FC = () => {
  const [payload, setPayload] = useState<GradePayload | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/trading-grade', { cache: 'no-store' });
      if (!response.ok) return;
      const next = await response.json() as GradePayload;
      setPayload(next);
    } catch {
      // A missing rating must not interrupt the operator shell.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const rating = payload?.current?.rating ?? null;
  if (!payload?.available || !rating) return <span className="hidden text-[6px] uppercase tracking-[0.08em] text-[#4f585f] md:inline">GRADE —</span>;

  const blocked = rating.appliedGateKeys.length > 0;
  const trend = payload?.surveillance?.trend ?? rating.trend;
  const consecutiveDowngrades = Number(payload?.surveillance?.consecutiveDowngrades ?? 0);
  const trendLabel = trend === 'DOWN' ? `▼${Math.max(1, Math.abs(Number(payload?.surveillance?.gradeStepChange ?? 1)))}` : trend === 'UP' ? '▲' : trend === 'STABLE' ? '→' : 'NEW';
  const downgradeAlert = trend === 'DOWN' || consecutiveDowngrades > 0;
  const title = [
    ...rating.reasons,
    `Trend: ${trendLabel}`,
    `Consecutive downgrades: ${consecutiveDowngrades}`,
    'Server-calculated and checkpoint-surveilled. Execution authority: false.',
  ].join('\n');

  return (
    <span className="hidden items-center gap-2 border-l border-[#202429] pl-2.5 text-[6px] uppercase tracking-[0.08em] md:flex" title={title}>
      <span className="text-[#59636b]">PAPER GRADE</span>
      <b className={`font-semibold ${downgradeAlert ? 'text-[#ff6262]' : blocked ? 'text-[#f3b642]' : 'text-[#62d49f]'}`}>{rating.grade}</b>
      <span className="text-[#59636b]">{rating.rawScore.toFixed(1)}</span>
      <span className={downgradeAlert ? 'text-[#ff6262]' : 'text-[#4f585f]'}>{trendLabel}</span>
      <span className="text-[#4f585f]">{rating.confidence}</span>
    </span>
  );
};
