import { evaluateEquityUniverseCandidate, scoreSectorStrength, type EquityUniverseCandidate, type SectorStrengthInput, type SectorStrengthScore } from './equityUniversePolicy';
import { buildHeadCouncilShortlist, type CommitteeCrossReview, type CommitteeNomination, type HeadCouncilCandidate } from './investmentCommittee';
import type { TradingHorizon } from './horizonPolicy';

export interface InvestmentCycleInput {
  asOf: number;
  marketStateId: string | null;
  sectorSignals: SectorStrengthInput[];
  equities: EquityUniverseCandidate[];
  nominations: CommitteeNomination[];
  reviews: CommitteeCrossReview[];
}

export interface InvestmentCycleResult {
  mode: 'SHADOW';
  executionAuthority: false;
  asOf: number;
  marketStateId: string | null;
  strongSectors: Partial<Record<TradingHorizon, SectorStrengthScore[]>>;
  eligibleUniverse: EquityUniverseCandidate[];
  rejectedUniverse: Array<{ candidate: EquityUniverseCandidate; reasons: string[]; dataGaps: string[] }>;
  shortlist: HeadCouncilCandidate[];
  survivors: HeadCouncilCandidate[];
  counts: {
    sectorsAnalyzed: number;
    equitiesInput: number;
    equitiesEligible: number;
    nominations: number;
    crossReviews: number;
    headCouncilCandidates: number;
    survivors: number;
  };
  blockers: string[];
}

const strongSectorThreshold = 62;

export const buildInvestmentCycle = (input: InvestmentCycleInput): InvestmentCycleResult => {
  const scoredSectors = input.sectorSignals.map(scoreSectorStrength);
  const strongSectors: Partial<Record<TradingHorizon, SectorStrengthScore[]>> = {};
  for (const sector of scoredSectors) {
    if (sector.score < strongSectorThreshold) continue;
    const list = strongSectors[sector.horizon] ?? [];
    list.push(sector);
    list.sort((a, b) => b.score - a.score);
    strongSectors[sector.horizon] = list;
  }

  const eligibleUniverse: EquityUniverseCandidate[] = [];
  const rejectedUniverse: InvestmentCycleResult['rejectedUniverse'] = [];
  for (const candidate of input.equities) {
    const decision = evaluateEquityUniverseCandidate(candidate);
    if (decision.eligible) eligibleUniverse.push(candidate);
    else rejectedUniverse.push({ candidate, reasons: decision.reasons, dataGaps: decision.dataGaps });
  }

  const eligibleMarkets = new Set(eligibleUniverse.map((candidate) => candidate.market));
  const eligibleSectorByMarket = new Map(eligibleUniverse.map((candidate) => [candidate.market, candidate.sector] as const));
  const strongSectorSets = new Map<TradingHorizon, Set<string>>();
  for (const [horizon, sectors] of Object.entries(strongSectors) as Array<[TradingHorizon, SectorStrengthScore[]]>) {
    strongSectorSets.set(horizon, new Set(sectors.map((sector) => sector.sector)));
  }

  const filteredNominations = input.nominations.filter((nomination) => {
    if (!eligibleMarkets.has(nomination.market)) return false;
    const sector = eligibleSectorByMarket.get(nomination.market);
    if (!sector) return false;
    return strongSectorSets.get(nomination.horizon)?.has(sector) === true;
  });
  const nominationKeys = new Set(filteredNominations.map((item) => `${item.market}::${item.horizon}`));
  const filteredReviews = input.reviews.filter((review) => nominationKeys.has(`${review.market}::${review.horizon}`));

  const shortlist = buildHeadCouncilShortlist(filteredNominations, filteredReviews, { survivalFraction: 0.30, minCrossReviews: 3 });
  const survivors = shortlist.filter((candidate) => candidate.survived);
  const blockers: string[] = [];
  if (!input.marketStateId) blockers.push('Market-state analysis has no canonical ID.');
  if (!Object.keys(strongSectors).length) blockers.push('No bullish sector passed the strength threshold.');
  if (!eligibleUniverse.length) blockers.push('No KRX equity passed the hard universe gate.');
  if (!filteredNominations.length) blockers.push('No committee nomination survived sector and universe filtering.');
  if (filteredNominations.length && filteredReviews.length < 3) blockers.push('Cross-review coverage is insufficient for Head Council selection.');

  return {
    mode: 'SHADOW',
    executionAuthority: false,
    asOf: input.asOf,
    marketStateId: input.marketStateId,
    strongSectors,
    eligibleUniverse,
    rejectedUniverse,
    shortlist,
    survivors,
    counts: {
      sectorsAnalyzed: input.sectorSignals.length,
      equitiesInput: input.equities.length,
      equitiesEligible: eligibleUniverse.length,
      nominations: filteredNominations.length,
      crossReviews: filteredReviews.length,
      headCouncilCandidates: shortlist.length,
      survivors: survivors.length,
    },
    blockers,
  };
};
