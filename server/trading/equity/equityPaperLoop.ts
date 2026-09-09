import { getAssetDecisionPolicy } from '../../../src/trading/assetPolicy';
import { buildEquityIntradayTiming, type EquityIntradayTimingSnapshot } from '../../../src/trading/equityIntradayTiming';
import { buildEvidenceCoverageRequest, evidenceSupportsNewLongRisk } from '../../../src/trading/evidenceCoverage';
import { buildPositionSizingDecision } from '../../../src/trading/positionSizing';
import { buildProtectionPlan } from '../../../src/trading/protectionPlan';
import { buildDynamicProtectionUpdate } from '../../../src/trading/protectionManager';
import { evaluateRisk } from '../../../src/trading/risk';
import { buildTradingSnapshot } from '../../../src/trading/snapshot';
import { buildVolumeAbsorptionSnapshot, type VolumeAbsorptionSnapshot } from '../../../src/trading/volumeAbsorption';
import { buildWaveTheorySnapshot } from '../../../src/trading/waveTheory';
import type { EvidenceAggregate } from '../../../src/trading/evidence';
import type { Candle, TradingSnapshot } from '../../../src/trading/types';
import { evidenceCoverageRequestStore } from '../evidenceCoverageQueue';
import { tradingEvidenceStore } from '../evidenceStore';
import { paperTradingSession } from '../paperSession';
import { createKisDomesticStockMarketDataFromEnv, type KisDomesticStockMarketData, type KisRankedStock } from './kisMarketData';

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
  intradayAction: EquityIntradayTimingSnapshot['action'] | null;
  intradayScore: number | null;
  relativeVolume: number | null;
  priceVsVwapPct: number | null;
  volumeAbsorptionScore: number | null;
  volumeAbsorptionDirection: VolumeAbsorptionSnapshot['direction'] | null;
  currentVsReferenceVolume: number | null;
  absorptionCandidate: boolean | null;
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
  intradayAction: null,
  intradayScore: null,
  relativeVolume: null,
  priceVsVwapPct: null,
  volumeAbsorptionScore: null,
  volumeAbsorptionDirection: null,
  currentVsReferenceVolume: null,
  absorptionCandidate: null,
  evidenceIds: evidence.evidenceIds.slice(),
  coverageRequestKey: null,
  reasons: [],
});

const technicalComposite = (snapshot: TradingSnapshot, waveScore: number) => {
  const boundedWave = Math.max(-100, Math.min(100, waveScore));
  return snapshot.fusion.directionalScore * 0.88 + boundedWave * 0.12;
};

const combinedEquityDirectional = (technical: number, evidence: EvidenceAggregate) => {
  const policy = getAssetDecisionPolicy('KRX-000000');
  return technical * policy.technicalWeight + evidence.score * policy.evidenceWeight;
};

const score100 = (directional: number) => Math.round(Math.max(0, Math.min(100, (directional + 100) / 2)));

const dailyTechnicalCandidate = (snapshot: TradingSnapshot) => snapshot.fusion.action === 'BUY'
  && snapshot.trend.directionalScore > 0
  && snapshot.technicalEvidence != null
  && snapshot.technicalEvidence.bullishFamilies > snapshot.technicalEvidence.bearishFamilies;

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
    strategyId: 'BO-EQUITY-EVIDENCE-SWING-v0.2',
    reason,
  });
  await evidenceCoverageRequestStore.enqueue(request);
  return request.requestKey;
};

const attachTiming = (
  result: EquityPaperDecision,
  timing: EquityIntradayTimingSnapshot,
  absorption: VolumeAbsorptionSnapshot,
) => {
  result.intradayAction = timing.action;
  result.intradayScore = timing.score;
  result.relativeVolume = timing.relativeVolume;
  result.priceVsVwapPct = timing.priceVsVwapPct;
  result.volumeAbsorptionScore = absorption.score;
  result.volumeAbsorptionDirection = absorption.direction;
  result.currentVsReferenceVolume = absorption.currentVsReferenceVolume;
  result.absorptionCandidate = absorption.absorptionCandidate;
  result.reasons.push(...absorption.reasons.slice(-3), ...timing.reasons.slice(-4));
};

const loadIntradayTiming = async (
  marketData: KisDomesticStockMarketData,
  symbol: string,
  dailyCandles: Candle[],
) => {
  const minuteCandles = await marketData.minuteCandles(symbol, 120);
  const absorption = buildVolumeAbsorptionSnapshot(dailyCandles, minuteCandles);
  const timing = buildEquityIntradayTiming(minuteCandles, absorption);
  return { minuteCandles, absorption, timing };
};

const reviewOpenPosition = async (
  stock: KisRankedStock,
  snapshot: TradingSnapshot,
  waveScore: number,
  evidence: EvidenceAggregate,
  marketData: KisDomesticStockMarketData,
  dailyCandles: Candle[],
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

  // Hard protection always executes before any discretionary intraday timing check.
  if (position.stopLossPrice != null && stock.price <= position.stopLossPrice) {
    paperTradingSession.executeApprovedExternalExit({
      market,
      referencePrice: stock.price,
      oracleTradeScore: result.oracleTradeScore,
      riskApproved: true,
      reason: `KRX protective stop breached at ${stock.price}; exits are never blocked by Evidence or timing.`,
    });
    result.action = 'EXIT';
    result.reasons.push('Protective stop was breached; full Paper exit executed immediately.');
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

  const { absorption, timing } = await loadIntradayTiming(marketData, stock.symbol, dailyCandles);
  attachTiming(result, timing, absorption);

  // Non-protective exits require both daily deterioration and minute-volume weakness.
  const dailyDeteriorated = snapshot.fusion.action === 'SELL' || technical <= -20;
  if (dailyDeteriorated && timing.action === 'EXIT_WEAKNESS') {
    paperTradingSession.executeApprovedExternalExit({
      market,
      referencePrice: stock.price,
      oracleTradeScore: result.oracleTradeScore,
      riskApproved: true,
      reason: 'Daily structure deteriorated and minute-volume timing confirmed weakness below VWAP.',
    });
    result.action = 'EXIT';
    result.reasons.push('Discretionary exit confirmed by both daily deterioration and high-volume intraday weakness.');
    return result;
  }

  result.reasons.push('Open KRX Paper position remains inside protection; minute-volume timing does not confirm a discretionary exit.');
  return result;
};

const evaluateFlatCandidate = async (
  stock: KisRankedStock,
  snapshot: TradingSnapshot,
  waveScore: number,
  evidence: EvidenceAggregate,
  marketData: KisDomesticStockMarketData,
  dailyCandles: Candle[],
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

  // Stage 1: daily chart selects direction/candidate. Minute data never rescues a bad daily setup.
  if (!dailyTechnicalCandidate(snapshot)) {
    result.reasons.push('Daily technical stack did not produce a sufficiently coherent BUY candidate; intraday timing was not queried.');
    return result;
  }
  result.reasons.push('Daily chart passed the directional/candidate selection gate.');

  // Stage 2: equities remain Evidence-first.
  const evidenceSupport = evidenceSupportsNewLongRisk(evidence);
  if (evidence.activeCount === 0) {
    result.coverageRequestKey = await requestEvidence(
      stock,
      `KRX ${stock.name} passed the daily BUY-selection gate but has no active source-backed Evidence. Acquire DART/company/material-news Evidence, analyze it in NARS, then re-evaluate from a fresh daily and intraday snapshot.`,
    );
    result.action = 'EVIDENCE_REQUESTED';
    result.reasons.push('Equity policy requires source-backed Evidence before new risk; NARS coverage request queued.');
    return result;
  }

  if (!evidenceSupport.allowed) {
    result.reasons.push(evidenceSupport.reason);
    result.reasons.push('Existing Evidence does not support a new long; intraday price action cannot override materially opposed Evidence.');
    return result;
  }

  const state = paperTradingSession.state();
  const openEquities = state.portfolio.positions.filter((position) => /^KRX-\d{6}$/.test(position.market));
  if (openEquities.length >= MAX_OPEN_EQUITY_POSITIONS) {
    result.reasons.push(`Equity position capacity ${MAX_OPEN_EQUITY_POSITIONS} is already full.`);
    return result;
  }

  // Stage 3: minute chart + volume decides whether now is a good execution time.
  const { absorption, timing } = await loadIntradayTiming(marketData, stock.symbol, dailyCandles);
  attachTiming(result, timing, absorption);
  if (timing.action !== 'ENTER_NOW') {
    result.reasons.push('Daily thesis and Evidence may remain valid, but minute-volume timing says WAIT rather than chase the entry.');
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
    reason: `KRX entry: daily BUY selection + source-backed Evidence + minute/volume timing ${timing.action} (RVOL ${(timing.relativeVolume ?? 0).toFixed(2)}x).`,
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
          const dailyCandles = await marketData.dailyCandles(stock.symbol, 240);
          if (dailyCandles.length < 200) throw new Error(`Insufficient daily history (${dailyCandles.length}) for ${stock.symbol}.`);
          const snapshot = buildTradingSnapshot(dailyCandles, evidence.activeCount > 0 ? evidence.score : undefined);
          const wave = buildWaveTheorySnapshot(dailyCandles);
          const position = paperTradingSession.getPosition(market);
          const decision = position
            ? await reviewOpenPosition(current, snapshot, wave.score, evidence, marketData, dailyCandles)
            : await evaluateFlatCandidate(current, snapshot, wave.score, evidence, marketData, dailyCandles);
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
