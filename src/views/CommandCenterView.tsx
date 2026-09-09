import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Database,
  Eye,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';
import { useAppContext } from '../store';

type CouncilMember = { role: string; vote: string; confidence: number; reasons: string[] };
type Council = {
  mode: string;
  executionAuthority: boolean;
  verdict: string;
  approveCount: number;
  cautionCount: number;
  rejectCount: number;
  abstainCount: number;
  members: CouncilMember[];
  summary: string;
};

type Decision = {
  timestamp: number;
  market: string;
  decision: string;
  regime?: string | null;
  regimeConfidence?: number | null;
  oracleTradeScore?: number | null;
  confidence?: number | null;
  strategyDisposition?: string | null;
  riskDisposition?: string | null;
  evidenceActiveCount?: number;
  evidenceIds?: string[];
  primaryReason?: string | null;
  reasons?: string[];
  council?: Council | null;
  router?: any;
  forecast?: any;
  technicalEvidence?: any;
  structure?: any;
  microstructure?: any;
  tradeMap?: any;
};

type Position = {
  market: string;
  quantity: number;
  entryPrice: number;
  markPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  stopLossPrice?: number | null;
  takeProfit1Price?: number | null;
  takeProfit2Price?: number | null;
  takeProfit1Taken?: boolean;
  protectionRevision?: number;
  openedAt: number;
};

type Trade = {
  id: string;
  market: string;
  closedAt: number;
  netPnl: number;
  returnPct: number;
  exitReason?: string;
  strategyVersion?: string | null;
};

type Evidence = {
  id: string;
  market: string;
  title: string;
  direction: string;
  source_type?: string;
  source?: string | null;
  evidence_grade?: string | null;
  evidence_score?: number | null;
  eligible_for_new_risk?: boolean;
  observed_at: string;
  rationale?: string;
};

type EquityDecision = {
  timestamp: number;
  market: string;
  name?: string;
  action: string;
  price: number;
  technicalScore?: number | null;
  evidenceScore?: number | null;
  waveScore?: number | null;
  intradayAction?: string | null;
  relativeVolume?: number | null;
  priceVsVwapPct?: number | null;
  volumeAbsorptionScore?: number | null;
  volumeAbsorptionDirection?: string | null;
  currentVsReferenceVolume?: number | null;
  absorptionCandidate?: boolean | null;
  reasons?: string[];
};

type StatusPayload = {
  success?: boolean;
  available?: boolean;
  status?: string;
  now?: number;
  mode?: string;
  strategyVersion?: string | null;
  checkpoint?: { savedAt?: number; reason?: string; runtimeId?: string; backend?: string };
  loop?: {
    cycleCount?: number;
    ageMs?: number | null;
    stale?: boolean;
    lastCycle?: {
      scanned?: number;
      entered?: number;
      exited?: number;
      held?: number;
      noTrade?: number;
      errors?: any[];
      evidenceOps?: any;
      equityCycle?: any;
    } | null;
  };
  portfolio?: {
    initialEquity?: number;
    equity?: number;
    cash?: number;
    realizedPnl?: number;
    feesPaid?: number;
    dailyPnlPct?: number;
    currentDrawdownPct?: number;
    openPositions?: Position[];
  };
  ingestion?: {
    evidenceActive?: number;
    externalEvidenceActive?: number;
    evidenceRequests?: number;
    narsInboxRecent?: number;
    lastCycleErrors?: number;
  };
  council?: { mode?: string; executionAuthority?: boolean; latest?: Council | null; stats?: { reviewed: number; approve: number; conditional: number; reject: number } };
  evidenceFlow?: Evidence[];
  decisionTape?: Decision[];
  equityDecisions?: EquityDecision[];
  recentTrades?: Trade[];
};

const fmtKrw = (value: number | null | undefined) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Number(value ?? 0));
const pct = (value: number | null | undefined, digits = 2) => `${(Number(value ?? 0) * 100).toFixed(digits)}%`;
const ago = (timestamp?: number | null) => {
  if (!timestamp) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
};

const tone = (value?: string | null) => {
  const normalized = String(value || '').toUpperCase();
  if (['OK', 'PASS', 'APPROVE', 'ENTER', 'BULLISH', 'ACTIVE', 'HOLD'].includes(normalized)) return 'text-[#77B9A5]';
  if (['REJECT', 'ERROR', 'BEARISH', 'EXIT', 'DEGRADED'].includes(normalized)) return 'text-[#D07D7D]';
  if (['CONDITIONAL', 'CAUTION', 'WAIT', 'NO_TRADE', 'EVIDENCE_REQUESTED'].includes(normalized)) return 'text-[#C7AA71]';
  return 'text-[#9AA5AE]';
};

const Card = ({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) => (
  <section className={`border border-white/[0.07] bg-[#070B10] ${className}`}>{children}</section>
);

const Kicker = ({ children }: React.PropsWithChildren) => (
  <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#58636D]">{children}</div>
);

export const CommandCenterView: React.FC = () => {
  const { setCurrentView } = useAppContext() as any;
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Decision | EquityDecision | null>(null);

  const load = async () => {
    try {
      const response = await fetch('/api/trading-status', { cache: 'no-store' });
      setPayload(await response.json() as StatusPayload);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', load);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', load);
    };
  }, []);

  const positions = payload?.portfolio?.openPositions ?? [];
  const decisions = payload?.decisionTape ?? [];
  const equityDecisions = payload?.equityDecisions ?? [];
  const evidence = payload?.evidenceFlow ?? [];
  const trades = payload?.recentTrades ?? [];
  const latestCouncil = payload?.council?.latest ?? decisions.find((item) => item.council)?.council ?? null;
  const latestDecision = decisions[0] ?? null;
  const latestEquityDecision = equityDecisions[0] ?? null;
  const totalUnrealized = useMemo(() => positions.reduce((sum, item) => sum + Number(item.unrealizedPnl || 0), 0), [positions]);

  const statusCells = [
    { label: 'Runtime', value: payload?.status || 'UNKNOWN', sub: payload?.checkpoint?.runtimeId || 'no checkpoint' },
    { label: 'NARS', value: (payload?.ingestion?.narsInboxRecent ?? 0) > 0 ? 'CONNECTED' : 'WAITING', sub: `${payload?.ingestion?.narsInboxRecent ?? 0} inbox · ${payload?.ingestion?.externalEvidenceActive ?? 0} active` },
    { label: 'Evidence', value: String(payload?.ingestion?.externalEvidenceActive ?? 0), sub: `${payload?.ingestion?.evidenceRequests ?? 0} requests` },
    { label: 'Council', value: latestCouncil?.verdict || 'NOT OBSERVED', sub: `${payload?.council?.mode || 'SHADOW'} · authority NO` },
    { label: 'Strategy', value: latestDecision?.strategyDisposition || payload?.strategyVersion || '—', sub: latestDecision?.market || 'no recent decision' },
    { label: 'Risk', value: latestDecision?.riskDisposition || 'NOT EVALUATED', sub: latestDecision?.decision || '—' },
    { label: 'Paper', value: payload?.mode || 'PAPER', sub: `${positions.length} open positions` },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-24 pt-4 md:px-6 lg:pb-8 xl:px-8">
      <div className="mx-auto max-w-[1560px]">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div>
            <div className="font-mono text-[7px] uppercase tracking-[0.22em] text-[#43D9E6]">Black Oracle · unified runtime</div>
            <h1 className="mt-1 text-2xl font-medium tracking-[-0.035em] text-[#EDF1F4]">ORACLE</h1>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#65707A]">현재 시스템이 무엇을 보고, 어떤 전략을 선택하고, 왜 거래하거나 기다리는지 실제 Paper runtime만 표시합니다.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentView('strategies')} className="border border-white/[0.08] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.12em] text-[#73808A]">Strategies</button>
            <button onClick={() => setCurrentView('log')} className="border border-white/[0.08] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.12em] text-[#73808A]">Full log</button>
            <button onClick={() => void load()} className="flex items-center gap-2 border border-[#43D9E6]/20 px-3 py-2 font-mono text-[7px] uppercase tracking-[0.12em] text-[#78C8D0]"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> refresh</button>
          </div>
        </header>

        <div className="mb-4 grid grid-cols-2 gap-px border border-white/[0.07] bg-white/[0.07] sm:grid-cols-4 xl:grid-cols-7">
          {statusCells.map((cell) => (
            <div key={cell.label} className="min-w-0 bg-[#070B10] p-3.5">
              <Kicker>{cell.label}</Kicker>
              <div className={`mt-2 truncate font-mono text-[11px] ${tone(cell.value)}`}>{cell.value}</div>
              <div className="mt-1 truncate text-[8px] text-[#505B65]">{cell.sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-4 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
          <Card>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div><Kicker>Portfolio</Kicker><div className="mt-1 text-[13px] text-[#DDE3E7]">₩100M unified Paper capital</div></div>
              <WalletCards className="h-4 w-4 text-[#65717B]" />
            </div>
            <div className="grid grid-cols-2 gap-px bg-white/[0.05] sm:grid-cols-4">
              <Metric label="Equity" value={`₩${fmtKrw(payload?.portfolio?.equity)}`} />
              <Metric label="Cash" value={`₩${fmtKrw(payload?.portfolio?.cash)}`} />
              <Metric label="Realized" value={`₩${fmtKrw(payload?.portfolio?.realizedPnl)}`} valueClass={Number(payload?.portfolio?.realizedPnl ?? 0) >= 0 ? 'text-[#77B9A5]' : 'text-[#D07D7D]'} />
              <Metric label="Unrealized" value={`₩${fmtKrw(totalUnrealized)}`} valueClass={totalUnrealized >= 0 ? 'text-[#77B9A5]' : 'text-[#D07D7D]'} />
            </div>
            <div className="divide-y divide-white/[0.045]">
              {positions.map((position) => {
                const ret = position.entryPrice > 0 ? (position.markPrice - position.entryPrice) / position.entryPrice : 0;
                return (
                  <button key={position.market} onClick={() => setCurrentView('log')} className="grid w-full gap-2 px-4 py-3 text-left sm:grid-cols-[105px_90px_90px_1fr] sm:items-center">
                    <div className="font-mono text-[9px] text-[#E1E6EA]">{position.market}</div>
                    <div className={`font-mono text-[9px] ${ret >= 0 ? 'text-[#77B9A5]' : 'text-[#D07D7D]'}`}>{pct(ret)}</div>
                    <div className="font-mono text-[8px] text-[#67727C]">₩{fmtKrw(position.markPrice)}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[7px] uppercase tracking-[0.08em] text-[#535E68]">
                      <span>SL {position.stopLossPrice == null ? '—' : fmtKrw(position.stopLossPrice)}</span>
                      <span>TP1 {position.takeProfit1Price == null ? '—' : fmtKrw(position.takeProfit1Price)}</span>
                      <span>TP2 {position.takeProfit2Price == null ? '—' : fmtKrw(position.takeProfit2Price)}</span>
                      <span>rev {position.protectionRevision ?? 0}</span>
                    </div>
                  </button>
                );
              })}
              {!positions.length && <div className="px-4 py-8 text-center text-[10px] text-[#58636D]">현재 열린 Paper 포지션이 없습니다.</div>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div><Kicker>Shadow Council</Kicker><div className="mt-1 text-[12px] text-[#D4DBE0]">실행권 없는 독립 검토 계층</div></div>
              <Bot className="h-4 w-4 text-[#6EC9D1]" />
            </div>
            {latestCouncil ? (
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className={`font-mono text-lg ${tone(latestCouncil.verdict)}`}>{latestCouncil.verdict}</div>
                  <div className="font-mono text-[7px] uppercase tracking-[0.12em] text-[#56616B]">execution authority · NO</div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-px bg-white/[0.05]">
                  <Mini label="Approve" value={latestCouncil.approveCount} />
                  <Mini label="Caution" value={latestCouncil.cautionCount} />
                  <Mini label="Reject" value={latestCouncil.rejectCount} />
                  <Mini label="Abstain" value={latestCouncil.abstainCount} />
                </div>
                <div className="mt-3 divide-y divide-white/[0.045]">
                  {latestCouncil.members.map((member) => (
                    <div key={member.role} className="flex items-start justify-between gap-3 py-2.5">
                      <div><div className="font-mono text-[8px] text-[#BBC4CB]">{member.role}</div><div className="mt-1 line-clamp-2 text-[9px] leading-4 text-[#66727C]">{member.reasons?.[0]}</div></div>
                      <div className={`shrink-0 font-mono text-[8px] ${tone(member.vote)}`}>{member.vote}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="px-4 py-10 text-center text-[10px] text-[#58636D]">새 runtime cycle 이후 Council trace가 생성됩니다.</div>}
          </Card>
        </div>

        <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3"><div><Kicker>Latest decisions</Kicker><div className="mt-1 text-[10px] text-[#5C6771]">클릭하면 전체 Decision Trace</div></div><Eye className="h-4 w-4 text-[#59656F]" /></div>
            <div className="divide-y divide-white/[0.045]">
              {decisions.slice(0, 8).map((item) => (
                <button key={`${item.market}-${item.timestamp}`} onClick={() => setSelected(item)} className="grid w-full gap-2 px-4 py-3 text-left sm:grid-cols-[100px_86px_105px_1fr] sm:items-center">
                  <div className="font-mono text-[9px] text-[#DDE3E7]">{item.market}</div>
                  <div className={`font-mono text-[8px] ${tone(item.decision)}`}>{item.decision}</div>
                  <div className="font-mono text-[7px] text-[#5E6973]">{item.strategyDisposition || '—'} · {item.oracleTradeScore == null ? '—' : item.oracleTradeScore.toFixed(1)}</div>
                  <div className="truncate text-[9px] text-[#78838C]">{item.primaryReason || item.reasons?.[0] || 'No rationale recorded.'}</div>
                </button>
              ))}
              {!decisions.length && <div className="px-4 py-8 text-center text-[10px] text-[#58636D]">최근 crypto decision이 없습니다.</div>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3"><div><Kicker>KRX daily → minute timing</Kicker><div className="mt-1 text-[10px] text-[#5C6771]">일봉 선정 · Evidence · 분봉/거래량 타이밍</div></div><TrendingUp className="h-4 w-4 text-[#59656F]" /></div>
            <div className="divide-y divide-white/[0.045]">
              {equityDecisions.slice(0, 8).map((item) => (
                <button key={`${item.market}-${item.timestamp}`} onClick={() => setSelected(item)} className="grid w-full gap-2 px-4 py-3 text-left sm:grid-cols-[100px_90px_85px_1fr] sm:items-center">
                  <div><div className="font-mono text-[9px] text-[#DDE3E7]">{item.market}</div><div className="mt-1 truncate text-[8px] text-[#505B64]">{item.name}</div></div>
                  <div className={`font-mono text-[8px] ${tone(item.action)}`}>{item.action}</div>
                  <div className="font-mono text-[7px] text-[#66717A]">{item.intradayAction || 'daily only'}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[7px] text-[#59656E]">
                    <span>RVOL {item.relativeVolume == null ? '—' : `${item.relativeVolume.toFixed(2)}x`}</span>
                    <span>VWAP {item.priceVsVwapPct == null ? '—' : pct(item.priceVsVwapPct)}</span>
                    <span>ABS {item.volumeAbsorptionScore == null ? '—' : item.volumeAbsorptionScore.toFixed(0)}</span>
                    {item.absorptionCandidate && <span className="text-[#77B9A5]">ABSORPTION</span>}
                  </div>
                </button>
              ))}
              {!equityDecisions.length && <div className="px-4 py-8 text-center text-[10px] text-[#58636D]">KIS 미설정 또는 아직 KRX cycle이 없습니다.</div>}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <Card>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3"><div><Kicker>NARS Evidence flow</Kicker><div className="mt-1 text-[10px] text-[#5C6771]">Black Oracle에 실제 전달·분석된 Evidence만 표시</div></div><Database className="h-4 w-4 text-[#59656F]" /></div>
            <div className="divide-y divide-white/[0.045]">
              {evidence.slice(0, 8).map((item) => (
                <div key={item.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[100px_75px_1fr] sm:items-start">
                  <div className="font-mono text-[8px] text-[#D6DDE2]">{item.market}</div>
                  <div className={`font-mono text-[7px] ${tone(item.direction)}`}>{item.evidence_grade || item.direction}</div>
                  <div><div className="text-[10px] leading-4 text-[#A8B2B9]">{item.title}</div><div className="mt-1 line-clamp-2 text-[9px] leading-4 text-[#59656E]">{item.rationale || item.source || item.source_type}</div></div>
                </div>
              ))}
              {!evidence.length && <div className="px-4 py-8 text-center text-[10px] text-[#58636D]">NARS EvidencePacket consumer의 첫 전달을 기다리고 있습니다.</div>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3"><div><Kicker>Recent trades</Kicker><div className="mt-1 text-[10px] text-[#5C6771]">종료 거래 · 결과는 Strategies 평가로 환류</div></div><Activity className="h-4 w-4 text-[#59656F]" /></div>
            <div className="divide-y divide-white/[0.045]">
              {trades.slice(0, 8).map((trade) => (
                <button key={trade.id} onClick={() => setCurrentView('log')} className="grid w-full grid-cols-[90px_75px_1fr] items-center gap-2 px-4 py-3 text-left">
                  <div className="font-mono text-[8px] text-[#D5DCE1]">{trade.market}</div>
                  <div className={`font-mono text-[8px] ${trade.returnPct >= 0 ? 'text-[#77B9A5]' : 'text-[#D07D7D]'}`}>{pct(trade.returnPct)}</div>
                  <div className="truncate text-[9px] text-[#66717A]">{trade.exitReason || trade.strategyVersion || 'closed trade'}</div>
                </button>
              ))}
              {!trades.length && <div className="px-4 py-8 text-center text-[10px] text-[#58636D]">종료 거래가 없습니다.</div>}
            </div>
          </Card>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border border-white/[0.06] bg-[#06090D] px-4 py-2.5 font-mono text-[7px] uppercase tracking-[0.1em] text-[#4D5862]">
          <span>checkpoint {payload?.checkpoint?.savedAt ? `${ago(payload.checkpoint.savedAt)} ago` : '—'} · cycle {payload?.loop?.cycleCount ?? 0}</span>
          <span className="text-[#6FBAA3]">paper only · no automatic live promotion · council shadow</span>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[180] flex justify-end bg-black/60" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-[560px] overflow-y-auto border-l border-white/[0.08] bg-[#070B10] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div><Kicker>Decision trace</Kicker><div className="mt-1 font-mono text-lg text-[#E7ECEF]">{(selected as any).market}</div></div>
              <button onClick={() => setSelected(null)} className="border border-white/[0.07] p-2 text-[#68737C]"><X className="h-3.5 w-3.5" /></button>
            </div>
            <TraceSection title="Raw trace" value={selected} />
          </aside>
        </div>
      )}
    </div>
  );
};

const Metric = ({ label, value, valueClass = 'text-[#DDE3E7]' }: { label: string; value: string; valueClass?: string }) => (
  <div className="bg-[#070B10] p-3.5"><Kicker>{label}</Kicker><div className={`mt-2 font-mono text-[13px] ${valueClass}`}>{value}</div></div>
);

const Mini = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-[#080C11] px-2 py-2 text-center"><div className="font-mono text-[6px] uppercase text-[#505B64]">{label}</div><div className="mt-1 font-mono text-[10px] text-[#C7CFD5]">{value}</div></div>
);

const TraceSection = ({ title, value }: { title: string; value: unknown }) => (
  <section className="mt-4 border border-white/[0.07] bg-[#05080C]">
    <div className="border-b border-white/[0.06] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#5F6A74]">{title}</div>
    <pre className="whitespace-pre-wrap break-words p-3 font-mono text-[9px] leading-5 text-[#87929B]">{JSON.stringify(value, null, 2)}</pre>
  </section>
);
