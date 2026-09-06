import { buildAlignedMarketReturnSeries, type MarketPriceSnapshot } from './marketHistory';

export type PortfolioCorrelationDisposition = 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';

export interface PortfolioCorrelationRiskResult {
  disposition: PortfolioCorrelationDisposition;
  candidateMarket: string;
  openMarkets: string[];
  maxCorrelation: number | null;
  highlyCorrelatedMarkets: string[];
  sampleReturns: number;
  reasons: string[];
}

const correlation = (left: number[], right: number[]) => {
  const count = Math.min(left.length, right.length);
  if (count < 2) return null;
  const x = left.slice(-count);
  const y = right.slice(-count);
  const meanX = x.reduce((sum, value) => sum + value, 0) / count;
  const meanY = y.reduce((sum, value) => sum + value, 0) / count;
  let covariance = 0; let varianceX = 0; let varianceY = 0;
  for (let index = 0; index < count; index += 1) {
    const dx = x[index] - meanX; const dy = y[index] - meanY;
    covariance += dx * dy; varianceX += dx * dx; varianceY += dy * dy;
  }
  if (varianceX <= 0 || varianceY <= 0) return null;
  return covariance / Math.sqrt(varianceX * varianceY);
};

export const assessPortfolioCorrelationRisk = (input: {
  candidateMarket: string;
  openMarkets: string[];
  marketHistory: MarketPriceSnapshot[];
  minReturnSamples?: number;
  watchCorrelation?: number;
  rejectCorrelation?: number;
  maxHighlyCorrelatedOpen?: number;
}): PortfolioCorrelationRiskResult => {
  const candidateMarket = input.candidateMarket.toUpperCase();
  const openMarkets = [...new Set(input.openMarkets.map((market) => market.toUpperCase()).filter((market) => market !== candidateMarket))].sort();
  const minReturnSamples = Math.max(12, Math.trunc(input.minReturnSamples ?? 24));
  const watchCorrelation = Math.min(0.95, Math.max(0.4, input.watchCorrelation ?? 0.7));
  const rejectCorrelation = Math.min(0.99, Math.max(watchCorrelation, input.rejectCorrelation ?? 0.82));
  const maxHighlyCorrelatedOpen = Math.max(1, Math.trunc(input.maxHighlyCorrelatedOpen ?? 1));

  if (!openMarkets.length) return { disposition: 'PASS', candidateMarket, openMarkets, maxCorrelation: null, highlyCorrelatedMarkets: [], sampleReturns: 0, reasons: ['No existing different-market position creates correlation concurrency risk.'] };

  const series = buildAlignedMarketReturnSeries(input.marketHistory, [candidateMarket, ...openMarkets], 384);
  const candidate = series.find((item) => item.market === candidateMarket);
  const sampleReturns = candidate?.returns.length ?? 0;
  if (!candidate || sampleReturns < minReturnSamples) {
    return {
      disposition: 'INSUFFICIENT_DATA', candidateMarket, openMarkets, maxCorrelation: null, highlyCorrelatedMarkets: [], sampleReturns,
      reasons: [`Portfolio correlation requires at least ${minReturnSamples} aligned return samples before adding another concurrent crypto long.`],
    };
  }

  const pairs = openMarkets.flatMap((market) => {
    const existing = series.find((item) => item.market === market);
    if (!existing || existing.returns.length < minReturnSamples) return [];
    const value = correlation(candidate.returns, existing.returns);
    return value == null || !Number.isFinite(value) ? [] : [{ market, correlation: value }];
  });
  if (pairs.length !== openMarkets.length) {
    return { disposition: 'INSUFFICIENT_DATA', candidateMarket, openMarkets, maxCorrelation: null, highlyCorrelatedMarkets: [], sampleReturns, reasons: ['Aligned return history is incomplete for at least one existing open market.'] };
  }

  const maxCorrelation = Math.max(...pairs.map((item) => item.correlation));
  const highlyCorrelatedMarkets = pairs.filter((item) => item.correlation >= rejectCorrelation).map((item) => item.market);
  let disposition: PortfolioCorrelationDisposition = 'PASS';
  if (highlyCorrelatedMarkets.length > maxHighlyCorrelatedOpen) disposition = 'REJECT';
  else if (maxCorrelation >= watchCorrelation) disposition = 'WATCH';

  const reasons = [`Maximum aligned correlation to current open positions is ${maxCorrelation.toFixed(3)} over ${sampleReturns} return samples.`];
  if (disposition === 'REJECT') reasons.push(`Candidate clusters with ${highlyCorrelatedMarkets.length} open market(s) above ${rejectCorrelation.toFixed(2)} correlation; concurrency limit is ${maxHighlyCorrelatedOpen}.`);
  else if (disposition === 'WATCH') reasons.push('Correlation is elevated; the candidate may proceed only while other hard exposure limits remain satisfied.');
  else reasons.push('No material correlated-concurrency blocker was detected.');

  return { disposition, candidateMarket, openMarkets, maxCorrelation, highlyCorrelatedMarkets, sampleReturns, reasons };
};
