import type { AutonomousStrategyExperiment, AutonomousFactoryResearchResult } from '../../src/trading/autonomousStrategyFactory';

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  if (!base || !key) throw new Error('Supabase credentials are unavailable for Strategy Experiment Ledger persistence.');
  return {
    base,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  };
};

export interface PersistStrategyExperimentContext {
  runId: string;
  market: string;
  timeframeMinutes: 15 | 60 | 240 | 1440;
}

const experimentRow = (
  context: PersistStrategyExperimentContext,
  experiment: AutonomousStrategyExperiment,
) => ({
  id: `${context.runId}:${experiment.experimentId}`,
  run_id: context.runId,
  market: context.market,
  timeframe_minutes: context.timeframeMinutes,
  generation: experiment.candidate.genome.generation,
  seed: experiment.candidate.genome.seed,
  hypothesis: experiment.candidate.hypothesis,
  parent_ids: experiment.candidate.hypothesis.parentIds,
  genome: experiment.candidate.genome,
  development_validation: experiment.validation.development,
  blind_validation: experiment.validation.blind,
  walk_forward_validation: experiment.validation.walkForward,
  stress_validation: {
    cost: experiment.validation.costStress,
    regime: experiment.validation.regimeStress,
    monteCarloSurvivalRate: experiment.validation.monteCarloSurvivalRate,
    parameterRobustness: experiment.validation.parameterRobustness,
    blindStartIndex: experiment.validation.blindStartIndex,
    developmentBars: experiment.validation.developmentBars,
    blindBars: experiment.validation.blindBars,
  },
  score: experiment.evaluation.score,
  lifecycle: experiment.evaluation.lifecycle,
  hard_gate_passed: experiment.evaluation.hardGatePassed,
  hard_gate_reasons: experiment.evaluation.hardGateReasons,
  fatal_reasons: experiment.evaluation.fatalReasons,
  dimensions: experiment.evaluation.dimensions,
  execution_authority: false,
  promotion_authority: false,
  requires_human_approval: true,
  human_review_status: experiment.evaluation.humanReviewStatus,
  updated_at: new Date().toISOString(),
});

export const persistStrategyExperiments = async (
  context: PersistStrategyExperimentContext,
  research: AutonomousFactoryResearchResult,
) => {
  const { base, headers } = dbConfig();
  const rows = research.experiments.map((experiment) => experimentRow(context, experiment));
  const chunkSize = 100;
  let persisted = 0;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const response = await fetch(`${base}/rest/v1/black_oracle_strategy_experiments?on_conflict=id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    });
    if (!response.ok) {
      throw new Error(`Strategy Experiment Ledger persistence failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
    }
    persisted += chunk.length;
  }

  return { persisted, runId: context.runId };
};
