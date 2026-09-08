import React, { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';

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
};

type StatusPayload = {
  success?: boolean;
  available?: boolean;
  status?: string;
  strategyVersion?: string | null;
  recentTrades?: ClosedTrade[];
  decisionTape?: Decision[];
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
  lastUsedAt: number;
};

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
const number = (value: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);

export const StrategiesView: React.FC = () => {
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const response = await fetch('/api/trading-status', { cache: 'no-store' });
      const next = await response.json() as StatusPayload;
      setPayload(next);
    } catch {
      setPayload(null);
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

  const latestDecisions = (payload?.decisionTape ?? []).slice(0, 8);

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-24 pt-4 md:px-6 lg:pb-8 xl:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div>
            <div className="font-mono text-[7px] uppercase tracking-[0.22em] text-[#43D9E6]">Strategy oversight</div>
            <h1 className="mt-1 text-xl font-medium text-[#E8EDF1]">STRATEGIES</h1>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#66717B]">
              실제 Paper 거래에 기록된 전략 버전만 집계합니다. 표본이 부족한 전략에는 임의 점수나 등급을 부여하지 않습니다.
            </p>
          </div>
          <button onClick={() => void load()} className="flex items-center gap-2 border border-white/[0.08] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#7B8791] hover:text-[#D9E0E5]">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Stat label="Observed versions" value={String(rows.length)} icon={<Activity className="h-3.5 w-3.5" />} />
          <Stat label="Closed sample" value={String(payload?.recentTrades?.length ?? 0)} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
          <Stat label="Current version" value={payload?.strategyVersion || '—'} icon={<TrendingUp className="h-3.5 w-3.5" />} />
        </div>

        <section className="mt-4 border border-white/[0.07] bg-[#070B10]">
          <div className="border-b border-white/[0.06] px-4 py-3 font-mono text-[7px] uppercase tracking-[0.18em] text-[#77838D]">Observed strategy leaderboard</div>
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
            <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#77838D]">Latest router decisions</div>
            <div className="mt-1 text-[10px] text-[#56616B]">현재 엔진이 어떤 시장을 왜 통과·보류했는지 감시합니다.</div>
          </div>
          <div className="divide-y divide-white/[0.045]">
            {latestDecisions.map((item) => (
              <div key={`${item.market}-${item.timestamp}`} className="grid gap-2 px-4 py-3 md:grid-cols-[110px_90px_100px_1fr] md:items-center">
                <div className="font-mono text-[9px] text-[#DCE2E7]">{item.market}</div>
                <div className="font-mono text-[8px] text-[#71CDD5]">{item.decision}</div>
                <div className="font-mono text-[8px] text-[#69747D]">{item.oracleTradeScore == null ? 'score —' : `score ${item.oracleTradeScore.toFixed(1)}`}</div>
                <div className="text-[10px] leading-relaxed text-[#7A858F]">{item.primaryReason || item.strategyDisposition || item.regime || 'No rationale recorded.'}</div>
              </div>
            ))}
            {!latestDecisions.length && <div className="px-4 py-8 text-center text-[11px] text-[#59646E]">최근 router decision이 없습니다.</div>}
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
