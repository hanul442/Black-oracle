import { TRADING_STRATEGY_VERSION } from '../../src/trading/config';
import { buildExecutionDecision } from '../../src/trading/executionPolicy';
import { TradingLedger } from '../../src/trading/ledger';
import { PaperBroker } from '../../src/trading/paperBroker';
import { PaperPortfolio } from '../../src/trading/paperPortfolio';
import type { PaperFill } from '../../src/trading/types';
import { buildMarketMultiTimeframe } from './multiTimeframe';
import { getMarketLiquidity } from './universe';

export class PaperTradingSession {
  private portfolio: PaperPortfolio;
  private broker: PaperBroker;
  private ledger: TradingLedger;
  private readonly markPrices = new Map<string, number>();

  constructor(initialCash = 1_000_000) {
    this.portfolio = new PaperPortfolio(initialCash);
    this.broker = new PaperBroker({ feeBps: 5, slippageBps: 8 });
    this.ledger = new TradingLedger();
  }

  reset(initialCash = 1_000_000) {
    this.portfolio = new PaperPortfolio(initialCash);
    this.broker = new PaperBroker({ feeBps: 5, slippageBps: 8 });
    this.ledger = new TradingLedger();
    this.markPrices.clear();
    return this.state();
  }

  state() {
    return {
      mode: 'PAPER' as const,
      strategyVersion: TRADING_STRATEGY_VERSION,
      portfolio: this.portfolio.snapshot(Object.fromEntries(this.markPrices)),
      ledger: this.ledger.snapshot(),
    };
  }

  async step(market: string, eventScore?: number) {
    const normalized = market.toUpperCase();
    const [liquidity, multiTimeframe] = await Promise.all([
      getMarketLiquidity(normalized),
      buildMarketMultiTimeframe(normalized, eventScore),
    ]);
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
    });

    this.ledger.append('MARKET_SNAPSHOT', {
      market: normalized,
      price: liquidity.tradePrice,
      liquidityScore: liquidity.score,
      multiTimeframeScore: multiTimeframe.oracleTradeScore,
    });
    this.ledger.append('SIGNAL', {
      market: normalized,
      action: decision.action,
      side: decision.side,
      directionalScore: multiTimeframe.directionalScore,
      confidence: decision.confidence,
    });

    let fill: PaperFill | null = null;
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
      this.portfolio.applyFill(fill);
      this.ledger.append('ORDER_FILLED', { ...fill });
      this.ledger.append('POSITION_UPDATED', { market: normalized, position: null });
    }

    const after = this.portfolio.snapshot(Object.fromEntries(this.markPrices), Date.now());
    return {
      success: true,
      mode: 'PAPER' as const,
      strategyVersion: TRADING_STRATEGY_VERSION,
      liquidity,
      multiTimeframe,
      decision,
      fill,
      portfolio: after,
      ledgerTail: this.ledger.snapshot().slice(-8),
    };
  }
}

export const paperTradingSession = new PaperTradingSession();
