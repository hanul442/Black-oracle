import { PaperBroker, type PaperBrokerOptions } from './paperBroker';
import { PaperPortfolio } from './paperPortfolio';
import type { PaperFill, PaperOrderRequest } from './types';

export type SimulationExecutionAdapterKind = 'DETERMINISTIC_REPLAY' | 'PAPER_BROKER';

export interface SimulationExecutionAdapter {
  readonly kind: SimulationExecutionAdapterKind;
  readonly simulationOnly: true;
  readonly executionAuthority: false;
  execute(order: PaperOrderRequest): PaperFill;
}

export interface ExecutionFillParityReport {
  schemaVersion: 1;
  executionAuthority: false;
  status: 'PASS' | 'REJECT';
  orderId: string;
  marketParity: boolean;
  sideParity: boolean;
  quantityParity: boolean;
  fillPriceParity: boolean;
  notionalParity: boolean;
  feeParity: boolean;
  slippageParity: boolean;
  timestampParity: boolean;
  tolerance: number;
  reasons: string[];
}

export interface AdapterLifecycleState {
  cash: number;
  realizedPnl: number;
  feesPaid: number;
  positions: Array<{
    market: string;
    quantity: number;
    averageCost: number;
    entryPrice: number;
  }>;
}

export interface ExecutionAdapterLifecycleParityReport {
  schemaVersion: 1;
  executionAuthority: false;
  status: 'PASS' | 'REJECT';
  orderReports: ExecutionFillParityReport[];
  replayState: AdapterLifecycleState;
  paperState: AdapterLifecycleState;
  cashParity: boolean;
  realizedPnlParity: boolean;
  feesParity: boolean;
  positionsParity: boolean;
  tolerance: number;
  reasons: string[];
}

const resolvedOptions = (options: PaperBrokerOptions = {}) => ({
  feeBps: options.feeBps ?? 5,
  slippageBps: options.slippageBps ?? 8,
});

const assertOrder = (order: PaperOrderRequest) => {
  if (!order?.id?.trim()) throw new Error('Execution adapter requires an order id.');
  if (!/^KRW-[A-Z0-9]+$/.test(order.market)) throw new Error(`Execution adapter requires normalized KRW market: ${order.market}`);
  if (!Number.isFinite(order.referencePrice) || order.referencePrice <= 0) throw new Error('Execution adapter reference price must be positive and finite.');
  if (!Number.isFinite(order.timestamp) || order.timestamp <= 0) throw new Error('Execution adapter timestamp must be positive and finite.');
  if (!order.strategyVersion?.trim()) throw new Error('Execution adapter requires strategyVersion.');
};

/** Independent deterministic reference implementation for historical replay. */
export class DeterministicReplayExecutionAdapter implements SimulationExecutionAdapter {
  readonly kind = 'DETERMINISTIC_REPLAY' as const;
  readonly simulationOnly = true as const;
  readonly executionAuthority = false as const;
  private readonly feeBps: number;
  private readonly slippageBps: number;
  private readonly processedOrderIds = new Set<string>();

  constructor(options: PaperBrokerOptions = {}) {
    const resolved = resolvedOptions(options);
    this.feeBps = resolved.feeBps;
    this.slippageBps = resolved.slippageBps;
  }

  execute(order: PaperOrderRequest): PaperFill {
    assertOrder(order);
    if (this.processedOrderIds.has(order.id)) throw new Error(`Duplicate replay order id: ${order.id}`);
    const hasNotional = Number.isFinite(order.notional) && (order.notional as number) > 0;
    const hasQuantity = Number.isFinite(order.quantity) && (order.quantity as number) > 0;
    if (!hasNotional && !hasQuantity) throw new Error('Replay order requires a positive notional or quantity.');
    if (order.side === 'BUY' && !hasNotional) throw new Error('Replay BUY requires notional sizing in Sprint 7 parity mode.');

    const slip = this.slippageBps / 10_000;
    const fillPrice = order.side === 'BUY' ? order.referencePrice * (1 + slip) : order.referencePrice * (1 - slip);
    const quantity = hasQuantity ? order.quantity as number : (order.notional as number) / fillPrice;
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
}

export class PaperBrokerExecutionAdapter implements SimulationExecutionAdapter {
  readonly kind = 'PAPER_BROKER' as const;
  readonly simulationOnly = true as const;
  readonly executionAuthority = false as const;
  private readonly broker: PaperBroker;

  constructor(options: PaperBrokerOptions = {}) {
    this.broker = new PaperBroker(options);
  }

  execute(order: PaperOrderRequest) {
    assertOrder(order);
    return this.broker.executeMarketOrder(order);
  }
}

const closeEnough = (left: number, right: number, tolerance: number) => Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;

export const compareExecutionFills = (
  replay: PaperFill,
  paper: PaperFill,
  tolerance = 1e-8,
): ExecutionFillParityReport => {
  const marketParity = replay.market === paper.market;
  const sideParity = replay.side === paper.side;
  const quantityParity = closeEnough(replay.quantity, paper.quantity, tolerance);
  const fillPriceParity = closeEnough(replay.fillPrice, paper.fillPrice, tolerance);
  const notionalParity = closeEnough(replay.notional, paper.notional, tolerance);
  const feeParity = closeEnough(replay.fee, paper.fee, tolerance);
  const slippageParity = closeEnough(replay.slippageBps, paper.slippageBps, tolerance);
  const timestampParity = replay.timestamp === paper.timestamp;
  const status = marketParity && sideParity && quantityParity && fillPriceParity && notionalParity && feeParity && slippageParity && timestampParity ? 'PASS' : 'REJECT';
  const reasons = [
    `market: ${marketParity ? 'PASS' : 'FAIL'}`,
    `side: ${sideParity ? 'PASS' : 'FAIL'}`,
    `quantity: ${quantityParity ? 'PASS' : 'FAIL'}`,
    `fillPrice: ${fillPriceParity ? 'PASS' : 'FAIL'}`,
    `notional: ${notionalParity ? 'PASS' : 'FAIL'}`,
    `fee: ${feeParity ? 'PASS' : 'FAIL'}`,
    `slippage: ${slippageParity ? 'PASS' : 'FAIL'}`,
    `timestamp: ${timestampParity ? 'PASS' : 'FAIL'}`,
  ];
  return { schemaVersion: 1, executionAuthority: false, status, orderId: paper.orderId, marketParity, sideParity, quantityParity, fillPriceParity, notionalParity, feeParity, slippageParity, timestampParity, tolerance, reasons };
};

export const compareExecutionAdapters = (
  order: PaperOrderRequest,
  options: PaperBrokerOptions = {},
): { replay: PaperFill; paper: PaperFill; parity: ExecutionFillParityReport } => {
  const replayAdapter = new DeterministicReplayExecutionAdapter(options);
  const paperAdapter = new PaperBrokerExecutionAdapter(options);
  const replay = replayAdapter.execute(order);
  const paper = paperAdapter.execute(order);
  return { replay, paper, parity: compareExecutionFills(replay, paper) };
};

class ReplaySpotBook {
  private cash: number;
  private realizedPnl = 0;
  private feesPaid = 0;
  private readonly positions = new Map<string, AdapterLifecycleState['positions'][number]>();

  constructor(initialCash: number) {
    if (!Number.isFinite(initialCash) || initialCash <= 0) throw new Error('Replay spot book requires positive initial cash.');
    this.cash = initialCash;
  }

  apply(fill: PaperFill) {
    const existing = this.positions.get(fill.market);
    if (fill.side === 'BUY') {
      const debit = fill.notional + fill.fee;
      if (debit > this.cash + 1e-9) throw new Error('Replay spot book has insufficient cash.');
      if (existing) throw new Error('Replay parity book does not pyramid in Sprint 7.');
      this.cash -= debit;
      this.feesPaid += fill.fee;
      this.positions.set(fill.market, {
        market: fill.market,
        quantity: fill.quantity,
        averageCost: debit / fill.quantity,
        entryPrice: fill.fillPrice,
      });
      return;
    }
    if (!existing) throw new Error('Replay parity book cannot sell without a position.');
    if (fill.quantity > existing.quantity + 1e-10) throw new Error('Replay sell quantity exceeds position.');
    const proceedsAfterFee = fill.notional - fill.fee;
    const costBasisReleased = existing.averageCost * fill.quantity;
    this.realizedPnl += proceedsAfterFee - costBasisReleased;
    this.cash += proceedsAfterFee;
    this.feesPaid += fill.fee;
    const remaining = Math.max(0, existing.quantity - fill.quantity);
    if (remaining <= 1e-10) this.positions.delete(fill.market);
    else this.positions.set(fill.market, { ...existing, quantity: remaining });
  }

  state(): AdapterLifecycleState {
    return {
      cash: this.cash,
      realizedPnl: this.realizedPnl,
      feesPaid: this.feesPaid,
      positions: Array.from(this.positions.values()).map((position) => ({ ...position })).sort((a, b) => a.market.localeCompare(b.market)),
    };
  }
}

const paperState = (portfolio: PaperPortfolio): AdapterLifecycleState => {
  const state = portfolio.exportState();
  return {
    cash: state.cash,
    realizedPnl: state.realizedPnl,
    feesPaid: state.feesPaid,
    positions: state.positions.map((position) => ({
      market: position.market,
      quantity: position.quantity,
      averageCost: position.averageCost,
      entryPrice: position.entryPrice,
    })).sort((a, b) => a.market.localeCompare(b.market)),
  };
};

const positionsEqual = (left: AdapterLifecycleState['positions'], right: AdapterLifecycleState['positions'], tolerance: number) => {
  if (left.length !== right.length) return false;
  return left.every((position, index) => {
    const candidate = right[index];
    return position.market === candidate.market
      && closeEnough(position.quantity, candidate.quantity, tolerance)
      && closeEnough(position.averageCost, candidate.averageCost, tolerance)
      && closeEnough(position.entryPrice, candidate.entryPrice, tolerance);
  });
};

export const compareExecutionAdapterLifecycle = (
  orders: PaperOrderRequest[],
  initialCash = 1_000_000,
  options: PaperBrokerOptions = {},
): ExecutionAdapterLifecycleParityReport => {
  const replayAdapter = new DeterministicReplayExecutionAdapter(options);
  const paperAdapter = new PaperBrokerExecutionAdapter(options);
  const replayBook = new ReplaySpotBook(initialCash);
  const portfolio = new PaperPortfolio(initialCash);
  const orderReports: ExecutionFillParityReport[] = [];

  for (const order of orders) {
    const replayFill = replayAdapter.execute(order);
    const paperFill = paperAdapter.execute(order);
    orderReports.push(compareExecutionFills(replayFill, paperFill));
    replayBook.apply(replayFill);
    portfolio.applyFill(paperFill);
  }

  const replayState = replayBook.state();
  const actualPaperState = paperState(portfolio);
  const tolerance = Math.max(1e-8, initialCash * 1e-10);
  const cashParity = closeEnough(replayState.cash, actualPaperState.cash, tolerance);
  const realizedPnlParity = closeEnough(replayState.realizedPnl, actualPaperState.realizedPnl, tolerance);
  const feesParity = closeEnough(replayState.feesPaid, actualPaperState.feesPaid, tolerance);
  const positionsParity = positionsEqual(replayState.positions, actualPaperState.positions, tolerance);
  const status = orderReports.every((report) => report.status === 'PASS') && cashParity && realizedPnlParity && feesParity && positionsParity ? 'PASS' : 'REJECT';
  const reasons = [
    `fill parity: ${orderReports.every((report) => report.status === 'PASS') ? 'PASS' : 'FAIL'}`,
    `cash: ${cashParity ? 'PASS' : 'FAIL'}`,
    `realizedPnl: ${realizedPnlParity ? 'PASS' : 'FAIL'}`,
    `fees: ${feesParity ? 'PASS' : 'FAIL'}`,
    `positions: ${positionsParity ? 'PASS' : 'FAIL'}`,
  ];
  return { schemaVersion: 1, executionAuthority: false, status, orderReports, replayState, paperState: actualPaperState, cashParity, realizedPnlParity, feesParity, positionsParity, tolerance, reasons };
};
