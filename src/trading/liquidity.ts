import type { LiquidityInput, LiquiditySnapshot } from './types';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const safeLog10 = (value: number) => Math.log10(Math.max(value, 1));

export const evaluateLiquidity = (input: LiquidityInput): LiquiditySnapshot => {
  const mid = (input.bestAsk + input.bestBid) / 2;
  const spreadBps = mid > 0 ? ((input.bestAsk - input.bestBid) / mid) * 10_000 : Number.POSITIVE_INFINITY;
  const minTop5DepthKrw = Math.min(input.top5BidDepthKrw, input.top5AskDepthKrw);
  const totalTop5Depth = input.top5BidDepthKrw + input.top5AskDepthKrw;
  const orderbookImbalance = totalTop5Depth > 0
    ? (input.top5BidDepthKrw - input.top5AskDepthKrw) / totalTop5Depth
    : 0;

  // v0.1 scoring anchors: 1B KRW/day is the minimum useful turnover floor,
  // while ~1T KRW/day receives the full turnover score.
  const volumeScore = clamp01((safeLog10(input.accTradePrice24h) - 9) / 3) * 100;
  const spreadScore = clamp01(1 - spreadBps / 25) * 100;
  const depthScore = clamp01((safeLog10(minTop5DepthKrw) - safeLog10(5_000_000)) / 2.3) * 100;
  const score = Math.round(volumeScore * 0.45 + spreadScore * 0.35 + depthScore * 0.2);

  const reasons: string[] = [];
  if (input.warning) reasons.push('Market is flagged with an exchange warning/caution state.');
  if (input.accTradePrice24h < 1_000_000_000) reasons.push('24h KRW turnover is below the 1B KRW v0.1 floor.');
  if (spreadBps > 25) reasons.push('Best bid/ask spread exceeds the 25 bps v0.1 ceiling.');
  if (minTop5DepthKrw < 5_000_000) reasons.push('Top-5 orderbook depth is below the 5M KRW v0.1 floor.');

  const eligible = reasons.length === 0;
  if (eligible) reasons.push('Turnover, spread, depth, and warning filters all passed.');

  return {
    market: input.market,
    tradePrice: input.tradePrice,
    accTradePrice24h: input.accTradePrice24h,
    signedChangeRate: input.signedChangeRate,
    spreadBps,
    top5BidDepthKrw: input.top5BidDepthKrw,
    top5AskDepthKrw: input.top5AskDepthKrw,
    orderbookImbalance,
    warning: input.warning,
    score,
    eligible,
    reasons,
  };
};
