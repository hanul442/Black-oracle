import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPortfolioExposure } from './portfolioExposure';

test('crypto-only book receives no diversification credit without correlation data', () => {
  const result = assessPortfolioExposure(1_000_000, [
    { market: 'KRW-BTC', marketValue: 20_000 },
    { market: 'KRW-ETH', marketValue: 20_000 },
  ], { grossExposureCapPct: 0.08, cryptoClusterExposureCapPct: 0.06 });

  assert.equal(result.grossExposurePct, 0.04);
  assert.equal(result.pairwiseCorrelation.available, false);
  assert.equal(result.disposition, 'WATCH');
  assert.equal(result.executionAuthority, false);
});

test('cluster cap breach is a deterministic reject', () => {
  const result = assessPortfolioExposure(1_000_000, [
    { market: 'KRW-BTC', marketValue: 40_000 },
    { market: 'KRW-ETH', marketValue: 40_000 },
  ], { grossExposureCapPct: 0.10, cryptoClusterExposureCapPct: 0.06 });

  assert.equal(result.cryptoClusterCapBreached, true);
  assert.equal(result.disposition, 'REJECT');
});

test('supplied highly correlated return series trigger concentration watch', () => {
  const btc = Array.from({ length: 20 }, (_, index) => index / 100);
  const eth = btc.map((value) => value * 1.1);
  const result = assessPortfolioExposure(1_000_000, [
    { market: 'KRW-BTC', marketValue: 20_000 },
    { market: 'KRW-ETH', marketValue: 20_000 },
  ], { grossExposureCapPct: 0.08, cryptoClusterExposureCapPct: 0.06 }, [
    { market: 'KRW-BTC', returns: btc },
    { market: 'KRW-ETH', returns: eth },
  ]);

  assert.equal(result.pairwiseCorrelation.available, true);
  assert.ok((result.pairwiseCorrelation.maximum || 0) > 0.99);
  assert.equal(result.disposition, 'WATCH');
});
