import assert from 'node:assert/strict';
import test from 'node:test';
import { EquityExposureRegistry } from './equityExposureRegistry';

const now = Date.now();

test('unknown exposure remains blocked when no source-backed record exists', () => {
  const registry = new EquityExposureRegistry();
  const result = registry.resolve('KRX-005930', now);
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.cryptoLinked, null);
  assert.ok(result.dataGaps.length > 0);
});

test('source-backed clear classification resolves explicitly', () => {
  const registry = new EquityExposureRegistry();
  registry.upsert({
    market: 'KRX-005930',
    status: 'CLEAR',
    reasons: ['Official company profile shows no material crypto business exposure in the reviewed classification scope.'],
    sourceType: 'OFFICIAL_PROFILE',
    sourceId: 'company-profile-1',
    observedAt: now - 1_000,
    expiresAt: now + 86_400_000,
    confidence: 0.9,
  });
  const result = registry.resolve('KRX-005930', now);
  assert.equal(result.status, 'CLEAR');
  assert.equal(result.cryptoLinked, false);
  assert.equal(result.confidence, 0.9);
});

test('stronger crypto-linked evidence overrides weaker clear record and preserves conflict', () => {
  const registry = new EquityExposureRegistry();
  registry.upsert({ market: 'KRX-000001', status: 'CLEAR', reasons: ['older classification'], sourceType: 'CURATED_RESEARCH', sourceId: 'clear', observedAt: now - 1_000, expiresAt: now + 86_400_000, confidence: 0.6 });
  registry.upsert({ market: 'KRX-000001', status: 'CRYPTO_LINKED', reasons: ['official filing identifies material digital-asset treasury exposure'], sourceType: 'FILING', sourceId: 'filing', observedAt: now - 500, expiresAt: now + 86_400_000, confidence: 0.95 });
  const result = registry.resolve('KRX-000001', now);
  assert.equal(result.status, 'CRYPTO_LINKED');
  assert.equal(result.cryptoLinked, true);
  assert.ok(result.dataGaps.some((item) => item.includes('Conflicting')));
});
