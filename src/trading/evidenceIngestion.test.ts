import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvidenceId, buildExternalTradingEvidence } from './evidenceIngestion';

const candidate = {
  market: 'KRW-BTC',
  title: 'Bitcoin market structure update',
  summary: 'A source-backed Bitcoin update.',
  publisher: 'Example Publisher',
  sourceUrl: 'https://example.com/bitcoin-update',
  publishedAt: Date.UTC(2026, 8, 4, 8, 0, 0),
  sourceType: 'NEWS' as const,
  reliability: 0.75,
  tags: ['btc'],
};

test('external evidence IDs are deterministic from source provenance', () => {
  assert.equal(buildEvidenceId(candidate), buildEvidenceId({ ...candidate }));
  assert.notEqual(
    buildEvidenceId(candidate),
    buildEvidenceId({ ...candidate, sourceUrl: 'https://example.com/another-update' }),
  );
});

test('irrelevant candidates never enter the trading evidence store', () => {
  const result = buildExternalTradingEvidence(
    candidate,
    { relevant: false, direction: 'NEUTRAL', strength: 0, expiryHours: 24, rationale: 'Not relevant.' },
    Date.UTC(2026, 8, 4, 9, 0, 0),
  );
  assert.equal(result, null);
});

test('fresh evidence preserves publisher, URL and classification without granting execution authority', () => {
  const observedAt = Date.UTC(2026, 8, 4, 9, 0, 0);
  const result = buildExternalTradingEvidence(
    candidate,
    { relevant: true, direction: 'BULLISH', strength: 68, expiryHours: 12, rationale: 'Constructive catalyst.' },
    observedAt,
  );

  assert.ok(result);
  assert.equal(result.publisher, 'Example Publisher');
  assert.equal(result.sourceUrl, candidate.sourceUrl);
  assert.equal(result.direction, 'BULLISH');
  assert.equal(result.strength, 68);
  assert.equal(result.reliability, 0.75);
  assert.equal(result.expiresAt, observedAt + 12 * 60 * 60 * 1000);
  assert.ok(result.tags?.includes('auto-ingested'));
  assert.equal('executionAuthority' in result, false);
});

test('stale news is rejected instead of masquerading as fresh evidence', () => {
  const observedAt = Date.UTC(2026, 8, 7, 9, 0, 0);
  const result = buildExternalTradingEvidence(
    candidate,
    { relevant: true, direction: 'BULLISH', strength: 80, expiryHours: 24, rationale: 'Old catalyst.' },
    observedAt,
  );
  assert.equal(result, null);
});
