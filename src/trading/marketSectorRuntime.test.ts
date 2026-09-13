import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMarketSectorRuntime } from './marketSectorRuntime';

test('composes shadow market and sector packets without execution authority', () => {
  const snapshot = buildMarketSectorRuntime({
    marketStates: [{
      horizon: 'SHORT', asOf: 1, indexTrendScore: 70, breadthScore: 68, turnoverScore: 72, volatilityScore: 60, evidenceScore: 66,
    }],
    sectorObservations: [
      { market: 'KRX-1', sector: 'SEMICONDUCTOR', horizon: 'SHORT', relativeStrengthScore: 75, volumeParticipationScore: 80, positive: true },
      { market: 'KRX-2', sector: 'SEMICONDUCTOR', horizon: 'SHORT', relativeStrengthScore: 70, volumeParticipationScore: 72, positive: true },
      { market: 'KRX-3', sector: 'SEMICONDUCTOR', horizon: 'SHORT', relativeStrengthScore: 65, volumeParticipationScore: 68, positive: false },
    ],
  });

  assert.equal(snapshot.mode, 'SHADOW');
  assert.equal(snapshot.executionAuthority, false);
  assert.ok(snapshot.marketStates.SHORT);
  assert.equal(snapshot.sectorPackets.length, 1);
});
