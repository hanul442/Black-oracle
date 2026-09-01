import type { PaperFill, PaperOrderRequest } from './types';

export interface PaperBrokerOptions {
  feeBps?: number;
  slippageBps?: number;
}

export class PaperBroker {
  private readonly feeBps: number;
  private readonly slippageBps: number;
  private readonly processedOrderIds = new Set<string>();

  constructor(options: PaperBrokerOptions = {}) {
    this.feeBps = options.feeBps ?? 5;
    this.slippageBps = options.slippageBps ?? 8;
  }

  executeMarketOrder(order: PaperOrderRequest): PaperFill {
    if (this.processedOrderIds.has(order.id)) {
      throw new Error(`Duplicate paper order id: ${order.id}`);
    }
    if (order.referencePrice <= 0 || !Number.isFinite(order.referencePrice)) {
      throw new Error('Paper order reference price must be positive and finite.');
    }

    const hasNotional = Number.isFinite(order.notional) && (order.notional as number) > 0;
    const hasQuantity = Number.isFinite(order.quantity) && (order.quantity as number) > 0;
    if (!hasNotional && !hasQuantity) {
      throw new Error('Paper order requires a positive notional or quantity.');
    }
    if (order.side === 'BUY' && !hasNotional) {
      throw new Error('Paper BUY orders require notional sizing in v0.1.');
    }

    const slippageRate = this.slippageBps / 10_000;
    const fillPrice = order.side === 'BUY'
      ? order.referencePrice * (1 + slippageRate)
      : order.referencePrice * (1 - slippageRate);
    const quantity = hasQuantity ? (order.quantity as number) : (order.notional as number) / fillPrice;
    const notional = quantity * fillPrice;
    const fee = notional * (this.feeBps / 10_000);

    this.processedOrderIds.add(order.id);

    return {
      orderId: order.id,
      market: order.market,
      side: order.side,
      quantity,
      referencePrice: order.referencePrice,
      fillPrice,
      notional,
      fee,
      slippageBps: this.slippageBps,
      timestamp: order.timestamp,
      strategyVersion: order.strategyVersion,
    };
  }

  hasProcessed(orderId: string) {
    return this.processedOrderIds.has(orderId);
  }
}
