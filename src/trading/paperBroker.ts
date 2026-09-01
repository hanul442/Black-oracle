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
    if (order.notional <= 0 || !Number.isFinite(order.notional)) {
      throw new Error('Paper order notional must be positive and finite.');
    }
    if (order.referencePrice <= 0 || !Number.isFinite(order.referencePrice)) {
      throw new Error('Paper order reference price must be positive and finite.');
    }

    const slippageRate = this.slippageBps / 10_000;
    const fillPrice = order.side === 'BUY'
      ? order.referencePrice * (1 + slippageRate)
      : order.referencePrice * (1 - slippageRate);
    const quantity = order.notional / fillPrice;
    const fee = order.notional * (this.feeBps / 10_000);

    this.processedOrderIds.add(order.id);

    return {
      orderId: order.id,
      market: order.market,
      side: order.side,
      quantity,
      referencePrice: order.referencePrice,
      fillPrice,
      notional: order.notional,
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
