import type { LargeParticipantFootprintSnapshot } from './largeParticipantFootprint';

export interface ObservedParticipantFlow {
  foreignNetBuyQty: number | null;
  programNetBuyQty: number | null;
  foreignHoldingQty: number | null;
  foreignExhaustionRate: number | null;
}

export interface ParticipantFlowFootprint {
  score: number;
  state: 'ACCUMULATION_LIKE' | 'DISTRIBUTION_LIKE' | 'MIXED' | 'NEUTRAL' | 'DATA_GAP';
  confidence: number;
  behavioralScore: number;
  observedFlowScore: number | null;
  reasons: string[];
  dataGaps: string[];
  actorAttribution: 'FOREIGN_FLOW_OBSERVED' | 'PROGRAM_FLOW_OBSERVED' | 'MULTIPLE_FLOW_OBSERVED' | 'NONE';
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const signScore = (value: number | null, scale: number) => value == null || !Number.isFinite(value) ? null : clamp(value / scale, -1, 1) * 100;

/**
 * Combines anonymous price/volume behaviour with directly observed KIS foreign/program
 * net-flow quantities. This still does not infer manipulation or identify a private actor.
 */
export const buildParticipantFlowFootprint = (
  behavioral: LargeParticipantFootprintSnapshot,
  flow: ObservedParticipantFlow,
): ParticipantFlowFootprint => {
  const foreign = signScore(flow.foreignNetBuyQty, 100_000);
  const program = signScore(flow.programNetBuyQty, 100_000);
  const observed = [foreign, program].filter((value): value is number => value != null);
  const observedFlowScore = observed.length ? observed.reduce((sum, value) => sum + value, 0) / observed.length : null;
  const dataGaps: string[] = [];
  if (!behavioral.available) dataGaps.push('Behavioral price/volume footprint is unavailable.');
  if (!observed.length) dataGaps.push('Foreign/program net-flow quantities are unavailable.');

  if (!behavioral.available && observedFlowScore == null) {
    return {
      score: 0,
      state: 'DATA_GAP',
      confidence: 0,
      behavioralScore: 0,
      observedFlowScore: null,
      reasons: [],
      dataGaps,
      actorAttribution: 'NONE',
    };
  }

  const behavioralWeight = behavioral.available ? 0.65 : 0;
  const observedWeight = observedFlowScore != null ? 0.35 : 0;
  const denominator = behavioralWeight + observedWeight || 1;
  const score = clamp(((behavioral.available ? behavioral.score : 0) * behavioralWeight + (observedFlowScore ?? 0) * observedWeight) / denominator, -100, 100);
  const confidence = clamp(
    (behavioral.available ? (behavioral.confidence === 'HIGH' ? 0.75 : behavioral.confidence === 'MEDIUM' ? 0.55 : 0.35) : 0)
      + (observed.length === 2 ? 0.2 : observed.length === 1 ? 0.1 : 0),
    0,
    0.95,
  );
  const state = score >= 35 ? 'ACCUMULATION_LIKE' : score <= -35 ? 'DISTRIBUTION_LIKE' : Math.abs(score) >= 15 ? 'MIXED' : 'NEUTRAL';
  const actorAttribution = foreign != null && program != null
    ? 'MULTIPLE_FLOW_OBSERVED'
    : foreign != null
      ? 'FOREIGN_FLOW_OBSERVED'
      : program != null
        ? 'PROGRAM_FLOW_OBSERVED'
        : 'NONE';

  const reasons = [...behavioral.reasons];
  if (foreign != null) reasons.push(`Observed foreign net-buy flow contributes ${foreign.toFixed(1)} normalized points.`);
  if (program != null) reasons.push(`Observed program net-buy flow contributes ${program.toFixed(1)} normalized points.`);
  reasons.push('Observed flow labels describe published flow categories only; they do not establish manipulation or a hidden actor identity.');

  return {
    score,
    state,
    confidence,
    behavioralScore: behavioral.available ? behavioral.score : 0,
    observedFlowScore,
    reasons,
    dataGaps,
    actorAttribution,
  };
};
