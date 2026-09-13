import { buildMarketStateMap, type MarketStateInput, type MarketStateSnapshot } from './marketState';
import { buildSectorStrengthRuntimePackets, type SectorConstituentObservation, type SectorStrengthRuntimePacket } from './sectorStrengthRuntime';
import type { TradingHorizon } from './horizonPolicy';

export interface MarketSectorRuntimeInput {
  marketStates: MarketStateInput[];
  sectorObservations: SectorConstituentObservation[];
}

export interface MarketSectorRuntimeSnapshot {
  mode: 'SHADOW';
  executionAuthority: false;
  marketStates: Partial<Record<TradingHorizon, MarketStateSnapshot>>;
  sectorPackets: SectorStrengthRuntimePacket[];
  blockers: string[];
}

export const buildMarketSectorRuntime = (input: MarketSectorRuntimeInput): MarketSectorRuntimeSnapshot => {
  const marketStates = buildMarketStateMap(input.marketStates);
  const sectorPackets = buildSectorStrengthRuntimePackets(input.sectorObservations);
  const blockers: string[] = [];
  if (!input.marketStates.length) blockers.push('No horizon market-state input is available.');
  if (!sectorPackets.length) blockers.push('No sector constituent observations are available.');
  if (sectorPackets.some((packet) => packet.dataGaps.length > 0)) blockers.push('One or more sector packets contain explicit DATA_GAPs.');

  return {
    mode: 'SHADOW',
    executionAuthority: false,
    marketStates,
    sectorPackets,
    blockers,
  };
};
