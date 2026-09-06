import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Database,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';

type MicrostructureView = {
  available: boolean;
  sampleTrades: number;
  sampleCoverageMs: number | null;
  takerImbalance: number | null;
  orderbookImbalanceTop5: number | null;
  orderbookImbalanceTop15: number | null;
  orderbookImbalanceTop30: number | null;
  pressureScore: number | null;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNAVAILABLE';
  confidence: number;
  pointOfControl: number | null;
  valueAreaLow: number | null;
  valueAreaHigh: number | null;
  profileLocation: 'ABOVE_VALUE' | 'IN_VALUE' | 'BELOW_VALUE' | 'AT_POC' | 'UNAVAILABLE';
};

type ChallengerView = {
  available: boolean;
  baselineAction: string;
  baselineOracleScore: number;
  alignment: 'SUPPORTS' | 'CONFLICTS' | 'NEUTRAL' | 'UNAVAILABLE';
  pressureScore: number | null;
  shadowScoreAdjustment: number;
  shadowOracleScore: number;
  confidence: number;
};

type DecisionTapeItem = {
  timestamp: number;
  market: string;
  decision: string;
  regime?: string | null;
  regimeConfidence?: number | null;
  oracleTradeScore: number | null;
  confidence?: number | null;
  strategyDisposition?: string | null;
  riskDisposition?: 'APPROVE' | 'REJECT' | 'NOT_EVALUATED' | string;
  eventScore?: number | null;
  forecast?: null | {
    available: boolean;
    direction: string;
    probabilityBullish: number | null;
    probabilityBearish: number | null;
    confidence: number;
    uncertainty: number;
  };
  evidenceActiveCount?: number;
  evidenceContradictionCount?: number;
  evidenceIds?: string[];
  microstructure?: MicrostructureView | null;
  challenger?: ChallengerView | null;
  primaryReason?: string | null;
  reasons?: string[];
  riskReasons?: string[];
};

type ClosedTrade = {
  id: string;
  market: string;
  openedAt: number;
  closedAt: number;
  entryPrice: number;
  exitPrice: number;
  netPnl: number;
  returnPct: number;
  fees: number;
  exitReason: string;
  strategyVersion: string;
  entryOracleTradeScore: number;
  exitOracleTradeScore: number;
  entryAudit?: null | {
    microstructure?: MicrostructureView | null;
    challenger?: ChallengerView | null;
  };
};

type OperationsPayload = {
  success: boolean;
  available: boolean;
  status: 'OK' | 'DEGRADED' | 'WAITING' | 'ERROR' | 'UNAVAILABLE';
  now?: number;
  mode?: 'PAPER';
  strategyVersion?: string | null;
  message?: string;
  error?: string;
  checkpoint?: {
    savedAt: number;
    reason: string;
    runtimeId: string;
    backend: string;
  };
  loop?: {
    cycleCount: number;
    intervalMs: number;
    maxMarkets: number;
    maxOpenPositions: number;
    lastCycle: null | {
      startedAt: number;
      finishedAt: number;
      durationMs: number;
      scanned: number;
      entered: number;
      exited: number;
      held: number;
      noTrade?: number;
      errors: Array<{ market: string; error: string }>;
    };
    ageMs: number | null;
    stale: boolean;
  };
  portfolio?: {
    initialEquity: number;
    equity: number;
    cash: number;
    realizedPnl: number;
    feesPaid: number;
    dailyPnlPct: number;
    currentDrawdownPct: number;
    openPositions: Array<{
      market: string;
      quantity: number;
      averageCost: number;
      entryPrice: number;
      openedAt: number;
      stopLossPrice: number | null;
      takeProfitPrice: number | null;
    }>;
  };
  performance?: {
    trades: number;
    wins: number;
    losses: number;
    breakeven: number;
    winRate: number;
    grossProfit: number;
    grossLoss: number;
    netPnl: number;
    expectancy: number;
    avgWin: number;
    avgLoss: number;
    payoffRatio: number | null;
    profitFactor: number | null;
    avgReturnPct: number;
    totalReturnPct: number;
    maxDrawdownPct: number;
    currentDrawdownPct: number;
    buckets: Array<{
      label: string;
      trades: number;
      wins: number;
      winRate: number;
      avgReturnPct: number;
      netPnl: number;
    }>;
    microstructureBuckets?: Array<{
      alignment: 'SUPPORTS' | 'CONFLICTS' | 'NEUTRAL' | 'UNAVAILABLE';
      trades: number;
      wins: number;
      winRate: number;
      avgReturnPct: number;
      netPnl: number;
    }>;
  };
  ingestion?: {
    markedMarkets: number;
    evidenceTotal: number;
    evidenceActive: number;
    evidenceExpired: number;
    scannedMarketsLastCycle: number;
    lastCycleErrors: number;
  };
  equityCurve?: Array<{ timestamp: number; equity: number }>;
  decisionTape?: DecisionTapeItem[];
  recentTrades?: ClosedTrade[];
};

const money = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const formatMoney = (value: number | null | undefined) => value == null ? '—' : `₩${money.format(value)}`;
const formatPct = (value: number | null | undefined, signed = false) => {
  if (value == null || !Number.isFinite(value)) return '—';
  const points = value * 100;
  return `${signed && points > 0 ? '+' : ''}${number.format(points)}%`;
};
const formatTime = (timestamp: number | null | undefined) => timestamp
  ? new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(timestamp))
  : '—';
const formatAge = (ms: number | null | undefined) => {
  if (ms == null) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${number.format(ms / 3_600_000)}h`;
};
const formatSignedScore = (value: number | null | undefined) => value == null || !Number.isFinite(value)
  ? '—'
  : `${value > 0 ? '+' : ''}${number.format(value)}`;

export const OperationsView: React.FC = () => {
  const [data, setData] = useState<OperationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/trading-status', { cache: 'no-store' });
      const payload = await response.json() as OperationsPayload;
      setData(payload);
      setError(response.ok ? null : payload.error || 'Trading status request failed.');
      setLastFetchedAt(Date.now());
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Trading status request failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const statusTone = data?.status === 'OK'
    ? 'text-[#72B6A0] border-[#72B6A0]/25 bg-[#72B6A0]/[0.035]'
    : data?.status === 'DEGRADED' || data?.status === 'ERROR'
      ? 'text-[#D66565] border-[#D66565]/25 bg-[#D66565]/[0.035]'
      : 'text-[#C7A96B] border-[#C7A96B]/25 bg-[#C7A96B]/[0.035]';

  return (
    <div className="h-full overflow-y-auto bg-[#05070A] px-4 pb-36 pt-5 text-[#E9EDF1] md:px-6 md:pb-28 xl:px-8">
      <div className="mx-auto max-w-[1520px]">
        <header className="mb-4 flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[7px] uppercase tracking-[0.22em] text-[#70CAD2]">
              <Activity className="h-3.5 w-3.5" /> Operations
            </div>
            <h1 className="text-[28px] font-medium tracking-[-0.04em] md:text-[34px]">Paper Engine</h1>
            <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-[#68737D] md:text-xs">
              Runtime, decision, portfolio, performance, and data-ingestion state sourced from the persisted Paper checkpoint. Unavailable metrics remain explicitly unavailable.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2.5 py-2 font-mono text-[7px] uppercase tracking-[0.16em] ${statusTone}`}>
              {data?.status || (loading ? 'LOADING' : 'UNKNOWN')}
            </span>
            <span className="border border-white/[0.07] px-2.5 py-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#5D6873]">
              {data?.mode || 'PAPER'}
            </span>
            <button
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className="flex items-center gap-2 border border-white/[0.08] px-3 py-2 font-mono text-[7px] uppercase tracking-[0.14em] text-[#78838D] transition hover:border-[#43D9E6]/25 hover:text-[#D9E0E5]"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 flex items-start gap-3 border border-[#D66565]/25 bg-[#D66565]/[0.03] p-4 text-[11px] leading-relaxed text-[#D7A2A2]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-mono text-[7px] uppercase tracking-[0.16em]">Runtime read failed</div>
              <div className="mt-1 text-[#A77878]">{error}</div>
            </div>
          </div>
        )}

        {!loading && data && !data.available ? (
          <EmptyRuntime message={data.message || data.error || 'No Paper checkpoint is currently available.'} />
        ) : (
          <>
            <MetricStrip data={data} />

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
              <Panel>
                <PanelHeader
                  title="Live decision tape"
                  eyebrow="Latest cycle"
                  detail={data?.loop?.lastCycle
                    ? `${data.loop.lastCycle.scanned} scanned · ${data.loop.lastCycle.noTrade ?? 0} no trade`
                    : 'awaiting cycle'}
                />
                <DecisionTape items={data?.decisionTape || []} />
              </Panel>

              <Panel>
                <PanelHeader title="Equity / drawdown" eyebrow="Paper portfolio" detail={`${data?.equityCurve?.length || 0} points`} />
                <EquityChart points={data?.equityCurve || []} />
                <div className="grid grid-cols-2 gap-px border-t border-white/[0.06] bg-white/[0.04] sm:grid-cols-4">
                  <MiniStat label="TOTAL RETURN" value={formatPct(data?.performance?.totalReturnPct, true)} tone={(data?.performance?.totalReturnPct || 0) >= 0 ? 'positive' : 'negative'} />
                  <MiniStat label="MAX DD" value={formatPct(data?.performance?.maxDrawdownPct)} tone="negative" />
                  <MiniStat label="EXPECTANCY" value={formatMoney(data?.performance?.expectancy)} />
                  <MiniStat label="PROFIT FACTOR" value={data?.performance?.profitFactor == null ? '—' : number.format(data.performance.profitFactor)} />
                </div>
              </Panel>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
              <Panel>
                <PanelHeader title="Microstructure shadow" eyebrow="Executed flow + displayed depth" detail="no order authority" />
                <MicrostructureTape items={data?.decisionTape || []} />
              </Panel>
              <Panel>
                <PanelHeader title="Challenger calibration" eyebrow="Closed-trade outcomes" detail={`${data?.performance?.trades || 0} total`} />
                <ChallengerBuckets buckets={data?.performance?.microstructureBuckets || []} />
              </Panel>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Panel>
                <PanelHeader title="Data ingestion" eyebrow="Observed inputs" detail="real checkpoint fields" />
                <div className="divide-y divide-white/[0.05] px-4 py-1">
                  <StatusRow label="Marked markets" value={String(data?.ingestion?.markedMarkets ?? '—')} />
                  <StatusRow label="Markets scanned / cycle" value={String(data?.ingestion?.scannedMarketsLastCycle ?? '—')} />
                  <StatusRow label="Evidence active" value={String(data?.ingestion?.evidenceActive ?? '—')} />
                  <StatusRow label="Evidence expired" value={String(data?.ingestion?.evidenceExpired ?? '—')} />
                  <StatusRow
                    label="Evidence contradictions / cycle"
                    value={String((data?.decisionTape || []).reduce((sum, item) => sum + (item.evidenceContradictionCount || 0), 0))}
                  />
                  <StatusRow label="Microstructure available / cycle" value={String((data?.decisionTape || []).filter((item) => item.microstructure?.available).length)} />
                  <StatusRow label="Cycle errors" value={String(data?.ingestion?.lastCycleErrors ?? '—')} danger={(data?.ingestion?.lastCycleErrors || 0) > 0} />
                  <StatusRow label="15m / 1h / 4h freshness" value="Not persisted yet" muted />
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Runtime health" eyebrow="Scheduler checkpoint" detail={data?.loop?.stale ? 'stale' : 'fresh'} />
                <div className="divide-y divide-white/[0.05] px-4 py-1">
                  <StatusRow label="Cycle count" value={String(data?.loop?.cycleCount ?? '—')} />
                  <StatusRow label="Last cycle" value={formatTime(data?.loop?.lastCycle?.finishedAt)} />
                  <StatusRow label="Cycle age" value={formatAge(data?.loop?.ageMs)} danger={Boolean(data?.loop?.stale)} />
                  <StatusRow label="Duration" value={data?.loop?.lastCycle ? `${number.format(data.loop.lastCycle.durationMs / 1000)}s` : '—'} />
                  <StatusRow label="NO TRADE / cycle" value={String(data?.loop?.lastCycle?.noTrade ?? '—')} />
                  <StatusRow label="Checkpoint" value={formatTime(data?.checkpoint?.savedAt)} />
                  <StatusRow label="Persistence" value={data?.checkpoint?.backend || '—'} />
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Score buckets" eyebrow="Oracle trade score" detail={`${data?.performance?.trades || 0} closed`} />
                <div className="space-y-3 p-4">
                  {(data?.performance?.buckets || []).map((bucket) => (
                    <div key={bucket.label}>
                      <div className="mb-1.5 flex items-center justify-between font-mono text-[7px] uppercase tracking-[0.12em]">
                        <span className="text-[#66717B]">{bucket.label}</span>
                        <span className="text-[#AEB7BF]">{bucket.trades} trades · {formatPct(bucket.winRate)}</span>
                      </div>
                      <div className="h-1 bg-white/[0.05]">
                        <div className="h-full bg-[#6C7882]" style={{ width: `${Math.min(100, Math.max(0, bucket.winRate * 100))}%` }} />
                      </div>
                    </div>
                  ))}
                  {!data?.performance?.buckets?.length && <Unavailable text="No score-bucket performance yet." />}
                </div>
              </Panel>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Panel>
                <PanelHeader title="Recent closed trades" eyebrow="Paper fills" detail={`${data?.recentTrades?.length || 0} shown`} />
                <RecentTrades trades={data?.recentTrades || []} />
              </Panel>

              <Panel>
                <PanelHeader title="Open positions" eyebrow="Current paper book" detail={`${data?.portfolio?.openPositions?.length || 0} open`} />
                <div className="divide-y divide-white/[0.05]">
                  {(data?.portfolio?.openPositions || []).map((position) => (
                    <div key={position.market} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-[10px] text-[#D8DEE4]">{position.market}</div>
                          <div className="mt-1 font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">opened {formatTime(position.openedAt)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-[#AAB3BC]">{number.format(position.quantity)}</div>
                          <div className="mt-1 font-mono text-[6px] text-[#4F5963]">avg {formatMoney(position.averageCost)}</div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-px bg-white/[0.04]">
                        <MiniStat label="STOP" value={formatMoney(position.stopLossPrice)} />
                        <MiniStat label="TARGET" value={formatMoney(position.takeProfitPrice)} />
                      </div>
                    </div>
                  ))}
                  {!data?.portfolio?.openPositions?.length && <Unavailable text="No open Paper positions." padded />}
                </div>
              </Panel>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] py-3 font-mono text-[6px] uppercase tracking-[0.13em] text-[#46515B]">
              <span>runtime {data?.checkpoint?.runtimeId || '—'} · checkpoint reason {data?.checkpoint?.reason || '—'}</span>
              <span>UI refreshed {formatTime(lastFetchedAt)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Panel = ({ children }: React.PropsWithChildren) => <section className="border border-white/[0.07] bg-[#080C11]">{children}</section>;

const PanelHeader = ({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) => (
  <div className="flex items-end justify-between gap-4 border-b border-white/[0.06] px-4 py-3.5">
    <div>
      <div className="font-mono text-[6px] uppercase tracking-[0.18em] text-[#59636D]">{eyebrow}</div>
      <div className="mt-1 text-sm font-medium text-[#CBD2D9]">{title}</div>
    </div>
    <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">{detail}</div>
  </div>
);

const MetricStrip = ({ data }: { data: OperationsPayload | null }) => {
  const items = [
    { label: 'EQUITY', value: formatMoney(data?.portfolio?.equity), sub: `cash ${formatMoney(data?.portfolio?.cash)}`, icon: WalletCards },
    { label: 'DAILY P&L', value: formatPct(data?.portfolio?.dailyPnlPct, true), sub: `realized ${formatMoney(data?.portfolio?.realizedPnl)}`, icon: (data?.portfolio?.dailyPnlPct || 0) >= 0 ? TrendingUp : TrendingDown, tone: (data?.portfolio?.dailyPnlPct || 0) >= 0 ? 'positive' : 'negative' },
    { label: 'CURRENT DD', value: formatPct(data?.portfolio?.currentDrawdownPct), sub: `max ${formatPct(data?.performance?.maxDrawdownPct)}`, icon: TrendingDown, tone: 'negative' },
    { label: 'OPEN POSITIONS', value: String(data?.portfolio?.openPositions?.length ?? '—'), sub: `limit ${data?.loop?.maxOpenPositions ?? '—'}`, icon: ShieldCheck },
    { label: 'TRADES', value: String(data?.performance?.trades ?? '—'), sub: `win ${formatPct(data?.performance?.winRate)}`, icon: BarChart3 },
    { label: 'CYCLE AGE', value: formatAge(data?.loop?.ageMs), sub: `count ${data?.loop?.cycleCount ?? '—'}`, icon: Clock3, tone: data?.loop?.stale ? 'negative' : 'positive' },
  ];
  return (
    <div className="grid grid-cols-2 gap-px border border-white/[0.07] bg-white/[0.06] md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="bg-[#070B10] p-3.5 md:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[6px] uppercase tracking-[0.14em] text-[#4F5963]">{item.label}</span>
              <Icon className="h-3.5 w-3.5 text-[#56616C]" />
            </div>
            <div className={`mt-3 text-[18px] font-light tracking-[-0.03em] md:text-[21px] ${item.tone === 'positive' ? 'text-[#7AB9A5]' : item.tone === 'negative' ? 'text-[#D47A7A]' : 'text-[#DDE3E7]'}`}>{item.value}</div>
            <div className="mt-1 truncate font-mono text-[6px] uppercase tracking-[0.1em] text-[#46515B]">{item.sub}</div>
          </div>
        );
      })}
    </div>
  );
};

const DecisionTape = ({ items }: { items: DecisionTapeItem[] }) => (
  <div className="divide-y divide-white/[0.05]">
    {items.map((item, index) => {
      const decision = String(item.decision || 'UNKNOWN').toUpperCase();
      const tone = decision === 'ENTER'
        ? 'text-[#78B39F] border-[#78B39F]/20 bg-[#78B39F]/[0.035]'
        : decision === 'EXIT'
          ? 'text-[#D47A7A] border-[#D47A7A]/20 bg-[#D47A7A]/[0.035]'
          : decision === 'NO_TRADE'
            ? 'text-[#C7A96B] border-[#C7A96B]/20 bg-[#C7A96B]/[0.035]'
            : 'text-[#A8B1B9] border-white/[0.08] bg-white/[0.025]';
      const risk = String(item.riskDisposition || 'NOT_EVALUATED').toUpperCase();
      const riskTone = risk === 'APPROVE'
        ? 'text-[#78B39F]'
        : risk === 'REJECT'
          ? 'text-[#D47A7A]'
          : 'text-[#66717B]';
      const forecast = item.forecast?.available
        ? `${item.forecast.direction} ${item.forecast.probabilityBullish == null ? '—' : `${Math.round(item.forecast.probabilityBullish * 100)}%↑`}`
        : 'FORECAST —';

      return (
        <div key={`${item.market}-${index}`} className="px-4 py-3.5">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[7px] tabular-nums text-[#4F5963]">{formatTime(item.timestamp)}</span>
                <span className="font-mono text-[9px] text-[#C9D0D6]">{item.market}</span>
                <span className={`border px-1.5 py-1 font-mono text-[6px] uppercase tracking-[0.1em] ${tone}`}>{decision}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[6px] uppercase tracking-[0.09em] text-[#59636D]">
                <span>{item.regime || 'REGIME —'}</span>
                <span>{item.strategyDisposition || 'ROUTE —'}</span>
                <span className={riskTone}>RISK {risk}</span>
                <span>CONF {formatPct(item.confidence)}</span>
                <span>{forecast}</span>
                <span>EVID {item.evidenceActiveCount ?? 0}</span>
                {(item.evidenceContradictionCount || 0) > 0 && <span className="text-[#C7A96B]">CONTRA {item.evidenceContradictionCount}</span>}
              </div>
              <div className="mt-2 text-[9px] leading-relaxed text-[#7D8791]">
                {item.primaryReason || 'Legacy checkpoint: detailed reason unavailable.'}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-[10px] tabular-nums text-[#AEB7BF]">{item.oracleTradeScore == null ? '—' : number.format(item.oracleTradeScore)}</div>
              <div className="mt-1 font-mono text-[6px] uppercase tracking-[0.08em] text-[#4F5963]">Oracle score</div>
              <div className="mt-2 font-mono text-[6px] tabular-nums text-[#56616C]">E {item.eventScore == null ? '—' : number.format(item.eventScore)}</div>
            </div>
          </div>
        </div>
      );
    })}
    {!items.length && <Unavailable text="No market decisions have been persisted yet." padded />}
  </div>
);

const MicrostructureTape = ({ items }: { items: DecisionTapeItem[] }) => (
  <div className="divide-y divide-white/[0.05]">
    {items.map((item) => {
      const micro = item.microstructure;
      const challenger = item.challenger;
      const alignment = challenger?.alignment ?? 'UNAVAILABLE';
      const alignmentTone = alignment === 'SUPPORTS'
        ? 'text-[#78B39F]'
        : alignment === 'CONFLICTS'
          ? 'text-[#D47A7A]'
          : alignment === 'NEUTRAL'
            ? 'text-[#C7A96B]'
            : 'text-[#59636D]';
      return (
        <div key={`micro-${item.market}`} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-[#59636D]" />
              <span className="font-mono text-[9px] text-[#C9D0D6]">{item.market}</span>
              <span className={`font-mono text-[7px] uppercase tracking-[0.1em] ${alignmentTone}`}>{alignment}</span>
            </div>
            <div className="font-mono text-[7px] text-[#69747E]">
              shadow {challenger ? number.format(challenger.shadowOracleScore) : '—'} / base {item.oracleTradeScore == null ? '—' : number.format(item.oracleTradeScore)}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-px bg-white/[0.04] sm:grid-cols-4">
            <MiniStat label="PRESSURE" value={formatSignedScore(micro?.pressureScore)} tone={(micro?.pressureScore ?? 0) >= 20 ? 'positive' : (micro?.pressureScore ?? 0) <= -20 ? 'negative' : undefined} />
            <MiniStat label="TAKER FLOW" value={formatPct(micro?.takerImbalance, true)} tone={(micro?.takerImbalance ?? 0) > 0 ? 'positive' : (micro?.takerImbalance ?? 0) < 0 ? 'negative' : undefined} />
            <MiniStat label="BOOK 5 / 30" value={`${formatPct(micro?.orderbookImbalanceTop5, true)} / ${formatPct(micro?.orderbookImbalanceTop30, true)}`} />
            <MiniStat label="PROFILE" value={micro?.profileLocation?.replaceAll('_', ' ') ?? '—'} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[6px] uppercase tracking-[0.1em] text-[#4F5963]">
            <span>{micro?.sampleTrades ?? 0} prints</span>
            <span>coverage {formatAge(micro?.sampleCoverageMs)}</span>
            <span>POC {formatMoney(micro?.pointOfControl)}</span>
            <span>VA {formatMoney(micro?.valueAreaLow)}–{formatMoney(micro?.valueAreaHigh)}</span>
            <span>shadow Δ {challenger ? formatSignedScore(challenger.shadowScoreAdjustment) : '—'}</span>
          </div>
        </div>
      );
    })}
    {!items.length && <Unavailable text="No microstructure observations have been persisted yet." padded />}
  </div>
);

const ChallengerBuckets = ({ buckets }: { buckets: NonNullable<NonNullable<OperationsPayload['performance']>['microstructureBuckets']> }) => (
  <div className="p-4">
    <div className="mb-3 border border-[#C7A96B]/15 bg-[#C7A96B]/[0.025] p-3 font-mono text-[6px] uppercase tracking-[0.11em] text-[#8D7D5B]">
      observational only · compare realized outcomes before any promotion
    </div>
    <div className="space-y-2">
      {buckets.map((bucket) => {
        const tone = bucket.alignment === 'SUPPORTS'
          ? 'text-[#78B39F]'
          : bucket.alignment === 'CONFLICTS'
            ? 'text-[#D47A7A]'
            : 'text-[#78838D]';
        return (
          <div key={bucket.alignment} className="border border-white/[0.05] bg-[#060A0E] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className={`font-mono text-[7px] uppercase tracking-[0.12em] ${tone}`}>{bucket.alignment}</span>
              <span className="font-mono text-[7px] text-[#7D8791]">{bucket.trades} trades</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[6px] uppercase tracking-[0.08em] text-[#56616C]">
              <span>win {formatPct(bucket.winRate)}</span>
              <span>avg {formatPct(bucket.avgReturnPct, true)}</span>
              <span>pnl {formatMoney(bucket.netPnl)}</span>
            </div>
          </div>
        );
      })}
      {!buckets.length && <Unavailable text="Awaiting closed-trade challenger sample." />}
    </div>
  </div>
);

const EquityChart = ({ points }: { points: Array<{ timestamp: number; equity: number }> }) => {
  const normalized = useMemo(() => {
    if (points.length < 2) return [];
    const width = 1000;
    const height = 260;
    const values = points.map((point) => point.equity);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    return points.map((point, index) => ({
      x: (index / Math.max(1, points.length - 1)) * width,
      y: height - ((point.equity - min) / range) * (height - 30) - 15,
    }));
  }, [points]);

  const path = normalized.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

  return (
    <div className="p-4">
      <div className="relative h-[240px] overflow-hidden border border-white/[0.045] bg-[#05080C] md:h-[280px]">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)', backgroundSize: '20% 25%' }} />
        {normalized.length >= 2 ? (
          <svg viewBox="0 0 1000 260" preserveAspectRatio="none" className="relative h-full w-full">
            <path d={path} fill="none" stroke="#8DAAB0" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : (
          <div className="relative flex h-full items-center justify-center font-mono text-[7px] uppercase tracking-[0.14em] text-[#4F5963]">Awaiting equity history</div>
        )}
      </div>
    </div>
  );
};

const StatusRow = ({ label, value, danger = false, muted = false }: { label: string; value: string; danger?: boolean; muted?: boolean }) => (
  <div className="flex items-center justify-between gap-3 py-3 text-[10px]">
    <span className="text-[#68737D]">{label}</span>
    <span className={`font-mono text-[8px] ${danger ? 'text-[#D66565]' : muted ? 'text-[#46515B]' : 'text-[#AAB3BC]'}`}>{value}</span>
  </div>
);

const MiniStat = ({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) => (
  <div className="bg-[#070A0E] p-3">
    <div className="font-mono text-[6px] uppercase tracking-[0.12em] text-[#4F5963]">{label}</div>
    <div className={`mt-1 text-[11px] ${tone === 'positive' ? 'text-[#78B39F]' : tone === 'negative' ? 'text-[#D47A7A]' : 'text-[#AEB7BF]'}`}>{value}</div>
  </div>
);

const RecentTrades = ({ trades }: { trades: ClosedTrade[] }) => (
  <div className="overflow-x-auto">
    {trades.length ? (
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[90px_100px_90px_90px_100px_110px_minmax(160px,1fr)] border-b border-white/[0.05] px-4 py-2 font-mono text-[6px] uppercase tracking-[0.12em] text-[#46515B]">
          <span>Closed</span><span>Market</span><span>Return</span><span>Net P&L</span><span>Score</span><span>Micro</span><span>Reason</span>
        </div>
        {trades.map((trade) => {
          const alignment = trade.entryAudit?.challenger?.alignment ?? 'UNAVAILABLE';
          return (
            <div key={trade.id} className="grid grid-cols-[90px_100px_90px_90px_100px_110px_minmax(160px,1fr)] items-center border-b border-white/[0.045] px-4 py-3 text-[9px] last:border-b-0">
              <span className="font-mono text-[7px] text-[#56616C]">{formatTime(trade.closedAt)}</span>
              <span className="font-mono text-[#C8CFD5]">{trade.market}</span>
              <span className={trade.returnPct >= 0 ? 'text-[#78B39F]' : 'text-[#D47A7A]'}>{formatPct(trade.returnPct, true)}</span>
              <span className={trade.netPnl >= 0 ? 'text-[#78B39F]' : 'text-[#D47A7A]'}>{formatMoney(trade.netPnl)}</span>
              <span className="font-mono text-[#7E8993]">{number.format(trade.entryOracleTradeScore)} → {number.format(trade.exitOracleTradeScore)}</span>
              <span className="font-mono text-[7px] text-[#68737D]">{alignment}</span>
              <span className="truncate text-[#68737D]">{trade.exitReason}</span>
            </div>
          );
        })}
      </div>
    ) : <Unavailable text="No closed Paper trades yet." padded />}
  </div>
);

const EmptyRuntime = ({ message }: { message: string }) => (
  <div className="flex min-h-[420px] flex-col items-center justify-center border border-dashed border-white/[0.08] bg-[#070A0E] px-6 text-center">
    <ServerCog className="h-7 w-7 text-[#59636D]" />
    <div className="mt-4 font-mono text-[8px] uppercase tracking-[0.18em] text-[#77818C]">Paper runtime unavailable</div>
    <p className="mt-2 max-w-md text-[11px] leading-relaxed text-[#59636D]">{message}</p>
  </div>
);

const Unavailable = ({ text, padded = false }: { text: string; padded?: boolean }) => (
  <div className={`${padded ? 'p-6' : 'py-3'} text-center font-mono text-[7px] uppercase tracking-[0.12em] text-[#46515B]`}>{text}</div>
);