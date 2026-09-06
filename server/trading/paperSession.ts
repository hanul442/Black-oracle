import { TRADING_STRATEGY_VERSION } from '../../src/trading/config';
import { buildExecutionDecision } from '../../src/trading/executionPolicy';
import { TradingLedger } from '../../src/trading/ledger';
import { buildMicrostructureChallenger } from '../../src/trading/microstructureChallenger';
import { PaperBroker } from '../../src/trading/paperBroker';
import { PaperPortfolio, type PaperPortfolioState } from '../../src/trading/paperPortfolio';
import { buildPaperPerformance, type ClosedPaperTrade, type PaperEntryAuditSnapshot } from '../../src/trading/performance';
import { buildTradeMap } from '../../src/trading/tradeMap';
import type { LiquiditySnapshot, PaperFill, TradingLedgerEvent } from '../../src/trading/types';
import { buildMarketMicrostructure } from './microstructure';
import { buildMarketMultiTimeframe } from './multiTimeframe';
import { getMarketLiquidity } from './universe';

interface EntryMetadata {
  fill: PaperFill;
  oracleTradeScore: number;
  audit?: PaperEntryAuditSnapshot;
}

const cloneAudit = (audit?: PaperEntryAuditSnapshot): PaperEntryAuditSnapshot | undefined => audit ? {
  ...audit,
  structure: audit.structure ? { ...audit.structure } : null,
  cycle: audit.cycle ? { ...audit.cycle, frames: { ...audit.cycle.frames }, reasons: audit.cycle.reasons.slice() } : null,
  technicalEvidence: audit.technicalEvidence ? { ...audit.technicalEvidence } : null,
  microstructure: audit.microstructure ? { ...audit.microstructure } : null,
  challenger: audit.challenger ? { ...audit.challenger, reasons: audit.challenger.reasons.slice() } : null,
  tradeMap: { ...audit.tradeMap, reasons: audit.tradeMap.reasons.slice() },
} : undefined;

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

  constructor(initialCash = 1_000_000) {
    this.portfolio = new PaperPortfolio(initialCash);
    this.broker = new PaperBroker({ feeBps: 5, slippageBps: 8 });
    this.ledger = new TradingLedger();
  }

  checkpoint(): PaperTradingSessionCheckpoint {
    return {
      schemaVersion: 1,
      portfolio: this.portfolio.exportState(),
      markPrices: Array.from(this.markPrices.entries()),
      entryMetadata: Array.from(this.entryMetadata.entries()).map(([market, metadata]) => [market, {
        fill: { ...metadata.fill },
        oracleTradeScore: metadata.oracleTradeScore,
        audit: cloneAudit(metadata.audit),
      }]),
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
      if (/^KRW-[A-Z0-9]+$/.test(market) && Number.isFinite(price) && price > 0) this.markPrices.set(market, price);
    }

    this.entryMetadata.clear();
    for (const [market, metadata] of checkpoint.entryMetadata ?? []) {
      if (!metadata?.fill || !Number.isFinite(metadata.oracleTradeScore)) continue;
      this.entryMetadata.set(market, {
        fill: { ...metadata.fill },
        oracleTradeScore: metadata.oracleTradeScore,
        audit: cloneAudit(metadata.audit),
      });
    }

    this.closedTrades.splice(
      0,
      this.closedTrades.length,
      ...(checkpoint.closedTrades ?? []).slice(-5_000).map((trade) => ({ ...trade, entryAudit: cloneAudit(trade.entryAudit) })),
    );
    return this.state();
  }

  reset(initialCash = 1_000_000) {
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

  async step(
    market: string,
    eventScore?: number,
    precomputedLiquidity?: LiquiditySnapshot,
    newEntryAllowed = true,
  ) {
    const normalized = market.toUpperCase();
    const [liquidity, multiTimeframe] = await Promise.all([
      precomputedLiquidity ? Promise.resolve(precomputedLiquidity) : getMarketLiquidity(normalized),
      buildMarketMultiTimeframe(normalized, eventScore),
    ]);
    const microstructure = await buildMarketMicrostructure(normalized, liquidity.tradePrice);
    const challenger = buildMicrostructureChallenger(multiTimeframe, microstructure);
    this.markPrices.set(normalized, liquidity.tradePrice);

    const before = this.portfolio.snapshot(Object.fromEntries(this.markPrices), multiTimeframe.asOf);
    const position = this.portfolio.getPosition(normalized);
    const decision = buildExecutionDecision({
      liquidity,
      multiTimeframe,
      oneHour: multiTimeframe.frames.oneHour,
      portfolio: before,
      position,
      marketDataAgeMs: Math.max(0, Date.now() - multiTimeframe.asOf),
      newEntryAllowed,
    });
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
      structure: entryAudit.structure,
      cycle: entryAudit.cycle,
      microstructure: entryAudit.microstructure,
      challenger: entryAudit.challenger,
    });
    this.ledger.append('SIGNAL', {
      market: normalized,
      action: decision.action,
      side: decision.side,
      directionalScore: multiTimeframe.directionalScore,
      oracleTradeScore: multiTimeframe.oracleTradeScore,
      confidence: decision.confidence,
      technicalEvidence: entryAudit.technicalEvidence,
      tradeMap,
      microstructure: entryAudit.microstructure,
      challenger: entryAudit.challenger,
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
      this.entryMetadata.set(normalized, { fill, oracleTradeScore: multiTimeframe.oracleTradeScore, audit: cloneAudit(entryAudit) });
      if (decision.stopLossPrice && decision.takeProfitPrice) {
        this.portfolio.setProtection(normalized, decision.stopLossPrice, decision.takeProfitPrice, fill.timestamp);
      }
      this.ledger.append('ORDER_FILLED', { ...fill });
      this.ledger.append('POSITION_UPDATED', { market: normalized, position: this.portfolio.getPosition(normalized) });
    } else if (decision.action === 'EXIT' && decision.side === 'SELL' && position) {
      const orderId = `paper-${Date.now()}-${normalized}-sell`;
      this.ledger.append('ORDER_SUBMITTED', { orderId, market: normalized, side: 'SELL', quantity: position.quantity });
      fill = this.broker.executeMarketOrder({
        id: orderId,
        market: normalized,
        side: 'SELL',
        quantity: position.quantity,
        referencePrice: liquidity.tradePrice,
        timestamp: Date.now(),
        strategyVersion: TRADING_STRATEGY_VERSION,
      });

      const entry = this.entryMetadata.get(normalized);
      const costBasis = position.averageCost * fill.quantity;
      const entryFee = entry?.fill.fee ?? Math.max(0, (position.averageCost - position.entryPrice) * fill.quantity);
      const grossPnl = (fill.fillPrice - position.entryPrice) * fill.quantity;
      const netPnl = fill.notional - fill.fee - costBasis;
      closedTrade = {
        id: `trade-${normalized}-${position.openedAt}-${fill.timestamp}`,
        market: normalized,
        openedAt: position.openedAt,
        closedAt: fill.timestamp,
        entryPrice: position.entryPrice,
        exitPrice: fill.fillPrice,
        quantity: fill.quantity,
        grossPnl,
        fees: entryFee + fill.fee,
        netPnl,
        returnPct: costBasis > 0 ? netPnl / costBasis : 0,
        exitReason: decision.reasons[0] ?? 'Exit policy triggered.',
        strategyVersion: TRADING_STRATEGY_VERSION,
        entryOracleTradeScore: entry?.oracleTradeScore ?? 50,
        exitOracleTradeScore: multiTimeframe.oracleTradeScore,
        entryAudit: cloneAudit(entry?.audit),
      };

      this.portfolio.applyFill(fill);
      this.entryMetadata.delete(normalized);
      this.closedTrades.push(closedTrade);
      if (this.closedTrades.length > 5_000) this.closedTrades.splice(0, this.closedTrades.length - 5_000);
      this.ledger.append('ORDER_FILLED', { ...fill });
      this.ledger.append('POSITION_UPDATED', { market: normalized, position: null, closedTrade });
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
      decision,
      tradeMap,
      fill,
      closedTrade,
      portfolio: after,
      performance,
      ledgerTail: this.ledger.snapshot().slice(-8),
    };
  }
}

export const paperTradingSession = new PaperTradingSession();
