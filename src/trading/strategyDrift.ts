export type StrategyDriftVerdict = 'STABLE' | 'WATCH' | 'DEGRADED' | 'INSUFFICIENT_DATA';
export type StrategyDriftRecommendation = 'CONTINUE_OBSERVATION' | 'EXTEND_VALIDATION' | 'DEMOTION_REVIEW';

export interface StrategyDriftWindow {
  genomeId: string;
  startedAt: number;
  endedAt: number;
  samples: number;
  expectancyReturn: number;
  maxDrawdownPct: number;
  regimeCounts: Record<string, number>;
  parity: {
    policyObserved: number;
    policyRejected: number;
    targetObserved: number;
    targetRejected: number;
    adapterObserved: number;
    adapterRejected: number;
  };
}

export interface StrategyDriftPolicy {
  version: string;
  minimumSamplesPerWindow: number;
  expectancyDropWatchBps: number;
  expectancyDropDegradeBps: number;
  drawdownExpansionWatchPct: number;
  drawdownExpansionDegradePct: number;
  regimeTotalVariationWatch: number;
  regimeTotalVariationDegrade: number;
  anyParityMismatchDegrades: boolean;
}

export interface StrategyDriftAssessment {
  schemaVersion: 1;
  policyVersion: string;
  genomeId: string;
  verdict: StrategyDriftVerdict;
  recommendation: StrategyDriftRecommendation;
  metrics: {
    baselineSamples: number;
    recentSamples: number;
    expectancyDropBps: number | null;
    drawdownExpansionPct: number | null;
    regimeTotalVariation: number | null;
    parityMismatches: number;
  };
  checks: Array<{
    key: 'SAMPLE_DEPTH' | 'EXPECTANCY_DRIFT' | 'DRAWDOWN_DRIFT' | 'REGIME_SHIFT' | 'PARITY_DRIFT';
    disposition: 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';
    reason: string;
  }>;
  reasons: string[];
  automaticDemotion: false;
  executionAuthority: false;
  promotionAuthority: false;
  capitalAuthority: false;
}

export const DEFAULT_STRATEGY_DRIFT_POLICY: StrategyDriftPolicy = {
  version: 'S7_STRATEGY_DRIFT_V1',
  minimumSamplesPerWindow: 20,
  expectancyDropWatchBps: 10,
  expectancyDropDegradeBps: 25,
  drawdownExpansionWatchPct: 0.01,
  drawdownExpansionDegradePct: 0.02,
  regimeTotalVariationWatch: 0.25,
  regimeTotalVariationDegrade: 0.40,
  anyParityMismatchDegrades: true,
};

const finite = (value: number, label: string) => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
};

const normalizeWindow = (window: StrategyDriftWindow): StrategyDriftWindow => {
  const genomeId = window.genomeId.trim();
  if (!genomeId) throw new Error('Strategy drift window requires genomeId.');
  if (!Number.isFinite(window.startedAt) || !Number.isFinite(window.endedAt) || window.startedAt <= 0 || window.endedAt < window.startedAt) {
    throw new Error('Strategy drift window timestamps are invalid.');
  }
  if (!Number.isInteger(window.samples) || window.samples < 0) throw new Error('Strategy drift window samples must be a non-negative integer.');
  finite(window.expectancyReturn, 'Strategy drift expectancyReturn');
  if (!Number.isFinite(window.maxDrawdownPct) || window.maxDrawdownPct < 0 || window.maxDrawdownPct > 1) throw new Error('Strategy drift maxDrawdownPct must be between 0 and 1.');
  const regimeCounts = Object.fromEntries(Object.entries(window.regimeCounts ?? {})
    .map(([key, value]) => [key.trim().toUpperCase(), value] as const)
    .filter(([key]) => Boolean(key))
    .map(([key, value]) => {
      if (!Number.isInteger(value) || value < 0) throw new Error(`Strategy drift regime count ${key} must be a non-negative integer.`);
      return [key, value] as const;
    }));
  const parityValues = Object.values(window.parity);
  if (parityValues.some((value) => !Number.isInteger(value) || value < 0)) throw new Error('Strategy drift parity counts must be non-negative integers.');
  if (window.parity.policyRejected > window.parity.policyObserved || window.parity.targetRejected > window.parity.targetObserved || window.parity.adapterRejected > window.parity.adapterObserved) {
    throw new Error('Strategy drift parity rejected counts cannot exceed observed counts.');
  }
  return { ...window, genomeId, regimeCounts };
};

const regimeDistribution = (counts: Record<string, number>) => {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;
  return Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value / total]));
};

/** Total variation distance in [0,1], robust to regime categories appearing in only one window. */
export const strategyRegimeTotalVariation = (left: Record<string, number>, right: Record<string, number>): number | null => {
  const a = regimeDistribution(left);
  const b = regimeDistribution(right);
  if (!a || !b) return null;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys.reduce((sum, key) => sum + Math.abs((a[key] ?? 0) - (b[key] ?? 0)), 0) / 2;
};

const dispositionForIncrease = (value: number, watch: number, reject: number) => value >= reject ? 'REJECT' as const : value >= watch ? 'WATCH' as const : 'PASS' as const;

export const assessStrategyDrift = (
  baselineInput: StrategyDriftWindow,
  recentInput: StrategyDriftWindow,
  policy: StrategyDriftPolicy = DEFAULT_STRATEGY_DRIFT_POLICY,
): StrategyDriftAssessment => {
  const baseline = normalizeWindow(baselineInput);
  const recent = normalizeWindow(recentInput);
  if (baseline.genomeId !== recent.genomeId) throw new Error('Strategy drift windows must reference the same genomeId.');
  if (recent.startedAt < baseline.startedAt) throw new Error('Recent strategy drift window cannot start before baseline window.');

  const checks: StrategyDriftAssessment['checks'] = [];
  const sampleSufficient = baseline.samples >= policy.minimumSamplesPerWindow && recent.samples >= policy.minimumSamplesPerWindow;
  checks.push({
    key: 'SAMPLE_DEPTH',
    disposition: sampleSufficient ? 'PASS' : 'INSUFFICIENT_DATA',
    reason: `Baseline/recent samples ${baseline.samples}/${recent.samples}; ${policy.minimumSamplesPerWindow} required per window.`,
  });

  const expectancyDropBps = sampleSufficient ? (baseline.expectancyReturn - recent.expectancyReturn) * 10_000 : null;
  checks.push({
    key: 'EXPECTANCY_DRIFT',
    disposition: expectancyDropBps == null ? 'INSUFFICIENT_DATA' : dispositionForIncrease(expectancyDropBps, policy.expectancyDropWatchBps, policy.expectancyDropDegradeBps),
    reason: expectancyDropBps == null ? 'Expectancy drift requires sufficient samples in both windows.' : `Expectancy deterioration is ${expectancyDropBps.toFixed(2)} bps vs watch/degrade ${policy.expectancyDropWatchBps}/${policy.expectancyDropDegradeBps} bps.`,
  });

  const drawdownExpansionPct = sampleSufficient ? recent.maxDrawdownPct - baseline.maxDrawdownPct : null;
  checks.push({
    key: 'DRAWDOWN_DRIFT',
    disposition: drawdownExpansionPct == null ? 'INSUFFICIENT_DATA' : dispositionForIncrease(drawdownExpansionPct, policy.drawdownExpansionWatchPct, policy.drawdownExpansionDegradePct),
    reason: drawdownExpansionPct == null ? 'Drawdown drift requires sufficient samples in both windows.' : `Max-drawdown expansion is ${(drawdownExpansionPct * 100).toFixed(2)}pp vs watch/degrade ${(policy.drawdownExpansionWatchPct * 100).toFixed(2)}/${(policy.drawdownExpansionDegradePct * 100).toFixed(2)}pp.`,
  });

  const regimeTotalVariation = sampleSufficient ? strategyRegimeTotalVariation(baseline.regimeCounts, recent.regimeCounts) : null;
  checks.push({
    key: 'REGIME_SHIFT',
    disposition: regimeTotalVariation == null ? 'INSUFFICIENT_DATA' : dispositionForIncrease(regimeTotalVariation, policy.regimeTotalVariationWatch, policy.regimeTotalVariationDegrade),
    reason: regimeTotalVariation == null ? 'Regime shift requires sufficient samples and non-empty regime counts.' : `Regime distribution total-variation distance is ${regimeTotalVariation.toFixed(3)} vs watch/degrade ${policy.regimeTotalVariationWatch}/${policy.regimeTotalVariationDegrade}.`,
  });

  const parityMismatches = recent.parity.policyRejected + recent.parity.targetRejected + recent.parity.adapterRejected;
  const parityObserved = recent.parity.policyObserved + recent.parity.targetObserved + recent.parity.adapterObserved;
  const parityDisposition = parityObserved === 0
    ? 'INSUFFICIENT_DATA' as const
    : parityMismatches > 0 && policy.anyParityMismatchDegrades
      ? 'REJECT' as const
      : parityMismatches > 0
        ? 'WATCH' as const
        : 'PASS' as const;
  checks.push({
    key: 'PARITY_DRIFT',
    disposition: parityDisposition,
    reason: `${parityMismatches} parity mismatch(es) across ${parityObserved} recent policy/target/adapter observation(s).`,
  });

  const rejected = checks.filter((item) => item.disposition === 'REJECT');
  const insufficient = checks.filter((item) => item.disposition === 'INSUFFICIENT_DATA');
  const watched = checks.filter((item) => item.disposition === 'WATCH');
  const verdict: StrategyDriftVerdict = rejected.length
    ? 'DEGRADED'
    : insufficient.length
      ? 'INSUFFICIENT_DATA'
      : watched.length
        ? 'WATCH'
        : 'STABLE';
  const recommendation: StrategyDriftRecommendation = verdict === 'DEGRADED'
    ? 'DEMOTION_REVIEW'
    : verdict === 'STABLE'
      ? 'CONTINUE_OBSERVATION'
      : 'EXTEND_VALIDATION';
  const reasons = [`${checks.filter((item) => item.disposition === 'PASS').length}/${checks.length} drift checks passed.`];
  if (rejected.length) reasons.push(`Degraded check(s): ${rejected.map((item) => item.key).join(', ')}.`);
  if (watched.length) reasons.push(`Watch check(s): ${watched.map((item) => item.key).join(', ')}.`);
  if (insufficient.length) reasons.push(`Insufficient check(s): ${insufficient.map((item) => item.key).join(', ')}.`);

  return {
    schemaVersion: 1,
    policyVersion: policy.version,
    genomeId: baseline.genomeId,
    verdict,
    recommendation,
    metrics: {
      baselineSamples: baseline.samples,
      recentSamples: recent.samples,
      expectancyDropBps,
      drawdownExpansionPct,
      regimeTotalVariation,
      parityMismatches,
    },
    checks,
    reasons,
    automaticDemotion: false,
    executionAuthority: false,
    promotionAuthority: false,
    capitalAuthority: false,
  };
};
