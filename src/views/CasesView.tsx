import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CircleDot,
  FlaskConical,
  Plus,
  Radar,
  ShieldCheck,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, useAppContext } from '../store';

type DecisionItem = {
  timestamp: number;
  market: string;
  decision: string;
  regime?: string | null;
  regimeConfidence?: number | null;
  oracleTradeScore: number | null;
  confidence?: number | null;
  strategyDisposition?: string | null;
  riskDisposition?: string;
  evidenceActiveCount?: number;
  evidenceContradictionCount?: number;
  evidenceIds?: string[];
  primaryReason?: string | null;
  reasons?: string[];
  riskReasons?: string[];
};

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
  primaryReason: string;
};

type StatusPayload = {
  success: boolean;
  available: boolean;
  status: string;
  now?: number;
  positionEvidence?: PositionEvidence[];
  decisionTape?: DecisionItem[];
};

type ResearchItem = {
  market: string;
  createdAt: number;
  executionAuthority: false;
};

const money = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const formatMoney = (value: number | null | undefined) => value == null ? '—' : `₩${money.format(value)}`;
const formatPct = (value: number | null | undefined, signed = false) => {
  if (value == null || !Number.isFinite(value)) return '—';
  const points = value * 100;
  return `${signed && points > 0 ? '+' : ''}${number.format(points)}%`;
};

const normalizeMarket = (value: string) => {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '');
  if (!normalized) return null;
  const market = normalized.startsWith('KRW-') ? normalized : `KRW-${normalized}`;
  return /^KRW-[A-Z0-9]+$/.test(market) ? market : null;
};

export const CasesView: React.FC = () => {
  const { user } = useAppContext() as any;
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [research, setResearch] = useState<ResearchItem[]>([]);
  const [marketInput, setMarketInput] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/trading-status', { cache: 'no-store' });
      const payload = await response.json() as StatusPayload;
      setStatus(payload);
      setError(response.ok ? null : 'Trading status unavailable.');
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Trading status unavailable.');
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const interval = window.setInterval(() => void loadStatus(), 15_000);
    return () => window.clearInterval(interval);
  }, [loadStatus]);

  useEffect(() => {
    if (!user?.uid) {
      setResearch([]);
      return;
    }
    return onSnapshot(collection(db, 'users', user.uid, 'researchWatchlist'), (snapshot) => {
      const items = snapshot.docs
        .map((item) => item.data() as ResearchItem)
        .filter((item) => /^KRW-[A-Z0-9]+$/.test(item.market))
        .sort((a, b) => a.createdAt - b.createdAt);
      setResearch(items);
    });
  }, [user?.uid]);

  const activePositions = status?.positionEvidence || [];
  const activeMarkets = useMemo(() => new Set(activePositions.map((item) => item.market)), [activePositions]);
  const decisionTape = status?.decisionTape || [];
  const decisionByMarket = useMemo(() => new Map(decisionTape.map((item) => [item.market, item])), [decisionTape]);
  const systemCandidates = useMemo(() => decisionTape
    .filter((item) => !activeMarkets.has(item.market))
    .sort((a, b) => (b.oracleTradeScore ?? -1) - (a.oracleTradeScore ?? -1)), [decisionTape, activeMarkets]);

  const addResearch = async () => {
    const market = normalizeMarket(marketInput);
    if (!market || !user?.uid) {
      setError('Research market must be a valid KRW symbol such as BTC or KRW-BTC.');
      return;
    }
    await setDoc(doc(db, 'users', user.uid, 'researchWatchlist', market), {
      market,
      createdAt: Date.now(),
      executionAuthority: false,
    });
    setMarketInput('');
    setError(null);
  };

  const removeResearch = async (market: string) => {
    if (!user?.uid) return;
    await deleteDoc(doc(db, 'users', user.uid, 'researchWatchlist', market));
    if (selectedKey === `research:${market}`) setSelectedKey(null);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-40 pt-6 text-[#E9EDF1] md:px-8 md:pb-28 md:pt-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-white/[0.06] pb-6">
          <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#43D9E6]">Market dossiers</div>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-medium tracking-[-0.03em]">Cases</h1>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#77818C]">
                Open positions and system candidates define the live analytical scope. Research Watchlist items remain research-only and never enter execution automatically.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 font-mono text-[7px] uppercase tracking-[0.14em] text-[#59636D]">
              <span>{activePositions.length} active</span>
              <span>{systemCandidates.length} candidates</span>
              <span>{research.length} research</span>
              <span className={status?.status === 'OK' ? 'text-[#72B6A0]' : 'text-[#C7A96B]'}>{status?.status || 'WAITING'}</span>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 flex items-start gap-2 border border-[#D66565]/20 bg-[#D66565]/[0.03] p-3 text-[10px] text-[#D7A2A2]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        <CaseSection
          icon={WalletCards}
          eyebrow="LIVE BOOK"
          title="Active positions"
          note="Actual Paper holdings. These cases have execution history and protective levels."
          empty="No open Paper positions."
        >
          {activePositions.map((position) => {
            const itemKey = `active:${position.market}`;
            const selected = selectedKey === itemKey;
            return (
              <MarketCard
                key={itemKey}
                market={position.market}
                badge={position.evidenceState}
                score={position.oracleTradeScore}
                decision={position.decision || 'HOLD'}
                regime={position.regime}
                route={position.router}
                reason={position.primaryReason}
                evidenceCount={position.externalEvidenceActive}
                contradictions={position.externalEvidenceContradictions}
                selected={selected}
                onToggle={() => setSelectedKey(selected ? null : itemKey)}
              >
                <div className="grid grid-cols-2 gap-px bg-white/[0.04] sm:grid-cols-4">
                  <DetailStat label="MARK" value={formatMoney(position.markPrice)} />
                  <DetailStat label="UNREALIZED" value={formatMoney(position.unrealizedPnl)} />
                  <DetailStat label="STOP" value={formatMoney(position.stopLossPrice)} />
                  <DetailStat label="TARGET" value={formatMoney(position.takeProfitPrice)} />
                </div>
                <InspectorText label="RISK" value={position.riskDisposition} />
                <InspectorText label="CONFIDENCE" value={formatPct(position.confidence)} />
                <InspectorText label="EVIDENCE IDS" value={position.evidenceIds.length ? position.evidenceIds.join(' · ') : 'No external structured evidence attached.'} />
              </MarketCard>
            );
          })}
        </CaseSection>

        <CaseSection
          icon={Radar}
          eyebrow="LATEST SCAN"
          title="System candidates"
          note="Markets scanned by the engine but not currently held. Ranking is observational; it does not bypass Risk or NO_TRADE."
          empty="No non-position candidates were persisted in the latest cycle."
        >
          {systemCandidates.map((candidate) => {
            const itemKey = `candidate:${candidate.market}`;
            const selected = selectedKey === itemKey;
            return (
              <MarketCard
                key={itemKey}
                market={candidate.market}
                badge={candidate.riskDisposition === 'REJECT' ? 'RISK REJECT' : candidate.decision}
                score={candidate.oracleTradeScore}
                decision={candidate.decision}
                regime={candidate.regime}
                route={candidate.strategyDisposition}
                reason={candidate.primaryReason || 'No persisted explanation.'}
                evidenceCount={candidate.evidenceActiveCount || 0}
                contradictions={candidate.evidenceContradictionCount || 0}
                selected={selected}
                onToggle={() => setSelectedKey(selected ? null : itemKey)}
              >
                <InspectorText label="RISK" value={candidate.riskDisposition || 'NOT_EVALUATED'} />
                <InspectorText label="CONFIDENCE" value={formatPct(candidate.confidence)} />
                <InspectorText label="REASONS" value={(candidate.reasons || []).join(' · ') || 'No additional reasons persisted.'} />
                <InspectorText label="RISK REASONS" value={(candidate.riskReasons || []).join(' · ') || 'No additional risk reasons.'} />
              </MarketCard>
            );
          })}
        </CaseSection>

        <CaseSection
          icon={FlaskConical}
          eyebrow="HUMAN RESEARCH"
          title="Research Watchlist"
          note="Manual research scope. Adding an asset here grants no Router, Risk, or execution authority."
          empty="No research-only markets yet."
          action={(
            <div className="flex w-full gap-2 sm:w-auto">
              <input
                value={marketInput}
                onChange={(event) => setMarketInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void addResearch(); }}
                placeholder="BTC or KRW-BTC"
                className="min-w-0 flex-1 border border-white/[0.08] bg-[#05080C] px-3 py-2 font-mono text-[9px] text-[#C8D0D7] outline-none placeholder:text-[#414B54] focus:border-[#43D9E6]/30 sm:w-44"
              />
              <button
                onClick={() => void addResearch()}
                className="flex min-h-10 items-center gap-1.5 border border-white/[0.09] px-3 font-mono text-[7px] uppercase tracking-[0.12em] text-[#7E8993] hover:border-[#43D9E6]/25 hover:text-[#D9E0E5]"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          )}
        >
          {research.map((item) => {
            const latest = decisionByMarket.get(item.market);
            const itemKey = `research:${item.market}`;
            const selected = selectedKey === itemKey;
            return (
              <MarketCard
                key={itemKey}
                market={item.market}
                badge="RESEARCH ONLY"
                score={latest?.oracleTradeScore ?? null}
                decision={latest?.decision || 'UNOBSERVED'}
                regime={latest?.regime}
                route={latest?.strategyDisposition}
                reason={latest?.primaryReason || 'This market is not part of the latest persisted engine scan.'}
                evidenceCount={latest?.evidenceActiveCount || 0}
                contradictions={latest?.evidenceContradictionCount || 0}
                selected={selected}
                onToggle={() => setSelectedKey(selected ? null : itemKey)}
                trailing={(
                  <button
                    aria-label={`Remove ${item.market} from research watchlist`}
                    onClick={(event) => { event.stopPropagation(); void removeResearch(item.market); }}
                    className="flex h-9 w-9 items-center justify-center border border-white/[0.06] text-[#59636D] hover:border-[#D66565]/25 hover:text-[#D66565]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              >
                <InspectorText label="AUTHORITY" value="RESEARCH ONLY · EXECUTION AUTHORITY FALSE" />
                <InspectorText label="LATEST ENGINE OBSERVATION" value={latest ? `${latest.decision} · score ${latest.oracleTradeScore ?? '—'}` : 'Not scanned in latest cycle.'} />
              </MarketCard>
            );
          })}
        </CaseSection>
      </div>
    </div>
  );
};

const CaseSection = ({ icon: Icon, eyebrow, title, note, empty, action, children }: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  note: string;
  empty: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const items = React.Children.toArray(children);
  return (
    <section className="mb-5 border border-white/[0.07] bg-[#080C11]">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.18em] text-[#59636D]">
            <Icon className="h-3.5 w-3.5 text-[#43D9E6]" /> {eyebrow}
          </div>
          <div className="mt-1.5 text-sm font-medium text-[#CBD2D9]">{title}</div>
          <p className="mt-1 max-w-3xl text-[10px] leading-relaxed text-[#66717B]">{note}</p>
        </div>
        {action}
      </div>
      <div className="grid gap-px bg-white/[0.04] lg:grid-cols-2">
        {items.length ? items : <div className="col-span-full bg-[#070A0E] p-6 text-center font-mono text-[7px] uppercase tracking-[0.13em] text-[#46515B]">{empty}</div>}
      </div>
    </section>
  );
};

type MarketCardProps = {
  key?: React.Key;
  market: string;
  badge: string;
  score: number | null;
  decision: string;
  regime?: string | null;
  route?: string | null;
  reason: string;
  evidenceCount: number;
  contradictions: number;
  selected: boolean;
  onToggle: () => void;
  trailing?: React.ReactNode;
  children: React.ReactNode;
};

const MarketCard = ({ market, badge, score, decision, regime, route, reason, evidenceCount, contradictions, selected, onToggle, trailing, children }: MarketCardProps) => (
  <article className="bg-[#080C11]">
    <button onClick={onToggle} className="w-full p-4 text-left transition hover:bg-white/[0.018]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CircleDot className="h-3 w-3 text-[#43D9E6]" />
            <span className="font-mono text-[11px] text-[#D8DEE4]">{market}</span>
            <span className="border border-white/[0.08] px-1.5 py-1 font-mono text-[6px] uppercase tracking-[0.1em] text-[#77818C]">{badge}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[6px] uppercase tracking-[0.09em] text-[#59636D]">
            <span>{decision}</span>
            <span>{regime || 'REGIME —'}</span>
            <span>{route || 'ROUTE —'}</span>
            <span>EVID {evidenceCount}</span>
            {contradictions > 0 && <span className="text-[#C7A96B]">CONTRA {contradictions}</span>}
          </div>
          <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-[#7D8791]">{reason}</p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            <div className="font-mono text-[12px] text-[#B7C0C8]">{score == null ? '—' : number.format(score)}</div>
            <div className="font-mono text-[6px] uppercase text-[#4F5963]">score</div>
          </div>
          {trailing}
          <div className="flex h-9 w-9 items-center justify-center text-[#59636D]">{selected ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div>
        </div>
      </div>
    </button>
    {selected && (
      <div className="border-t border-white/[0.05] bg-[#06090D] p-4">
        <div className="mb-3 flex items-center gap-2 font-mono text-[6px] uppercase tracking-[0.14em] text-[#59636D]">
          <ShieldCheck className="h-3 w-3" /> Local case inspector
        </div>
        <div className="space-y-2">{children}</div>
      </div>
    )}
  </article>
);

const DetailStat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[#070A0E] p-3">
    <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">{label}</div>
    <div className="mt-1 text-[10px] text-[#B7C0C8]">{value}</div>
  </div>
);

const InspectorText = ({ label, value }: { label: string; value: string }) => (
  <div className="grid gap-1 border-b border-white/[0.045] py-2 last:border-b-0 sm:grid-cols-[130px_1fr]">
    <span className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">{label}</span>
    <span className="text-[9px] leading-relaxed text-[#8B959E]">{value}</span>
  </div>
);
