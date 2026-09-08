export type ResearchValidationVerdict = 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';

export interface ExpectedShortfallResult {
  available: boolean;
  sampleCount: number;
  confidenceLevel: number;
  valueAtRisk: number | null;
  expectedShortfall: number | null;
}

export interface DeflatedSharpeResult {
  available: boolean;
  sampleCount: number;
  trialCount: number;
  sharpePerObservation: number | null;
  expectedMaxNullSharpe: number | null;
  skewness: number | null;
  kurtosis: number | null;
  probability: number | null;
  verdict: ResearchValidationVerdict;
  reasons: string[];
}

export interface PboStrategySeries { id: string; returns: number[]; }
export interface ProbabilityBacktestOverfittingResult {
  available: boolean;
  strategyCount: number;
  observationCount: number;
  slices: number;
  combinations: number;
  pbo: number | null;
  medianLogit: number | null;
  verdict: ResearchValidationVerdict;
  reasons: string[];
}

export interface CalibrationObservation { probability: number; outcome: boolean; }
export interface CalibrationBin {
  lower: number;
  upper: number;
  count: number;
  meanProbability: number | null;
  outcomeRate: number | null;
}
export interface CalibrationResult {
  available: boolean;
  sampleCount: number;
  brierScore: number | null;
  logLoss: number | null;
  expectedCalibrationError: number | null;
  bins: CalibrationBin[];
  verdict: ResearchValidationVerdict;
}

export interface RegimeReturnSample { returnPct: number; regime: string; }
export interface BlockRegimeMonteCarloConfig {
  scenarioCount: number;
  seed: number;
  minSamples: number;
  blockSize: number;
  horizonSamples: number | null;
  drawdownLimitPct: number;
  costInflationBps: number;
}
export interface BlockRegimeMonteCarloResult {
  available: boolean;
  sampleCount: number;
  scenarioCount: number;
  blockSize: number;
  horizonSamples: number;
  survivalProbability: number | null;
  profitableProbability: number | null;
  terminalP05: number | null;
  terminalMedian: number | null;
  drawdownP95: number | null;
  expectedShortfall95: number | null;
  regimeCount: number;
  verdict: ResearchValidationVerdict;
  assumptions: {
    movingBlockBootstrap: true;
    regimeStratified: true;
    costInflationBps: number;
  };
  reasons: string[];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const finiteReturns = (values: number[]) => values.filter((value) => Number.isFinite(value) && value > -1 && value < 10);
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const sampleStd = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1));
};
const quantile = (values: number[], q: number) => {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const position = (sorted.length - 1) * clamp01(q);
  const lower = Math.floor(position); const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};
const median = (values: number[]) => quantile(values, 0.5);

const erf = (x: number) => {
  const sign = x < 0 ? -1 : 1;
  const a1 = 0.254829592; const a2 = -0.284496736; const a3 = 1.421413741;
  const a4 = -1.453152027; const a5 = 1.061405429; const p = 0.3275911;
  const ax = Math.abs(x); const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);
  return sign * y;
};
const normalCdf = (x: number) => 0.5 * (1 + erf(x / Math.sqrt(2)));

// Acklam inverse-normal approximation. Used only inside the DSR null-max estimate.
const inverseNormal = (p: number) => {
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const plow = 0.02425; const phigh = 1 - plow;
  if (q < plow) {
    const r = Math.sqrt(-2 * Math.log(q));
    return (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  if (q > phigh) {
    const r = Math.sqrt(-2 * Math.log(1 - q));
    return -(((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  const r = q - 0.5; const s = r * r;
  return (((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1);
};

export const buildExpectedShortfall = (returns: number[], confidenceLevel = 0.95): ExpectedShortfallResult => {
  const samples = finiteReturns(returns);
  const confidence = Math.min(0.999, Math.max(0.5, confidenceLevel));
  if (samples.length < 5) return { available: false, sampleCount: samples.length, confidenceLevel: confidence, valueAtRisk: null, expectedShortfall: null };
  const valueAtRisk = quantile(samples, 1 - confidence)!;
  const tail = samples.filter((value) => value <= valueAtRisk);
  return {
    available: true,
    sampleCount: samples.length,
    confidenceLevel: confidence,
    valueAtRisk,
    expectedShortfall: tail.length ? mean(tail) : valueAtRisk,
  };
};

export const buildDeflatedSharpe = (returns: number[], trialCount = 1): DeflatedSharpeResult => {
  const samples = finiteReturns(returns);
  const trials = Math.max(1, Math.trunc(trialCount));
  if (samples.length < 30) return {
    available: false, sampleCount: samples.length, trialCount: trials, sharpePerObservation: null,
    expectedMaxNullSharpe: null, skewness: null, kurtosis: null, probability: null,
    verdict: 'INSUFFICIENT_DATA', reasons: [`At least 30 observations are required; ${samples.length} are available.`],
  };
  const avg = mean(samples); const std = sampleStd(samples);
  if (std <= 0) return {
    available: false, sampleCount: samples.length, trialCount: trials, sharpePerObservation: null,
    expectedMaxNullSharpe: null, skewness: null, kurtosis: null, probability: null,
    verdict: 'INSUFFICIENT_DATA', reasons: ['Return variance is zero; Sharpe deflation is undefined.'],
  };
  const sharpe = avg / std;
  const skewness = mean(samples.map((value) => ((value - avg) / std) ** 3));
  const kurtosis = mean(samples.map((value) => ((value - avg) / std) ** 4));
  const sigmaNull = 1 / Math.sqrt(Math.max(1, samples.length - 1));
  const gamma = 0.5772156649015329;
  const expectedMaxNullSharpe = trials <= 1 ? 0 : sigmaNull * (
    (1 - gamma) * inverseNormal(1 - 1 / trials)
      + gamma * inverseNormal(1 - 1 / (trials * Math.E))
  );
  const varianceAdjustment = Math.max(1e-9, 1 - skewness * sharpe + ((kurtosis - 1) / 4) * sharpe * sharpe);
  const statistic = (sharpe - expectedMaxNullSharpe) * Math.sqrt(samples.length - 1) / Math.sqrt(varianceAdjustment);
  const probability = clamp01(normalCdf(statistic));
  const verdict: ResearchValidationVerdict = probability >= 0.95 ? 'PASS' : probability >= 0.8 ? 'WATCH' : 'REJECT';
  const reasons = [
    `Per-observation Sharpe ${sharpe.toFixed(4)} is evaluated against a null maximum adjusted for ${trials} tried configuration(s).`,
    `Deflated Sharpe probability is ${(probability * 100).toFixed(1)}%.`,
  ];
  return { available: true, sampleCount: samples.length, trialCount: trials, sharpePerObservation: sharpe, expectedMaxNullSharpe, skewness, kurtosis, probability, verdict, reasons };
};

const combinations = (n: number, k: number, limit: number) => {
  const output: number[][] = [];
  const walk = (start: number, values: number[]) => {
    if (output.length >= limit) return;
    if (values.length === k) { output.push(values.slice()); return; }
    for (let value = start; value < n; value += 1) { values.push(value); walk(value + 1, values); values.pop(); if (output.length >= limit) break; }
  };
  walk(0, []); return output;
};
const sharpeLike = (values: number[]) => {
  const std = sampleStd(values); return std > 0 ? mean(values) / std : mean(values) > 0 ? Number.POSITIVE_INFINITY : mean(values) < 0 ? Number.NEGATIVE_INFINITY : 0;
};

export const buildProbabilityBacktestOverfitting = (
  strategies: PboStrategySeries[],
  slices = 8,
  maximumCombinations = 500,
): ProbabilityBacktestOverfittingResult => {
  const clean = strategies.map((item) => ({ id: item.id, returns: finiteReturns(item.returns) }));
  const observationCount = clean.length ? Math.min(...clean.map((item) => item.returns.length)) : 0;
  const strategyCount = clean.length;
  const evenSlices = Math.max(4, Math.trunc(slices / 2) * 2);
  if (strategyCount < 3 || observationCount < 60) return {
    available: false, strategyCount, observationCount, slices: evenSlices, combinations: 0, pbo: null, medianLogit: null,
    verdict: 'INSUFFICIENT_DATA', reasons: ['PBO requires at least 3 comparable strategy configurations and 60 aligned observations.'],
  };
  const sliceSize = Math.floor(observationCount / evenSlices);
  if (sliceSize < 5) return {
    available: false, strategyCount, observationCount, slices: evenSlices, combinations: 0, pbo: null, medianLogit: null,
    verdict: 'INSUFFICIENT_DATA', reasons: ['The requested CSCV slice count leaves fewer than 5 observations per slice.'],
  };
  const usableCount = sliceSize * evenSlices;
  const sliceIndices = Array.from({ length: evenSlices }, (_, slice) => Array.from({ length: sliceSize }, (_v, offset) => slice * sliceSize + offset));
  const splits = combinations(evenSlices, evenSlices / 2, Math.max(1, maximumCombinations));
  const logits: number[] = [];

  for (const inSlices of splits) {
    const inSet = new Set(inSlices);
    const trainIndices = sliceIndices.filter((_indices, index) => inSet.has(index)).flat();
    const testIndices = sliceIndices.filter((_indices, index) => !inSet.has(index)).flat();
    const inScores = clean.map((strategy) => sharpeLike(trainIndices.map((index) => strategy.returns[index])));
    let winner = 0;
    for (let index = 1; index < inScores.length; index += 1) if (inScores[index] > inScores[winner]) winner = index;
    const outScores = clean.map((strategy) => sharpeLike(testIndices.map((index) => strategy.returns[index])));
    const ordered = outScores.map((score, index) => ({ score, index })).sort((a, b) => a.score - b.score || a.index - b.index);
    const rank = ordered.findIndex((item) => item.index === winner) + 1;
    const omega = Math.min(1 - 1e-9, Math.max(1e-9, rank / (strategyCount + 1)));
    logits.push(Math.log(omega / (1 - omega)));
  }

  const pbo = logits.length ? logits.filter((value) => value <= 0).length / logits.length : null;
  const medianLogit = median(logits);
  const verdict: ResearchValidationVerdict = pbo == null ? 'INSUFFICIENT_DATA' : pbo <= 0.2 ? 'PASS' : pbo <= 0.4 ? 'WATCH' : 'REJECT';
  return {
    available: pbo != null, strategyCount, observationCount: usableCount, slices: evenSlices, combinations: logits.length,
    pbo, medianLogit, verdict,
    reasons: pbo == null ? ['No valid CSCV combinations were produced.'] : [`Estimated probability of backtest overfitting is ${(pbo * 100).toFixed(1)}% across ${logits.length} combinatorial splits.`],
  };
};

export const buildCalibration = (observations: CalibrationObservation[], binCount = 10): CalibrationResult => {
  const clean = observations.filter((item) => Number.isFinite(item.probability)).map((item) => ({ probability: clamp01(item.probability), outcome: Boolean(item.outcome) }));
  const binsN = Math.min(20, Math.max(2, Math.trunc(binCount)));
  if (clean.length < 20) return { available: false, sampleCount: clean.length, brierScore: null, logLoss: null, expectedCalibrationError: null, bins: [], verdict: 'INSUFFICIENT_DATA' };
  const eps = 1e-9;
  const brierScore = mean(clean.map((item) => (item.probability - (item.outcome ? 1 : 0)) ** 2));
  const logLoss = mean(clean.map((item) => -(item.outcome ? Math.log(Math.max(eps, item.probability)) : Math.log(Math.max(eps, 1 - item.probability)))));
  const bins: CalibrationBin[] = [];
  let ece = 0;
  for (let index = 0; index < binsN; index += 1) {
    const lower = index / binsN; const upper = (index + 1) / binsN;
    const members = clean.filter((item) => item.probability >= lower && (index === binsN - 1 ? item.probability <= upper : item.probability < upper));
    const meanProbability = members.length ? mean(members.map((item) => item.probability)) : null;
    const outcomeRate = members.length ? mean(members.map((item) => item.outcome ? 1 : 0)) : null;
    if (members.length && meanProbability != null && outcomeRate != null) ece += members.length / clean.length * Math.abs(meanProbability - outcomeRate);
    bins.push({ lower, upper, count: members.length, meanProbability, outcomeRate });
  }
  const verdict: ResearchValidationVerdict = brierScore <= 0.18 && ece <= 0.08 ? 'PASS' : brierScore <= 0.25 && ece <= 0.15 ? 'WATCH' : 'REJECT';
  return { available: true, sampleCount: clean.length, brierScore, logLoss, expectedCalibrationError: ece, bins, verdict };
};

const createSeededRandom = (seed: number) => {
  let state = (Math.trunc(seed) >>> 0) || 0x6d2b79f5;
  return () => { state += 0x6d2b79f5; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296; };
};

export const buildBlockRegimeMonteCarlo = (
  input: RegimeReturnSample[],
  overrides: Partial<BlockRegimeMonteCarloConfig> = {},
): BlockRegimeMonteCarloResult => {
  const samples = input.filter((item) => Number.isFinite(item.returnPct) && item.returnPct > -1 && item.returnPct < 10).map((item) => ({ returnPct: item.returnPct, regime: item.regime || 'UNKNOWN' }));
  const config: BlockRegimeMonteCarloConfig = {
    scenarioCount: Math.min(10_000, Math.max(200, Math.trunc(overrides.scenarioCount ?? 1_000))),
    seed: Math.trunc(overrides.seed ?? 20_260_906),
    minSamples: Math.min(500, Math.max(20, Math.trunc(overrides.minSamples ?? 40))),
    blockSize: Math.min(20, Math.max(2, Math.trunc(overrides.blockSize ?? 5))),
    horizonSamples: overrides.horizonSamples ?? null,
    drawdownLimitPct: Math.min(0.5, Math.max(0.01, overrides.drawdownLimitPct ?? 0.10)),
    costInflationBps: Math.min(500, Math.max(0, overrides.costInflationBps ?? 10)),
  };
  const regimes = [...new Set(samples.map((item) => item.regime))];
  if (samples.length < config.minSamples || regimes.length < 1) return {
    available: false, sampleCount: samples.length, scenarioCount: config.scenarioCount, blockSize: config.blockSize,
    horizonSamples: config.horizonSamples ?? samples.length, survivalProbability: null, profitableProbability: null,
    terminalP05: null, terminalMedian: null, drawdownP95: null, expectedShortfall95: null, regimeCount: regimes.length,
    verdict: 'INSUFFICIENT_DATA', assumptions: { movingBlockBootstrap: true, regimeStratified: true, costInflationBps: config.costInflationBps },
    reasons: [`At least ${config.minSamples} regime-labelled observations are required; ${samples.length} are available.`],
  };

  const blocksByRegime = new Map<string, number[][]>();
  for (const regime of regimes) blocksByRegime.set(regime, []);
  for (let start = 0; start < samples.length; start += 1) {
    const regime = samples[start].regime; const block: number[] = [];
    for (let offset = 0; offset < config.blockSize && start + offset < samples.length; offset += 1) {
      if (samples[start + offset].regime !== regime) break;
      block.push(samples[start + offset].returnPct);
    }
    if (block.length >= 2) blocksByRegime.get(regime)!.push(block);
  }
  const usableRegimes = regimes.filter((regime) => (blocksByRegime.get(regime)?.length ?? 0) > 0);
  if (!usableRegimes.length) return {
    available: false, sampleCount: samples.length, scenarioCount: config.scenarioCount, blockSize: config.blockSize,
    horizonSamples: config.horizonSamples ?? samples.length, survivalProbability: null, profitableProbability: null,
    terminalP05: null, terminalMedian: null, drawdownP95: null, expectedShortfall95: null, regimeCount: regimes.length,
    verdict: 'INSUFFICIENT_DATA', assumptions: { movingBlockBootstrap: true, regimeStratified: true, costInflationBps: config.costInflationBps }, reasons: ['No within-regime moving blocks could be formed.'],
  };
  const frequencies = usableRegimes.map((regime) => samples.filter((item) => item.regime === regime).length);
  const frequencyTotal = frequencies.reduce((sum, value) => sum + value, 0);
  const random = createSeededRandom(config.seed); const horizon = Math.max(config.minSamples, Math.trunc(config.horizonSamples ?? samples.length));
  const terminalReturns: number[] = []; const drawdowns: number[] = []; let survived = 0; let profitable = 0;
  const cost = config.costInflationBps / 10_000;

  for (let scenario = 0; scenario < config.scenarioCount; scenario += 1) {
    let equity = 1; let peak = 1; let maxDrawdown = 0; let count = 0;
    while (count < horizon) {
      const regimeDraw = random() * frequencyTotal; let cumulative = 0; let regime = usableRegimes[usableRegimes.length - 1];
      for (let index = 0; index < usableRegimes.length; index += 1) { cumulative += frequencies[index]; if (regimeDraw <= cumulative) { regime = usableRegimes[index]; break; } }
      const blocks = blocksByRegime.get(regime)!; const block = blocks[Math.min(blocks.length - 1, Math.floor(random() * blocks.length))];
      for (const sample of block) {
        if (count >= horizon) break;
        equity *= 1 + Math.max(-0.999, sample - cost); peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - equity) / peak : 1); count += 1;
      }
    }
    const terminal = equity - 1; terminalReturns.push(terminal); drawdowns.push(maxDrawdown);
    if (maxDrawdown <= config.drawdownLimitPct && equity > 0) survived += 1;
    if (terminal > 0) profitable += 1;
  }
  const survivalProbability = survived / config.scenarioCount; const profitableProbability = profitable / config.scenarioCount;
  const terminalP05 = quantile(terminalReturns, 0.05); const terminalMedian = quantile(terminalReturns, 0.5); const drawdownP95 = quantile(drawdowns, 0.95);
  const es = buildExpectedShortfall(terminalReturns, 0.95).expectedShortfall;
  const verdict: ResearchValidationVerdict = survivalProbability >= 0.95 && (drawdownP95 ?? 1) <= config.drawdownLimitPct && (es ?? -1) >= -0.05
    ? 'PASS' : survivalProbability >= 0.8 && (drawdownP95 ?? 1) <= config.drawdownLimitPct * 1.5 ? 'WATCH' : 'REJECT';
  return {
    available: true, sampleCount: samples.length, scenarioCount: config.scenarioCount, blockSize: config.blockSize, horizonSamples: horizon,
    survivalProbability, profitableProbability, terminalP05, terminalMedian, drawdownP95, expectedShortfall95: es, regimeCount: usableRegimes.length,
    verdict, assumptions: { movingBlockBootstrap: true, regimeStratified: true, costInflationBps: config.costInflationBps },
    reasons: [`Moving-block stress retained within-regime return sequences across ${usableRegimes.length} regime(s).`, `Stress survival probability is ${(survivalProbability * 100).toFixed(1)}%.`],
  };
};
