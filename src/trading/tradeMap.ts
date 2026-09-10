import type { ExecutionDecision, MultiTimeframeSnapshot, TradeMapSnapshot, TradingSnapshot } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface TradeMapInput {
  currentPrice: number;
  decision: ExecutionDecision;
  multiTimeframe: MultiTimeframeSnapshot;
  oneHour: TradingSnapshot;
  stage?: 'FINAL_EXECUTION' | 'PRE_RISK_SHADOW';
}

export const buildTradeMap = (input: TradeMapInput): TradeMapSnapshot => {
  const { currentPrice, decision, multiTimeframe, oneHour } = input;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) throw new Error('Trade map requires a positive current price.');

  const preRiskShadow = input.stage === 'PRE_RISK_SHADOW';
  const longBias = multiTimeframe.action === 'BUY' || multiTimeframe.directionalScore >= 20;
  const proposedLong = decision.action === 'ENTER' && decision.side === 'BUY';
  const active = !preRiskShadow && proposedLong;
  const status: TradeMapSnapshot['status'] = active ? 'ACTIVE' : proposedLong || longBias ? 'CANDIDATE' : 'NO_TRADE';
  if (status === 'NO_TRADE') {
    return {
      status,
      direction: 'NONE',
      entryPrice: null,
      structuralInvalidationPrice: null,
      stopLossPrice: null,
      takeProfit1Price: null,
      takeProfit2Price: null,
      takeProfit1Fraction: null,
      takeProfit2Fraction: null,
      riskReward1: null,
      riskReward2: null,
      expectedRiskPct: null,
      reasons: [
        'No long trade map is published because the current spot engine has no actionable bullish edge.',
        ...decision.reasons.slice(0, 2),
      ],
    };
  }

  const fallbackStopDistancePct = clamp(oneHour.indicators.atrPct * 1.6, 0.0075, 0.05);
  const fallbackStop = currentPrice * (1 - fallbackStopDistancePct);
  const stopLossPrice = decision.stopLossPrice && decision.stopLossPrice < currentPrice
    ? decision.stopLossPrice
    : fallbackStop;
  const structuralSwingLow = oneHour.structure?.lastSwingLow?.price ?? null;
  const structuralInvalidationPrice = structuralSwingLow && structuralSwingLow < currentPrice
    ? structuralSwingLow
    : stopLossPrice;
  const risk = Math.max(Number.EPSILON, currentPrice - stopLossPrice);
  const takeProfit1Price = decision.takeProfit1Price && decision.takeProfit1Price > currentPrice
    ? decision.takeProfit1Price
    : currentPrice + risk;
  const takeProfit2Price = decision.takeProfit2Price && decision.takeProfit2Price > takeProfit1Price
    ? decision.takeProfit2Price
    : decision.takeProfitPrice && decision.takeProfitPrice > takeProfit1Price
      ? decision.takeProfitPrice
      : currentPrice + risk * 2;
  const takeProfit1Fraction = decision.takeProfit1Fraction ?? 0.4;
  const takeProfit2Fraction = 1 - takeProfit1Fraction;
  const riskReward1 = (takeProfit1Price - currentPrice) / risk;
  const riskReward2 = (takeProfit2Price - currentPrice) / risk;
  const expectedRiskPct = risk / currentPrice;

  const reasons = [
    active
      ? 'Execution gates passed; this map mirrors the active Paper entry and its dynamic protection levels.'
      : preRiskShadow && proposedLong
        ? 'Pre-risk candidate map only: Router/Council/Arbiter may review these proposed levels, but deterministic Risk has not authorized execution.'
        : 'Bullish structure exists, but execution has not authorized an entry; the map is candidate-only.',
    oneHour.structure?.lastEvent
      ? `${oneHour.structure.lastEvent.type} ${oneHour.structure.lastEvent.direction} is the latest 1H confirmed structure event.`
      : 'No 1H structural break is confirmed; ATR protection remains the fallback.',
    `Protective risk is ${(expectedRiskPct * 100).toFixed(2)}%; TP1 is ${riskReward1.toFixed(2)}R on ${(takeProfit1Fraction * 100).toFixed(0)}% and TP2 is ${riskReward2.toFixed(2)}R on the remainder.`,
  ];
  if (decision.positionSizingMode) reasons.push(`Position sizing mode: ${decision.positionSizingMode}; confidence does not directly scale notional.`);
  if (multiTimeframe.cycle?.entryTiming) reasons.push(`Multi-cycle timing state is ${multiTimeframe.cycle.entryTiming}.`);

  return {
    status,
    direction: 'LONG',
    entryPrice: currentPrice,
    structuralInvalidationPrice,
    stopLossPrice,
    takeProfit1Price,
    takeProfit2Price,
    takeProfit1Fraction,
    takeProfit2Fraction,
    riskReward1,
    riskReward2,
    expectedRiskPct,
    reasons,
  };
};