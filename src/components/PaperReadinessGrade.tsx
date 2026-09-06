import React, { useCallback, useEffect, useState } from 'react';
import { buildPaperReadinessRating, type OracleRatingResult } from '../trading';

type TradingStatus = any;

const buildFromStatus = (status: TradingStatus): OracleRatingResult | null => {
  if (!status?.available) return null;
  const integrity = status.integrity || {};
  const historical = status.historicalValidation || {};
  const promotion = status.promotionAudit || {};

  return buildPaperReadinessRating({
    evidenceCoverage: typeof promotion.evidenceCoverage === 'number' ? promotion.evidenceCoverage : null,
    auditAverage: typeof promotion.auditAverage === 'number' ? promotion.auditAverage : null,
    historicalVerdict: historical.verdict || 'INSUFFICIENT_DATA',
    walkForwardVerdict: status.walkForwardValidation?.verdict || 'INSUFFICIENT_DATA',
    monteCarloVerdict: status.validation?.verdict || 'INSUFFICIENT_DATA',
    integrityCoverageDays: Number(integrity.coverageDays || 0),
    integrityRequiredDays: Number(integrity.requiredCoverageDays || 14),
    integrityCoverageComplete: integrity.coverageComplete === true,
    fatalRuntimeIncidents: typeof integrity.fatalRuntimeIncidents === 'number' ? integrity.fatalRuntimeIncidents : null,
    unresolvedCriticalIncidents: typeof integrity.unresolvedCriticalIncidents === 'number' ? integrity.unresolvedCriticalIncidents : null,
    runtimeHealthy: status.status === 'OK',
    closedTrades: Number(status.performance?.trades ?? status.validation?.tradeCount ?? 0),
    requiredClosedTrades: 60,
    observationDays: Number(historical.observationDays || 0),
    requiredObservationDays: 14,
  });
};

export const PaperReadinessGrade: React.FC = () => {
  const [rating, setRating] = useState<OracleRatingResult | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/trading-status', { cache: 'no-store' });
      if (!response.ok) return;
      const status = await response.json();
      setRating(buildFromStatus(status));
    } catch {
      // A missing rating must not interrupt the operator shell.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (!rating) return <span className="hidden text-[6px] uppercase tracking-[0.08em] text-[#4f585f] md:inline">GRADE —</span>;

  const blocked = rating.appliedGateKeys.length > 0;
  return (
    <span className="hidden items-center gap-2 border-l border-[#202429] pl-2.5 text-[6px] uppercase tracking-[0.08em] md:flex" title={rating.reasons.join('\n')}>
      <span className="text-[#59636b]">PAPER GRADE</span>
      <b className={`font-semibold ${blocked ? 'text-[#f3b642]' : 'text-[#62d49f]'}`}>{rating.grade}</b>
      <span className="text-[#59636b]">{rating.rawScore.toFixed(1)}</span>
      <span className="text-[#4f585f]">{rating.confidence}</span>
    </span>
  );
};
