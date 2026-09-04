export type MonteCarloVerdict = 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';

export interface MonteCarloConfig {
  scenarioCount: number;
  seed: number;
  minTrades: number;
  horizonTrades: number | null;
  drawdownLimitPct: number;
  costInflationBps: number;
  adverseShockPct: number;
  winnerHaircut: number;
  loserAmplification: number;
}

export interface MonteCarloDistribution {
  p05: number | null;
  median: number | null;
  p95: number | null;
}

export interface MonteCarloValidation {
  verdict: MonteCarloVerdict;
  available: boolean;
  tradeCount: number;
  scenarioCount: number;
  seed: number;
  horizonTrades: number;
  survivalProbability: number | null;
  ruinProbability: number | null;
  profitableProbability: number | null;
  terminalReturn: MonteCarloDistribution;
  maxDrawdown: MonteCarloDistribution & { worst: number | null };
  thresholds: {
    drawdownLimitPct: number;
    passSurvivalProbability: number;
    watchSurvivalProbability: number;
  };
  assumptions: {
    bootstrapWithReplacement: true;
    costInflationBps: number;
    adverseShockPct: number;
    winnerHaircut: number;
    loserAmplification: number;
  };
  reasons: string[];
}

const DEFAULT_CONFIG: MonteCarloConfig = {
  scenarioCount: 1_000,
  seed: 20_260_904,
  minTrades: 20,
  horizonTrades: null,
  drawdownLimitPct: 0.05,
  costInflationBps: 10,
  adverseShockPct: 0.001,
  winnerHaircut: 0.85,
  loserAmplification: 1.1,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const quantile = (values: number[], q: number) => {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const position = (sorted.length - 1) * clamp01(q);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const createSeededRandom = (seed: number) => {
  let state = (Math.trunc(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const resolveConfig = (tradeCount: number, config: Partial<MonteCarloConfig>): MonteCarloConfig => {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const scenarioCount = Math.min(20_000, Math.max(100, Math.trunc(merged.scenarioCount)));
  const minTrades = Math.min(500, Math.max(5, Math.trunc(merged.minTrades)));
  const horizonTrades = merged.horizonTrades == null
    ? Math.min(100, Math.max(minTrades, tradeCount))
    : Math.min(500, Math.max(1, Math.trunc(merged.horizonTrades)));

  return {
    ...merged,
    scenarioCount,
    minTrades,
    horizonTrades,
    drawdownLimitPct: Math.min(0.5, Math.max(0.001, merged.drawdownLimitPct)),
    costInflationBps: Math.min(500, Math.max(0, merged.costInflationBps)),
    adverseShockPct: Math.min(0.25, Math.max(0, merged.adverseShockPct)),
    winnerHaircut: Math.min(1, Math.max(0, merged.winnerHaircut)),
    loserAmplification: Math.min(3, Math.max(1, merged.loserAmplification)),
  };
};

const stressedReturn = (sample: number, config: MonteCarloConfig) => {
  const costDrag = config.costInflationBps / 10_000;
  const directionalStress = sample >= 0
    ? sample * config.winnerHaircut
    : sample * config.loserAmplification;
  return Math.max(-0.999, directionalStress - costDrag - config.adverseShockPct);
};

const insufficient = (tradeCount: number, config: MonteCarloConfig): MonteCarloValidation => ({
  verdict: 'INSUFFICIENT_DATA',
  available: false,
  tradeCount,
  scenarioCount: config.scenarioCount,
  seed: config.seed,
  horizonTrades: config.horizonTrades ?? config.minTrades,
  survivalProbability: null,
  ruinProbability: null,
  profitableProbability: null,
  terminalReturn: { p05: null, median: null, p95: null },
  maxDrawdown: { p05: null, median: null, p95: null, worst: null },
  thresholds: {
    drawdownLimitPct: config.drawdownLimitPct,
    passSurvivalProbability: 0.95,
    watchSurvivalProbability: 0.8,
  },
  assumptions: {
    bootstrapWithReplacement: true,
    costInflationBps: config.costInflationBps,
    adverseShockPct: config.adverseShockPct,
    winnerHaircut: config.winnerHaircut,
    loserAmplification: config.loserAmplification,
  },
  reasons: [`At least ${config.minTrades} closed Paper trades are required; ${tradeCount} are available.`],
});

export const buildMonteCarloValidation = (
  tradeReturns: number[],
  configOverrides: Partial<MonteCarloConfig> = {},
): MonteCarloValidation => {
  const samples = tradeReturns.filter((value) => Number.isFinite(value) && value > -1 && value < 10);
  const config = resolveConfig(samples.length, configOverrides);
  if (samples.length < config.minTrades) return insufficient(samples.length, config);

  const random = createSeededRandom(config.seed);
  const terminalReturns: number[] = [];
  const maxDrawdowns: number[] = [];
  let survived = 0;
  let profitable = 0;

  for (let scenario = 0; scenario < config.scenarioCount; scenario += 1) {
    let equity = 1;
    let peak = 1;
    let maxDrawdown = 0;

    for (let step = 0; step < (config.horizonTrades ?? samples.length); step += 1) {
      const index = Math.min(samples.length - 1, Math.floor(random() * samples.length));
      const nextReturn = stressedReturn(samples[index], config);
      equity *= 1 + nextReturn;
      peak = Math.max(peak, equity);
      if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
    }

    const terminalReturn = equity - 1;
    terminalReturns.push(terminalReturn);
    maxDrawdowns.push(maxDrawdown);
    if (maxDrawdown < config.drawdownLimitPct && equity > 0) survived += 1;
    if (terminalReturn > 0) profitable += 1;
  }

  const survivalProbability = survived / config.scenarioCount;
  const ruinProbability = 1 - survivalProbability;
  const profitableProbability = profitable / config.scenarioCount;
  const terminalP05 = quantile(terminalReturns, 0.05);
  const terminalMedian = quantile(terminalReturns, 0.5);
  const terminalP95 = quantile(terminalReturns, 0.95);
  const drawdownP05 = quantile(maxDrawdowns, 0.05);
  const drawdownMedian = quantile(maxDrawdowns, 0.5);
  const drawdownP95 = quantile(maxDrawdowns, 0.95);
  const worstDrawdown = maxDrawdowns.length > 0 ? Math.max(...maxDrawdowns) : null;

  let verdict: MonteCarloVerdict = 'REJECT';
  const reasons: string[] = [];

  if (
    survivalProbability >= 0.95
    && (drawdownP95 ?? 1) <= config.drawdownLimitPct
    && (terminalP05 ?? -1) >= -0.02
  ) {
    verdict = 'PASS';
    reasons.push('Stress survival, tail drawdown, and fifth-percentile terminal return meet the validation thresholds.');
  } else if (
    survivalProbability >= 0.8
    && (drawdownP95 ?? 1) <= config.drawdownLimitPct * 1.5
    && (terminalP05 ?? -1) >= -0.05
  ) {
    verdict = 'WATCH';
    reasons.push('The strategy remains viable in most simulations but tail outcomes require further observation.');
  } else {
    reasons.push('Stress survival or tail-loss behavior does not meet the current validation thresholds.');
  }

  if (ruinProbability > 0) reasons.push(`${(ruinProbability * 100).toFixed(1)}% of scenarios breached the validation drawdown limit.`);
  if ((terminalP05 ?? 0) < 0) reasons.push('The fifth-percentile terminal return remains negative under stress.');

  return {
    verdict,
    available: true,
    tradeCount: samples.length,
    scenarioCount: config.scenarioCount,
    seed: config.seed,
    horizonTrades: config.horizonTrades ?? samples.length,
    survivalProbability,
    ruinProbability,
    profitableProbability,
    terminalReturn: { p05: terminalP05, median: terminalMedian, p95: terminalP95 },
    maxDrawdown: { p05: drawdownP05, median: drawdownMedian, p95: drawdownP95, worst: worstDrawdown },
    thresholds: {
      drawdownLimitPct: config.drawdownLimitPct,
      passSurvivalProbability: 0.95,
      watchSurvivalProbability: 0.8,
    },
    assumptions: {
      bootstrapWithReplacement: true,
      costInflationBps: config.costInflationBps,
      adverseShockPct: config.adverseShockPct,
      winnerHaircut: config.winnerHaircut,
      loserAmplification: config.loserAmplification,
    },
    reasons,
  };
};
