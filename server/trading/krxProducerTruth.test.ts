import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyKrxResearchTruth, type KrxResearchTruthSnapshot } from './equity/krxResearchTruth';

const baseTruth = (overrides: Partial<KrxResearchTruthSnapshot> = {}): KrxResearchTruthSnapshot => ({
  source: 'KRX_OFFICIAL_EOD',
  discovered: 100,
  volumePrefiltered: 60,
  profiled: 60,
  eligible: 0,
  committeeCandidateCount: 0,
  nominationReadyCount: 0,
  ...overrides,
});

test('KRX producer truth distinguishes source emptiness from Committee emptiness', () => {
  assert.equal(classifyKrxResearchTruth(baseTruth({ discovered: 0, volumePrefiltered: 0, profiled: 0 })), 'SOURCE_EMPTY');
  assert.equal(classifyKrxResearchTruth(baseTruth({ volumePrefiltered: 0, profiled: 0 })), 'VOLUME_PREFILTER_EMPTY');
  assert.equal(classifyKrxResearchTruth(baseTruth({ profiled: 0 })), 'PROFILE_EMPTY');
  assert.equal(classifyKrxResearchTruth(baseTruth()), 'COMMITTEE_EMPTY');
});

test('KRX producer truth distinguishes nomination blockers from readiness', () => {
  assert.equal(classifyKrxResearchTruth(baseTruth({ committeeCandidateCount: 12 })), 'NOMINATION_BLOCKED');
  assert.equal(classifyKrxResearchTruth(baseTruth({ committeeCandidateCount: 12, nominationReadyCount: 3 })), 'NOMINATION_READY');
});
