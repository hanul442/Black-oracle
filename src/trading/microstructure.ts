import { buildTradeVolumeProfile, type TradePrint, type VolumeProfileSnapshot } from './volumeProfile';

export interface OrderbookLevelInput {
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
}

export interface MicrostructureSnapshot {
  available: boolean;
  market: string;
  asOf: number;
  sampleTrades: number;
  sampleStart: number | null;
  sampleEnd: number | null;
  sampleCoverageMs: number | null;
  buyTradeCount: number;
  sellTradeCount: number;
  buyQuoteVolume: number;
  sellQuoteVolume: number;
  takerImbalance: number | null;
  orderbookImbalanceTop5: number | null;
  orderbookImbalanceTop15: number | null;
  orderbookImbalanceTop30: number | null;
  weightedOrderbookImbalance: number | null;
  top30BidDepthKrw: number | null;
  top30AskDepthKrw: number | null;
  pressureScore: number | null;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNAVAILABLE';
  confidence: number;
  profile: VolumeProfileSnapshot;
  reasons: string[];
}

export interface MarketMicrostructureInput {
  market: string;
  asOf: number;
  currentPrice: number;
  trades: TradePrint[];
  orderbookLevels: OrderbookLevelInput[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const depth = (levels: OrderbookLevelInput[], count: number) => levels.slice(0, count).reduce(
  (acc, level) => ({
    bid: acc.bid + level.bidPrice * level.bidSize,
    ask: acc.ask + level.askPrice * level.askSize,
  }),
  { bid: 0, ask: 0 },
);

const imbalance = (bid: number, ask: number) => {
  const total = bid + ask;
  return total > 0 ? (bid - ask) / total : null;
};

const weightedBookImbalance = (levels: OrderbookLevelInput[]) => {
  let bid = 0;
  let ask = 0;
  for (let index = 0; index < Math.min(30, levels.length); index += 1) {
    const level = levels[index];
    const weight = 1 / Math.sqrt(index + 1);
    bid += level.bidPrice * level.bidSize * weight;
    ask += level.askPrice * level.askSize * weight;
  }
  return imbalance(bid, ask);
};

export const unavailableMicrostructure = (
  market: string,
  asOf: number,
  reason: string,
): MicrostructureSnapshot => ({
  available: false,
  market: market.toUpperCase(),
  asOf,
  sampleTrades: 0,
  sampleStart: null,
  sampleEnd: null,
  sampleCoverageMs: null,
  buyTradeCount: 0,
  sellTradeCount: 0,
  buyQuoteVolume: 0,
  sellQuoteVolume: 0,
  takerImbalance: null,
  orderbookImbalanceTop5: null,
  orderbookImbalanceTop15: null,
  orderbookImbalanceTop30: null,
  weightedOrderbookImbalance: null,
  top30BidDepthKrw: null,
  top30AskDepthKrw: null,
  pressureScore: null,
  direction: 'UNAVAILABLE',
  confidence: 0,
  profile: buildTradeVolumeProfile([]),
  reasons: [reason],
});

export const buildMicrostructureSnapshot = (input: MarketMicrostructureInput): MicrostructureSnapshot => {
  const trades = input.trades
    .filter((trade) => Number.isFinite(trade.price) && trade.price > 0 && Number.isFinite(trade.volume) && trade.volume > 0)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);
  const levels = input.orderbookLevels.filter((level) =>
    [level.bidPrice, level.askPrice, level.bidSize, level.askSize].every((value) => Number.isFinite(value) && value >= 0),
  );

  if (trades.length < 20 || levels.length < 5) {
    return unavailableMicrostructure(
      input.market,
      input.asOf,
      `Microstructure requires at least 20 valid trades and 5 orderbook levels; received ${trades.length}/${levels.length}.`,
    );
  }

  let buyQuoteVolume = 0;
  let sellQuoteVolume = 0;
  let buyTradeCount = 0;
  let sellTradeCount = 0;
  for (const trade of trades) {
    const quote = trade.price * trade.volume;
    if (trade.side === 'BID') {
      buyQuoteVolume += quote;
      buyTradeCount += 1;
    } else {
      sellQuoteVolume += quote;
      sellTradeCount += 1;
    }
  }

  const takerImbalance = imbalance(buyQuoteVolume, sellQuoteVolume) ?? 0;
  const top5 = depth(levels, 5);
  const top15 = depth(levels, 15);
  const top30 = depth(levels, 30);
  const orderbookImbalanceTop5 = imbalance(top5.bid, top5.ask) ?? 0;
  const orderbookImbalanceTop15 = imbalance(top15.bid, top15.ask) ?? 0;
  const orderbookImbalanceTop30 = imbalance(top30.bid, top30.ask) ?? 0;
  const weightedOrderbookImbalance = weightedBookImbalance(levels) ?? 0;

  // This is deliberately a transparent shadow score, not an execution signal.
  // Aggressor flow receives slightly more weight than resting depth because trade prints
  // represent executed demand/supply while displayed liquidity can cancel before execution.
  const pressureScore = Math.round(clamp(
    (takerImbalance * 0.55 + weightedOrderbookImbalance * 0.25 + orderbookImbalanceTop5 * 0.2) * 100,
    -100,
    100,
  ));
  const direction: MicrostructureSnapshot['direction'] = pressureScore >= 20
    ? 'BULLISH'
    : pressureScore <= -20
      ? 'BEARISH'
      : 'NEUTRAL';

  const sampleStart = trades[0].timestamp;
  const sampleEnd = trades.at(-1)!.timestamp;
  const sampleCoverageMs = Math.max(0, sampleEnd - sampleStart);
  const tradeQuality = clamp(trades.length / 300, 0, 1);
  const depthQuality = clamp(levels.length / 30, 0, 1);
  const sideDiversity = buyTradeCount > 0 && sellTradeCount > 0 ? 1 : 0.65;
  const confidence = clamp((tradeQuality * 0.55 + depthQuality * 0.35 + sideDiversity * 0.1) * 0.9, 0, 0.9);
  const profile = buildTradeVolumeProfile(trades, { currentPrice: input.currentPrice });

  return {
    available: true,
    market: input.market.toUpperCase(),
    asOf: input.asOf,
    sampleTrades: trades.length,
    sampleStart,
    sampleEnd,
    sampleCoverageMs,
    buyTradeCount,
    sellTradeCount,
    buyQuoteVolume,
    sellQuoteVolume,
    takerImbalance,
    orderbookImbalanceTop5,
    orderbookImbalanceTop15,
    orderbookImbalanceTop30,
    weightedOrderbookImbalance,
    top30BidDepthKrw: top30.bid,
    top30AskDepthKrw: top30.ask,
    pressureScore,
    direction,
    confidence,
    profile,
    reasons: [
      `${trades.length} recent executions classify BID as taker-buy and ASK as taker-sell; quote-volume imbalance is ${(takerImbalance * 100).toFixed(1)}%.`,
      `Displayed depth imbalance is ${(orderbookImbalanceTop5 * 100).toFixed(1)}% top-5, ${(orderbookImbalanceTop15 * 100).toFixed(1)}% top-15, and ${(orderbookImbalanceTop30 * 100).toFixed(1)}% top-30.`,
      `Shadow pressure score is ${pressureScore}; it has no order authority until outcome-calibrated out of sample.`,
      ...profile.reasons,
    ],
  };
};
