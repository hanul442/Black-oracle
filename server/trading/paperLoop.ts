import { buildDecisionTrace, type DecisionTrace } from '../../src/trading/decisionTrace';
import type { LiquiditySnapshot } from '../../src/trading/types';
import { tradingEvidenceStore } from './evidenceStore';
import { paperTradingSession } from './paperSession';
import { buildMarketShadowResearch, buildPointInTimeRelativeStrengthContext } from './researchFeatures';
import { researchFeatureStore } from './researchStore';
import { buildKrwLiquidityUniverse, getMarketLiquidity } from './universe';

export interface PaperLoopConfig {
  intervalMs: number;
  maxMarkets: number;
  maxOpenPositions: number;
}

export interface PaperLoopCycleResult {
  startedAt: number;
  finishedAt: number;
  scanned: number;
  entered: number;
  exited: number;
  held: number;
  noTrade: number;
  errors: Array<{ market: string; error: string }>;
  researchErrors: Array<{ market: string; error: string }>;
  markets: Array<DecisionTrace & { decision: DecisionTrace['action'] }>;
}

export interface PaperLoopCheckpoint {
  schemaVersion: 1;
  running: boolean;
  config: PaperLoopConfig;
  cycleCount: number;
  lastCycle: PaperLoopCycleResult | null;
}

const DEFAULT_CONFIG: PaperLoopConfig = {
  intervalMs: 15 * 60 * 1000,
  maxMarkets: 6,
  maxOpenPositions: 4,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const cloneTrace = <T extends DecisionTrace & { decision: DecisionTrace['action'] }>(item: T): T => ({
  ...item,
  router: { ...item.router, reasons: item.router.reasons.slice() },
  forecast: { ...item.forecast, reasons: item.forecast.reasons.slice() },
  evidenceGate: item.evidenceGate ? {
    ...item.evidenceGate,
    evidenceIds: item.evidenceGate.evidenceIds.slice(),
    reasons: item.evidenceGate.reasons.slice(),
  } : null,
  evidenceIds: item.evidenceIds.slice(),
  technicalEvidence: item.technicalEvidence ? { ...item.technicalEvidence } : null,
  structure: item.structure ? { ...item.structure } : null,
  cycle: item.cycle ? { ...item.cycle, frames: { ...item.cycle.frames }, reasons: item.cycle.reasons.slice() } : null,
  microstructure: item.microstructure ? { ...item.microstructure } : null,
  challenger: item.challenger ? { ...item.challenger, reasons: item.challenger.reasons.slice() } : null,
  shadowResearch: item.shadowResearch ? structuredClone(item.shadowResearch) : null,
  tradeMap: item.tradeMap ? { ...item.tradeMap, reasons: item.tradeMap.reasons.slice() } : null,
  reasons: item.reasons.slice(),
  riskReasons: item.riskReasons.slice(),
});

const validateConfig = (config: PaperLoopConfig) => {
  if (!Number.isInteger(config.intervalMs) || config.intervalMs < 5 * 60 * 1000) {
    throw new Error('Paper loop intervalMs must be at least 300000 (5 minutes).');
  }
  if (!Number.isInteger(config.maxMarkets) || config.maxMarkets < 1 || config.maxMarkets > 12) {
    throw new Error('Paper loop maxMarkets must be an integer between 1 and 12.');
  }
  if (!Number.isInteger(config.maxOpenPositions) || config.maxOpenPositions < 1 || config.maxOpenPositions > 8) {
    throw new Error('Paper loop maxOpenPositions must be an integer between 1 and 8.');
  }
};

export class PaperLoopController {
  private timer: NodeJS.Timeout | null = null;
  private cycleInProgress = false;
  private config: PaperLoopConfig = { ...DEFAULT_CONFIG };
  private lastCycle: PaperLoopCycleResult | null = null;
  private cycleCount = 0;

  checkpoint(): PaperLoopCheckpoint {
    return {
      schemaVersion: 1,
      running: this.timer !== null,
      config: { ...this.config },
      cycleCount: this.cycleCount,
      lastCycle: this.lastCycle ? {
        ...this.lastCycle,
        errors: this.lastCycle.errors.map((item) => ({ ...item })),
        researchErrors: this.lastCycle.researchErrors.map((item) => ({ ...item })),
        markets: this.lastCycle.markets.map((item) => cloneTrace(item)),
      } : null,
    };
  }

  restore(checkpoint: PaperLoopCheckpoint, resume = false) {
    if (!checkpoint || checkpoint.schemaVersion !== 1) throw new Error('Unsupported Paper loop checkpoint schema.');
    validateConfig(checkpoint.config);
    this.stop();
    this.config = { ...checkpoint.config };
    this.cycleCount = Number.isInteger(checkpoint.cycleCount) && checkpoint.cycleCount >= 0 ? checkpoint.cycleCount : 0;
    this.lastCycle = checkpoint.lastCycle ? {
      ...checkpoint.lastCycle,
      noTrade: Number.isInteger(checkpoint.lastCycle.noTrade) ? checkpoint.lastCycle.noTrade : 0,
      errors: checkpoint.lastCycle.errors.map((item) => ({ ...item })),
      researchErrors: Array.isArray(checkpoint.lastCycle.researchErrors)
        ? checkpoint.lastCycle.researchErrors.map((item) => ({ ...item }))
        : [],
      markets: checkpoint.lastCycle.markets.map((item) => ({
        ...cloneTrace({
          ...item,
          evidenceGate: item.evidenceGate ?? null,
          technicalEvidence: item.technicalEvidence ?? null,
          structure: item.structure ?? null,
          cycle: item.cycle ?? null,
          microstructure: item.microstructure ?? null,
          challenger: item.challenger ?? null,
          shadowResearch: item.shadowResearch ?? null,
          tradeMap: item.tradeMap ?? null,
        }),
        evidenceScore: Number.isFinite(item.evidenceScore) ? item.evidenceScore : item.eventScore ?? 0,
        evidenceConfidence: Number.isFinite(item.evidenceConfidence) ? item.evidenceConfidence : 0,
        evidenceBullishWeight: Number.isFinite(item.evidenceBullishWeight) ? item.evidenceBullishWeight : 0,
        evidenceBearishWeight: Number.isFinite(item.evidenceBearishWeight) ? item.evidenceBearishWeight : 0,
        evidenceSourceDiversity: Number.isFinite(item.evidenceSourceDiversity) ? item.evidenceSourceDiversity : 0,
        evidenceFreshness: Number.isFinite(item.evidenceFreshness) ? item.evidenceFreshness : 0,
        evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds.slice() : [],
        reasons: Array.isArray(item.reasons) ? item.reasons.slice() : [],
        riskReasons: Array.isArray(item.riskReasons) ? item.riskReasons.slice() : [],
      })),
    } : null;
    if (checkpoint.running && resume) this.start(this.config);
    return this.status();
  }

  status() {
    return {
      running: this.timer !== null,
      cycleInProgress: this.cycleInProgress,
      config: { ...this.config },
      cycleCount: this.cycleCount,
      lastCycle: this.lastCycle,
      session: paperTradingSession.state(),
      research: researchFeatureStore.summary(),
    };
  }

  start(config: Partial<PaperLoopConfig> = {}) {
    const next: PaperLoopConfig = { ...this.config, ...config };
    validateConfig(next);

    this.config = next;
    if (this.timer) return this.status();

    this.timer = setInterval(() => {
      void this.runCycle().catch((error) => {
        console.error('Black Oracle paper loop cycle failed:', error);
      });
    }, this.config.intervalMs);
    this.timer.unref?.();

    return this.status();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    return this.status();
  }

  async runCycle(): Promise<PaperLoopCycleResult> {
    if (this.cycleInProgress) throw new Error('A Paper loop cycle is already in progress.');
    this.cycleInProgress = true;
    const startedAt = Date.now();
    const cycleId = `paper-cycle-${startedAt}-${this.cycleCount + 1}`;

    const result: PaperLoopCycleResult = {
      startedAt,
      finishedAt: startedAt,
      scanned: 0,
      entered: 0,
      exited: 0,
      held: 0,
      noTrade: 0,
      errors: [],
      researchErrors: [],
      markets: [],
    };
    const researchTargets: Array<{
      market: string;
      decisionAt: number;
      referencePrice: number;
      traceIndex: number;
    }> = [];

    try {
      const universe = await buildKrwLiquidityUniverse(Math.max(this.config.maxMarkets, 8), 30);
      const liquidityByMarket = new Map(universe.map((item) => [item.market, item]));
      const state = paperTradingSession.state();
      const openMarkets = state.portfolio.positions.map((position) => position.market);
      const eligibleCandidates = universe.filter((item) => item.eligible).slice(0, this.config.maxMarkets).map((item) => item.market);
      const orderedMarkets = [...new Set([...openMarkets, ...eligibleCandidates])];

      // PHASE 1: complete all production decisions first. Shadow research is not
      // allowed to introduce API latency, exceptions, or values into execution.
      for (const market of orderedMarkets) {
        const currentState = paperTradingSession.state();
        const currentlyOpen = currentState.portfolio.positions.map((position) => position.market);
        const alreadyOpen = currentlyOpen.includes(market);
        const newEntryAllowed = alreadyOpen || currentlyOpen.length < this.config.maxOpenPositions;

        try {
          let liquidity: LiquiditySnapshot | undefined = liquidityByMarket.get(market);
          if (!liquidity) liquidity = await getMarketLiquidity(market);
          const evidence = tradingEvidenceStore.aggregate(market);
          const step = await paperTradingSession.step(
            market,
            evidence.activeCount > 0 ? evidence.score : undefined,
            liquidity,
            newEntryAllowed,
          );
          const decisionAt = Date.now();
          const hasOpenPositionAfterStep = step.portfolio.positions.some((position) => position.market === market);
          const trace = buildDecisionTrace({
            timestamp: decisionAt,
            market,
            decision: step.decision,
            multiTimeframe: step.multiTimeframe,
            evidence: step.evidence,
            evidenceGate: step.evidenceGate,
            microstructure: step.microstructure,
            challenger: step.challenger,
            tradeMap: step.tradeMap,
            hasOpenPositionAfterStep,
          });

          result.scanned += 1;
          if (trace.action === 'ENTER') result.entered += 1;
          else if (trace.action === 'EXIT') result.exited += 1;
          else if (trace.action === 'HOLD') result.held += 1;
          else result.noTrade += 1;
          const traceIndex = result.markets.push({ ...trace, decision: trace.action }) - 1;
          researchTargets.push({ market, decisionAt, referencePrice: liquidity.tradePrice, traceIndex });
        } catch (error) {
          result.errors.push({
            market,
            error: error instanceof Error ? error.message : 'Unknown Paper loop error.',
          });
        }

        await sleep(350);
      }

      // PHASE 2: research-only instrumentation. Universe membership is frozen to
      // this cycle and candle queries are cut off at the production decision time.
      let relativeContext: Awaited<ReturnType<typeof buildPointInTimeRelativeStrengthContext>> | null = null;
      try {
        relativeContext = await buildPointInTimeRelativeStrengthContext(universe, startedAt);
      } catch (error) {
        result.researchErrors.push({
          market: 'UNIVERSE',
          error: error instanceof Error ? error.message : 'Unknown point-in-time universe research error.',
        });
      }

      for (const target of researchTargets) {
        try {
          const trace = result.markets[target.traceIndex];
          const research = await buildMarketShadowResearch(
            target.market,
            target.decisionAt,
            relativeContext?.byMarket.get(target.market) ?? null,
          );
          const enriched = buildDecisionTrace({
            timestamp: trace.timestamp,
            market: target.market,
            decision: {
              action: trace.action === 'ENTER' ? 'ENTER' : trace.action === 'EXIT' ? 'EXIT' : 'HOLD',
              side: trace.action === 'ENTER' ? 'BUY' : trace.action === 'EXIT' ? 'SELL' : null,
              notional: trace.tradeMap?.entryPrice && trace.action === 'ENTER' ? 0 : 0,
              quantity: 0,
              confidence: trace.confidence,
              stopLossPrice: trace.tradeMap?.stopLossPrice ?? null,
              takeProfitPrice: trace.tradeMap?.takeProfit1Price ?? null,
              riskDisposition: trace.riskDisposition,
              riskReasons: trace.riskReasons.slice(),
              reasons: trace.reasons.slice(),
            },
            multiTimeframe: {
              market: trace.market,
              asOf: trace.timestamp,
              action: trace.action === 'ENTER' ? 'BUY' : trace.action === 'EXIT' ? 'SELL' : 'WAIT',
              directionalScore: trace.technicalEvidence?.directionalScore ?? 0,
              oracleTradeScore: trace.oracleTradeScore,
              confidence: trace.confidence,
              aligned: trace.cycle?.aligned ?? false,
              positionRiskMultiplier: 1,
              frames: {
                fourHour: research.snapshot.frames.fourHour as never,
                oneHour: research.snapshot.frames.oneHour as never,
                fifteenMinute: research.snapshot.frames.fifteenMinute as never,
              },
              reasons: [],
            } as never,
            evidence: {
              market: trace.market,
              score: trace.evidenceScore,
              confidence: trace.evidenceConfidence,
              activeCount: trace.evidenceActiveCount,
              bullishWeight: trace.evidenceBullishWeight,
              bearishWeight: trace.evidenceBearishWeight,
              contradictionCount: trace.evidenceContradictionCount,
              asOf: trace.timestamp,
              evidenceIds: trace.evidenceIds.slice(),
              reasons: [],
            },
            evidenceGate: trace.evidenceGate,
            shadowResearch: research.snapshot,
            tradeMap: trace.tradeMap,
            hasOpenPositionAfterStep: trace.action === 'ENTER' || trace.action === 'HOLD',
          });
          // Only the research field is taken from the enriched trace. The production
          // decision trace itself remains byte-for-byte unchanged.
          result.markets[target.traceIndex] = cloneTrace({
            ...trace,
            shadowResearch: enriched.shadowResearch,
            decision: trace.action,
          });

          researchFeatureStore.appendShadowSnapshot({
            cycleId,
            timestamp: target.decisionAt,
            market: target.market,
            referencePrice: target.referencePrice,
            executionDecision: trace.action,
            evidenceScore: trace.evidenceActiveCount > 0 ? trace.evidenceScore : null,
            evidenceConfidence: trace.evidenceConfidence,
            oracleTradeScore: trace.oracleTradeScore,
            snapshot: research.snapshot,
          });
          researchFeatureStore.resolvePendingForMarket(target.market, research.fifteenMinuteCandles, target.decisionAt);
        } catch (error) {
          result.researchErrors.push({
            market: target.market,
            error: error instanceof Error ? error.message : 'Unknown shadow research error.',
          });
        }
      }

      result.finishedAt = Date.now();
      this.lastCycle = result;
      this.cycleCount += 1;
      return result;
    } finally {
      this.cycleInProgress = false;
    }
  }
}

export const paperLoopController = new PaperLoopController();
