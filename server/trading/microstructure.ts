import { buildMicrostructureSnapshot, unavailableMicrostructure, type MicrostructureSnapshot } from '../../src/trading/microstructure';
import { getOrderbooks, getRecentTrades } from './upbitPublic';

export const buildMarketMicrostructure = async (
  market: string,
  currentPrice: number,
): Promise<MicrostructureSnapshot> => {
  const normalized = market.toUpperCase();
  const asOf = Date.now();

  try {
    const [trades, orderbooks] = await Promise.all([
      getRecentTrades(normalized, 500),
      getOrderbooks([normalized]),
    ]);
    const orderbook = orderbooks.find((item) => item.market === normalized);
    if (!orderbook) return unavailableMicrostructure(normalized, asOf, 'No orderbook snapshot was returned for the microstructure challenger.');

    return buildMicrostructureSnapshot({
      market: normalized,
      asOf: Math.max(asOf, orderbook.timestamp, trades.at(-1)?.timestamp ?? 0),
      currentPrice,
      trades,
      orderbookLevels: orderbook.units,
    });
  } catch (error) {
    return unavailableMicrostructure(
      normalized,
      asOf,
      `Microstructure challenger failed soft: ${error instanceof Error ? error.message : 'unknown public-market-data error'}`,
    );
  }
};
