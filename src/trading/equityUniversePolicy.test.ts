import assert from 'node:assert/strict';
import test from 'node:test';
import { EQUITY_MIN_DAILY_VOLUME, EQUITY_MIN_MARKET_CAP_KRW, evaluateEquityUniverseCandidate } from './equityUniversePolicy';

const base = {
  market: 'KRX-000000',
  symbol: '000000',
  name: 'TEST',
  sector: 'TEST',
  dailyVolume: EQUITY_MIN_DAILY_VOLUME,
  marketCapKrw: EQUITY_MIN_MARKET_CAP_KRW,
  cryptoLinked: false,
};

test('passes only when volume, market cap and crypto classification all pass', () => {
  const result = evaluateEquityUniverseCandidate(base);
  assert.equal(result.eligible, true);
  assert.equal(result.dataGaps.length, 0);
});

test('rejects sub-threshold liquidity or size', () => {
  assert.equal(evaluateEquityUniverseCandidate({ ...base, dailyVolume: 499_999 }).eligible, false);
  assert.equal(evaluateEquityUniverseCandidate({ ...base, marketCapKrw: EQUITY_MIN_MARKET_CAP_KRW - 1 }).eligible, false);
});

test('rejects crypto-linked equities and missing classification data', () => {
  assert.equal(evaluateEquityUniverseCandidate({ ...base, cryptoLinked: true, cryptoLinkReasons: ['digital asset treasury'] }).eligible, false);
  const unknown = evaluateEquityUniverseCandidate({ ...base, cryptoLinked: null });
  assert.equal(unknown.eligible, false);
  assert.ok(unknown.dataGaps.some((item) => item.includes('Crypto-linked')));
});
