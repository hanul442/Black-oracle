import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  Database,
  FlaskConical,
  Plus,
  Radar,
  ShieldCheck,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, useAppContext } from '../store';

type AuditCompleteness = {
  score: number;
  grade: string;
  missing: string[];
  dimensions?: Array<{ id: string; state: string; reason: string }>;
};

type Trace = {
  timestamp: number;
  market: string;
  action: string;
  regime?: string | null;
  oracleTradeScore?: number | null;
  confidence?: number | null;
  strategyDisposition?: string | null;
  riskDisposition?: string | null;
  forecast?: null | { available: boolean; direction: string; confidence: number; uncertainty?: number; reasons?: string[] };
  evidenceActiveCount?: number;
  evidenceContradictionCount?: number;
  evidenceIds?: string[];
  primaryReason?: string | null;
  reasons?: string[];
  riskReasons?: string[];
  auditCompleteness?: AuditCompleteness;
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
  evidenceState: string;
  lastDecisionAt: number | null;
  decision: string | null;
  regime: string | null;
  router: string | null;
  confidence: number | null;
  oracleTradeScore: number | null;
  riskDisposition: string;
  externalEvidenceActive: number;
  externalEvidenceContradictions: number;
  evidenceIds: string[];
  primaryReason: string;
  forecast?: null | { available: boolean; direction: string; confidence: number; uncertainty?: number; reasons?: string[] };
  evidenceItems?: Array<{
    id: string;
    title: string;
    direction: string;
    strength: number;
    reliability: number;
    sourceType: string;
    publisher: string;
    sourceUrl: string | null;
    summary: string | null;
    observedAt: number;
    expiresAt: number;
    contradictionOf: string | null;
  }>;
};

type DecisionItem = {
  timestamp: number;
  market: string;
  decision: string;
  regime?: string | null;
  oracleTradeScore?: number | null;
  confidence?: number | null;
  strategyDisposition?: string | null;
  riskDisposition?: string | null;
  evidenceActiveCount?: number;
  evidenceContradictionCount?: number;
  evidenceIds?: string[];
  primaryReason?: string | null;
  forecast?: null | { available: boolean; direction: string; confidence: number; uncertainty?: number; reasons?: string[] };
};

type TradingStatus = {
  available?: boolean;
  status?: string;
  positionEvidence?: PositionEvidence[];
  decisionTape?: DecisionItem[];
};

type TradeCase = {
  id: string;
  market: string;
  status: 'OPEN' | 'CLOSED';
  auditClass: string;
  openedAt: number;
  closedAt: number | null;
  intelligencePackageId: string | null;
  councilRunId: string | null;
  finalDecisionId: string | null;
  supervisionNotes: string[];
  entry: {
    timestamp: number;
    referencePrice: number;
    fillPrice: number;
    notional: number;
    fee: number;
    slippageBps: number;
    strategyVersion: string;
    multiTimeframe: {
      action: string;
      directionalScore: number;
      oracleTradeScore: number;
      confidence: number;
      aligned: boolean;
      positionRiskMultiplier: number;
      frames: {
        fourHour: { directionalScore: number; confidence: number; regime: string };
        oneHour: { directionalScore: number; confidence: number; regime: string };
        fifteenMinute: { directionalScore: number; confidence: number; regime: string };
      };
    };
    trace: Trace | null;
  };
  latestDecision: Trace | null;
  decisionHistory: Array<Trace | null>;
};

type ResearchItem = { market: string; createdAt: number; executionAuthority: false };
type Segment = 'OPEN' | 'CANDIDATES' | 'RESEARCH' | 'CLOSED';
type InspectorTab = 'OVERVIEW' | 'EVIDENCE' | 'SCENARIO' | 'COUNCIL' | 'RISK' | 'HISTORY';

const SEGMENTS: Segment[] = ['OPEN', 'CANDIDATES', 'RESEARCH', 'CLOSED'];
const TABS: InspectorTab[] = ['OVERVIEW', 'EVIDENCE', 'SCENARIO', 'COUNCIL', 'RISK', 'HISTORY'];
const money = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const pct = (value: number | null | undefined, digits = 0) => value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;
const cash = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : value < 0 ? '-' : ''}₩${money.format(Math.abs(value))}`;
const price = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `₩${money.format(value)}`;
const stamp = (value: number | null | undefined) => value ? new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';

const normalizeMarket = (value: string) => {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '');
  if (!normalized) return null;
  const market = normalized.startsWith('KRW-') ? normalized : `KRW-${normalized}`;
  return /^KRW-[A-Z0-9]+$/.test(market) ? market : null;
};

export const CasesView: React.FC = () => {
  const { user } = useAppContext() as any;
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const [cases, setCases] = useState<TradeCase[]>([]);
  const [research, setResearch] = useState<ResearchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment>('OPEN');
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [tab, setTab] = useState<InspectorTab>('OVERVIEW');
  const [marketInput, setMarketInput] = useState('');

  const load = useCallback(async () => {
    try {
      const [statusResponse, casesResponse] = await Promise.all([
        fetch('/api/trading-status', { cache: 'no-store' }),
        fetch('/api/trade-cases', { cache: 'no-store' }),
      ]);
      const [nextStatus, nextCases] = await Promise.all([
        statusResponse.json() as Promise<TradingStatus & { error?: string }>,
        casesResponse.json() as Promise<{ cases?: TradeCase[]; error?: string }>,
      ]);
      setStatus(nextStatus);
      setCases(nextCases.cases || []);
      setError(statusResponse.ok && casesResponse.ok ? null : nextStatus.error || nextCases.error || 'Paper dossier request failed.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Paper dossier request failed.');
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!user?.uid) {
      setResearch([]);
      return undefined;
    }
    return onSnapshot(collection(db, 'users', user.uid, 'researchWatchlist'), (snapshot) => {
      setResearch(snapshot.docs
        .map((item) => item.data() as ResearchItem)
        .filter((item) => /^KRW-[A-Z0-9]+$/.test(item.market))
        .sort((a, b) => a.createdAt - b.createdAt));
    });
  }, [user?.uid]);

  const activePositions = status?.positionEvidence || [];
  const activeMarkets = useMemo(() => new Set(activePositions.map((item) => item.market)), [activePositions]);
  const candidates = useMemo(() => (status?.decisionTape || [])
    .filter((item) => !activeMarkets.has(item.market))
    .sort((a, b) => (b.oracleTradeScore ?? -1) - (a.oracleTradeScore ?? -1)), [activeMarkets, status?.decisionTape]);
  const closedCases = useMemo(() => cases.filter((item) => item.status === 'CLOSED'), [cases]);
  const openCases = useMemo(() => cases.filter((item) => item.status === 'OPEN'), [cases]);

  useEffect(() => {
    const available = segment === 'OPEN'
      ? activePositions.map((item) => item.market)
      : segment === 'CANDIDATES'
        ? candidates.map((item) => item.market)
        : segment === 'RESEARCH'
          ? research.map((item) => item.market)
          : closedCases.map((item) => item.market);
    if (!selectedMarket || !available.includes(selectedMarket)) {
      setSelectedMarket(available[0] || null);
      setSelectedCaseId(segment === 'CLOSED' ? closedCases[0]?.id || null : null);
      setTab('OVERVIEW');
    }
  }, [activePositions, candidates, closedCases, research, segment, selectedMarket]);

  const addResearch = async () => {
    const market = normalizeMarket(marketInput);
    if (!market || !user?.uid) {
      setError('Research market must be a valid KRW symbol such as BTC or KRW-BTC.');
      return;
    }
    await setDoc(doc(db, 'users', user.uid, 'researchWatchlist', market), { market, createdAt: Date.now(), executionAuthority: false });
    setMarketInput('');
    setError(null);
  };

  const removeResearch = async (market: string) => {
    if (!user?.uid) return;
    await deleteDoc(doc(db, 'users', user.uid, 'researchWatchlist', market));
  };

  const selectedPosition = activePositions.find((item) => item.market === selectedMarket) || null;
  const selectedDecision = (status?.decisionTape || []).find((item) => item.market === selectedMarket) || null;
  const selectedCase = selectedCaseId
    ? cases.find((item) => item.id === selectedCaseId) || null
    : openCases.find((item) => item.market === selectedMarket) || cases.find((item) => item.market === selectedMarket) || null;
  const selectedTrace = selectedCase?.latestDecision || (selectedDecision ? {
    timestamp: selectedDecision.timestamp,
    market: selectedDecision.market,
    action: selectedDecision.decision,
    regime: selectedDecision.regime,
    oracleTradeScore: selectedDecision.oracleTradeScore,
    confidence: selectedDecision.confidence,
    strategyDisposition: selectedDecision.strategyDisposition,
    riskDisposition: selectedDecision.riskDisposition,
    forecast: selectedDecision.forecast,
    evidenceActiveCount: selectedDecision.evidenceActiveCount,
    evidenceContradictionCount: selectedDecision.evidenceContradictionCount,
    evidenceIds: selectedDecision.evidenceIds,
    primaryReason: selectedDecision.primaryReason,
  } as Trace : null);

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-3 pb-28 pt-4 text-[#E9EDF1] md:px-5 md:pb-20 xl:px-6">
      <div className="mx-auto max-w-[1580px]">
        <header className="border-b border-white/[0.06] pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="font-mono text-[7px] uppercase tracking-[0.22em] text-[#43D9E6]">Position supervision</div>
              <h1 className="mt-2 text-[28px] font-medium tracking-[-0.04em] md:text-[34px]">Positions</h1>
              <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-[#68737D]">Live holdings, system candidates and research watchlist share one inspection model. Forecast and Council are provenance layers inside each market dossier rather than separate primary destinations.</p>
            </div>
            <div className="flex flex-wrap gap-3 font-mono text-[6px] uppercase tracking-[0.12em] text-[#59636D]"><span>{activePositions.length} open</span><span>{candidates.length} candidates</span><span>{research.length} research</span><span>{closedCases.length} closed</span><span className={status?.status === 'OK' ? 'text-[#72B6A0]' : 'text-[#C7A96B]'}>{status?.status || 'WAITING'}</span></div>
          </div>
        </header>

        {error && <div className="mt-3 flex gap-2 border border-[#D66565]/20 bg-[#D66565]/[0.03] p-3 text-[10px] text-[#D69A9A]"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}</div>}

        <div className="mt-3 flex gap-1 overflow-x-auto border border-white/[0.06] bg-[#070A0E] p-2">{SEGMENTS.map((item) => <button key={item} onClick={() => { setSegment(item); setSelectedMarket(null); setSelectedCaseId(null); setTab('OVERVIEW'); }} className={`shrink-0 border px-3 py-2 font-mono text-[6px] uppercase tracking-[0.12em] ${segment === item ? 'border-[#43D9E6]/25 bg-[#43D9E6]/[0.035] text-[#79CDD5]' : 'border-white/[0.055] text-[#56616B]'}`}>{item}</button>)}</div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(320px,.72fr)_minmax(0,1.28fr)]">
          <section className="border border-white/[0.065] bg-[#070A0E]">
            <div className="flex items-center justify-between border-b border-white/[0.055] px-3 py-3"><div className="flex items-center gap-2">{segment === 'OPEN' ? <WalletCards className="h-3.5 w-3.5 text-[#43D9E6]" /> : segment === 'CANDIDATES' ? <Radar className="h-3.5 w-3.5 text-[#43D9E6]" /> : segment === 'RESEARCH' ? <FlaskConical className="h-3.5 w-3.5 text-[#C7A96B]" /> : <BookOpen className="h-3.5 w-3.5 text-[#7B8791]" />}<span className="font-mono text-[7px] uppercase tracking-[0.16em] text-[#89949E]">{segment}</span></div><span className="font-mono text-[6px] text-[#46515B]">select to inspect</span></div>

            {segment === 'RESEARCH' && <div className="flex gap-2 border-b border-white/[0.05] p-3"><input value={marketInput} onChange={(event) => setMarketInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addResearch(); }} placeholder="BTC or KRW-BTC" className="min-w-0 flex-1 border border-white/[0.06] bg-[#05070A] px-3 py-2 font-mono text-[8px] text-[#9DA7B0] outline-none placeholder:text-[#46515B]" /><button onClick={() => void addResearch()} className="flex h-9 w-9 items-center justify-center border border-[#C7A96B]/20 text-[#C7A96B]"><Plus className="h-3.5 w-3.5" /></button></div>}

            <div className="divide-y divide-white/[0.045]">
              {segment === 'OPEN' && activePositions.map((item) => <ListRow key={item.market} active={selectedMarket === item.market} market={item.market} label={item.decision || 'HOLD'} detail={`${item.evidenceState} · ${item.regime || 'UNKNOWN'}`} score={item.oracleTradeScore} warning={item.evidenceState !== 'EVIDENCE_SUPPORTED'} onClick={() => { setSelectedMarket(item.market); setSelectedCaseId(null); setTab('OVERVIEW'); }} />)}
              {segment === 'CANDIDATES' && candidates.map((item) => <ListRow key={item.market} active={selectedMarket === item.market} market={item.market} label={item.decision} detail={`${item.regime || 'UNKNOWN'} · evidence ${item.evidenceActiveCount || 0}`} score={item.oracleTradeScore} warning={(item.evidenceActiveCount || 0) === 0} onClick={() => { setSelectedMarket(item.market); setSelectedCaseId(null); setTab('OVERVIEW'); }} />)}
              {segment === 'RESEARCH' && research.map((item) => <div key={item.market} className={`flex items-center ${selectedMarket === item.market ? 'bg-white/[0.025]' : ''}`}><button onClick={() => { setSelectedMarket(item.market); setSelectedCaseId(null); setTab('OVERVIEW'); }} className="min-w-0 flex-1 p-3 text-left"><div className="font-mono text-[8px] text-[#AEB7BF]">{item.market}</div><div className="mt-1 font-mono text-[6px] uppercase text-[#C7A96B]">research only · no execution authority</div></button><button onClick={() => void removeResearch(item.market)} className="mr-3 flex h-8 w-8 items-center justify-center border border-white/[0.06] text-[#59636D]"><Trash2 className="h-3 w-3" /></button></div>)}
              {segment === 'CLOSED' && closedCases.map((item) => <ListRow key={item.id} active={selectedCaseId === item.id} market={item.market} label="CLOSED" detail={`${stamp(item.openedAt)} → ${stamp(item.closedAt)} · ${item.auditClass}`} score={item.latestDecision?.auditCompleteness?.score ?? null} warning={(item.latestDecision?.auditCompleteness?.score ?? 100) < 70} onClick={() => { setSelectedMarket(item.market); setSelectedCaseId(item.id); setTab('OVERVIEW'); }} />)}
              {((segment === 'OPEN' && !activePositions.length) || (segment === 'CANDIDATES' && !candidates.length) || (segment === 'RESEARCH' && !research.length) || (segment === 'CLOSED' && !closedCases.length)) && <div className="px-4 py-14 text-center font-mono text-[7px] uppercase tracking-[0.14em] text-[#4F5963]">No records in this scope.</div>}
            </div>
          </section>

          <section className="min-h-[420px] border border-white/[0.065] bg-[#070A0E]">
            {!selectedMarket ? <div className="flex min-h-[420px] items-center justify-center p-8 text-center"><div><ShieldCheck className="mx-auto h-5 w-5 text-[#46515B]" /><div className="mt-3 font-mono text-[7px] uppercase tracking-[0.16em] text-[#59636D]">Select a market dossier</div><div className="mt-2 text-[9px] text-[#414B54]">Inspection stays local to the position instead of opening global Forecast/Council pages.</div></div></div> : <>
              <div className="border-b border-white/[0.055] px-3 py-3 md:px-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[12px] text-[#DCE2E7]">{selectedMarket}</span><span className="border border-white/[0.06] px-1.5 py-1 font-mono text-[6px] uppercase text-[#68737D]">{selectedCase?.status || segment}</span>{selectedTrace?.auditCompleteness && <span className={`border px-1.5 py-1 font-mono text-[6px] uppercase ${selectedTrace.auditCompleteness.score >= 80 ? 'border-[#72B6A0]/20 text-[#72B6A0]' : selectedTrace.auditCompleteness.score >= 50 ? 'border-[#C7A96B]/20 text-[#C7A96B]' : 'border-[#D66565]/20 text-[#D66565]'}`}>audit {selectedTrace.auditCompleteness.score}%</span>}</div><div className="mt-1.5 max-w-3xl text-[10px] leading-relaxed text-[#77818B]">{selectedPosition?.primaryReason || selectedTrace?.primaryReason || selectedDecision?.primaryReason || 'No persisted decision explanation is available for this market.'}</div></div>
                  <div className="font-mono text-[6px] uppercase text-[#4F5963]">last decision {stamp(selectedTrace?.timestamp || selectedPosition?.lastDecisionAt || selectedDecision?.timestamp)}</div>
                </div>
              </div>

              <div className="flex gap-1 overflow-x-auto border-b border-white/[0.055] p-2">{TABS.map((item) => <button key={item} onClick={() => setTab(item)} className={`shrink-0 border px-2.5 py-1.5 font-mono text-[6px] uppercase tracking-[0.1em] ${tab === item ? 'border-[#43D9E6]/22 text-[#75C7CF]' : 'border-white/[0.05] text-[#505B65]'}`}>{item}</button>)}</div>

              <div className="p-3 md:p-4">
                {tab === 'OVERVIEW' && <OverviewTab position={selectedPosition} trace={selectedTrace} tradeCase={selectedCase} segment={segment} />}
                {tab === 'EVIDENCE' && <EvidenceTab position={selectedPosition} trace={selectedTrace} />}
                {tab === 'SCENARIO' && <ScenarioTab trace={selectedTrace} tradeCase={selectedCase} />}
                {tab === 'COUNCIL' && <CouncilTab tradeCase={selectedCase} />}
                {tab === 'RISK' && <RiskTab position={selectedPosition} trace={selectedTrace} />}
                {tab === 'HISTORY' && <HistoryTab tradeCase={selectedCase} trace={selectedTrace} />}
              </div>
            </>}
          </section>
        </div>
      </div>
    </div>
  );
};

type ListRowProps = {
  active: boolean;
  market: string;
  label: string;
  detail: string;
  score: number | null | undefined;
  warning?: boolean;
  onClick: () => void;
};

const ListRow: React.FC<ListRowProps> = ({ active, market, label, detail, score, warning, onClick }) => <button onClick={onClick} className={`flex w-full items-center gap-3 p-3 text-left transition ${active ? 'bg-white/[0.025]' : 'hover:bg-white/[0.012]'}`}><div className={`h-2 w-2 shrink-0 rounded-full ${warning ? 'bg-[#C7A96B]' : 'bg-[#72B6A0]'}`} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-mono text-[8px] text-[#AEB7BF]">{market}</span><span className="font-mono text-[6px] uppercase text-[#66717B]">{label}</span></div><div className="mt-1 truncate text-[8px] text-[#505B65]">{detail}</div></div><div className="font-mono text-[8px] text-[#74808A]">{score ?? '—'}</div><ChevronRight className="h-3 w-3 text-[#3F4851]" /></button>;

const OverviewTab = ({ position, trace, tradeCase, segment }: { position: PositionEvidence | null; trace: Trace | null; tradeCase: TradeCase | null; segment: Segment }) => <div className="space-y-3"><div className="grid grid-cols-2 gap-px bg-white/[0.04] sm:grid-cols-4"><Stat label="MARK" value={price(position?.markPrice)} /><Stat label="ENTRY" value={price(position?.entryPrice ?? tradeCase?.entry.fillPrice)} /><Stat label="UNREALIZED" value={cash(position?.unrealizedPnl)} warning={(position?.unrealizedPnl || 0) < 0} /><Stat label="AUDIT" value={trace?.auditCompleteness ? `${trace.auditCompleteness.score}% ${trace.auditCompleteness.grade}` : '—'} warning={(trace?.auditCompleteness?.score ?? 100) < 70} /></div><InfoGrid rows={[
  ['SCOPE', segment],
  ['ACTION', trace?.action || position?.decision || '—'],
  ['REGIME', trace?.regime || position?.regime || '—'],
  ['ROUTE', trace?.strategyDisposition || position?.router || '—'],
  ['CONFIDENCE', pct(trace?.confidence ?? position?.confidence)],
  ['SCORE', String(trace?.oracleTradeScore ?? position?.oracleTradeScore ?? '—')],
  ['CASE', tradeCase?.id || 'No persisted trade case'],
  ['STRATEGY', tradeCase?.entry.strategyVersion || '—'],
]} />{tradeCase?.entry.multiTimeframe && <div className="border border-white/[0.055] bg-[#05070A] p-3"><div className="font-mono text-[6px] uppercase tracking-[0.13em] text-[#59636D]">ENTRY MULTI-TIMEFRAME</div><div className="mt-3 grid gap-px bg-white/[0.04] sm:grid-cols-3"><Frame label="4H" item={tradeCase.entry.multiTimeframe.frames.fourHour} /><Frame label="1H" item={tradeCase.entry.multiTimeframe.frames.oneHour} /><Frame label="15M" item={tradeCase.entry.multiTimeframe.frames.fifteenMinute} /></div></div>}{trace?.auditCompleteness?.missing?.length ? <div className="border border-[#C7A96B]/18 bg-[#C7A96B]/[0.02] p-3"><div className="font-mono text-[6px] uppercase text-[#C7A96B]">MISSING AUDIT LINKS</div><div className="mt-2 flex flex-wrap gap-1">{trace.auditCompleteness.missing.map((item) => <span key={item} className="border border-[#C7A96B]/16 px-1.5 py-1 font-mono text-[5px] uppercase text-[#A88D5F]">{item}</span>)}</div></div> : null}</div>;

const EvidenceTab = ({ position, trace }: { position: PositionEvidence | null; trace: Trace | null }) => <div><div className="grid grid-cols-3 gap-px bg-white/[0.04]"><Stat label="STATE" value={position?.evidenceState || ((trace?.evidenceActiveCount || 0) > 0 ? 'ATTACHED' : 'NONE')} warning={(position?.evidenceState || 'TECHNICAL_ONLY') !== 'EVIDENCE_SUPPORTED'} /><Stat label="ACTIVE" value={String(position?.externalEvidenceActive ?? trace?.evidenceActiveCount ?? 0)} /><Stat label="CONTRADICTIONS" value={String(position?.externalEvidenceContradictions ?? trace?.evidenceContradictionCount ?? 0)} warning={(position?.externalEvidenceContradictions || trace?.evidenceContradictionCount || 0) > 0} /></div><div className="mt-3 space-y-2">{(position?.evidenceItems || []).map((item) => <div key={item.id} className="border border-white/[0.055] bg-[#05070A] p-3"><div className="flex flex-wrap items-center gap-2 font-mono text-[5px] uppercase text-[#59636D]"><span className="text-[#8B969F]">{item.publisher}</span><span>{item.sourceType}</span><span>REL {Math.round(item.reliability * (item.reliability <= 1 ? 100 : 1))}</span><span>{item.direction}</span>{item.contradictionOf && <span className="text-[#D66565]">CONTRADICTS</span>}</div><div className="mt-1.5 text-[10px] text-[#AEB7BF]">{item.title}</div>{item.summary && <div className="mt-1 text-[8px] leading-relaxed text-[#59636D]">{item.summary}</div>}<div className="mt-2 font-mono text-[5px] text-[#46515B]">{item.id} · observed {stamp(item.observedAt)} · expires {stamp(item.expiresAt)}</div></div>)}{!(position?.evidenceItems || []).length && <Empty text={(trace?.evidenceIds || []).length ? `Evidence IDs: ${(trace?.evidenceIds || []).join(' · ')}` : 'No structured external evidence attached to this dossier.'} />}</div></div>;

const ScenarioTab = ({ trace, tradeCase }: { trace: Trace | null; tradeCase: TradeCase | null }) => <div className="space-y-3"><div className="border border-white/[0.055] bg-[#05070A] p-4"><div className="font-mono text-[6px] uppercase text-[#59636D]">LATEST FORECAST</div>{trace?.forecast?.available ? <><div className="mt-2 text-[18px] font-light text-[#C8D0D6]">{trace.forecast.direction}</div><div className="mt-2 flex gap-4 font-mono text-[6px] uppercase text-[#59636D]"><span>CONF <b className="font-normal text-[#8C98A2]">{pct(trace.forecast.confidence)}</b></span><span>UNCERTAINTY <b className="font-normal text-[#8C98A2]">{pct(trace.forecast.uncertainty)}</b></span></div>{trace.forecast.reasons?.length ? <div className="mt-3 space-y-1 text-[9px] text-[#68737D]">{trace.forecast.reasons.map((reason, index) => <div key={`${reason}-${index}`}>{reason}</div>)}</div> : null}</> : <div className="mt-3 text-[9px] text-[#C7A96B]">Forecast unavailable at the persisted decision point.</div>}</div><div className={`border p-4 ${tradeCase?.intelligencePackageId ? 'border-[#72B6A0]/18 bg-[#72B6A0]/[0.02]' : 'border-[#C7A96B]/18 bg-[#C7A96B]/[0.02]'}`}><div className="font-mono text-[6px] uppercase text-[#59636D]">PERSISTED SCENARIO / INTELLIGENCE LINK</div><div className="mt-2 font-mono text-[8px] text-[#8D98A2]">{tradeCase?.intelligencePackageId || 'NOT LINKED'}</div><div className="mt-2 text-[8px] leading-relaxed text-[#59636D]">A forecast is not treated as a full scenario chain. Until a persisted scenario package is linked, Audit completeness keeps this dimension missing.</div></div></div>;

const CouncilTab = ({ tradeCase }: { tradeCase: TradeCase | null }) => <div className={`border p-4 ${tradeCase?.councilRunId ? 'border-[#72B6A0]/18 bg-[#72B6A0]/[0.02]' : 'border-[#C7A96B]/18 bg-[#C7A96B]/[0.02]'}`}><div className="font-mono text-[6px] uppercase text-[#59636D]">COUNCIL RUN</div><div className="mt-2 font-mono text-[9px] text-[#AEB7BF]">{tradeCase?.councilRunId || 'NO PERSISTED COUNCIL RUN LINKED'}</div><div className="mt-3 text-[9px] leading-relaxed text-[#68737D]">Council remains advisory. A missing run is shown as an audit gap rather than silently substituting a generic opinion.</div>{tradeCase?.finalDecisionId && <div className="mt-3 border-t border-white/[0.05] pt-2 font-mono text-[6px] text-[#59636D]">FINAL DECISION {tradeCase.finalDecisionId}</div>}</div>;

const RiskTab = ({ position, trace }: { position: PositionEvidence | null; trace: Trace | null }) => <div className="space-y-3"><div className="grid grid-cols-2 gap-px bg-white/[0.04] sm:grid-cols-4"><Stat label="RISK GATE" value={trace?.riskDisposition || position?.riskDisposition || '—'} warning={(trace?.riskDisposition || position?.riskDisposition) === 'REJECT'} /><Stat label="STOP" value={price(position?.stopLossPrice)} /><Stat label="TARGET" value={price(position?.takeProfitPrice)} /><Stat label="UNREALIZED" value={cash(position?.unrealizedPnl)} warning={(position?.unrealizedPnl || 0) < 0} /></div><div className="border border-white/[0.055] bg-[#05070A] p-3"><div className="font-mono text-[6px] uppercase text-[#59636D]">RISK REASONS</div><div className="mt-2 space-y-1.5 text-[9px] text-[#68737D]">{trace?.riskReasons?.length ? trace.riskReasons.map((reason, index) => <div key={`${reason}-${index}`}>{reason}</div>) : <div>No separate risk reason persisted.</div>}</div></div>{trace?.auditCompleteness?.dimensions && <div className="border border-white/[0.055] bg-[#05070A] p-3"><div className="font-mono text-[6px] uppercase text-[#59636D]">RISK / EXECUTION AUDIT</div><div className="mt-2 space-y-2">{trace.auditCompleteness.dimensions.filter((item) => item.id === 'RISK_GATE' || item.id === 'EXECUTION_TRACE' || item.id === 'OUTCOME').map((item) => <div key={item.id}><div className={`font-mono text-[6px] uppercase ${item.state === 'PASS' ? 'text-[#72B6A0]' : item.state === 'MISSING' ? 'text-[#C7A96B]' : 'text-[#59636D]'}`}>{item.id} · {item.state}</div><div className="mt-0.5 text-[8px] text-[#59636D]">{item.reason}</div></div>)}</div></div>}</div>;

const HistoryTab = ({ tradeCase, trace }: { tradeCase: TradeCase | null; trace: Trace | null }) => <div className="space-y-1">{(tradeCase?.decisionHistory || []).filter(Boolean).map((item, index) => <div key={`${item?.timestamp}-${index}`} className="grid grid-cols-[70px_72px_minmax(0,1fr)] gap-2 border-b border-white/[0.045] px-2 py-2.5 font-mono text-[6px]"><span className="text-[#4F5963]">{stamp(item?.timestamp)}</span><span className={item?.action === 'ENTER' ? 'text-[#72B6A0]' : item?.action === 'EXIT' ? 'text-[#C7A96B]' : 'text-[#77818B]'}>{item?.action || '—'}</span><div className="min-w-0"><div className="truncate text-[#8A959F]">{item?.primaryReason || 'No persisted reason.'}</div><div className="mt-1 flex flex-wrap gap-2 text-[#46515B]"><span>{item?.regime || '—'}</span><span>score {item?.oracleTradeScore ?? '—'}</span><span>risk {item?.riskDisposition || '—'}</span><span>audit {item?.auditCompleteness?.score ?? '—'}%</span></div></div></div>)}{!(tradeCase?.decisionHistory || []).length && <Empty text={trace ? 'No persistent trade-case history yet; only the current decision trace is available.' : 'No decision history available for this market.'} />}</div>;

const Stat = ({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) => <div className="bg-[#05070A] px-3 py-3"><div className="font-mono text-[5px] uppercase tracking-[0.12em] text-[#46515B]">{label}</div><div className={`mt-1 font-mono text-[9px] ${warning ? 'text-[#C7A96B]' : 'text-[#9FA9B2]'}`}>{value}</div></div>;
const InfoGrid = ({ rows }: { rows: Array<[string, string]> }) => <div className="grid gap-px bg-white/[0.04] sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="bg-[#05070A] p-3"><div className="font-mono text-[5px] uppercase text-[#46515B]">{label}</div><div className="mt-1 text-[9px] text-[#8A959F]">{value}</div></div>)}</div>;
const Frame = ({ label, item }: { label: string; item: { directionalScore: number; confidence: number; regime: string } }) => <div className="bg-[#070A0E] p-3"><div className="font-mono text-[6px] text-[#59636D]">{label}</div><div className="mt-1 font-mono text-[9px] text-[#AEB7BF]">{item.regime}</div><div className="mt-1 font-mono text-[6px] text-[#59636D]">score {item.directionalScore.toFixed(1)} · conf {pct(item.confidence)}</div></div>;
const Empty = ({ text }: { text: string }) => <div className="border border-white/[0.055] bg-[#05070A] px-4 py-12 text-center text-[9px] leading-relaxed text-[#59636D]">{text}</div>;
