import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Crosshair,
  Radar,
  ShieldCheck,
  Target,
} from 'lucide-react';

type PositionEvidence = {
  market: string;
  openedAt: number;
  quantity: number;
  entryPrice: number;
  averageCost: number;
  markPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  evidenceState: 'TECHNICAL_ONLY' | 'EVIDENCE_SUPPORTED' | 'CONTESTED' | 'STALE';
  lastDecisionAt: number | null;
  decision: string | null;
  regime: string | null;
  regimeConfidence: number | null;
  router: string | null;
  confidence: number | null;
  oracleTradeScore: number | null;
  riskDisposition: string;
  externalEvidenceActive: number;
  externalEvidenceContradictions: number;
  evidenceIds: string[];
  forecast: null | {
    available: boolean;
    direction: string;
    probabilityBullish: number | null;
    probabilityBearish: number | null;
    confidence: number;
    uncertainty: number;
  };
  primaryReason: string;
};

type Payload = {
  success?: boolean;
  available?: boolean;
  positionEvidence?: PositionEvidence[];
};

const money = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const pct = (value: number | null | undefined, signed = false) => {
  if (value == null || !Number.isFinite(value)) return '—';
  const points = value * 100;
  return `${signed && points > 0 ? '+' : ''}${points.toFixed(2)}%`;
};
const krw = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? '—'
  : `₩${money.format(value)}`;
const time = (value: number | null | undefined) => value
  ? new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : '—';

const stateTone = (state: PositionEvidence['evidenceState']) => {
  if (state === 'EVIDENCE_SUPPORTED') return 'border-[#72B6A0]/25 bg-[#72B6A0]/[0.035] text-[#86C5B1]';
  if (state === 'CONTESTED') return 'border-[#D66565]/25 bg-[#D66565]/[0.035] text-[#D98787]';
  if (state === 'STALE') return 'border-[#D66565]/25 bg-[#D66565]/[0.035] text-[#D98787]';
  return 'border-[#C7A96B]/25 bg-[#C7A96B]/[0.035] text-[#D3B778]';
};

export const PositionEvidencePanel: React.FC = () => {
  const [items, setItems] = useState<PositionEvidence[]>([]);
  const [activeMarket, setActiveMarket] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/trading-status', { cache: 'no-store' });
        const payload = await response.json() as Payload;
        if (!cancelled) setItems(payload.positionEvidence ?? []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const coverage = useMemo(() => {
    const supported = items.filter((item) => item.evidenceState === 'EVIDENCE_SUPPORTED').length;
    const contested = items.filter((item) => item.evidenceState === 'CONTESTED').length;
    const technicalOnly = items.filter((item) => item.evidenceState === 'TECHNICAL_ONLY').length;
    return { supported, contested, technicalOnly };
  }, [items]);

  return (
    <section className="shrink-0 border-b border-white/[0.06] bg-[#06090D] px-4 py-3 md:px-6 xl:px-8">
      <div className="mx-auto max-w-[1520px]">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.18em] text-[#70CAD2]">
              <Crosshair className="h-3.5 w-3.5" /> Position evidence
            </div>
            <div className="mt-1 text-[11px] text-[#77818C]">
              What the Paper engine currently owns, why it still owns it, and whether external evidence actually supports the position.
            </div>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[6px] uppercase tracking-[0.11em] text-[#59636D]">
            <span>{items.length} open</span>
            <span className="text-[#72B6A0]">{coverage.supported} supported</span>
            <span className="text-[#C7A96B]">{coverage.technicalOnly} technical-only</span>
            <span className="text-[#D66565]">{coverage.contested} contested</span>
          </div>
        </div>

        {loading && !items.length ? (
          <div className="border border-white/[0.06] px-3 py-4 font-mono text-[7px] uppercase tracking-[0.13em] text-[#4F5963]">Loading current Paper positions…</div>
        ) : items.length ? (
          <div className="grid gap-2 xl:grid-cols-2">
            {items.map((item) => {
              const open = activeMarket === item.market;
              const pnlPct = item.averageCost > 0 ? item.markPrice / item.averageCost - 1 : 0;
              return (
                <article key={item.market} className="border border-white/[0.07] bg-[#080C11]">
                  <button
                    type="button"
                    onClick={() => setActiveMarket(open ? null : item.market)}
                    className="flex w-full items-start gap-3 px-3 py-3 text-left md:px-4"
                  >
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center border border-white/[0.07] bg-[#05070A]">
                      <CircleDot className="h-3.5 w-3.5 text-[#70CAD2]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] text-[#DDE3E8]">{item.market}</span>
                        <span className={`border px-1.5 py-1 font-mono text-[6px] uppercase tracking-[0.1em] ${stateTone(item.evidenceState)}`}>
                          {item.evidenceState.replace('_', ' ')}
                        </span>
                        <span className="border border-white/[0.07] px-1.5 py-1 font-mono text-[6px] uppercase tracking-[0.1em] text-[#77818C]">
                          {item.decision || '—'}
                        </span>
                      </span>
                      <span className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[7px] text-[#69747E] sm:grid-cols-4">
                        <span>MARK {krw(item.markPrice)}</span>
                        <span>ENTRY {krw(item.averageCost)}</span>
                        <span className={pnlPct >= 0 ? 'text-[#72B6A0]' : 'text-[#D66565]'}>P&L {pct(pnlPct, true)}</span>
                        <span>SCORE {item.oracleTradeScore ?? '—'}</span>
                      </span>
                      <span className="mt-2 block text-[9px] leading-relaxed text-[#7D8791]">{item.primaryReason}</span>
                    </span>
                    {open ? <ChevronUp className="mt-1 h-3.5 w-3.5 shrink-0 text-[#68737D]" /> : <ChevronDown className="mt-1 h-3.5 w-3.5 shrink-0 text-[#68737D]" />}
                  </button>

                  {open && (
                    <div className="border-t border-white/[0.055] px-3 py-3 md:px-4">
                      {item.evidenceState === 'TECHNICAL_ONLY' && (
                        <div className="mb-3 flex items-start gap-2 border border-[#C7A96B]/20 bg-[#C7A96B]/[0.025] p-3 text-[9px] leading-relaxed text-[#A89262]">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>No fresh external evidence is attached to this live position. The current hold is supported only by market structure, liquidity and the deterministic trading model.</span>
                        </div>
                      )}

                      <div className="grid gap-px bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-4">
                        <Fact icon={Radar} label="REGIME" value={`${item.regime || '—'} · ${pct(item.regimeConfidence)}`} />
                        <Fact icon={ShieldCheck} label="ROUTER / RISK" value={`${item.router || '—'} · ${item.riskDisposition}`} />
                        <Fact icon={Crosshair} label="EXTERNAL EVIDENCE" value={`${item.externalEvidenceActive} active · ${item.externalEvidenceContradictions} contra`} />
                        <Fact icon={Target} label="LAST DECISION" value={time(item.lastDecisionAt)} />
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-px bg-white/[0.04] sm:grid-cols-4">
                        <PriceFact label="STOP" value={krw(item.stopLossPrice)} />
                        <PriceFact label="TARGET" value={krw(item.takeProfitPrice)} />
                        <PriceFact label="MARKET VALUE" value={krw(item.marketValue)} />
                        <PriceFact label="UNREALIZED" value={krw(item.unrealizedPnl)} tone={item.unrealizedPnl >= 0 ? 'positive' : 'negative'} />
                      </div>

                      <div className="mt-2 border border-white/[0.055] bg-[#05080C] p-3">
                        <div className="font-mono text-[6px] uppercase tracking-[0.15em] text-[#4F5963]">FORECAST / EVIDENCE COVERAGE</div>
                        <div className="mt-1.5 text-[9px] leading-relaxed text-[#7D8791]">
                          {item.forecast?.available
                            ? `${item.forecast.direction} · bullish ${pct(item.forecast.probabilityBullish)} · bearish ${pct(item.forecast.probabilityBearish)} · confidence ${pct(item.forecast.confidence)}.`
                            : 'Forecast unavailable because no active structured external evidence is attached. This is intentionally shown as unavailable rather than inferred from technical signals.'}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-white/[0.07] px-4 py-5 text-center font-mono text-[7px] uppercase tracking-[0.12em] text-[#4F5963]">No open Paper positions.</div>
        )}
      </div>
    </section>
  );
};

const Fact = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="bg-[#06090D] p-3">
    <div className="flex items-center gap-1.5 font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]"><Icon className="h-3 w-3" />{label}</div>
    <div className="mt-1.5 text-[9px] text-[#AAB3BC]">{value}</div>
  </div>
);

const PriceFact = ({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) => (
  <div className="bg-[#06090D] p-3">
    <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">{label}</div>
    <div className={`mt-1.5 text-[9px] ${tone === 'positive' ? 'text-[#72B6A0]' : tone === 'negative' ? 'text-[#D66565]' : 'text-[#AAB3BC]'}`}>{value}</div>
  </div>
);
