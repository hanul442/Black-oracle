import {
  runAutonomousStrategyFactoryResearch,
  type AutonomousFactoryResearchResult,
  type AutonomousStrategyExperiment,
  type StrategyLifecycle,
} from '../../src/trading/autonomousStrategyFactory';
import type { StrategyEvaluationMetrics } from '../../src/trading/strategyFactory';
import { persistStrategyExperiments } from './strategyExperimentLedger';
import { getMinuteCandleHistory } from './upbitPublic';

export interface StrategyFactoryRunConfig {
  market?: string;
  unit?: 15 | 60 | 240;
  bars?: number;
  /** Backward-compatible alias for candidatesPerGeneration. */
  candidates?: number;
  candidatesPerGeneration?: number;
  generations?: number;
  parentPoolSize?: number;
  blindFraction?: number;
  walkForwardFolds?: number;
  seed?: number;
  topN?: number;
}

type LegacyCandidateStatus = 'BLOCKED' | 'QUALIFYING' | 'CANDIDATE';

export interface StrategyFactoryRunSummary {
  id: string;
  market: string;
  unit: 15 | 60 | 240;
  bars: number;
  candidateCount: number;
  seed: number;
  startedAt: number;
  finishedAt: number;
  factoryVersion: 'BO-SF-AUTO-v1';
  generationCount: number;
  blindFraction: number;
  developmentBars: number;
  blindBars: number;
  candidateStatusCounts: Record<LegacyCandidateStatus, number>;
  lifecycleCounts: Record<StrategyLifecycle, number>;
  top: Array<{
    genome: AutonomousStrategyExperiment['candidate']['genome'];
    hypothesis: AutonomousStrategyExperiment['candidate']['hypothesis'];
    metrics: StrategyEvaluationMetrics;
    evaluation: {
      score: number;
      status: LegacyCandidateStatus;
      lifecycle: StrategyLifecycle;
      hardGatePassed: boolean;
      hardGateReasons: string[];
      fatalReasons: string[];
      dimensions: AutonomousStrategyExperiment['evaluation']['dimensions'];
      requiresHumanApproval: true;
    };
    validation: AutonomousStrategyExperiment['validation'];
    tradeCount: number;
    oosTradeCount: number;
    blindTradeCount: number;
    reasons: string[];
  }>;
  humanApprovalRequired: true;
  championPromotionRequiresHumanApproval: true;
  liveDeploymentRequiresHumanApproval: true;
  executionAuthority: false;
  promotionAuthority: false;
}

let latestRun: StrategyFactoryRunSummary | null = null;
let running = false;

const clampInt = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.trunc(value)));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

const legacyStatusFor = (lifecycle: StrategyLifecycle): LegacyCandidateStatus => {
  if (lifecycle === 'REJECT') return 'BLOCKED';
  if (lifecycle === 'INCUBATOR') return 'QUALIFYING';
  return 'CANDIDATE';
};

const metricsFor = (experiment: AutonomousStrategyExperiment): StrategyEvaluationMetrics => ({
  totalSamples: experiment.validation.development.totalSamples,
  oosSamples: experiment.validation.development.oosSamples,
  oosExpectancy: experiment.validation.development.oosExpectancy,
  sharpe: experiment.validation.development.sharpe,
  sortino: experiment.validation.development.sortino,
  maxDrawdownPct: Math.max(
    experiment.validation.development.maxDrawdownPct,
    experiment.validation.blind.maxDrawdownPct,
  ),
  monteCarloSurvivalRate: experiment.validation.monteCarloSurvivalRate,
  regimeStability: experiment.validation.regimeStress.positiveRegimeRate,
  parameterRobustness: experiment.validation.parameterRobustness,
});

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
      factory_version: run.factoryVersion,
      generation_count: run.generationCount,
      blind_fraction: run.blindFraction,
      lifecycle_counts: run.lifecycleCounts,
      human_approval_required: true,
      execution_authority: false,
      promotion_authority: false,
    }),
  });
  if (!response.ok) throw new Error(`Strategy Factory persistence failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  return true;
};

const buildRunSummary = (
  research: AutonomousFactoryResearchResult,
  context: { id: string; market: string; unit: 15 | 60 | 240; bars: number; startedAt: number; topN: number },
): StrategyFactoryRunSummary => {
  const candidateStatusCounts: Record<LegacyCandidateStatus, number> = { BLOCKED: 0, QUALIFYING: 0, CANDIDATE: 0 };
  for (const experiment of research.experiments) {
    candidateStatusCounts[legacyStatusFor(experiment.evaluation.lifecycle)] += 1;
  }

  return {
    id: context.id,
    market: context.market,
    unit: context.unit,
    bars: context.bars,
    candidateCount: research.candidateCount,
    seed: research.seed,
    startedAt: context.startedAt,
    finishedAt: Date.now(),
    factoryVersion: research.version,
    generationCount: research.generations,
    blindFraction: research.blindFraction,
    developmentBars: research.developmentBars,
    blindBars: research.blindBars,
    candidateStatusCounts,
    lifecycleCounts: { ...research.lifecycleCounts },
    top: research.experiments.slice(0, context.topN).map((experiment) => {
      const status = legacyStatusFor(experiment.evaluation.lifecycle);
      return {
        genome: experiment.candidate.genome,
        hypothesis: experiment.candidate.hypothesis,
        metrics: metricsFor(experiment),
        evaluation: {
          score: experiment.evaluation.score,
          status,
          lifecycle: experiment.evaluation.lifecycle,
          hardGatePassed: experiment.evaluation.hardGatePassed,
          hardGateReasons: experiment.evaluation.hardGateReasons.slice(),
          fatalReasons: experiment.evaluation.fatalReasons.slice(),
          dimensions: { ...experiment.evaluation.dimensions },
          requiresHumanApproval: true,
        },
        validation: experiment.validation,
        tradeCount: experiment.validation.development.totalSamples,
        oosTradeCount: experiment.validation.development.oosSamples,
        blindTradeCount: experiment.validation.blind.samples,
        reasons: [
          experiment.candidate.hypothesis.thesis,
          ...experiment.evaluation.fatalReasons,
          ...experiment.evaluation.hardGateReasons,
          'Blind holdout was not opened until generation and parent-selection decisions were complete.',
          'Research classification cannot grant execution, Champion promotion, capital, or LIVE authority.',
        ].slice(0, 20),
      };
    }),
    humanApprovalRequired: true,
    championPromotionRequiresHumanApproval: true,
    liveDeploymentRequiresHumanApproval: true,
    executionAuthority: false,
    promotionAuthority: false,
  };
};

export const strategyFactoryRunnerStatus = () => ({ running, latestRun });

/**
 * Autonomous research tournament. The automation boundary ends at hypothesis
 * generation, validation, lifecycle classification, and Experiment Ledger persistence.
 * It cannot mutate Paper/live routing or grant Champion authority.
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
    const bars = clampInt(config.bars ?? 1_800, 700, 5_000);
    const candidatesPerGeneration = clampInt(config.candidatesPerGeneration ?? config.candidates ?? 96, 8, 1_000);
    const generations = clampInt(config.generations ?? 3, 1, 8);
    const parentPoolSize = clampInt(config.parentPoolSize ?? Math.min(24, candidatesPerGeneration), 4, candidatesPerGeneration);
    const blindFraction = clamp(config.blindFraction ?? 0.20, 0.20, 0.35);
    const walkForwardFolds = clampInt(config.walkForwardFolds ?? 4, 2, 8);
    const seed = Math.trunc(config.seed ?? 4_420_623);
    const topN = clampInt(config.topN ?? 20, 1, 50);

    const candles = await getMinuteCandleHistory(market, unit, bars);
    if (candles.length < 700) throw new Error(`Autonomous Strategy Factory requires at least 700 historical bars; ${candles.length} were loaded.`);

    const research = runAutonomousStrategyFactoryResearch(candles, {
      seed,
      generations,
      candidatesPerGeneration,
      parentPoolSize,
      blindFraction,
      walkForwardFolds,
      warmupBars: 220,
      baseCostPerSideBps: 13,
    });
    const runId = `sf-auto-${market}-${unit}-${seed}-${startedAt}`;
    latestRun = buildRunSummary(research, {
      id: runId,
      market,
      unit,
      bars: candles.length,
      startedAt,
      topN,
    });

    // Parent run must exist before candidate-level FK rows are inserted.
    await persistRun(latestRun);
    await persistStrategyExperiments({ runId, market, timeframeMinutes: unit }, research);
    return latestRun;
  } finally {
    running = false;
  }
};
