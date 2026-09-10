import { TRADING_STRATEGY_VERSION, UNIFIED_PAPER_INITIAL_EQUITY_KRW } from '../../src/trading/config';
import type { EvidenceAggregate } from '../../src/trading/evidence';
import { buildExecutionDecision } from '../../src/trading/executionPolicy';
import { TradingLedger } from '../../src/trading/ledger';
import { buildMicrostructureChallenger } from '../../src/trading/microstructureChallenger';
import { PaperBroker } from '../../src/trading/paperBroker';
import { PaperPortfolio, type PaperPortfolioState } from '../../src/trading/paperPortfolio';
import { buildPaperPerformance, type ClosedPaperTrade, type PaperEntryAuditSnapshot } from '../../src/trading/performance';
import { buildPreTradeShadowReview } from '../../src/trading/preTradeReview';
import { buildDynamicProtectionUpdate, type DynamicProtectionUpdate } from '../../src/trading/protectionManager';
import { buildTradeMap } from '../../src/trading/tradeMap';
import type { LiquiditySnapshot, PaperFill, TradingLedgerEvent } from '../../src/trading/types';
import { buildMarketMicrostructure } from './microstructure';
import { buildMarketMultiTimeframe } from './multiTimeframe';
import { getMarketLiquidity } from './universe';

interface EntryMetadata {
  fill: PaperFill;
  oracleTradeScore: number;
  audit?: PaperEntryAuditSnapshot;
  realizedQuantity?: number;
  accumulatedGrossPnl?: number;
  accumulatedNetPnl?: number;
  accumulatedExitFees?: number;
  weightedExitValue?: number;
  partialExitCount?: number;
}

export interface ApprovedExternalPaperEntry {
  market: string;
  referencePrice: number;
  notional: number;
  oracleTradeScore: number;
  stopLossPrice: number;
  takeProfit1Price: number | null;
  takeProfit2Price: number;
  takeProfit1Fraction: number;
  protectionBasis: 'STRUCTURE_ATR' | 'ATR';
  riskApproved: true;
  timestamp?: number;
  reason: string;
  audit?: PaperEntryAuditSnapshot;
}

export interface ApprovedExternalPaperExit {
  market: string;
  referencePrice: number;
  oracleTradeScore: number;
  quantity?: number;
  riskApproved: true;
  timestamp?: number;
  reason: string;
  markTakeProfit1?: boolean;
}

const VALID_MARKET = /^(KRW-[A-Z0-9]+|KRX-\d{6})$/;

const cloneAudit = (audit?: PaperEntryAuditSnapshot): PaperEntryAuditSnapshot | undefined => audit ? {
  ...audit,
  structure: audit.structure ? { ...audit.structure } : null,
  cycle: audit.cycle ? { ...audit.cycle, frames: { ...audit.cycle.frames }, reasons: audit.cycle.reasons.slice() } : null,
  technicalEvidence: audit.technicalEvidence ? { ...audit.technicalEvidence } : null,
  microstructure: audit.microstructure ? { ...audit.microstructure } : null,
  challenger: audit.challenger ? { ...audit.challenger, reasons: audit.challenger.reasons.slice() } : null,
  tradeMap: { ...audit.tradeMap, reasons: audit.tradeMap.reasons.slice() },
} : undefined;

const cloneEntryMetadata = (metadata: EntryMetadata): EntryMetadata => ({
  ...metadata,
  fill: { ...metadata.fill },
  audit: cloneAudit(metadata.audit),
});

export interface PaperTradingSessionCheckpoint {
  schemaVersion: 1;
  portfolio: PaperPortfolioState;
  markPrices: Array<[string, number]>;
  entryMetadata: Array<[string, EntryMetadata]>;
  closedTrades: ClosedPaperTrade[];
  ledger: TradingLedgerEvent[];
  processedOrderIds: string[];
}

export class PaperTradingSession {
  private portfolio: PaperPortfolio;
  private broker: PaperBroker;
  private ledger: TradingLedger;
  private readonly markPrices = new Map<string, number>();
  private readonly entryMetadata = new Map<string, EntryMetadata>();
  private readonly closedTrades: ClosedPaperTrade[] = [];

  constructor(initialCash = UNIFIED_PAPER_INITIAL_EQUITY_KRW) {
    this.portfolio = new PaperPortfolio(initialCash);
    this.broker = new PaperBroker({ feeBps: 5, slippageBps: 8 });
    this.ledger = new TradingLedger();
  }

  checkpoint(): PaperTradingSessionCheckpoint {
    return {
      schemaVersion: 1,
      portfolio: this.portfolio.exportState(),
      markPrices: Array.from(this.markPrices.entries()),
      entryMetadata: Array.from(this.entryMetadata.entries()).map(([market, metadata]) => [market, cloneEntryMetadata(metadata)]),
      closedTrades: this.closedTrades.map((trade) => ({ ...trade, entryAudit: cloneAudit(trade.entryAudit) })),
      ledger: this.ledger.snapshot().map((event) => ({ ...event, payload: { ...event.payload } })),
      processedOrderIds: this.broker.processedOrderIdsSnapshot(),
    };
  }

  restore(checkpoint: PaperTradingSessionCheckpoint) {
    if (!checkpoint || checkpoint.schemaVersion !== 1) throw new Error('Unsupported Paper session checkpoint schema.');
    this.portfolio = PaperPortfolio.restore(checkpoint.portfolio);
    this.broker = new PaperBroker({ feeBps: 5, slippageBps: 8 });
    this.broker.restoreProcessedOrderIds(checkpoint.processedOrderIds ?? []);
    this.ledger = TradingLedger.restore(checkpoint.ledger ?? []);

    this.markPrices.clear();
    for (const [market, price] of checkpoint.markPrices ?? []) {
      if (VALID_MARKET.test(market) && Number.isFinite(price) && price > 0) this.markPrices.set(market, price);
    }

    this.entryMetadata.clear();
    for (const [market, metadata] of checkpoint.entryMetadata ?? []) {
      if (!metadata?.fill || !Number.isFinite(metadata.oracleTradeScore)) continue;
      this.entryMetadata.set(market, cloneEntryMetadata(metadata));
    }

    this.closedTrades.splice(
      0,
      this.closedTrades.length,
      ...(checkpoint.closedTrades ?? []).slice(-5_000).map((trade) => ({ ...trade, entryAudit: cloneAudit(trade.entryAudit) })),
    );
    return this.state();
  }

  reset(initialCash = UNIFIED_PAPER_INITIAL_EQUITY_KRW) {
    this.portfolio = new PaperPortfolio(initialCash);
    this.broker = new PaperBroker({ feeBps: 5, slippageBps: 8 });
    this.ledger = new TradingLedger();
    this.markPrices.clear();
    this.entryMetadata.clear();
    this.closedTrades.splice(0, this.closedTrades.length);
    return this.state();
  }

  performance(timestamp = Date.now()) {
    const portfolio = this.portfolio.snapshot(Object.fromEntries(this.markPrices), timestamp);
    return buildPaperPerformance(
      this.closedTrades,
      portfolio.equityCurve,
      portfolio.initialEquity,
      portfolio.equity,
      portfolio.drawdownPct,
    );
  }

  state() {
    const portfolio = this.portfolio.snapshot(Object.fromEntries(this.markPrices));
    return {
      mode: 'PAPER' as const,
      strategyVersion: TRADING_STRATEGY_VERSION,
      portfolio,
      performance: buildPaperPerformance(
        this.closedTrades,
        portfolio.equityCurve,
        portfolio.initialEquity,
        portfolio.equity,
        portfolio.drawdownPct,
      ),
      closedTrades: this.closedTrades.slice(-100).map((trade) => ({ ...trade, entryAudit: cloneAudit(trade.entryAudit) })),
      ledger: this.ledger.snapshot(),
    };
  }

  getPosition(market: string) {
    return this.portfolio.getPosition(market.toUpperCase());
  }

  markExternalPrice(market: string, price: number, timestamp = Date.now()) {
    const normalized = market.toUpperCase();
    if (!VALID_MARKET.test(normalized)) throw new Error(`Unsupported Paper market: ${normalized}`);
    if (!(price > 0) || !Number.isFinite(price)) throw new Error('External mark price must be positive and finite.');
    this.markPrices.set(normalized, price);
    return this.portfolio.snapshot(Object.fromEntries(this.markPrices), timestamp);
  }

  applyExternalDynamicProtection(update: DynamicProtectionUpdate, timestamp = Date.now()) {
    const normalized = update.market.toUpperCase();
    if (!this.portfolio.getPosition(normalized)) throw new Error(`No Paper position exists for ${normalized}.`);
    this.portfolio.applyDynamicProtection({ ...update, market: normalized }, timestamp);
    this.ledger.append('POSITION_UPDATED', {
      market: normalized,
      source: 'EXTERNAL_ASSET_LOOP',
      dynamicProtection: true,
      currentPrice: update.currentPrice,
      stopLossPrice: update.stopLossPrice,
      takeProfit2Price: update.takeProfit2Price,
      protectionRevision: update.protectionRevision,
      reasons: update.reasons,
    });
    return this.portfolio.getPosition(normalized);
  }

  executeApprovedExternalEntry(plan: ApprovedExternalPaperEntry) {
    const normalized = plan.market.toUpperCase();
    if (!VALID_MARKET.test(normalized)) throw new Error(`Unsupported Paper market: ${normalized}`);
    if (!plan.riskApproved) throw new Error('External Paper entry requires deterministic risk approval.');
    if (this.portfolio.getPosition(normalized)) throw new Error(`Paper position already exists for ${normalized}.`);
    if (!(plan.referencePrice > 0) || !(plan.notional > 0)) throw new Error('External Paper entry requires positive price and notional.');
    const timestamp = plan.timestamp ?? Date.now();
    this.markPrices.set(normalized, plan.referencePrice);
    const orderId = `paper-ext-${timestamp}-${normalized}-buy`;
    this.ledger.append('ORDER_SUBMITTED', {
      orderId,
      market: normalized,
      side: 'BUY',
      notional: plan.notional,
      source: 'EXTERNAL_ASSET_LOOP',
      reason: plan.reason,
    });
    const fill = this.broker.executeMarketOrder({
      id: orderId,
      market: normalized,
      side: 'BUY',
      notional: plan.notional,
      referencePrice: plan.referencePrice,
      timestamp,
      strategyVersion: TRADING_STRATEGY_VERSION,
    });
    this.portfolio.applyFill(fill);
    this.entryMetadata.set(normalized, {
      fill,
      oracleTradeScore: plan.oracleTradeScore,
      audit: cloneAudit(plan.audit),
      realizedQuantity: 0,
      accumulatedGrossPnl: 0,
      accumulatedNetPnl: 0,
      accumulatedExitFees: 0,
      weightedExitValue: 0,
      partialExitCount: 0,
    });
    this.portfolio.setProtectionPlan(normalized, {
      stopLossPrice: plan.stopLossPrice,
      takeProfit1Price: plan.takeProfit1Price,
      takeProfit2Price: plan.takeProfit2Price,
      takeProfit1Fraction: plan.takeProfit1Fraction,
      protectionBasis: plan.protectionBasis,
    }, timestamp);
    this.ledger.append('ORDER_FILLED', { ...fill, source: 'EXTERNAL_ASSET_LOOP', reason: plan.reason });
    this.ledger.append('POSITION_UPDATED', { market: normalized, position: this.portfolio.getPosition(normalized), source: 'EXTERNAL_ASSET_LOOP' });
    return {
      fill,
      position: this.portfolio.getPosition(normalized),
      portfolio: this.portfolio.snapshot(Object.fromEntries(this.markPrices), timestamp),
      ledgerTail: this.ledger.snapshot().slice(-8),
    };
  }

  executeApprovedExternalExit(plan: ApprovedExternalPaperExit) {
    const normalized = plan.market.toUpperCase();
    if (!VALID_MARKET.test(normalized)) throw new Error(`Unsupported Paper market: ${normalized}`);
    if (!plan.riskApproved) throw new Error('External Paper exit requires explicit deterministic approval.');
    const position = this.portfolio.getPosition(normalized);
    if (!position) throw new Error(`No Paper position exists for ${normalized}.`);
    if (!(plan.referencePrice > 0)) throw new Error('External Paper exit requires a positive reference price.');
    const timestamp = plan.timestamp ?? Date.now();
    this.markPrices.set(normalized, plan.referencePrice);
    const exitQuantity = Math.min(position.quantity, plan.quantity && plan.quantity > 0 ? plan.quantity : position.quantity);
    const orderId = `paper-ext-${timestamp}-${normalized}-sell`;
    this.ledger.append('ORDER_SUBMITTED', {
      orderId,
      market: normalized,
      side: 'SELL',
      quantity: exitQuantity,
      source: 'EXTERNAL_ASSET_LOOP',
      reason: plan.reason,
    });
    const fill = this.broker.executeMarketOrder({
      id: orderId,
      market: normalized,
      side: 'SELL',
      quantity: exitQuantity,
      referencePrice: plan.referencePrice,
      timestamp,
      strategyVersion: TRADING_STRATEGY_VERSION,
    });

    const entry = this.entryMetadata.get(normalized);
    const costBasisReleased = position.averageCost * fill.quantity;
    const fillGrossPnl = (fill.fillPrice - position.entryPrice) * fill.quantity;
    const fillNetPnl = fill.notional - fill.fee - costBasisReleased;
    const updatedMetadata: EntryMetadata | null = entry ? {
      ...entry,
      realizedQuantity: (entry.realizedQuantity ?? 0) + fill.quantity,
      accumulatedGrossPnl: (entry.accumulatedGrossPnl ?? 0) + fillGrossPnl,
      accumulatedNetPnl: (entry.accumulatedNetPnl ?? 0) + fillNetPnl,
      accumulatedExitFees: (entry.accumulatedExitFees ?? 0) + fill.fee,
      weightedExitValue: (entry.weightedExitValue ?? 0) + fill.fillPrice * fill.quantity,
      partialExitCount: (entry.partialExitCount ?? 0) + (fill.quantity < position.quantity - 1e-10 ? 1 : 0),
    } : null;

    const remainingPosition = this.portfolio.applyFill(fill);
    if (remainingPosition) {
      if (updatedMetadata) this.entryMetadata.set(normalized, updatedMetadata);
      if (plan.markTakeProfit1) this.portfolio.markTakeProfit1(normalized, timestamp);
      this.ledger.append('ORDER_FILLED', { ...fill, partialExit: true, source: 'EXTERNAL_ASSET_LOOP', reason: plan.reason });
      this.ledger.append('POSITION_UPDATED', { market: normalized, position: this.portfolio.getPosition(normalized), partialExit: true, source: 'EXTERNAL_ASSET_LOOP' });
      return {
        fill,
        partial: true,
        closedTrade: null,
        position: this.portfolio.getPosition(normalized),
        portfolio: this.portfolio.snapshot(Object.fromEntries(this.markPrices), timestamp),
      };
    }

    const totalQuantity = updatedMetadata?.realizedQuantity ?? fill.quantity;
    const totalGrossPnl = updatedMetadata?.accumulatedGrossPnl ?? fillGrossPnl;
    const totalNetPnl = updatedMetadata?.accumulatedNetPnl ?? fillNetPnl;
    const exitFees = updatedMetadata?.accumulatedExitFees ?? fill.fee;
    const weightedExitValue = updatedMetadata?.weightedExitValue ?? fill.fillPrice * fill.quantity;
    const entryNotionalWithFee = entry ? entry.fill.notional + entry.fill.fee : position.averageCost * totalQuantity;
    const weightedExitPrice = totalQuantity > 0 ? weightedExitValue / totalQuantity : fill.fillPrice;
    const closedTrade: ClosedPaperTrade = {
      id: `trade-${normalized}-${position.openedAt}-${timestamp}`,
      market: normalized,
      openedAt: position.openedAt,
      closedAt: timestamp,
      entryPrice: position.entryPrice,
      exitPrice: weightedExitPrice,
      quantity: totalQuantity,
      grossPnl: totalGrossPnl,
      fees: (entry?.fill.fee ?? 0) + exitFees,
      netPnl: totalNetPnl,
      returnPct: entryNotionalWithFee > 0 ? totalNetPnl / entryNotionalWithFee : 0,
      exitReason: (updatedMetadata?.partialExitCount ?? 0) > 0
        ? `Staged exit completed. Final reason: ${plan.reason}`
        : plan.reason,
      strategyVersion: TRADING_STRATEGY_VERSION,
      entryOracleTradeScore: entry?.oracleTradeScore ?? 50,
      exitOracleTradeScore: plan.oracleTradeScore,
      entryAudit: cloneAudit(entry?.audit),
    };
    this.entryMetadata.delete(normalized);
    this.closedTrades.push(closedTrade);
    if (this.closedTrades.length > 5_000) this.closedTrades.splice(0, this.closedTrades.length - 5_000);
    this.ledger.append('ORDER_FILLED', { ...fill, partialExit: false, source: 'EXTERNAL_ASSET_LOOP', reason: plan.reason });
    this.ledger.append('POSITION_UPDATED', { market: normalized, position: null, closedTrade, source: 'EXTERNAL_ASSET_LOOP' });
    return {
      fill,
      partial: false,
      closedTrade,
      position: null,
      portfolio: this.portfolio.snapshot(Object.fromEntries(this.markPrices), timestamp),
    };
  }

  async step(
    market: string,
    eventScore?: number,
    precomputedLiquidity?: LiquiditySnapshot,
    newEntryAllowed = true,
    externalEvidenceAvailable = true,
    evidence?: EvidenceAggregate,
  ) {
    const normalized = market.toUpperCase();
    const [liquidity, multiTimeframe] = await Promise.all([
      precomputedLiquidity ? Promise.resolve(precomputedLiquidity) : getMarketLiquidity(normalized),
      buildMarketMultiTimeframe(normalized, eventScore),
    ]);
    const microstructure = await buildMarketMicrostructure(normalized, liquidity.tradePrice);
    const challenger = buildMicrostructureChallenger(multiTimeframe, microstructure);
    this.markPrices.set(normalized, liquidity.tradePrice);

    let position = this.portfolio.getPosition(normalized);
    let protectionUpdate: DynamicProtectionUpdate | null = null;
    if (position?.stopLossPrice) {
      protectionUpdate = buildDynamicProtectionUpdate(position, multiTimeframe.frames.oneHour, liquidity.tradePrice);
      if (protectionUpdate.changed) {
        this.portfolio.applyDynamicProtection(protectionUpdate, multiTimeframe.asOf);
        this.ledger.append('POSITION_UPDATED', {
          market: normalized,
          dynamicProtection: true,
          currentPrice: liquidity.tradePrice,
          stopLossPrice: protectionUpdate.stopLossPrice,
          takeProfit2Price: protectionUpdate.takeProfit2Price,
          protectionRevision: protectionUpdate.protectionRevision,
          reasons: protectionUpdate.reasons,
        });
        position = this.portfolio.getPosition(normalized);
      }
    }

    const before = this.portfolio.snapshot(Object.fromEntries(this.markPrices), multiTimeframe.asOf);
    const technicalEntryCandidate = !position
      && newEntryAllowed
      && liquidity.eligible
      && multiTimeframe.action === 'BUY'
      && multiTimeframe.confidence >= 0.62;
    const decision = buildExecutionDecision({
      liquidity,
      multiTimeframe,
      oneHour: multiTimeframe.frames.oneHour,
      portfolio: before,
      position,
      marketDataAgeMs: Math.max(0, Date.now() - multiTimeframe.asOf),
      newEntryAllowed,
      newRiskEvidenceAllowed: externalEvidenceAvailable,
    });

    // S2 shadow-only boundary: capture the exact evidence/router/council/arbiter
    // review before any ORDER_SUBMITTED event. This snapshot has no execution
    // authority and therefore cannot alter the qualification runtime outcome.
    const preTradeReview = evidence ? buildPreTradeShadowReview({
      timestamp: multiTimeframe.asOf,
      market: normalized,
      decision,
      multiTimeframe,
      evidence,
      microstructure,
      challenger,
    }) : null;

    const tradeMap = buildTradeMap({
      currentPrice: liquidity.tradePrice,
      decision,
      multiTimeframe,
      oneHour: multiTimeframe.frames.oneHour,
    });
    const oneHour = multiTimeframe.frames.oneHour;
    const technical = oneHour.technicalEvidence;
    const structure = oneHour.structure;
    const entryAudit: PaperEntryAuditSnapshot = {
      timestamp: multiTimeframe.asOf,
      eventScore: eventScore ?? null,
      regime: oneHour.regime.regime,
      regimeConfidence: oneHour.regime.confidence,
      structure: structure ? {
        bias: structure.bias,
        confidence: structure.confidence,
        eventType: structure.lastEvent?.type ?? null,
        eventDirection: structure.lastEvent?.direction ?? null,
        location: structure.location.zone,
        percentile: structure.location.percentile,
      } : null,
      cycle: multiTimeframe.cycle ? {
        ...multiTimeframe.cycle,
        frames: { ...multiTimeframe.cycle.frames },
        reasons: multiTimeframe.cycle.reasons.slice(),
      } : null,
      technicalEvidence: technical ? {
        rawSignalCount: technical.rawSignalCount,
        independentFamilyCount: technical.independentFamilyCount,
        correlatedSignalPenalty: technical.correlatedSignalPenalty,
        directionalScore: technical.directionalScore,
        confidence: technical.confidence,
        bullishFamilies: technical.bullishFamilies,
        bearishFamilies: technical.bearishFamilies,
        neutralFamilies: technical.neutralFamilies,
      } : null,
      microstructure: {
        available: microstructure.available,
        sampleTrades: microstructure.sampleTrades,
        sampleCoverageMs: microstructure.sampleCoverageMs,
        takerImbalance: microstructure.takerImbalance,
        orderbookImbalanceTop5: microstructure.orderbookImbalanceTop5,
        orderbookImbalanceTop15: microstructure.orderbookImbalanceTop15,
        orderbookImbalanceTop30: microstructure.orderbookImbalanceTop30,
        weightedOrderbookImbalance: microstructure.weightedOrderbookImbalance,
        pressureScore: microstructure.pressureScore,
        direction: microstructure.direction,
        confidence: microstructure.confidence,
        pointOfControl: microstructure.profile.pointOfControl,
        valueAreaLow: microstructure.profile.valueAreaLow,
        valueAreaHigh: microstructure.profile.valueAreaHigh,
        profileLocation: microstructure.profile.currentLocation,
      },
      challenger: { ...challenger, reasons: challenger.reasons.slice() },
      tradeMap: { ...tradeMap, reasons: tradeMap.reasons.slice() },
    };

    this.ledger.append('MARKET_SNAPSHOT', {
      market: normalized,
      price: liquidity.tradePrice,
      liquidityScore: liquidity.score,
      multiTimeframeScore: multiTimeframe.oracleTradeScore,
      eventScore: eventScore ?? null,
      externalEvidenceAvailable,
      technicalEntryCandidate,
      structure: entryAudit.structure,
      cycle: entryAudit.cycle,
      microstructure: entryAudit.microstructure,
      challenger: entryAudit.challenger,
      protectionUpdate,
    });
    this.ledger.append('SIGNAL', {
      market: normalized,
      action: decision.action,
      side: decision.side,
      directionalScore: multiTimeframe.directionalScore,
      oracleTradeScore: multiTimeframe.oracleTradeScore,
      confidence: decision.confidence,
      externalEvidenceAvailable,
      technicalEntryCandidate,
      positionSizingMode: decision.positionSizingMode ?? null,
      expectedLossAtStop: decision.expectedLossAtStop ?? null,
      technicalEvidence: entryAudit.technicalEvidence,
      tradeMap,
      microstructure: entryAudit.microstructure,
      challenger: entryAudit.challenger,
      preTradeReview,
      protectionUpdate,
    });

    let fill: PaperFill | null = null;
    let closedTrade: ClosedPaperTrade | null = null;
    if (decision.action === 'ENTER' && decision.side === 'BUY') {
      const orderId = `paper-${Date.now()}-${normalized}-buy`;
      this.ledger.append('ORDER_SUBMITTED', { orderId, market: normalized, side: 'BUY', notional: decision.notional });
      fill = this.broker.executeMarketOrder({
        id: orderId,
        market: normalized,
        side: 'BUY',
        notional: decision.notional,
        referencePrice: liquidity.tradePrice,
        timestamp: Date.now(),
        strategyVersion: TRADING_STRATEGY_VERSION,
      });
      this.portfolio.applyFill(fill);
      this.entryMetadata.set(normalized, {
        fill,
        oracleTradeScore: multiTimeframe.oracleTradeScore,
        audit: cloneAudit(entryAudit),
        realizedQuantity: 0,
        accumulatedGrossPnl: 0,
        accumulatedNetPnl: 0,
        accumulatedExitFees: 0,
        weightedExitValue: 0,
        partialExitCount: 0,
      });
      if (decision.stopLossPrice && decision.takeProfit2Price) {
        this.portfolio.setProtectionPlan(normalized, {
          stopLossPrice: decision.stopLossPrice,
          takeProfit1Price: decision.takeProfit1Price ?? null,
          takeProfit2Price: decision.takeProfit2Price,
          takeProfit1Fraction: decision.takeProfit1Fraction ?? 0.4,
          protectionBasis: decision.protectionBasis ?? 'ATR',
        }, fill.timestamp);
      } else if (decision.stopLossPrice && decision.takeProfitPrice) {
        this.portfolio.setProtection(normalized, decision.stopLossPrice, decision.takeProfitPrice, fill.timestamp);
      }
      this.ledger.append('ORDER_FILLED', { ...fill });
      this.ledger.append('POSITION_UPDATED', { market: normalized, position: this.portfolio.getPosition(normalized) });
    } else if (decision.action === 'EXIT' && decision.side === 'SELL' && position) {
      const exitQuantity = Math.min(position.quantity, decision.quantity > 0 ? decision.quantity : position.quantity);
      const orderId = `paper-${Date.now()}-${normalized}-sell`;
      this.ledger.append('ORDER_SUBMITTED', { orderId, market: normalized, side: 'SELL', quantity: exitQuantity });
      fill = this.broker.executeMarketOrder({
        id: orderId,
        market: normalized,
        side: 'SELL',
        quantity: exitQuantity,
        referencePrice: liquidity.tradePrice,
        timestamp: Date.now(),
        strategyVersion: TRADING_STRATEGY_VERSION,
      });

      const entry = this.entryMetadata.get(normalized);
      const costBasisReleased = position.averageCost * fill.quantity;
      const fillGrossPnl = (fill.fillPrice - position.entryPrice) * fill.quantity;
      const fillNetPnl = fill.notional - fill.fee - costBasisReleased;
      const updatedMetadata: EntryMetadata | null = entry ? {
        ...entry,
        realizedQuantity: (entry.realizedQuantity ?? 0) + fill.quantity,
        accumulatedGrossPnl: (entry.accumulatedGrossPnl ?? 0) + fillGrossPnl,
        accumulatedNetPnl: (entry.accumulatedNetPnl ?? 0) + fillNetPnl,
        accumulatedExitFees: (entry.accumulatedExitFees ?? 0) + fill.fee,
        weightedExitValue: (entry.weightedExitValue ?? 0) + fill.fillPrice * fill.quantity,
        partialExitCount: (entry.partialExitCount ?? 0) + (fill.quantity < position.quantity - 1e-10 ? 1 : 0),
      } : null;

      const remainingPosition = this.portfolio.applyFill(fill);
      const isPartial = remainingPosition !== null;
      const hitTp1 = isPartial
        && position.takeProfit1Price != null
        && !position.takeProfit1Taken
        && liquidity.tradePrice >= position.takeProfit1Price;

      if (isPartial) {
        if (updatedMetadata) this.entryMetadata.set(normalized, updatedMetadata);
        if (hitTp1) this.portfolio.markTakeProfit1(normalized, fill.timestamp);
        this.ledger.append('ORDER_FILLED', { ...fill, partialExit: true, reason: decision.reasons[0] ?? 'Partial exit.' });
        this.ledger.append('POSITION_UPDATED', { market: normalized, position: this.portfolio.getPosition(normalized), partialExit: true });
      } else {
        const totalQuantity = updatedMetadata?.realizedQuantity ?? fill.quantity;
        const totalGrossPnl = updatedMetadata?.accumulatedGrossPnl ?? fillGrossPnl;
        const totalNetPnl = updatedMetadata?.accumulatedNetPnl ?? fillNetPnl;
        const exitFees = updatedMetadata?.accumulatedExitFees ?? fill.fee;
        const weightedExitValue = updatedMetadata?.weightedExitValue ?? fill.fillPrice * fill.quantity;
        const entryNotionalWithFee = entry ? entry.fill.notional + entry.fill.fee : position.averageCost * totalQuantity;
        const weightedExitPrice = totalQuantity > 0 ? weightedExitValue / totalQuantity : fill.fillPrice;
        closedTrade = {
          id: `trade-${normalized}-${position.openedAt}-${fill.timestamp}`,
          market: normalized,
          openedAt: position.openedAt,
          closedAt: fill.timestamp,
          entryPrice: position.entryPrice,
          exitPrice: weightedExitPrice,
          quantity: totalQuantity,
          grossPnl: totalGrossPnl,
          fees: (entry?.fill.fee ?? 0) + exitFees,
          netPnl: totalNetPnl,
          returnPct: entryNotionalWithFee > 0 ? totalNetPnl / entryNotionalWithFee : 0,
          exitReason: (updatedMetadata?.partialExitCount ?? 0) > 0
            ? `Staged exit completed. Final reason: ${decision.reasons[0] ?? 'Exit policy triggered.'}`
            : decision.reasons[0] ?? 'Exit policy triggered.',
          strategyVersion: TRADING_STRATEGY_VERSION,
          entryOracleTradeScore: entry?.oracleTradeScore ?? 50,
          exitOracleTradeScore: multiTimeframe.oracleTradeScore,
          entryAudit: cloneAudit(entry?.audit),
        };

        this.entryMetadata.delete(normalized);
        this.closedTrades.push(closedTrade);
        if (this.closedTrades.length > 5_000) this.closedTrades.splice(0, this.closedTrades.length - 5_000);
        this.ledger.append('ORDER_FILLED', { ...fill, partialExit: false });
        this.ledger.append('POSITION_UPDATED', { market: normalized, position: null, closedTrade });
      }
    }

    const after = this.portfolio.snapshot(Object.fromEntries(this.markPrices), Date.now());
    const performance = buildPaperPerformance(
      this.closedTrades,
      after.equityCurve,
      after.initialEquity,
      after.equity,
      after.drawdownPct,
    );

    return {
      success: true,
      mode: 'PAPER' as const,
      strategyVersion: TRADING_STRATEGY_VERSION,
      liquidity,
      multiTimeframe,
      microstructure,
      challenger,
      eventScore: eventScore ?? null,
      externalEvidenceAvailable,
      technicalEntryCandidate,
      protectionUpdate,
      decision,
      preTradeReview,
      tradeMap,
      fill,
      closedTrade,
      portfolio: after,
      performance,
      ledgerTail: this.ledger.snapshot().slice(-10),
    };
  }
}

export const paperTradingSession = new PaperTradingSession();
