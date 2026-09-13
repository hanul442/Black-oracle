import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSectorStrengthRuntimePackets } from './sectorStrengthRuntime';

test('aggregates breadth, relative strength and volume participation by sector and horizon', () => {
  const packets = buildSectorStrengthRuntimePackets([
    { market: 'KRX-000001', sector: 'SEMICONDUCTOR', horizon: 'MEDIUM', relativeStrengthScore: 80, volumeParticipationScore: 78, positive: true, evidenceScore: 70, fundamentalMomentumScore: 74 },
    { market: 'KRX-000002', sector: 'SEMICONDUCTOR', horizon: 'MEDIUM', relativeStrengthScore: 76, volumeParticipationScore: 72, positive: true, evidenceScore: 66, fundamentalMomentumScore: 70 },
    { market: 'KRX-000003', sector: 'SEMICONDUCTOR', horizon: 'MEDIUM', relativeStrengthScore: 65, volumeParticipationScore: 68, positive: false, evidenceScore: 62, fundamentalMomentumScore: 64 },
  ]);
  assert.equal(packets.length, 1);
  assert.equal(packets[0].constituentCount, 3);
  assert.equal(packets[0].positiveCount, 2);
  assert.ok(packets[0].breadthPct > 60);
  assert.ok(packets[0].input.relativeStrength > 70);
});

test('flags weak constituent coverage and missing evidence without fabricating it', () => {
  const [packet] = buildSectorStrengthRuntimePackets([
    { market: 'KRX-000004', sector: 'ROBOTICS', horizon: 'SHORT', relativeStrengthScore: 70, volumeParticipationScore: 80, positive: true },
  ]);
  assert.ok(packet.dataGaps.some((gap) => gap.includes('minimum preferred coverage')));
  assert.ok(packet.dataGaps.some((gap) => gap.includes('Evidence')));
  assert.equal(packet.input.earningsOrFundamentalMomentum, null);
});
