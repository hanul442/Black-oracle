import React, { useEffect, useMemo, useState } from 'react';
import { Activity, FlaskConical, RefreshCw, ShieldCheck, Trophy } from 'lucide-react';

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

type StatusPayload = {
  success?: boolean;
  recentTrades?: ClosedTrade[];
  strategyVersion?: string | null;
};

type Lifecycle = 'REJECT' | 'INCUBATOR' | 'CHALLENGER' | 'CHAMPION_CANDIDATE';

type FactoryTop = {
  genome: { id: string; generation?: number; indicators: string[]; indicatorWeights?: Record<string, number> };
  hypothesis?: { thesis?: string; parentIds?: string[]; origin?: string };
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
  evaluation: {
    score: number;
    status?: string;
    lifecycle?: Lifecycle;
    hardGatePassed: boolean;
    hardGateReasons: string[];
    fatalReasons?: string[];
    requiresHumanApproval?: true;
  };
  validation?: {
    blind?: { samples: number; expectancy: number; sharpe: number; maxDrawdownPct: number; winRate: number };
    walkForward?: { eligibleFolds: number; positiveFoldRate: number; worstExpectancy: number };
    costStress?: { survivalRate: number; worstExpectancy: number };
    regimeStress?: { eligibleRegimes: number; positiveRegimeRate: number; worstExpectancy: number };
    monteCarloSurvivalRate?: number;
    parameterRobustness?: number;
  };
  blindTradeCount?: number;
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
  factory_version?: string | null;
  generation_count?: number | null;
  blind_fraction?: number | null;
  status_counts?: Record<string, number>;
  lifecycle_counts?: Partial<Record<Lifecycle, number>>;
  top_results: FactoryTop[];
  human_approval_required?: boolean;
  execution_authority: false;
  promotion_authority: false;
};

type FactoryPayload = {
  success?: boolean;
  available?: boolean;
  latestRun?: FactoryRun | null;
  governance?: { automaticChampionPromotion?: boolean; automaticLiveDeployment?: boolean; humanApprovalRequired?: boolean };
};

type StrategyRow = {
  version: string;
  trades: number;
  wins: number;
  winRate: number;
  avgReturnPct: number;
  totalReturnPct: number;
  totalPnl: number;
  avgEntryScore: number | null;
};

const pct = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '—';
const krw = (value: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);

const lifecycleStyle = (lifecycle?: Lifecycle) => {
  if (lifecycle === 'CHAMPION_CANDIDATE') return 'border-[#D2B36A]/30 bg-[#D2B36A]/[0.05] text-[#D5BA78]';
  if (lifecycle === 'CHALLENGER') return 'border-[#43D9E6]/25 bg-[#43D9E6]/[0.04] text-[#7CCDD4]';
  if (lifecycle === 'INCUBATOR') return 'border-white/[0.10] bg-white/[0.02] text-[#929DA6]';
  return 'border-[#B86D6D]/25 bg-[#B86D6D]/[0.04] text-[#C78080]';
};

const Stat = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="border border-white/[0.07] bg-[#070B10] p-4">
    <div className="flex items-center justify-between font-mono text-[7px] uppercase tracking-[0.16em] text-[#56616B]">
      <span>{label}</span>{icon}
    </div>
    <div className="mt-3 font-mono text-[22px] tracking-[-0.04em] text-[#E2E8EC]">{value}</div>
  </div>
);

export const StrategiesView: React.FC = () => {
  const [trading, setTrading] = useState<StatusPayload | null>(null);
  const [factory, setFactory] = useState<FactoryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [tradingResponse, factoryResponse] = await Promise.all([
        fetch('/api/trading-status', { cache: 'no-store' }),
        fetch('/api/strategy-factory-status', { cache: 'no-store' }).catch(() => null),
      ]);
      setTrading(await tradingResponse.json() as StatusPayload);
      setFactory(factoryResponse ? await factoryResponse.json() as FactoryPayload : null);
    } catch {
      setTrading(null);
      setFactory(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const observed = useMemo<StrategyRow[]>(() => {
    const grouped = new Map<string, ClosedTrade[]>();
    for (const trade of trading?.recentTrades ?? []) {
      const version = trade.strategyVersion || 'UNVERSIONED';
      grouped.set(version, [...(grouped.get(version) ?? []), trade]);
    }
    return [...grouped.entries()].map(([version, trades]) => {
      const wins = trades.filter((trade) => trade.netPnl > 0).length;
      const scores = trades.map((trade) => trade.entryOracleTradeScore).filter((value): value is number => typeof value === 'number');
      return {
        version,
        trades: trades.length,
        wins,
        winRate: trades.length ? wins / trades.length : 0,
        avgReturnPct: trades.length ? trades.reduce((sum, trade) => sum + trade.returnPct, 0) / trades.length : 0,
        totalReturnPct: trades.reduce((sum, trade) => sum + trade.returnPct, 0),
        totalPnl: trades.reduce((sum, trade) => sum + trade.netPnl, 0),
        avgEntryScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      };
    }).sort((a, b) => b.trades - a.trades);
  }, [trading?.recentTrades]);

  const run = factory?.latestRun ?? null;
  const top = run?.top_results ?? [];
  const lifecycle = run?.lifecycle_counts ?? {};
  const championCandidates = lifecycle.CHAMPION_CANDIDATE ?? top.filter((item) => item.evaluation.lifecycle === 'CHAMPION_CANDIDATE').length;
  const challengers = lifecycle.CHALLENGER ?? top.filter((item) => item.evaluation.lifecycle === 'CHALLENGER').length;
  const incubators = lifecycle.INCUBATOR ?? run?.status_counts?.QUALIFYING ?? 0;
  const rejected = lifecycle.REJECT ?? run?.status_counts?.BLOCKED ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-24 pt-4 md:px-6 lg:pb-8 xl:px-8">
      <div className="mx-auto max-w-[1580px]">
        <header className="mb-4 flex flex-col justify-between gap-3 border-b border-white/[0.06] pb-4 md:flex-row md:items-end">
          <div>
            <div className="font-mono text-[7px] uppercase tracking-[0.22em] text-[#43D9E6]">Autonomous research · human authority</div>
            <h1 className="mt-1 text-xl font-medium text-[#E8EDF1]">STRATEGY FACTORY</h1>
            <p className="mt-1 max-w-4xl text-[11px] leading-relaxed text-[#67727C]">
              가설 생성 → 세대별 변형/도태 → Backtest/OOS → 잠금 Blind → Walk-forward → Monte Carlo → 비용·슬리피지·레짐 스트레스. 연구 분류는 자동이지만 Champion 승격과 실거래는 인간 승인 없이는 불가능합니다.
            </p>
          </div>
          <button onClick={() => void load()} className="flex items-center gap-2 self-start border border-white/[0.08] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#7D8892] hover:text-[#DCE2E6]">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> refresh
          </button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Champion candidate" value={String(championCandidates)} icon={<Trophy className="h-3.5 w-3.5" />} />
          <Stat label="Challenger" value={String(challengers)} icon={<Activity className="h-3.5 w-3.5" />} />
          <Stat label="Incubator" value={String(incubators)} icon={<FlaskConical className="h-3.5 w-3.5" />} />
          <Stat label="Reject" value={String(rejected)} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
          <Stat label="Observed Paper" value={String(trading?.recentTrades?.length ?? 0)} icon={<Activity className="h-3.5 w-3.5" />} />
        </div>

        <section className="mt-4 border border-[#43D9E6]/15 bg-[#071015]">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
            <div>
              <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#76C8D0]">Research tournament</div>
              <div className="mt-1 text-[10px] text-[#65717A]">
                Blind는 세대 선택이 끝날 때까지 잠금 · 동일 seed 재현 가능 · 모든 후보는 Experiment Ledger 기록
              </div>
            </div>
            <div className="text-right font-mono text-[7px] uppercase leading-relaxed tracking-[0.1em] text-[#59656F]">
              {run ? <>{run.factory_version || 'LEGACY FACTORY'} · {run.market} · {run.timeframe_minutes}m<br />{run.generation_count ?? 1} generations · {run.candidate_count} experiments · blind {pct(run.blind_fraction ?? null)}</> : 'NO PERSISTED RUN'}
            </div>
          </div>

          <div className="border-b border-[#D2B36A]/15 bg-[#D2B36A]/[0.025] px-4 py-2.5 font-mono text-[7px] uppercase tracking-[0.12em] text-[#A99466]">
            AUTHORITY GATE · auto Champion promotion = NO · auto LIVE deployment = NO · human approval required = YES
          </div>

          {run ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1380px] text-left">
                <thead className="border-b border-white/[0.05] font-mono text-[7px] uppercase tracking-[0.11em] text-[#46515B]">
                  <tr>
                    <th className="px-4 py-3">Rank</th><th>Hypothesis / Genome</th><th>Gen</th><th>Lifecycle</th><th>Score</th>
                    <th>Dev OOS EV</th><th>Blind</th><th>Blind EV</th><th>WF +</th><th>Cost survive</th><th>Regime +</th><th>MC survive</th><th>MDD</th><th>Robust</th>
                  </tr>
                </thead>
                <tbody>
                  {top.slice(0, 20).map((item, index) => {
                    const validation = item.validation;
                    const lifecycleName = item.evaluation.lifecycle ?? (item.evaluation.hardGatePassed ? 'CHALLENGER' : 'REJECT');
                    return (
                      <tr key={item.genome.id} className="border-b border-white/[0.045] align-top text-[9px] text-[#9CA7AF] last:border-0">
                        <td className="px-4 py-3 font-mono text-[#6CC7CF]">#{index + 1}</td>
                        <td className="max-w-[360px] py-3 pr-4">
                          <div className="text-[10px] leading-relaxed text-[#D0D7DC]">{item.hypothesis?.thesis || item.genome.indicators.join(' + ')}</div>
                          <div className="mt-1 truncate font-mono text-[7px] text-[#505B65]" title={item.genome.id}>{item.genome.id}</div>
                        </td>
                        <td className="py-3">G{item.genome.generation ?? 1}</td>
                        <td className="py-3"><span className={`border px-2 py-1 font-mono text-[7px] ${lifecycleStyle(lifecycleName)}`}>{lifecycleName}</span></td>
                        <td className="py-3 font-mono text-[#E3E8EB]">{Number(item.evaluation.score).toFixed(1)}</td>
                        <td className={item.metrics.oosExpectancy >= 0 ? 'py-3 text-[#76B8A5]' : 'py-3 text-[#C97878]'}>{pct(item.metrics.oosExpectancy)}</td>
                        <td className="py-3">{validation?.blind?.samples ?? item.blindTradeCount ?? '—'}</td>
                        <td className={(validation?.blind?.expectancy ?? 0) >= 0 ? 'py-3 text-[#76B8A5]' : 'py-3 text-[#C97878]'}>{pct(validation?.blind?.expectancy)}</td>
                        <td className="py-3">{pct(validation?.walkForward?.positiveFoldRate)}</td>
                        <td className="py-3">{pct(validation?.costStress?.survivalRate)}</td>
                        <td className="py-3">{pct(validation?.regimeStress?.positiveRegimeRate)}</td>
                        <td className="py-3">{pct(validation?.monteCarloSurvivalRate ?? item.metrics.monteCarloSurvivalRate)}</td>
                        <td className="py-3">{pct(-Math.abs(validation?.blind?.maxDrawdownPct ?? item.metrics.maxDrawdownPct))}</td>
                        <td className="py-3">{pct(validation?.parameterRobustness ?? item.metrics.parameterRobustness)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!top.length && <div className="px-4 py-10 text-center text-[11px] text-[#5D6872]">Run은 있으나 저장된 상위 Experiment가 없습니다.</div>}
            </div>
          ) : (
            <div className="px-4 py-12 text-center">
              <div className="text-[11px] text-[#68747D]">아직 Autonomous Strategy Factory 결과가 없습니다.</div>
              <div className="mt-1 text-[9px] text-[#49545D]">실제 검증 run이 기록되기 전에는 전략을 임의로 우수하다고 표시하지 않습니다.</div>
            </div>
          )}
        </section>

        <section className="mt-4 border border-white/[0.07] bg-[#070B10]">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#77838D]">Observed Paper strategies</div>
            <div className="mt-1 text-[9px] text-[#515C65]">Research lifecycle와 실제 Paper 성과를 섞지 않습니다. Champion 후보도 이 표본과 별도 인간 검토를 거쳐야 합니다.</div>
          </div>
          {observed.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left">
                <thead className="border-b border-white/[0.05] font-mono text-[7px] uppercase tracking-[0.11em] text-[#46515B]">
                  <tr><th className="px-4 py-3">Strategy</th><th>Sample</th><th>Win rate</th><th>Avg return</th><th>Total return</th><th>PnL</th><th>Entry score</th></tr>
                </thead>
                <tbody>
                  {observed.map((row) => (
                    <tr key={row.version} className="border-b border-white/[0.045] text-[10px] text-[#AAB4BC] last:border-0">
                      <td className="px-4 py-3 font-mono text-[#E0E5E9]">{row.version}</td>
                      <td>{row.trades}</td><td>{pct(row.winRate)}</td>
                      <td className={row.avgReturnPct >= 0 ? 'text-[#76B8A5]' : 'text-[#C97878]'}>{pct(row.avgReturnPct)}</td>
                      <td>{pct(row.totalReturnPct)}</td><td>{krw(row.totalPnl)}</td><td>{row.avgEntryScore == null ? '—' : row.avgEntryScore.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="px-4 py-10 text-center text-[11px] text-[#59646E]">아직 strategyVersion이 기록된 종료 거래가 없습니다.</div>}
        </section>
      </div>
    </div>
  );
};
