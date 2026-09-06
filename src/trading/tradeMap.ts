import type { ExecutionDecision, MultiTimeframeSnapshot, TradeMapSnapshot, TradingSnapshot } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface TradeMapInput {
  currentPrice: number;
  decision: ExecutionDecision;
  multiTimeframe: MultiTimeframeSnapshot;
  oneHour: TradingSnapshot;
}

export const buildTradeMap = (input: TradeMapInput): TradeMapSnapshot => {
  const { currentPrice, decision, multiTimeframe, oneHour } = input;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) throw new Error('Trade map requires a positive current price.');

  const longBias = multiTimeframe.action === 'BUY' || multiTimeframe.directionalScore >= 20;
  const active = decision.action === 'ENTER' && decision.side === 'BUY';
  const status: TradeMapSnapshot['status'] = active ? 'ACTIVE' : longBias ? 'CANDIDATE' : 'NO_TRADE';
  if (status === 'NO_TRADE') {
    return {
      status,
      direction: 'NONE',
      entryPrice: null,
      structuralInvalidationPrice: null,
      stopLossPrice: null,
      takeProfit1Price: null,
      takeProfit2Price: null,
      riskReward1: null,
      riskReward2: null,
      expectedRiskPct: null,
      reasons: [
        'No long trade map is published because the current spot engine has no actionable bullish edge.',
        ...decision.reasons.slice(0, 2),
      ],
    };
  }

  const fallbackStopDistancePct = clamp(oneHour.indicators.atrPct * 1.8, 0.012, 0.04);
  const fallbackStop = currentPrice * (1 - fallbackStopDistancePct);
  const stopLossPrice = decision.stopLossPrice && decision.stopLossPrice < currentPrice
    ? decision.stopLossPrice
    : fallbackStop;
  const structuralSwingLow = oneHour.structure?.lastSwingLow?.price ?? null;
  const structuralInvalidationPrice = structuralSwingLow && structuralSwingLow < currentPrice
    ? structuralSwingLow
    : stopLossPrice;
  const risk = Math.max(Number.EPSILON, currentPrice - stopLossPrice);
  const takeProfit1Price = currentPrice + risk;
  const takeProfit2Price = decision.takeProfitPrice && decision.takeProfitPrice > currentPrice
    ? decision.takeProfitPrice
    : currentPrice + risk * 2;
  const riskReward1 = (takeProfit1Price - currentPrice) / risk;
  const riskReward2 = (takeProfit2Price - currentPrice) / risk;
  const expectedRiskPct = risk / currentPrice;

  const reasons = [
    active
      ? 'Execution gates passed; this map mirrors the active Paper entry and its protective levels.'
      : 'Bullish structure exists, but execution has not authorized an entry; the map is candidate-only.',
    oneHour.structure?.lastEvent
      ? `${oneHour.structure.lastEvent.type} ${oneHour.structure.lastEvent.direction} is the latest 1H confirmed structure event.`
      : 'No 1H structural break is confirmed; ATR protection remains the fallback.',
    `Protective risk is ${(expectedRiskPct * 100).toFixed(2)}% from reference entry with TP1 at 1R and TP2 at ${riskReward2.toFixed(2)}R.`,
  ];
  if (multiTimeframe.cycle?.entryTiming) reasons.push(`Multi-cycle timing state is ${multiTimeframe.cycle.entryTiming}.`);

  return {
    status,
    direction: 'LONG',
    entryPrice: currentPrice,
    structuralInvalidationPrice,
    stopLossPrice,
    takeProfit1Price,
    takeProfit2Price,
    riskReward1,
    riskReward2,
    expectedRiskPct,
    reasons,
  };
};
