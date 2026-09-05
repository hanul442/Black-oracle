import React, { useEffect, useMemo, useState } from 'react';
import { FlaskConical, GitCompareArrows, ShieldCheck, TrendingDown, Zap } from 'lucide-react';

type MonteCarloValidation = {
  verdict: 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';
  available: boolean;
  tradeCount: number;
  survivalProbability: number | null;
  ruinProbability: number | null;
  terminalReturn: { p05: number | null; median: number | null; p95: number | null };
  maxDrawdown: { p05: number | null; median: number | null; p95: number | null; worst: number | null };
};

type RiskLabItem = {
  profile: {
    id: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';
    label: string;
    maxPositionPct: number;
    maxOpenPositions: number;
    grossExposureCapPct: number;
    cryptoClusterExposureCapPct: number;
    maxDailyLossPct: number;
    maxTotalDrawdownPct: number;
    executionAuthority: false;
  };
  validation: MonteCarloValidation;
  normalizedTradeCount: number;
  normalization: {
    source: 'POSITION_RETURN';
    output: 'ACCOUNT_IMPACT_RETURN';
    allocationAssumptionPct: number;
    concurrencyModeled: false;
    correlationModeled: false;
  };
  promotionAuthority: false;
};

type ExposureAssessment = {
  equity: number;
  grossExposure: number;
  grossExposurePct: number;
  cryptoClusterExposure: number;
  cryptoClusterExposurePct: number;
  positionCount: number;
  maxSinglePositionPct: number;
  grossCapBreached: boolean;
  cryptoClusterCapBreached: boolean;
  pairwiseCorrelation: {
    available: boolean;
    average: number | null;
    maximum: number | null;
    pairCount: number;
    reason: string;
  };
  disposition: 'PASS' | 'WATCH' | 'REJECT';
  reasons: string[];
  executionAuthority: false;
};

type ExposureLabItem = {
  profileId: RiskLabItem['profile']['id'];
  profileLabel: string;
  assessment: ExposureAssessment;
};

type StatusPayload = {
  riskLab?: RiskLabItem[];
  exposureLab?: ExposureLabItem[];
  correlation?: {
    alignedReturnObservations: number;
    markets: string[];
    available: boolean;
  };
};

const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(1)}%`;
const corr = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : value.toFixed(2);

const verdictTone = (verdict: MonteCarloValidation['verdict'] | ExposureAssessment['disposition']) => {
  if (verdict === 'PASS') return 'text-[#72B6A0] border-[#72B6A0]/25';
  if (verdict === 'WATCH') return 'text-[#C7A96B] border-[#C7A96B]/25';
  if (verdict === 'REJECT') return 'text-[#D66565] border-[#D66565]/25';
  return 'text-[#69747E] border-white/[0.08]';
};

export const RiskLabPanel: React.FC = () => {
  const [payload, setPayload] = useState<StatusPayload>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/trading-status', { cache: 'no-store' });
        const next = await response.json() as StatusPayload;
        if (!cancelled) setPayload(next);
      } catch {
        if (!cancelled) setPayload({});
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const exposureByProfile = useMemo(() => new Map(
    (payload.exposureLab || []).map((item) => [item.profileId, item.assessment]),
  ), [payload.exposureLab]);
  const items = payload.riskLab || [];

  return (
    <section className="shrink-0 border-b border-white/[0.06] bg-[#06090D] px-4 py-4 md:px-6 xl:px-8">
      <div className="mx-auto max-w-[1520px]">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.18em] text-[#70CAD2]">
              <FlaskConical className="h-3.5 w-3.5" /> Risk Lab
            </div>
            <div className="mt-1 text-[11px] text-[#77818C]">Same closed-trade sample under three Paper sizing profiles, plus the current book's observed exposure and cycle-aligned correlation.</div>
          </div>
          <div className="font-mono text-[6px] uppercase tracking-[0.11em] text-[#4F5963]">experiment only · no execution or promotion authority</div>
        </div>

        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 border border-white/[0.06] bg-[#080C11] px-3 py-2 font-mono text-[6px] uppercase tracking-[0.09em] text-[#59636D]">
          <span className="flex items-center gap-1.5"><GitCompareArrows className="h-3 w-3" /> aligned returns {payload.correlation?.alignedReturnObservations ?? 0}</span>
          <span>markets {payload.correlation?.markets?.join(' · ') || '—'}</span>
          <span className={payload.correlation?.available ? 'text-[#72B6A0]' : 'text-[#C7A96B]'}>{payload.correlation?.available ? 'correlation live' : 'correlation awaiting ≥10 returns'}</span>
        </div>

        <div className="grid gap-2 lg:grid-cols-3">
          {items.map((item) => {
            const exposure = exposureByProfile.get(item.profile.id);
            return (
              <div key={item.profile.id} className="border border-white/[0.07] bg-[#080C11] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {item.profile.id === 'AGGRESSIVE' ? <Zap className="h-3.5 w-3.5 text-[#C7A96B]" /> : <ShieldCheck className="h-3.5 w-3.5 text-[#77818C]" />}
                      <span className="text-[12px] font-medium text-[#D2D9DF]">{item.profile.label}</span>
                    </div>
                    <div className="mt-1 font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">max position {pct(item.profile.maxPositionPct)}</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <span className={`border px-1.5 py-1 font-mono text-[6px] uppercase tracking-[0.1em] ${verdictTone(item.validation.verdict)}`}>MC {item.validation.verdict}</span>
                    {exposure && <span className={`border px-1.5 py-1 font-mono text-[6px] uppercase tracking-[0.1em] ${verdictTone(exposure.disposition)}`}>BOOK {exposure.disposition}</span>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-px bg-white/[0.04]">
                  <Stat label="SURVIVAL" value={pct(item.validation.survivalProbability)} />
                  <Stat label="RUIN" value={pct(item.validation.ruinProbability)} danger={(item.validation.ruinProbability || 0) > 0} />
                  <Stat label="P95 DD" value={pct(item.validation.maxDrawdown.p95)} danger={(item.validation.maxDrawdown.p95 || 0) > item.profile.maxTotalDrawdownPct} />
                  <Stat label="P05 RETURN" value={pct(item.validation.terminalReturn.p05)} />
                  <Stat label="GROSS NOW" value={pct(exposure?.grossExposurePct)} danger={Boolean(exposure?.grossCapBreached)} />
                  <Stat label="CRYPTO CLUSTER" value={pct(exposure?.cryptoClusterExposurePct)} danger={Boolean(exposure?.cryptoClusterCapBreached)} />
                  <Stat label="CORR AVG" value={corr(exposure?.pairwiseCorrelation.average)} />
                  <Stat label="CORR MAX" value={corr(exposure?.pairwiseCorrelation.maximum)} danger={(exposure?.pairwiseCorrelation.maximum ?? 0) >= 0.8} />
                </div>

                <div className="mt-3 space-y-1.5 font-mono text-[6px] uppercase tracking-[0.09em] text-[#59636D]">
                  <div className="flex justify-between gap-3"><span>Daily loss cap</span><span className="text-[#8D97A0]">{pct(item.profile.maxDailyLossPct)}</span></div>
                  <div className="flex justify-between gap-3"><span>Total DD cap</span><span className="text-[#8D97A0]">{pct(item.profile.maxTotalDrawdownPct)}</span></div>
                  <div className="flex justify-between gap-3"><span>Gross exposure cap</span><span className="text-[#8D97A0]">{pct(item.profile.grossExposureCapPct)}</span></div>
                  <div className="flex justify-between gap-3"><span>Crypto cluster cap</span><span className="text-[#8D97A0]">{pct(item.profile.cryptoClusterExposureCapPct)}</span></div>
                  <div className="flex justify-between gap-3"><span>Correlation pairs</span><span className="text-[#8D97A0]">{exposure?.pairwiseCorrelation.pairCount ?? 0}</span></div>
                </div>

                <div className="mt-3 flex items-start gap-2 border-t border-white/[0.05] pt-2 text-[8px] leading-relaxed text-[#4F5963]">
                  <TrendingDown className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    {item.normalizedTradeCount} normalized trades. Current-book correlation uses only aligned Paper-cycle returns; Monte Carlo joint concurrency remains unmodeled and therefore remains a promotion blocker.
                  </span>
                </div>
              </div>
            );
          })}

          {!items.length && (
            <div className="col-span-full border border-dashed border-white/[0.07] p-6 text-center font-mono text-[7px] uppercase tracking-[0.13em] text-[#46515B]">Risk Lab data unavailable.</div>
          )}
        </div>
      </div>
    </section>
  );
};

const Stat = ({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) => (
  <div className="bg-[#05080C] p-2.5">
    <div className="font-mono text-[6px] uppercase tracking-[0.1em] text-[#4F5963]">{label}</div>
    <div className={`mt-1 font-mono text-[9px] ${danger ? 'text-[#D66565]' : 'text-[#AAB3BC]'}`}>{value}</div>
  </div>
);
