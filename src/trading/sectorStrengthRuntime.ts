import type { TradingHorizon } from './horizonPolicy';
import type { SectorStrengthInput } from './equityUniversePolicy';

export interface SectorConstituentObservation {
  market: string;
  sector: string;
  horizon: TradingHorizon;
  relativeStrengthScore: number;
  volumeParticipationScore: number;
  positive: boolean;
  evidenceScore?: number | null;
  fundamentalMomentumScore?: number | null;
  riskPenalty?: number | null;
}

export interface SectorStrengthRuntimePacket {
  sector: string;
  horizon: TradingHorizon;
  constituentCount: number;
  positiveCount: number;
  breadthPct: number;
  input: SectorStrengthInput;
  dataGaps: string[];
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const buildSectorStrengthRuntimePackets = (
  observations: SectorConstituentObservation[],
  minimumConstituents = 3,
): SectorStrengthRuntimePacket[] => {
  const groups = new Map<string, SectorConstituentObservation[]>();
  for (const item of observations) {
    const key = `${item.horizon}::${item.sector}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const packets: SectorStrengthRuntimePacket[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const positiveCount = group.filter((item) => item.positive).length;
    const breadthPct = group.length ? positiveCount / group.length * 100 : 0;
    const evidence = group.map((item) => item.evidenceScore).filter((value): value is number => value != null && Number.isFinite(value));
    const fundamentals = group.map((item) => item.fundamentalMomentumScore).filter((value): value is number => value != null && Number.isFinite(value));
    const risks = group.map((item) => item.riskPenalty).filter((value): value is number => value != null && Number.isFinite(value));
    const dataGaps: string[] = [];
    if (group.length < minimumConstituents) dataGaps.push(`Only ${group.length} constituent(s); minimum preferred coverage is ${minimumConstituents}.`);
    if (!evidence.length) dataGaps.push('No constituent-level source-backed Evidence score is available.');
    if (!fundamentals.length) dataGaps.push('No constituent-level earnings/fundamental momentum score is available.');

    packets.push({
      sector: first.sector,
      horizon: first.horizon,
      constituentCount: group.length,
      positiveCount,
      breadthPct,
      dataGaps,
      input: {
        sector: first.sector,
        horizon: first.horizon,
        relativeStrength: clamp(average(group.map((item) => item.relativeStrengthScore))),
        breadth: clamp(breadthPct),
        volumeParticipation: clamp(average(group.map((item) => item.volumeParticipationScore))),
        evidenceScore: clamp(evidence.length ? average(evidence) : 50),
        earningsOrFundamentalMomentum: fundamentals.length ? clamp(average(fundamentals)) : null,
        riskPenalty: risks.length ? clamp(average(risks), 0, 40) : 0,
      },
    });
  }

  return packets.sort((a, b) => a.horizon.localeCompare(b.horizon) || a.sector.localeCompare(b.sector));
};
