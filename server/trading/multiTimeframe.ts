import { buildMultiTimeframeConsensus } from '../../src/trading/multiTimeframe';
import { buildTradingSnapshot } from '../../src/trading/snapshot';
import type { MultiTimeframeSnapshot } from '../../src/trading/types';
import { getMinuteCandles } from './upbitPublic';

export const buildMarketMultiTimeframe = async (
  market: string,
  eventScore?: number,
): Promise<MultiTimeframeSnapshot> => {
  const normalized = market.toUpperCase();
  const [fourHourCandles, oneHourCandles, fifteenMinuteCandles] = await Promise.all([
    getMinuteCandles(normalized, 240, 200),
    getMinuteCandles(normalized, 60, 200),
    getMinuteCandles(normalized, 15, 200),
  ]);

  const fourHour = buildTradingSnapshot(fourHourCandles, eventScore);
  const oneHour = buildTradingSnapshot(oneHourCandles, eventScore);
  const fifteenMinute = buildTradingSnapshot(fifteenMinuteCandles, eventScore);

  return buildMultiTimeframeConsensus(fourHour, oneHour, fifteenMinute);
};
