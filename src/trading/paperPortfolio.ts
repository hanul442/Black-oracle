import type { PaperFill, PaperPortfolioSnapshot, PaperPosition } from './types';

export class PaperPortfolio {
  private cash: number;
  private readonly initialEquity: number;
  private dailyStartEquity: number;
  private realizedPnl = 0;
  private feesPaid = 0;
  private peakEquity: number;
  private readonly positions = new Map<string, PaperPosition>();
  private readonly equityCurve: Array<{ timestamp: number; equity: number }> = [];

  constructor(initialCash = 1_000_000) {
    if (!Number.isFinite(initialCash) || initialCash <= 0) throw new Error('Initial paper cash must be positive and finite.');
    this.cash = initialCash;
    this.initialEquity = initialCash;
    this.dailyStartEquity = initialCash;
    this.peakEquity = initialCash;
  }

  applyFill(fill: PaperFill): PaperPosition | null {
    const existing = this.positions.get(fill.market);

    if (fill.side === 'BUY') {
      const totalDebit = fill.notional + fill.fee;
      if (totalDebit > this.cash + 1e-9) throw new Error('Paper portfolio has insufficient cash for this buy fill.');
      if (existing) throw new Error('Paper v0.1 does not pyramid into an existing position.');

      this.cash -= totalDebit;
      this.feesPaid += fill.fee;
      const position: PaperPosition = {
        market: fill.market,
        quantity: fill.quantity,
        averageCost: totalDebit / fill.quantity,
        entryPrice: fill.fillPrice,
        openedAt: fill.timestamp,
        updatedAt: fill.timestamp,
        stopLossPrice: null,
        takeProfitPrice: null,
      };
      this.positions.set(fill.market, position);
      return { ...position };
    }

    if (!existing) throw new Error('Paper v0.1 cannot sell without an existing spot position.');
    if (fill.quantity > existing.quantity + 1e-10) throw new Error('Paper sell quantity exceeds the current spot position.');

    const proceedsAfterFee = fill.notional - fill.fee;
    const costBasisReleased = existing.averageCost * fill.quantity;
    this.realizedPnl += proceedsAfterFee - costBasisReleased;
    this.cash += proceedsAfterFee;
    this.feesPaid += fill.fee;

    const remainingQuantity = Math.max(0, existing.quantity - fill.quantity);
    if (remainingQuantity <= 1e-10) {
      this.positions.delete(fill.market);
      return null;
    }

    const updated: PaperPosition = {
      ...existing,
      quantity: remainingQuantity,
      updatedAt: fill.timestamp,
    };
    this.positions.set(fill.market, updated);
    return { ...updated };
  }

  setProtection(market: string, stopLossPrice: number, takeProfitPrice: number, timestamp = Date.now()) {
    const position = this.positions.get(market);
    if (!position) throw new Error(`No paper position exists for ${market}.`);
    if (!(stopLossPrice > 0 && takeProfitPrice > stopLossPrice)) throw new Error('Protection prices are invalid.');

    this.positions.set(market, {
      ...position,
      stopLossPrice,
      takeProfitPrice,
      updatedAt: timestamp,
    });
  }

  getPosition(market: string): PaperPosition | null {
    const position = this.positions.get(market);
    return position ? { ...position } : null;
  }

  snapshot(markPrices: Record<string, number> = {}, timestamp = Date.now()): PaperPortfolioSnapshot {
    let marketValue = 0;
    let unrealizedPnl = 0;
    const positions = Array.from(this.positions.values()).map((position) => {
      const markPrice = markPrices[position.market] ?? position.entryPrice;
      const value = position.quantity * markPrice;
      marketValue += value;
      unrealizedPnl += value - position.quantity * position.averageCost;
      return { ...position, markPrice, marketValue: value, unrealizedPnl: value - position.quantity * position.averageCost };
    });

    const equity = this.cash + marketValue;
    this.peakEquity = Math.max(this.peakEquity, equity);
    const drawdownPct = this.peakEquity > 0 ? Math.max(0, (this.peakEquity - equity) / this.peakEquity) : 0;
    const dailyPnlPct = this.dailyStartEquity > 0 ? (equity - this.dailyStartEquity) / this.dailyStartEquity : 0;

    const lastPoint = this.equityCurve[this.equityCurve.length - 1];
    if (!lastPoint || lastPoint.timestamp !== timestamp || Math.abs(lastPoint.equity - equity) > 1e-9) {
      this.equityCurve.push({ timestamp, equity });
      if (this.equityCurve.length > 2_000) this.equityCurve.splice(0, this.equityCurve.length - 2_000);
    }

    return {
      initialEquity: this.initialEquity,
      cash: this.cash,
      equity,
      marketValue,
      realizedPnl: this.realizedPnl,
      unrealizedPnl,
      totalPnl: equity - this.initialEquity,
      feesPaid: this.feesPaid,
      peakEquity: this.peakEquity,
      drawdownPct,
      dailyPnlPct,
      positions,
      equityCurve: this.equityCurve.slice(),
    };
  }

  resetDailyBaseline(markPrices: Record<string, number> = {}, timestamp = Date.now()) {
    this.dailyStartEquity = this.snapshot(markPrices, timestamp).equity;
  }
}
