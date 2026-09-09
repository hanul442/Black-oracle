import { getAssetDecisionPolicy } from '../../../src/trading/assetPolicy';
import { buildEvidenceCoverageRequest, evidenceSupportsNewLongRisk } from '../../../src/trading/evidenceCoverage';
import { buildPositionSizingDecision } from '../../../src/trading/positionSizing';
import { buildProtectionPlan } from '../../../src/trading/protectionPlan';
import { buildDynamicProtectionUpdate } from '../../../src/trading/protectionManager';
import { evaluateRisk } from '../../../src/trading/risk';
import { buildTradingSnapshot } from '../../../src/trading/snapshot';
import { buildWaveTheorySnapshot } from '../../../src/trading/waveTheory';
import type { EvidenceAggregate, TradingEvidence } from '../../../src/trading/evidence';
import type { TradingSnapshot } from '../../../src/trading/types';
import { evidenceCoverageRequestStore } from '../evidenceCoverageQueue';
import { tradingEvidenceStore } from '../evidenceStore';
import { paperTradingSession } from '../paperSession';
import { createKisDomesticStockMarketDataFromEnv, type KisRankedStock } from './kisMarketData';

export type EquityPaperAction = 'ENTER' | 'EXIT' | 'PARTIAL_EXIT' | 'HOLD' | 'NO_TRADE' | 'EVIDENCE_REQUESTED' | 'ERROR';

export interface EquityPaperDecision {
  market: string;
  symbol: string;
  name: string;
  action: EquityPaperAction;
  price: number;
  technicalScore: number | null;
  technicalAction: 'BUY' | 'SELL' | 'WAIT' | null;
  evidenceScore: number;
  evidenceConfidence: number;
  evidenceCount: number;
  waveScore: number | null;
  wavePhase: string | null;
  combinedDirectionalScore: number | null;
  oracleTradeScore: number | null;
  evidenceIds: string[];
  coverageRequestKey: string | null;
  reasons: string[];
}

export interface EquityPaperCycleResult {
  startedAt: number;
  finishedAt: number;
  sessionOpen: boolean;
  universeCount: number;
  scanned: number;
  entered: number;
  exited: number;
  partialExited: number;
  evidenceRequested: number;
  errors: number;
  decisions: EquityPaperDecision[];
}

const MAX_CANDIDATES = 6;
const MAX_OPEN_EQUITY_POSITIONS = 4;
const KST_OFFSET_MS = 9 * 60 * 60_000;

const isKrxSessionOpen = (now = Date.now()) => {
  const kst = new Date(now + KST_OFFSET_MS);
  const weekday = kst.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return minutes >= 9 * 60 && minutes <= 15 * 60 + 30;
};

const evidenceFor = (market: string): EvidenceAggregate => tradingEvidenceStore.aggregate(market);

const decisionBase = (
  stock: Pick<KisRankedStock, 'symbol' | 'name' | 'price'>,
  action: EquityPaperAction,
  evidence: EvidenceAggregate,
): EquityPaperDecision => ({
  market: `KRX-${stock.symbol}`,
  symbol: stock.symbol,
  name: stock.name,
  action,
  price: stock.price,
  technicalScore: null,
  technicalAction: null,
  evidenceScore: evidence.score,
  evidenceConfidence: evidence.confidence,
  evidenceCount: evidence.activeCount,
  waveScore: null,
  wavePhase: null,
  combinedDirectionalScore: null,
  oracleTradeScore: null,
  evidenceIds: evidence.evidenceIds.slice(),
  coverageRequestKey: null,
  reasons: [],
});

const technicalComposite = (snapshot: TradingSnapshot, waveScore: number) => {
  // Wave structure remains a bounded challenger rather than overpowering the existing technical stack.
  const boundedWave = Math.max(-100, Math.min(100, waveScore));
  return snapshot.fusion.directionalScore * 0.88 + boundedWave * 0.12;
};

const combinedEquityDirectional = (technical: number, evidence: EvidenceAggregate) => {
  const policy = getAssetDecisionPolicy('KRX-000000');
  return technical * policy.technicalWeight + evidence.score * policy.evidenceWeight;
};

const score100 = (directional: number) => Math.round(Math.max(0, Math.min(100, (directional + 100) / 2)));

const coverageAliases = (stock: Pick<KisRankedStock, 'symbol' | 'name'>) => [
  stock.name,
  stock.symbol,
  `KRX-${stock.symbol}`,
  `${stock.name} ${stock.symbol}`,
];

const requestEvidence = async (stock: Pick<KisRankedStock, 'symbol' | 'name'>, reason: string) => {
  const market = `KRX-${stock.symbol}`;
  const request = buildEvidenceCoverageRequest(market, Date.now(), {
    trigger: 'ENTRY_CANDIDATE',
    aliases: coverageAliases(stock),
    assetClass: 'EQUITY',
    strategyId: 'BO-EQUITY-EVIDENCE-SWING-v0.1',
    reason,
  });
  await evidenceCoverageRequestStore.enqueue(request);
  return request.requestKey;
};

const buildSnapshot = async (stock: KisRankedStock, evidence: EvidenceAggregate) => {
  const marketData = createKisDomesticStockMarketDataFromEnv();
  const candles = await marketData.dailyCandles(stock.symbol, 240);
  if (candles.length < 200) throw new Error(`Insufficient daily history (${candles.length}) for ${stock.symbol}.`);
  const snapshot = buildTradingSnapshot(candles, evidence.activeCount > 0 ? evidence.score : undefined);
  const wave = buildWaveTheorySnapshot(candles);
  return { snapshot, wave };
};

const reviewOpenPosition = async (
  stock: KisRankedStock,
  snapshot: TradingSnapshot,
  waveScore: number,
  evidence: EvidenceAggregate,
): Promise<EquityPaperDecision> => {
  const market = `KRX-${stock.symbol}`;
  const position = paperTradingSession.getPosition(market);
  const result = decisionBase(stock, 'HOLD', evidence);
  const technical = technicalComposite(snapshot, waveScore);
  result.technicalScore = technical;
  result.technicalAction = snapshot.fusion.action;
  result.waveScore = waveScore;
  result.combinedDirectionalScore = combinedEquityDirectional(technical, evidence);
  result.oracleTradeScore = score100(result.combinedDirectionalScore);
  if (!position) return result;

  paperTradingSession.markExternalPrice(market, stock.price);

  if (position.stopLossPrice != null && stock.price <= position.stopLossPrice) {
    paperTradingSession.executeApprovedExternalExit({
      market,
      referencePrice: stock.price,
      oracleTradeScore: result.oracleTradeScore,
      riskApproved: true,
      reason: `KRX protective stop breached at ${stock.price}; exits are never blocked by missing evidence.`,
    });
    result.action = 'EXIT';
    result.reasons.push('Protective stop was breached; full Paper exit executed.');
    return result;
  }

  if (position.takeProfit1Price != null && !position.takeProfit1Taken && stock.price >= position.takeProfit1Price) {
    const initialQuantity = position.initialQuantity ?? position.quantity;
    const targetQty = initialQuantity * (position.takeProfit1Fraction ?? 0.4);
    const quantity = Math.min(position.quantity, Math.max(0, targetQty));
    if (quantity > 0 && quantity < position.quantity) {
      paperTradingSession.executeApprovedExternalExit({
        market,
        referencePrice: stock.price,
        oracleTradeScore: result.oracleTradeScore,
        quantity,
        riskApproved: true,
        markTakeProfit1: true,
        reason: 'KRX TP1 reached; partial profit realized and runner retained.',
      });
      result.action = 'PARTIAL_EXIT';
      result.reasons.push('TP1 reached; partial Paper exit executed and remaining stop moved toward breakeven.');
      return result;
    }
  }

  if (position.takeProfit2Price != null && stock.price >= position.takeProfit2Price) {
    paperTradingSession.executeApprovedExternalExit({
      market,
      referencePrice: stock.price,
      oracleTradeScore: result.oracleTradeScore,
      riskApproved: true,
      reason: 'KRX TP2 reached; runner fully realized.',
    });
    result.action = 'EXIT';
    result.reasons.push('TP2 reached; full Paper exit executed.');
    return result;
  }

  if (position.stopLossPrice != null) {
    const update = buildDynamicProtectionUpdate(position, snapshot, stock.price);
    if (update.changed) {
      paperTradingSession.applyExternalDynamicProtection(update, snapshot.asOf);
      result.reasons.push(...update.reasons);
    }
  }

  if (snapshot.fusion.action === 'SELL' && snapshot.fusion.directionalScore <= -25) {
    paperTradingSession.executeApprovedExternalExit({
      market,
      referencePrice: stock.price,
      oracleTradeScore: result.oracleTradeScore,
      riskApproved: true,
      reason: 'Daily technical structure reversed to SELL; risk-reduction exit executed.',
    });
    result.action = 'EXIT';
    result.reasons.push('Daily technical structure reversed bearish; full Paper exit executed.');
    return result;
  }

  result.reasons.push('Open KRX Paper position remains inside dynamic protection and exit rules.');
  return result;
};

const evaluateFlatCandidate = async (
  stock: KisRankedStock,
  snapshot: TradingSnapshot,
  waveScore: number,
  evidence: EvidenceAggregate,
): Promise<EquityPaperDecision> => {
  const market = `KRX-${stock.symbol}`;
  const technical = technicalComposite(snapshot, waveScore);
  const combined = combinedEquityDirectional(technical, evidence);
  const result = decisionBase(stock, 'NO_TRADE', evidence);
  result.technicalScore = technical;
  result.technicalAction = snapshot.fusion.action;
  result.waveScore = waveScore;
  result.combinedDirectionalScore = combined;
  result.oracleTradeScore = score100(combined);

  const technicalCandidate = snapshot.fusion.action === 'BUY'
    && snapshot.trend.directionalScore > 0
    && snapshot.technicalEvidence != null
    && snapshot.technicalEvidence.bullishFamilies > snapshot.technicalEvidence.bearishFamilies;

  if (!technicalCandidate) {
    result.reasons.push('Daily technical stack did not produce a sufficiently coherent BUY candidate.');
    return result;
  }

  const evidenceSupport = evidenceSupportsNewLongRisk(evidence);
  if (evidence.activeCount === 0) {
    result.coverageRequestKey = await requestEvidence(
      stock,
      `KRX ${stock.name} produced a technical BUY candidate but has no active source-backed Evidence. Acquire DART/company/material-news evidence, analyze it in NARS, then re-evaluate from a fresh market snapshot.`,
    );
    result.action = 'EVIDENCE_REQUESTED';
    result.reasons.push('Technical BUY candidate found, but Equity policy requires source-backed Evidence before new risk.');
    return result;
  }

  if (!evidenceSupport.allowed) {
    result.reasons.push(evidenceSupport.reason);
    result.reasons.push('Existing Evidence does not support a new long; do not search for confirmation merely to justify the trade.');
    return result;
  }

  const state = paperTradingSession.state();
  const openEquities = state.portfolio.positions.filter((position) => /^KRX-\d{6}$/.test(position.market));
  if (openEquities.length >= MAX_OPEN_EQUITY_POSITIONS) {
    result.reasons.push(`Equity position capacity ${MAX_OPEN_EQUITY_POSITIONS} is already full.`);
    return result;
  }

  const protection = buildProtectionPlan(snapshot, stock.price);
  const sizing = buildPositionSizingDecision({
    equity: state.portfolio.equity,
    cash: state.portfolio.cash,
    stopDistancePct: protection.stopDistancePct,
  });
  const risk = evaluateRisk({
    equity: state.portfolio.equity,
    requestedNotional: sizing.requestedNotional,
    dailyPnlPct: state.portfolio.dailyPnlPct,
    totalDrawdownPct: state.portfolio.drawdownPct,
    estimatedSlippageBps: 15,
    marketDataAgeMs: 0,
    feedConnected: true,
    ledgerInSync: true,
    duplicateOrderDetected: false,
  });
  if (risk.status !== 'PASS') {
    result.reasons.push(...risk.reasons);
    return result;
  }

  paperTradingSession.executeApprovedExternalEntry({
    market,
    referencePrice: stock.price,
    notional: risk.approvedNotional,
    oracleTradeScore: result.oracleTradeScore,
    stopLossPrice: protection.stopLossPrice,
    takeProfit1Price: protection.takeProfit1Price,
    takeProfit2Price: protection.takeProfit2Price,
    takeProfit1Fraction: protection.takeProfit1Fraction,
    protectionBasis: protection.basis,
    riskApproved: true,
    reason: `KRX Evidence-first swing entry: technical BUY + source-backed Evidence support (${evidence.score}, ${(evidence.confidence * 100).toFixed(0)}%).`,
  });
  result.action = 'ENTER';
  result.reasons.push(...protection.reasons, ...sizing.reasons, evidenceSupport.reason);
  return result;
};

export class EquityPaperLoop {
  private lastCycle: EquityPaperCycleResult | null = null;
  private running = false;

  status() {
    return { running: this.running, lastCycle: this.lastCycle };
  }

  async runCycle(limit = MAX_CANDIDATES): Promise<EquityPaperCycleResult> {
    if (this.running) throw new Error('An Equity Paper cycle is already in progress.');
    this.running = true;
    const startedAt = Date.now();
    const sessionOpen = isKrxSessionOpen(startedAt);
    const cycle: EquityPaperCycleResult = {
      startedAt,
      finishedAt: startedAt,
      sessionOpen,
      universeCount: 0,
      scanned: 0,
      entered: 0,
      exited: 0,
      partialExited: 0,
      evidenceRequested: 0,
      errors: 0,
      decisions: [],
    };

    try {
      if (!sessionOpen) {
        cycle.finishedAt = Date.now();
        this.lastCycle = cycle;
        return cycle;
      }

      const marketData = createKisDomesticStockMarketDataFromEnv();
      const ranked = await marketData.volumeRank(Math.max(limit, MAX_CANDIDATES));
      cycle.universeCount = ranked.length;
      const byMarket = new Map(ranked.map((item) => [`KRX-${item.symbol}`, item]));
      const openEquities = paperTradingSession.state().portfolio.positions.filter((position) => /^KRX-\d{6}$/.test(position.market));
      const openFallback: KisRankedStock[] = openEquities
        .filter((position) => !byMarket.has(position.market))
        .map((position) => ({
          symbol: position.market.replace('KRX-', ''),
          name: position.market,
          price: position.markPrice,
          volume: 0,
          turnoverKrw: 0,
          changeRate: null,
          rank: 999,
          marketName: null,
        }));
      const candidates = [...openFallback, ...ranked.slice(0, Math.max(1, Math.min(12, limit)))];
      const seen = new Set<string>();

      for (const stock of candidates) {
        const market = `KRX-${stock.symbol}`;
        if (seen.has(market)) continue;
        seen.add(market);
        try {
          const quote = await marketData.quote(stock.symbol);
          const current: KisRankedStock = { ...stock, price: quote.price, volume: quote.volume ?? stock.volume, changeRate: quote.changeRate };
          const evidence = evidenceFor(market);
          const candles = await marketData.dailyCandles(stock.symbol, 240);
          if (candles.length < 200) throw new Error(`Insufficient daily history (${candles.length}) for ${stock.symbol}.`);
          const snapshot = buildTradingSnapshot(candles, evidence.activeCount > 0 ? evidence.score : undefined);
          const wave = buildWaveTheorySnapshot(candles);
          const position = paperTradingSession.getPosition(market);
          const decision = position
            ? await reviewOpenPosition(current, snapshot, wave.score, evidence)
            : await evaluateFlatCandidate(current, snapshot, wave.score, evidence);
          decision.wavePhase = wave.phase;
          decision.reasons.push(...wave.reasons.slice(0, 3));
          cycle.decisions.push(decision);
          cycle.scanned += 1;
          if (decision.action === 'ENTER') cycle.entered += 1;
          if (decision.action === 'EXIT') cycle.exited += 1;
          if (decision.action === 'PARTIAL_EXIT') cycle.partialExited += 1;
          if (decision.action === 'EVIDENCE_REQUESTED') cycle.evidenceRequested += 1;
        } catch (error) {
          const evidence = evidenceFor(market);
          const failed = decisionBase(stock, 'ERROR', evidence);
          failed.reasons.push(error instanceof Error ? error.message : 'Unknown Equity Paper error.');
          cycle.decisions.push(failed);
          cycle.errors += 1;
        }
      }

      cycle.finishedAt = Date.now();
      this.lastCycle = cycle;
      return cycle;
    } finally {
      this.running = false;
    }
  }
}

export const equityPaperLoop = new EquityPaperLoop();
