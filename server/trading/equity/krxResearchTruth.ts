import type { KrxShadowResearchCycleResult } from './krxShadowResearchLoop';

export type KrxResearchDisposition =
  | 'SOURCE_EMPTY'
  | 'VOLUME_PREFILTER_EMPTY'
  | 'PROFILE_EMPTY'
  | 'COMMITTEE_EMPTY'
  | 'NOMINATION_BLOCKED'
  | 'NOMINATION_READY';

export interface KrxResearchTruthSnapshot {
  source: KrxShadowResearchCycleResult['source'];
  discovered: number;
  volumePrefiltered: number;
  profiled: number;
  eligible: number;
  committeeCandidateCount: number;
  nominationReadyCount: number;
}

export const snapshotKrxResearchTruth = (cycle: KrxShadowResearchCycleResult): KrxResearchTruthSnapshot => ({
  source: cycle.source,
  discovered: cycle.universe.discovered,
  volumePrefiltered: cycle.universe.volumePrefiltered,
  profiled: cycle.universe.profiled,
  eligible: cycle.universe.eligible,
  committeeCandidateCount: cycle.committeeCandidates.length,
  nominationReadyCount: cycle.nominationReadyCount,
});

export const classifyKrxResearchTruth = (truth: KrxResearchTruthSnapshot): KrxResearchDisposition => {
  if (truth.discovered === 0) return 'SOURCE_EMPTY';
  if (truth.volumePrefiltered === 0) return 'VOLUME_PREFILTER_EMPTY';
  if (truth.profiled === 0) return 'PROFILE_EMPTY';
  if (truth.committeeCandidateCount === 0) return 'COMMITTEE_EMPTY';
  if (truth.nominationReadyCount === 0) return 'NOMINATION_BLOCKED';
  return 'NOMINATION_READY';
};
