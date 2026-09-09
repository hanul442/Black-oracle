import { generateStrategyFactoryCandidates } from '../../src/trading/strategyFactory';
import { rankStrategyFactoryCandidates, type StrategyFactoryBacktestResult } from '../../src/trading/strategyFactoryBacktest';
import { getMinuteCandleHistory } from './upbitPublic';

export interface StrategyFactoryRunConfig {
  market?: string;
  unit?: 15 | 60 | 240;
  bars?: number;
  candidates?: number;
  seed?: number;
  topN?: number;
}

export interface StrategyFactoryRunSummary {
  id: string;
  market: string;
  unit: 15 | 60 | 240;
  bars: number;
  candidateCount: number;
  seed: number;
  startedAt: number;
  finishedAt: number;
  candidateStatusCounts: Record<'BLOCKED' | 'QUALIFYING' | 'CANDIDATE', number>;
  top: Array<{
    genome: StrategyFactoryBacktestResult['genome'];
    metrics: StrategyFactoryBacktestResult['metrics'];
    evaluation: StrategyFactoryBacktestResult['evaluation'];
    tradeCount: number;
    oosTradeCount: number;
    reasons: string[];
  }>;
  executionAuthority: false;
  promotionAuthority: false;
}

let latestRun: StrategyFactoryRunSummary | null = null;
let running = false;

const clampInt = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.trunc(value)));

const persistRun = async (run: StrategyFactoryRunSummary) => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  if (!base || !key) return false;
  const response = await fetch(`${base}/rest/v1/black_oracle_strategy_factory_runs?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: run.id,
      market: run.market,
      timeframe_minutes: run.unit,
      bars: run.bars,
      candidate_count: run.candidateCount,
      seed: run.seed,
      started_at: new Date(run.startedAt).toISOString(),
      finished_at: new Date(run.finishedAt).toISOString(),
      status_counts: run.candidateStatusCounts,
      top_results: run.top,
      execution_authority: false,
      promotion_authority: false,
    }),
  });
  if (!response.ok) throw new Error(`Strategy Factory persistence failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return true;
};

export const strategyFactoryRunnerStatus = () => ({
  running,
  latestRun,
});

/**
 * Runs a deterministic research tournament over one crypto market. Results are
 * observational only: no Paper/live order and no automatic strategy promotion is allowed.
 */
export const runCryptoStrategyFactory = async (config: StrategyFactoryRunConfig = {}): Promise<StrategyFactoryRunSummary> => {
  if (running) throw new Error('A Strategy Factory research run is already in progress.');
  running = true;
  const startedAt = Date.now();
  try {
    const market = String(config.market ?? 'KRW-BTC').trim().toUpperCase();
    if (!/^KRW-[A-Z0-9]+$/.test(market)) throw new Error('Strategy Factory crypto runner requires a normalized KRW market.');
    const unit = (config.unit ?? 60) as 15 | 60 | 240;
    if (![15, 60, 240].includes(unit)) throw new Error('Strategy Factory unit must be 15, 60, or 240 minutes.');
    const bars = clampInt(config.bars ?? 1_500, 500, 5_000);
    const candidates = clampInt(config.candidates ?? 256, 16, 1_000);
    const seed = Math.trunc(config.seed ?? 4_420_623);
    const topN = clampInt(config.topN ?? 20, 1, 50);

    const candles = await getMinuteCandleHistory(market, unit, bars);
    if (candles.length < 500) throw new Error(`Strategy Factory requires at least 500 historical bars; ${candles.length} were loaded.`);
    const genomes = generateStrategyFactoryCandidates({
      seed,
      generation: 1,
      assetClass: 'CRYPTO_SPOT',
      candidates,
      minIndicators: 3,
      maxIndicators: 6,
    });
    const ranked = rankStrategyFactoryCandidates(genomes, candles, {
      warmupBars: 220,
      oosFraction: 0.30,
      costPerSideBps: 13,
      maxWindowBars: 320,
    });
    const counts = { BLOCKED: 0, QUALIFYING: 0, CANDIDATE: 0 } as Record<'BLOCKED' | 'QUALIFYING' | 'CANDIDATE', number>;
    for (const result of ranked) counts[result.evaluation.status] += 1;

    latestRun = {
      id: `sf-${market}-${unit}-${seed}-${startedAt}`,
      market,
      unit,
      bars: candles.length,
      candidateCount: genomes.length,
      seed,
      startedAt,
      finishedAt: Date.now(),
      candidateStatusCounts: counts,
      top: ranked.slice(0, topN).map((result) => ({
        genome: result.genome,
        metrics: result.metrics,
        evaluation: result.evaluation,
        tradeCount: result.trades.length,
        oosTradeCount: result.trades.filter((trade) => trade.oos).length,
        reasons: result.reasons.slice(),
      })),
      executionAuthority: false,
      promotionAuthority: false,
    };
    await persistRun(latestRun);
    return latestRun;
  } finally {
    running = false;
  }
};
