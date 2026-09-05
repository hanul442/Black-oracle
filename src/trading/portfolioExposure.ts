export interface ExposurePosition {
  market: string;
  marketValue: number;
}

export interface ExposureProfileLimits {
  grossExposureCapPct: number;
  cryptoClusterExposureCapPct: number;
}

export interface CorrelationSeries {
  market: string;
  returns: number[];
}

export interface PortfolioExposureAssessment {
  equity: number;
  grossExposure: number;
  grossExposurePct: number;
  cryptoClusterExposure: number;
  cryptoClusterExposurePct: number;
  positionCount: number;
  maxSinglePositionPct: number;
  grossCapBreached: boolean;
  cryptoClusterCapBreached: boolean;
  pairwiseCorrelation: {
    available: boolean;
    average: number | null;
    maximum: number | null;
    pairCount: number;
    reason: string;
  };
  disposition: 'PASS' | 'WATCH' | 'REJECT';
  reasons: string[];
  executionAuthority: false;
}

const finite = (value: number) => Number.isFinite(value);

const pearson = (left: number[], right: number[]) => {
  const size = Math.min(left.length, right.length);
  if (size < 10) return null;
  const a = left.slice(-size);
  const b = right.slice(-size);
  if (!a.every(finite) || !b.every(finite)) return null;
  const meanA = a.reduce((sum, value) => sum + value, 0) / size;
  const meanB = b.reduce((sum, value) => sum + value, 0) / size;
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let index = 0; index < size; index += 1) {
    const da = a[index] - meanA;
    const db = b[index] - meanB;
    covariance += da * db;
    varianceA += da * da;
    varianceB += db * db;
  }
  if (varianceA <= 0 || varianceB <= 0) return null;
  return Math.max(-1, Math.min(1, covariance / Math.sqrt(varianceA * varianceB)));
};

const correlationSummary = (positions: ExposurePosition[], series: CorrelationSeries[]) => {
  const byMarket = new Map(series.map((item) => [item.market.toUpperCase(), item.returns]));
  const values: number[] = [];
  for (let left = 0; left < positions.length; left += 1) {
    for (let right = left + 1; right < positions.length; right += 1) {
      const a = byMarket.get(positions[left].market.toUpperCase());
      const b = byMarket.get(positions[right].market.toUpperCase());
      if (!a || !b) continue;
      const value = pearson(a, b);
      if (value !== null) values.push(value);
    }
  }
  if (!values.length) {
    return {
      available: false,
      average: null,
      maximum: null,
      pairCount: 0,
      reason: 'No sufficiently long aligned return series are available; correlation is not inferred.',
    };
  }
  return {
    available: true,
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    maximum: Math.max(...values),
    pairCount: values.length,
    reason: 'Pairwise Pearson correlation is calculated only from supplied aligned return series.',
  };
};

export const assessPortfolioExposure = (
  equity: number,
  positions: ExposurePosition[],
  limits: ExposureProfileLimits,
  correlationSeries: CorrelationSeries[] = [],
): PortfolioExposureAssessment => {
  if (!finite(equity) || equity <= 0) throw new Error('Portfolio exposure assessment requires positive finite equity.');
  if (!finite(limits.grossExposureCapPct) || limits.grossExposureCapPct <= 0 || limits.grossExposureCapPct > 1) {
    throw new Error('grossExposureCapPct must be within (0, 1].');
  }
  if (!finite(limits.cryptoClusterExposureCapPct) || limits.cryptoClusterExposureCapPct <= 0 || limits.cryptoClusterExposureCapPct > 1) {
    throw new Error('cryptoClusterExposureCapPct must be within (0, 1].');
  }

  const clean = positions
    .filter((item) => /^KRW-[A-Z0-9]+$/.test(item.market.toUpperCase()))
    .filter((item) => finite(item.marketValue) && item.marketValue >= 0)
    .map((item) => ({ ...item, market: item.market.toUpperCase() }));

  const grossExposure = clean.reduce((sum, item) => sum + item.marketValue, 0);
  // v0.3 is crypto-only, so every current KRW market is conservatively treated as one crypto-risk cluster.
  // Later asset-class expansion can replace this with explicit cluster taxonomy.
  const cryptoClusterExposure = grossExposure;
  const grossExposurePct = grossExposure / equity;
  const cryptoClusterExposurePct = cryptoClusterExposure / equity;
  const maxSinglePositionPct = clean.length
    ? Math.max(...clean.map((item) => item.marketValue / equity))
    : 0;
  const grossCapBreached = grossExposurePct > limits.grossExposureCapPct;
  const cryptoClusterCapBreached = cryptoClusterExposurePct > limits.cryptoClusterExposureCapPct;
  const pairwiseCorrelation = correlationSummary(clean, correlationSeries);
  const reasons: string[] = [];

  if (grossCapBreached) reasons.push(`Gross exposure ${(grossExposurePct * 100).toFixed(2)}% exceeds the profile cap ${(limits.grossExposureCapPct * 100).toFixed(2)}%.`);
  if (cryptoClusterCapBreached) reasons.push(`Crypto-cluster exposure ${(cryptoClusterExposurePct * 100).toFixed(2)}% exceeds the profile cap ${(limits.cryptoClusterExposureCapPct * 100).toFixed(2)}%.`);
  if (!pairwiseCorrelation.available && clean.length > 1) reasons.push('Correlation data is unavailable, so multi-position diversification cannot be credited.');
  if (pairwiseCorrelation.maximum !== null && pairwiseCorrelation.maximum >= 0.8) reasons.push(`Maximum observed pairwise correlation is ${pairwiseCorrelation.maximum.toFixed(2)}, indicating concentrated directional risk.`);

  const highCorrelation = (pairwiseCorrelation.maximum ?? 0) >= 0.8;
  const disposition = grossCapBreached || cryptoClusterCapBreached
    ? 'REJECT'
    : highCorrelation || (!pairwiseCorrelation.available && clean.length > 1)
      ? 'WATCH'
      : 'PASS';

  if (!reasons.length) reasons.push('Observed exposure and available correlation checks remain within the selected experimental profile.');

  return Object.freeze({
    equity,
    grossExposure,
    grossExposurePct,
    cryptoClusterExposure,
    cryptoClusterExposurePct,
    positionCount: clean.length,
    maxSinglePositionPct,
    grossCapBreached,
    cryptoClusterCapBreached,
    pairwiseCorrelation: Object.freeze(pairwiseCorrelation),
    disposition,
    reasons: Object.freeze(reasons) as string[],
    executionAuthority: false as const,
  });
};
