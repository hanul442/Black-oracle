import assert from 'node:assert/strict';
import test from 'node:test';
import { assessPortfolioCorrelationRisk } from './portfolioCorrelationRisk';
import type { MarketPriceSnapshot } from './marketHistory';

const correlatedHistory = (count = 40): MarketPriceSnapshot[] => Array.from({ length: count }, (_, index) => ({
  timestamp: 1_000_000 + index * 900_000,
  prices: [
    ['KRW-BTC', 100 + index * 1.2 + (index % 3) * 0.1],
    ['KRW-ETH', 50 + index * 0.6 + (index % 3) * 0.05],
    ['KRW-XRP', 10 + index * 0.12 + (index % 3) * 0.01],
  ],
}));

test('no open position means no correlation blocker', () => {
  const result = assessPortfolioCorrelationRisk({ candidateMarket: 'KRW-BTC', openMarkets: [], marketHistory: [] });
  assert.equal(result.disposition, 'PASS');
});

test('missing aligned history fails closed before adding concurrent crypto exposure', () => {
  const result = assessPortfolioCorrelationRisk({ candidateMarket: 'KRW-BTC', openMarkets: ['KRW-ETH'], marketHistory: correlatedHistory(5) });
  assert.equal(result.disposition, 'INSUFFICIENT_DATA');
});

test('multiple highly correlated open markets reject additional cluster exposure', () => {
  const result = assessPortfolioCorrelationRisk({
    candidateMarket: 'KRW-BTC', openMarkets: ['KRW-ETH', 'KRW-XRP'], marketHistory: correlatedHistory(), minReturnSamples: 20, maxHighlyCorrelatedOpen: 1,
  });
  assert.equal(result.disposition, 'REJECT');
  assert.ok((result.maxCorrelation ?? 0) > 0.82);
  assert.equal(result.highlyCorrelatedMarkets.length, 2);
});
