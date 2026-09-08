import type { CouncilComparisonObservation } from './councilComparison.ts';

/**
 * Keep full Council trace payload only on the newest observation for each market.
 * Historical comparison rows remain available for prospective scoring, while
 * checkpoint growth stays bounded by the number of actively observed markets.
 */
export const retainLatestCouncilTracePerMarket = (
  observations: CouncilComparisonObservation[],
): CouncilComparisonObservation[] => {
  const latestIndexByMarket = new Map<string, number>();

  observations.forEach((item, index) => {
    const market = String(item.market ?? '').toUpperCase();
    if (!market) return;
    const currentIndex = latestIndexByMarket.get(market);
    if (currentIndex == null) {
      latestIndexByMarket.set(market, index);
      return;
    }
    const current = observations[currentIndex];
    if (item.generatedAt > current.generatedAt || (item.generatedAt === current.generatedAt && index > currentIndex)) {
      latestIndexByMarket.set(market, index);
    }
  });

  return observations.map((item, index) => ({
    ...item,
    v1: { ...item.v1 },
    v2: { ...item.v2 },
    trace: latestIndexByMarket.get(String(item.market ?? '').toUpperCase()) === index ? item.trace : undefined,
    executionAuthority: false,
    promotionAuthority: false,
  }));
};
