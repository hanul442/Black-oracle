import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHorizonPositionIdentity, validateHorizonSleeveLimits } from './horizonPositionIdentity';

test('same market remains distinct across horizons and strategies', () => {
  const short = buildHorizonPositionIdentity('KRX-000660', 'SHORT', 'momentum-v1');
  const medium = buildHorizonPositionIdentity('KRX-000660', 'MEDIUM', 'sector-v2');
  assert.notEqual(short.positionKey, medium.positionKey);
  assert.equal(short.positionKey, 'KRX-000660::SHORT::momentum-v1');
});

test('sleeve validation prevents implicit leverage and invalid single-position caps', () => {
  const valid = validateHorizonSleeveLimits([
    { horizon: 'ULTRA_SHORT', maxGrossExposurePct: 0.2, maxSinglePositionPct: 0.05 },
    { horizon: 'SHORT', maxGrossExposurePct: 0.3, maxSinglePositionPct: 0.1 },
    { horizon: 'MEDIUM', maxGrossExposurePct: 0.3, maxSinglePositionPct: 0.1 },
    { horizon: 'MEDIUM_LONG', maxGrossExposurePct: 0.1, maxSinglePositionPct: 0.05 },
    { horizon: 'LONG', maxGrossExposurePct: 0.1, maxSinglePositionPct: 0.05 },
  ]);
  assert.equal(valid.valid, true);
  const invalid = validateHorizonSleeveLimits([
    { horizon: 'SHORT', maxGrossExposurePct: 0.7, maxSinglePositionPct: 0.2 },
    { horizon: 'MEDIUM', maxGrossExposurePct: 0.5, maxSinglePositionPct: 0.2 },
  ]);
  assert.equal(invalid.valid, false);
});
