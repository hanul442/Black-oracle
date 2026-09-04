import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceForecast } from './evidenceForecast';
import type { EvidenceAggregate } from './evidence';

const baseAggregate: EvidenceAggregate = {
  market: 'KRW-BTC',
  score: 70,
  confidence: 0.8,
  activeCount: 4,
  bullishWeight: 2.5,
  bearishWeight: 0.4,
  contradictionCount: 0,
  asOf: 10_000,
  evidenceIds: ['a', 'b', 'c', 'd'],
  reasons: ['fixture'],
};

test('returns unavailable instead of fabricating probability when evidence is missing', () => {
  const forecast = buildEvidenceForecast({
    ...baseAggregate,
    score: 0,
    confidence: 0,
    activeCount: 0,
    bullishWeight: 0,
    bearishWeight: 0,
    evidenceIds: [],
  });

  assert.equal(forecast.available, false);
  assert.equal(forecast.direction, 'UNAVAILABLE');
  assert.equal(forecast.probabilityBullish, null);
  assert.equal(forecast.probabilityBearish, null);
  assert.equal(forecast.confidence, 0);
  assert.equal(forecast.uncertainty, 1);
});

test('shrinks directional evidence toward 50/50 by confidence', () => {
  const forecast = buildEvidenceForecast(baseAggregate);

  assert.equal(forecast.available, true);
  assert.equal(forecast.direction, 'BULLISH');
  assert.equal(forecast.probabilityBullish, 0.78);
  assert.equal(forecast.probabilityBearish, 0.22);
  assert.equal(forecast.confidence, 0.8);
  assert.equal(forecast.uncertainty, 0.2);
});

test('contradictions increase uncertainty instead of changing order authority', () => {
  const clean = buildEvidenceForecast(baseAggregate);
  const contradicted = buildEvidenceForecast({ ...baseAggregate, contradictionCount: 2 });

  assert.ok(contradicted.confidence < clean.confidence);
  assert.ok((contradicted.probabilityBullish ?? 0.5) < (clean.probabilityBullish ?? 0.5));
  assert.equal(contradicted.direction, 'BULLISH');
});