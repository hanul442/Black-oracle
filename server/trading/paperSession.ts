import { TRADING_STRATEGY_VERSION } from '../../src/trading/config';
import { buildExecutionDecision, type ExecutionPolicyInput } from '../../src/trading/executionPolicy';
import type { GovernedTradingIntelligencePackage } from '../../src/trading/governanceCore';
import type { FinalDecision } from '../../src/trading/intelligencePipeline';
import { TradingLedger } from '../../src/trading/ledger';
import { PaperBroker } from '../../src/trading/paperBroker';
import { PaperPortfolio, type PaperPortfolioState } from '../../src/trading/paperPortfolio';
import { buildPaperPerformance, type ClosedPaperTrade } from '../../src/trading/performance';
import { buildIndependentPolicyShadow } from '../../src/trading/strategyIntent';
import { buildShadowTargetPipeline } from '../../src/trading/targetPipeline';
import type { ExecutionDecision, LiquiditySnapshot, MultiTimeframeSnapshot, PaperFill, TradingLedgerEvent } from '../../src/trading/types';
import { buildMarketMultiTimeframe } from './multiTimeframe';
import { getMarketLiquidity } from './universe';

interface EntryMetadata { fill: PaperFill; oracleTradeScore: number; }
export interface PaperTradingSessionCheckpoint { schemaVersion: 1; portfolio: PaperPortfolioState; markPrices: Array<[string, number]>; entryMetadata: Array<[string, EntryMetadata]>; closedTrades: ClosedPaperTrade[]; ledger: TradingLedgerEvent[]; processedOrderIds: string[]; }
export interface PaperGovernanceContext { market: string; liquidity: LiquiditySnapshot; multiTimeframe: MultiTimeframeSnapshot; executionDecision: ExecutionDecision; hasOpenPositionBefore: boolean; }
export interface PaperGovernanceEvaluation { intelligence: GovernedTradingIntelligencePackage; finalDecision: FinalDecision; }
export type PaperGovernanceEvaluator = (context: PaperGovernanceContext) => PaperGovernanceEvaluation | Promise<PaperGovernanceEvaluation>;

const governanceVetoDecision = (baseDecision: ExecutionDecision, reasons: string[]): ExecutionDecision => ({
  action: 'HOLD', side: null, notional: 0, quantity: 0, confidence: baseDecision.confidence, stopLossPrice: null, takeProfitPrice: null,
  riskDisposition: baseDecision.riskDisposition, riskReasons: baseDecision.riskReasons.slice(), reasons: [...baseDecision.reasons, ...reasons],
});

export class PaperTradingSession {
  private portfolio: PaperPortfolio;
  private broker: PaperBroker;
  private ledger: TradingLedger;
  private readonly markPrices = new Map<string, number>();
  private readonly entryMetadata = new Map<string, EntryMetadata>();
  private readonly closedTrades: ClosedPaperTrade[] = [];

  constructor(initialCash = 1_000_000) { this.portfolio = new PaperPortfolio(initialCash); this.broker = new PaperBroker({ feeBps: 5, slippageBps: 8 }); this.ledger = new TradingLedger(); }

  checkpoint(): PaperTradingSessionCheckpoint {
    return {
      schemaVersion: 1, portfolio: this.portfolio.exportState(), markPrices: Array.from(this.markPrices.entries()),
      entryMetadata: Array.from(this.entryMetadata.entries()).map(([market, metadata]) => [market, { fill: { ...metadata.fill }, oracleTradeScore: metadata.oracleTradeScore }]),
      closedTrades: this.closedTrades.map((trade) => ({ ...trade })), ledger: this.ledger.snapshot().map((event) => ({ ...event, payload: { ...event.payload } })),
      processedOrderIds: this.broker.processedOrderIdsSnapshot(),
    };
  }

  restore(checkpoint: PaperTradingSessionCheckpoint) {
    if (!checkpoint || checkpoint.schemaVersion !== 1) throw new Error('Unsupported Paper session checkpoint schema.');
    this.portfolio = PaperPortfolio.restore(checkpoint.portfolio); this.broker = new PaperBroker({ feeBps: 5, slippageBps: 8 });
    this.broker.restoreProcessedOrderIds(checkpoint.processedOrderIds ?? []); this.ledger = TradingLedger.restore(checkpoint.ledger ?? []);
    this.markPrices.clear(); for (const [market, price] of checkpoint.markPrices ?? []) if (/^KRW-[A-Z0-9]+$/.test(market) && Number.isFinite(price) && price > 0) this.markPrices.set(market, price);
    this.entryMetadata.clear(); for (const [market, metadata] of checkpoint.entryMetadata ?? []) if (metadata?.fill && Number.isFinite(metadata.oracleTradeScore)) this.entryMetadata.set(market, { fill: { ...metadata.fill }, oracleTradeScore: metadata.oracleTradeScore });
    this.closedTrades.splice(0, this.closedTrades.length, ...(checkpoint.closedTrades ?? []).slice(-5_000).map((trade) => ({ ...trade })));
    return this.state();
  }

  reset(initialCash = 1_000_000) { this.portfolio = new PaperPortfolio(initialCash); this.broker = new PaperBroker({ feeBps: 5, slippageBps: 8 }); this.ledger = new TradingLedger(); this.markPrices.clear(); this.entryMetadata.clear(); this.closedTrades.splice(0, this.closedTrades.length); return this.state(); }
  performance(timestamp = Date.now()) { const portfolio = this.portfolio.snapshot(Object.fromEntries(this.markPrices), timestamp); return buildPaperPerformance(this.closedTrades, portfolio.equityCurve, portfolio.initialEquity, portfolio.equity, portfolio.drawdownPct); }
  state() { const portfolio = this.portfolio.snapshot(Object.fromEntries(this.markPrices)); return { mode: 'PAPER' as const, strategyVersion: TRADING_STRATEGY_VERSION, portfolio, performance: buildPaperPerformance(this.closedTrades, portfolio.equityCurve, portfolio.initialEquity, portfolio.equity, portfolio.drawdownPct), closedTrades: this.closedTrades.slice(-100), ledger: this.ledger.snapshot() }; }

  async step(market: string, eventScore?: number, precomputedLiquidity?: LiquiditySnapshot, newEntryAllowed = true, governanceEvaluator?: PaperGovernanceEvaluator, newEntryBlockReasons: string[] = []) {
    const normalized = market.toUpperCase();
    const [liquidity, multiTimeframe] = await Promise.all([precomputedLiquidity ? Promise.resolve(precomputedLiquidity) : getMarketLiquidity(normalized), buildMarketMultiTimeframe(normalized, eventScore)]);
    this.markPrices.set(normalized, liquidity.tradePrice);
    const before = this.portfolio.snapshot(Object.fromEntries(this.markPrices), multiTimeframe.asOf);
    const position = this.portfolio.getPosition(normalized);
    const executionPolicyInput: ExecutionPolicyInput = {
      liquidity, multiTimeframe, oneHour: multiTimeframe.frames.oneHour, portfolio: before, position,
      marketDataAgeMs: Math.max(0, Date.now() - multiTimeframe.asOf), newEntryAllowed, newEntryBlockReasons,
    };
    const baseDecision = buildExecutionDecision(executionPolicyInput);
    const independentPolicyShadow = buildIndependentPolicyShadow(executionPolicyInput, baseDecision);

    let governance: PaperGovernanceEvaluation | null = null; let governanceError: string | null = null;
    if (governanceEvaluator) {
      try { governance = await governanceEvaluator({ market: normalized, liquidity, multiTimeframe, executionDecision: baseDecision, hasOpenPositionBefore: Boolean(position) }); }
      catch (error) { governanceError = error instanceof Error ? error.message : 'Unknown governance evaluation error.'; }
    }
    let decision = baseDecision;
    if (baseDecision.action === 'ENTER') {
      if (governanceError) decision = governanceVetoDecision(baseDecision, [`Governance evaluation failed closed before entry: ${governanceError}`]);
      else if (governance?.finalDecision.action !== 'ENTER') decision = governanceVetoDecision(baseDecision, governance?.finalDecision.reasons ?? ['Governance evaluation was unavailable; new entry failed closed.']);
    }

    // Sprint 7 bridge: the legacy decision remains authoritative. The independent
    // pre-risk intent seam and post-governance target pipeline are both observation-only.
    // Neither parity report can create, cancel, resize or promote an order.
    const targetPipeline = buildShadowTargetPipeline({
      market: normalized,
      strategyVersion: TRADING_STRATEGY_VERSION,
      generatedAt: Date.now(),
      referencePrice: liquidity.tradePrice,
      portfolio: before,
      decision,
    });
    const portfolioTarget = targetPipeline.target;

    this.ledger.append('MARKET_SNAPSHOT', { market: normalized, price: liquidity.tradePrice, liquidityScore: liquidity.score, multiTimeframeScore: multiTimeframe.oracleTradeScore, eventScore: eventScore ?? null });
    this.ledger.append('SIGNAL', {
      market: normalized, baseAction: baseDecision.action, action: decision.action, side: decision.side, directionalScore: multiTimeframe.directionalScore,
      oracleTradeScore: multiTimeframe.oracleTradeScore, confidence: decision.confidence, governanceMode: governance?.finalDecision.mode ?? (governanceEvaluator ? 'ENFORCE' : null),
      governancePolicy: governance?.finalDecision.policy ?? null, intelligenceDisposition: governance?.finalDecision.intelligenceDisposition ?? null,
      intelligencePackageId: governance?.intelligence.id ?? null, scenarioSetId: governance?.intelligence.scenarios.id ?? null, councilRunId: governance?.intelligence.council.id ?? null,
      portfolioEntryBlockReasons: newEntryAllowed ? [] : newEntryBlockReasons, governanceError,
      independentStrategyIntent: {
        id: independentPolicyShadow.intent.id,
        action: independentPolicyShadow.intent.action,
        gate: independentPolicyShadow.intent.gate,
        requestedNotional: independentPolicyShadow.intent.requestedNotional,
        executionAuthority: independentPolicyShadow.intent.executionAuthority,
      },
      independentPolicyParity: {
        id: independentPolicyShadow.parity.id,
        status: independentPolicyShadow.parity.status,
        actionParity: independentPolicyShadow.parity.actionParity,
        sideParity: independentPolicyShadow.parity.sideParity,
        notionalParity: independentPolicyShadow.parity.notionalParity,
        protectionParity: independentPolicyShadow.parity.protectionParity,
        riskDispositionParity: independentPolicyShadow.parity.riskDispositionParity,
        executionAuthority: independentPolicyShadow.parity.executionAuthority,
      },
      strategyIntent: {
        id: targetPipeline.intent.id,
        action: targetPipeline.intent.action,
        requestedNotional: targetPipeline.intent.requestedNotional,
        executionAuthority: targetPipeline.intent.executionAuthority,
      },
      portfolioTarget: {
        id: portfolioTarget.id,
        source: portfolioTarget.source,
        intent: portfolioTarget.intent,
        currentWeight: portfolioTarget.currentWeight,
        targetWeight: portfolioTarget.targetWeight,
        currentNotional: portfolioTarget.currentNotional,
        targetNotional: portfolioTarget.targetNotional,
        deltaNotional: portfolioTarget.deltaNotional,
        riskDisposition: portfolioTarget.riskDisposition,
        executionAuthority: portfolioTarget.executionAuthority,
      },
      riskAdjustedTarget: {
        id: targetPipeline.riskAdjustedTarget.id,
        approvedTargetNotional: targetPipeline.riskAdjustedTarget.approvedTargetNotional,
        approvedDeltaNotional: targetPipeline.riskAdjustedTarget.approvedDeltaNotional,
        riskDisposition: targetPipeline.riskAdjustedTarget.riskDisposition,
        executionAuthority: targetPipeline.riskAdjustedTarget.executionAuthority,
      },
      targetPipelineParity: {
        id: targetPipeline.parity.id,
        status: targetPipeline.parity.status,
        expectedDeltaNotional: targetPipeline.parity.expectedDeltaNotional,
        actualDeltaNotional: targetPipeline.parity.actualDeltaNotional,
        absoluteDifference: targetPipeline.parity.absoluteDifference,
        tolerance: targetPipeline.parity.tolerance,
        executionAuthority: targetPipeline.parity.executionAuthority,
      },
    });

    let fill: PaperFill | null = null; let closedTrade: ClosedPaperTrade | null = null;
    if (decision.action === 'ENTER' && decision.side === 'BUY') {
      const orderId = `paper-${Date.now()}-${normalized}-buy`; this.ledger.append('ORDER_SUBMITTED', { orderId, market: normalized, side: 'BUY', notional: decision.notional, independentPolicyParityId: independentPolicyShadow.parity.id, portfolioTargetId: portfolioTarget.id, targetPipelineParityId: targetPipeline.parity.id });
      fill = this.broker.executeMarketOrder({ id: orderId, market: normalized, side: 'BUY', notional: decision.notional, referencePrice: liquidity.tradePrice, timestamp: Date.now(), strategyVersion: TRADING_STRATEGY_VERSION });
      this.portfolio.applyFill(fill); this.entryMetadata.set(normalized, { fill, oracleTradeScore: multiTimeframe.oracleTradeScore });
      if (decision.stopLossPrice && decision.takeProfitPrice) this.portfolio.setProtection(normalized, decision.stopLossPrice, decision.takeProfitPrice, fill.timestamp);
      this.ledger.append('ORDER_FILLED', { ...fill }); this.ledger.append('POSITION_UPDATED', { market: normalized, position: this.portfolio.getPosition(normalized) });
    } else if (decision.action === 'EXIT' && decision.side === 'SELL' && position) {
      const orderId = `paper-${Date.now()}-${normalized}-sell`; this.ledger.append('ORDER_SUBMITTED', { orderId, market: normalized, side: 'SELL', quantity: position.quantity, independentPolicyParityId: independentPolicyShadow.parity.id, portfolioTargetId: portfolioTarget.id, targetPipelineParityId: targetPipeline.parity.id });
      fill = this.broker.executeMarketOrder({ id: orderId, market: normalized, side: 'SELL', quantity: position.quantity, referencePrice: liquidity.tradePrice, timestamp: Date.now(), strategyVersion: TRADING_STRATEGY_VERSION });
      const entry = this.entryMetadata.get(normalized); const costBasis = position.averageCost * fill.quantity; const entryFee = entry?.fill.fee ?? Math.max(0, (position.averageCost - position.entryPrice) * fill.quantity);
      const grossPnl = (fill.fillPrice - position.entryPrice) * fill.quantity; const netPnl = fill.notional - fill.fee - costBasis;
      closedTrade = { id: `trade-${normalized}-${position.openedAt}-${fill.timestamp}`, market: normalized, openedAt: position.openedAt, closedAt: fill.timestamp, entryPrice: position.entryPrice, exitPrice: fill.fillPrice, quantity: fill.quantity, grossPnl, fees: entryFee + fill.fee, netPnl, returnPct: costBasis > 0 ? netPnl / costBasis : 0, exitReason: decision.reasons[0] ?? 'Exit policy triggered.', strategyVersion: TRADING_STRATEGY_VERSION, entryOracleTradeScore: entry?.oracleTradeScore ?? 50, exitOracleTradeScore: multiTimeframe.oracleTradeScore };
      this.portfolio.applyFill(fill); this.entryMetadata.delete(normalized); this.closedTrades.push(closedTrade); if (this.closedTrades.length > 5_000) this.closedTrades.splice(0, this.closedTrades.length - 5_000);
      this.ledger.append('ORDER_FILLED', { ...fill }); this.ledger.append('POSITION_UPDATED', { market: normalized, position: null, closedTrade });
    }
    const after = this.portfolio.snapshot(Object.fromEntries(this.markPrices), Date.now()); const performance = buildPaperPerformance(this.closedTrades, after.equityCurve, after.initialEquity, after.equity, after.drawdownPct);
    return { success: true, mode: 'PAPER' as const, strategyVersion: TRADING_STRATEGY_VERSION, liquidity, multiTimeframe, eventScore: eventScore ?? null, baseDecision, independentPolicyShadow, decision, targetPipeline, portfolioTarget, governance, governanceError, fill, closedTrade, portfolio: after, performance, ledgerTail: this.ledger.snapshot().slice(-8) };
  }
}

export const paperTradingSession = new PaperTradingSession();
