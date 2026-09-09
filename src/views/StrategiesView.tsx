import React, { useEffect, useMemo, useState } from 'react';
import { Activity, FlaskConical, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';

type ClosedTrade = {
  id: string;
  market: string;
  openedAt: number;
  closedAt: number;
  netPnl: number;
  returnPct: number;
  strategyVersion?: string | null;
  entryOracleTradeScore?: number | null;
};

type Decision = {
  timestamp: number;
  market: string;
  decision: string;
  regime?: string | null;
  oracleTradeScore?: number | null;
  strategyDisposition?: string | null;
  primaryReason?: string | null;
  evidenceActiveCount?: number | null;
  evidenceIds?: string[];
};

type StatusPayload = {
  success?: boolean;
  available?: boolean;
  status?: string;
  strategyVersion?: string | null;
  recentTrades?: ClosedTrade[];
  decisionTape?: Decision[];
  equityDecisions?: Array<{
    timestamp: number;
    market: string;
    action: string;
    name?: string;
    technicalScore?: number | null;
    evidenceCount?: number;
    oracleTradeScore?: number | null;
    reasons?: string[];
  }>;
};

type FactoryTop = {
  genome: {
    id: string;
    indicators: string[];
    indicatorWeights: Record<string, number>;
    entryThreshold: number;
    exitThreshold: number;
    stopAtrMultiple: number;
    takeProfitR: number;
    correlationPenalty: number;
  };
  metrics: {
    totalSamples: number;
    oosSamples: number;
    oosExpectancy: number;
    sharpe: number;
    sortino: number;
    maxDrawdownPct: number;
    monteCarloSurvivalRate: number;
    regimeStability: number;
    parameterRobustness: number;
  };
  evaluation: { score: number; status: string; hardGatePassed: boolean; hardGateReasons: string[] };
  tradeCount: number;
  oosTradeCount: number;
};

type FactoryRun = {
  id: string;
  market: string;
  timeframe_minutes: number;
  bars: number;
  candidate_count: number;
  seed: number;
  started_at: string;
  finished_at: string;
  status_counts: Record<string, number>;
  top_results: FactoryTop[];
  execution_authority: false;
  promotion_authority: false;
};

type FactoryPayload = { success?: boolean; available?: boolean; latestRun?: FactoryRun | null };

type StrategyRow = {
  version: string;
  trades: number;
  wins: number;
  winRate: number;
  avgReturnPct: number;
  totalReturnPct: number;
  totalPnl: number;
  avgEntryScore: number | null;
  lastUsedAt: number;
};

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
const number = (value: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);

export const StrategiesView: React.FC = () => {
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [factory, setFactory] = useState<FactoryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [tradingResponse, factoryResponse] = await Promise.all([
        fetch('/api/trading-status', { cache: 'no-store' }),
        fetch('/api/strategy-factory-status', { cache: 'no-store' }).catch(() => null),
      ]);
      setPayload(await tradingResponse.json() as StatusPayload);
      setFactory(factoryResponse ? await factoryResponse.json() as FactoryPayload : null);
    } catch {
      setPayload(null);
      setFactory(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', load);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', load);
    };
  }, []);

  const rows = useMemo<StrategyRow[]>(() => {
    const grouped = new Map<string, ClosedTrade[]>();
    for (const trade of payload?.recentTrades ?? []) {
      const key = trade.strategyVersion || 'UNVERSIONED';
      grouped.set(key, [...(grouped.get(key) ?? []), trade]);
    }

    return [...grouped.entries()].map(([version, trades]) => {
      const wins = trades.filter((trade) => trade.netPnl > 0).length;
      const entryScores = trades
        .map((trade) => trade.entryOracleTradeScore)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      return {
        version,
        trades: trades.length,
        wins,
        winRate: trades.length ? wins / trades.length : 0,
        avgReturnPct: trades.length ? trades.reduce((sum, trade) => sum + trade.returnPct, 0) / trades.length : 0,
        totalReturnPct: trades.reduce((sum, trade) => sum + trade.returnPct, 0),
        totalPnl: trades.reduce((sum, trade) => sum + trade.netPnl, 0),
        avgEntryScore: entryScores.length ? entryScores.reduce((a, b) => a + b, 0) / entryScores.length : null,
        lastUsedAt: Math.max(...trades.map((trade) => trade.closedAt)),
      };
    }).sort((a, b) => b.trades - a.trades || b.avgReturnPct - a.avgReturnPct);
  }, [payload?.recentTrades]);

  const latestDecisions = [
    ...(payload?.decisionTape ?? []),
    ...(payload?.equityDecisions ?? []).map((item) => ({
      timestamp: item.timestamp,
      market: item.market,
      decision: item.action,
      regime: 'EQUITY',
      oracleTradeScore: item.oracleTradeScore,
      primaryReason: item.reasons?.[0] || `${item.name || item.market} equity decision`,
      evidenceActiveCount: item.evidenceCount,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  const factoryRun = factory?.latestRun ?? null;
  const factoryTop = factoryRun?.top_results ?? [];

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-24 pt-4 md:px-6 lg:pb-8 xl:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div>
            <div className="font-mono text-[7px] uppercase tracking-[0.22em] text-[#43D9E6]">Strategy competition & oversight</div>
            <h1 className="mt-1 text-xl font-medium text-[#E8EDF1]">STRATEGIES</h1>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-[#66717B]">
              운영 거래의 실제 성과와 Strategy Factory의 OOS 연구 경쟁을 분리해 봅니다. Factory 결과는 Challenger 후보일 뿐 자동 승격·주문 권한이 없습니다.
            </p>
          </div>
          <button onClick={() => void load()} className="flex items-center gap-2 border border-white/[0.08] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#7B8791] hover:text-[#D9E0E5]">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Stat label="Observed versions" value={String(rows.length)} icon={<Activity className="h-3.5 w-3.5" />} />
          <Stat label="Closed sample" value={String(payload?.recentTrades?.length ?? 0)} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
          <Stat label="Factory candidates" value={factoryRun ? String(factoryRun.candidate_count) : '—'} icon={<FlaskConical className="h-3.5 w-3.5" />} />
          <Stat label="Current version" value={payload?.strategyVersion || '—'} icon={<TrendingUp className="h-3.5 w-3.5" />} />
        </div>

        <section className="mt-4 border border-[#43D9E6]/15 bg-[#071015]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
            <div>
              <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#78CAD2]">Strategy Factory · Research Arena</div>
              <div className="mt-1 text-[10px] text-[#5F6B74]">Seeded indicator combinations → historical next-bar execution → OOS → cost stress → Monte Carlo → robustness score.</div>
            </div>
            {factoryRun && <div className="font-mono text-[7px] uppercase tracking-[0.1em] text-[#64717B]">{factoryRun.market} · {factoryRun.timeframe_minutes}m · {factoryRun.bars} bars · seed {factoryRun.seed}</div>}
          </div>
          {factoryRun ? (
            <>
              <div className="grid gap-px border-b border-white/[0.05] bg-white/[0.04] sm:grid-cols-3">
                <FactoryStat label="Candidate" value={factoryRun.status_counts?.CANDIDATE ?? 0} />
                <FactoryStat label="Qualifying" value={factoryRun.status_counts?.QUALIFYING ?? 0} />
                <FactoryStat label="Blocked" value={factoryRun.status_counts?.BLOCKED ?? 0} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left">
                  <thead className="border-b border-white/[0.05] font-mono text-[7px] uppercase tracking-[0.12em] text-[#46515B]">
                    <tr><th className="px-4 py-3">Rank</th><th>Genome</th><th>Indicators</th><th>Score</th><th>Status</th><th>Trades/OOS</th><th>OOS EV</th><th>Sharpe</th><th>MDD</th><th>MC survive</th></tr>
                  </thead>
                  <tbody>
                    {factoryTop.slice(0, 12).map((item, index) => (
                      <tr key={item.genome.id} className="border-b border-white/[0.045] text-[10px] text-[#AAB4BC] last:border-0">
                        <td className="px-4 py-3 font-mono text-[#6CC7CF]">#{index + 1}</td>
                        <td className="max-w-[210px] truncate font-mono text-[8px] text-[#D3D9DE]" title={item.genome.id}>{item.genome.id}</td>
                        <td className="max-w-[300px] text-[9px] text-[#79858E]">{item.genome.indicators.join(' · ')}</td>
                        <td className="font-mono text-[#DCE4E8]">{Number(item.evaluation.score).toFixed(1)}</td>
                        <td><span className={`border px-2 py-1 font-mono text-[7px] ${item.evaluation.hardGatePassed ? 'border-[#6AB7A0]/20 text-[#76B8A5]' : 'border-[#B16B6B]/20 text-[#BE7B7B]'}`}>{item.evaluation.status}</span></td>
                        <td>{item.tradeCount}/{item.oosTradeCount}</td>
                        <td className={item.metrics.oosExpectancy >= 0 ? 'text-[#78BCA7]' : 'text-[#D47A7A]'}>{pct(item.metrics.oosExpectancy)}</td>
                        <td>{Number(item.metrics.sharpe).toFixed(2)}</td>
                        <td>{pct(-Math.abs(item.metrics.maxDrawdownPct))}</td>
                        <td>{pct(item.metrics.monteCarloSurvivalRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!factoryTop.length && <div className="px-4 py-8 text-center text-[11px] text-[#59646E]">최근 Factory run에 저장된 상위 후보가 없습니다.</div>}
            </>
          ) : (
            <div className="px-4 py-10 text-center">
              <div className="text-[11px] text-[#65717A]">아직 persisted Strategy Factory run이 없습니다.</div>
              <div className="mt-1 text-[9px] text-[#48525B]">후보를 임의로 우수하다고 표시하지 않습니다. 실제 OOS 연구 run이 저장되면 여기에 나타납니다.</div>
            </div>
          )}
        </section>

        <section className="mt-4 border border-white/[0.07] bg-[#070B10]">
          <div className="border-b border-white/[0.06] px-4 py-3 font-mono text-[7px] uppercase tracking-[0.18em] text-[#77838D]">Observed live/Paper strategy versions</div>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-white/[0.05] font-mono text-[7px] uppercase tracking-[0.12em] text-[#46515B]">
                  <tr><th className="px-4 py-3">Strategy</th><th>Sample</th><th>Win rate</th><th>Avg return</th><th>Total return</th><th>PnL</th><th>Entry score</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.version} className="border-b border-white/[0.045] text-[11px] text-[#B8C1C8] last:border-0">
                      <td className="px-4 py-3 font-mono text-[10px] text-[#E1E6EA]">{row.version}</td>
                      <td>{row.trades}</td>
                      <td>{pct(row.winRate)}</td>
                      <td className={row.avgReturnPct >= 0 ? 'text-[#78BCA7]' : 'text-[#D47A7A]'}>{pct(row.avgReturnPct)}</td>
                      <td className={row.totalReturnPct >= 0 ? 'text-[#78BCA7]' : 'text-[#D47A7A]'}>{pct(row.totalReturnPct)}</td>
                      <td>{number(row.totalPnl)}</td>
                      <td>{row.avgEntryScore == null ? '—' : row.avgEntryScore.toFixed(1)}</td>
                      <td><span className="border border-white/[0.08] px-2 py-1 font-mono text-[7px] uppercase tracking-[0.1em] text-[#7A858E]">{row.trades < 5 ? 'LOW SAMPLE' : 'OBSERVED'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-[11px] text-[#59646E]">아직 strategyVersion이 기록된 종료 거래가 없습니다.</div>
          )}
        </section>

        <section className="mt-4 border border-white/[0.07] bg-[#070B10]">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#77838D]">Latest decisions</div>
            <div className="mt-1 text-[10px] text-[#56616B]">코인 technical-first와 주식 evidence-first 판단을 같은 감시 화면에서 봅니다.</div>
          </div>
          <div className="divide-y divide-white/[0.045]">
            {latestDecisions.map((item) => (
              <div key={`${item.market}-${item.timestamp}`} className="grid gap-2 px-4 py-3 md:grid-cols-[110px_90px_100px_90px_1fr] md:items-center">
                <div className="font-mono text-[9px] text-[#DCE2E7]">{item.market}</div>
                <div className="font-mono text-[8px] text-[#71CDD5]">{item.decision}</div>
                <div className="font-mono text-[8px] text-[#69747D]">{item.oracleTradeScore == null ? 'score —' : `score ${Number(item.oracleTradeScore).toFixed(1)}`}</div>
                <div className="font-mono text-[7px] text-[#56616B]">EV {item.evidenceActiveCount ?? 0}</div>
                <div className="text-[10px] leading-relaxed text-[#7A858F]">{item.primaryReason || item.strategyDisposition || item.regime || 'No rationale recorded.'}</div>
              </div>
            ))}
            {!latestDecisions.length && <div className="px-4 py-8 text-center text-[11px] text-[#59646E]">최근 decision이 없습니다.</div>}
          </div>
        </section>
      </div>
    </div>
  );
};

const Stat = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="border border-white/[0.07] bg-[#070B10] p-4">
    <div className="flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.15em] text-[#53606A]">{icon}{label}</div>
    <div className="mt-2 truncate font-mono text-lg text-[#DCE3E8]">{value}</div>
  </div>
);

const FactoryStat = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-[#070B10] px-4 py-3">
    <div className="font-mono text-[7px] uppercase tracking-[0.12em] text-[#4C5962]">{label}</div>
    <div className="mt-1 font-mono text-base text-[#C9D2D8]">{value}</div>
  </div>
);
