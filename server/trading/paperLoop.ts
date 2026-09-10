import { getAssetDecisionPolicy } from '../../src/trading/assetPolicy';
import { buildDecisionTrace, type DecisionTrace } from '../../src/trading/decisionTrace';
import { buildEvidenceCoverageRequest } from '../../src/trading/evidenceCoverage';
import type { LiquiditySnapshot } from '../../src/trading/types';
import { equityPaperLoop, type EquityPaperCycleResult } from './equity/equityPaperLoop';
import { evidenceCoverageRequestStore } from './evidenceCoverageQueue';
import { tradingEvidenceStore } from './evidenceStore';
import { syncAnalyzedNarsEvidence } from './externalEvidenceSource';
import { consumeNarsEvidencePackets } from './narsConsumer';
import { acquirePendingEvidenceCoverage } from './narsCoverageAcquirer';
import { paperTradingSession } from './paperSession';
import { buildKrwLiquidityUniverse, getMarketLiquidity } from './universe';

export interface PaperLoopConfig {
  intervalMs: number;
  maxMarkets: number;
  maxOpenPositions: number;
}

export interface PaperLoopEvidenceOps {
  importedBeforeConsume: number;
  consumedPackets: number;
  importedAfterConsume: number;
  acquisitionRequests: number;
  acquisitionSourcesIngested: number;
  errors: string[];
}

export interface PaperLoopCycleResult {
  startedAt: number;
  finishedAt: number;
  scanned: number;
  entered: number;
  exited: number;
  held: number;
  noTrade: number;
  evidenceOps: PaperLoopEvidenceOps;
  equityCycle: EquityPaperCycleResult | null;
  errors: Array<{ market: string; error: string }>;
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

const EQUITY_CADENCE_MS = 30 * 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const kisConfigured = () => Boolean(String(process.env.KIS_APP_KEY ?? '').trim() && String(process.env.KIS_APP_SECRET ?? '').trim());

const emptyEvidenceOps = (): PaperLoopEvidenceOps => ({
  importedBeforeConsume: 0,
  consumedPackets: 0,
  importedAfterConsume: 0,
  acquisitionRequests: 0,
  acquisitionSourcesIngested: 0,
  errors: [],
});

const cloneEvidenceOps = (value?: Partial<PaperLoopEvidenceOps> | null): PaperLoopEvidenceOps => ({
  importedBeforeConsume: Number(value?.importedBeforeConsume ?? 0),
  consumedPackets: Number(value?.consumedPackets ?? 0),
  importedAfterConsume: Number(value?.importedAfterConsume ?? 0),
  acquisitionRequests: Number(value?.acquisitionRequests ?? 0),
  acquisitionSourcesIngested: Number(value?.acquisitionSourcesIngested ?? 0),
  errors: Array.isArray(value?.errors) ? value!.errors!.map(String) : [],
});

const cloneTrace = <T extends DecisionTrace & { decision: DecisionTrace['action'] }>(item: T): T => ({
  ...item,
  router: { ...item.router, reasons: item.router.reasons.slice() },
  forecast: { ...item.forecast, reasons: item.forecast.reasons.slice() },
  evidenceIds: item.evidenceIds.slice(),
  technicalEvidence: item.technicalEvidence ? { ...item.technicalEvidence } : null,
  structure: item.structure ? { ...item.structure } : null,
  cycle: item.cycle ? { ...item.cycle, frames: { ...item.cycle.frames }, reasons: item.cycle.reasons.slice() } : null,
  microstructure: item.microstructure ? { ...item.microstructure } : null,
  challenger: item.challenger ? { ...item.challenger, reasons: item.challenger.reasons.slice() } : null,
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
  private lastEquityCycleAt = 0;

  checkpoint(): PaperLoopCheckpoint {
    return {
      schemaVersion: 1,
      running: this.timer !== null,
      config: { ...this.config },
      cycleCount: this.cycleCount,
      lastCycle: this.lastCycle ? {
        ...this.lastCycle,
        evidenceOps: cloneEvidenceOps(this.lastCycle.evidenceOps),
        equityCycle: this.lastCycle.equityCycle ? {
          ...this.lastCycle.equityCycle,
          decisions: this.lastCycle.equityCycle.decisions.map((item) => ({ ...item, evidenceIds: item.evidenceIds.slice(), reasons: item.reasons.slice() })),
        } : null,
        errors: this.lastCycle.errors.map((item) => ({ ...item })),
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
      evidenceOps: cloneEvidenceOps((checkpoint.lastCycle as any).evidenceOps),
      equityCycle: (checkpoint.lastCycle as any).equityCycle ?? null,
      errors: checkpoint.lastCycle.errors.map((item) => ({ ...item })),
      markets: checkpoint.lastCycle.markets.map((item) => ({
        ...cloneTrace({
          ...item,
          technicalEvidence: item.technicalEvidence ?? null,
          structure: item.structure ?? null,
          cycle: item.cycle ?? null,
          microstructure: item.microstructure ?? null,
          challenger: item.challenger ?? null,
          tradeMap: item.tradeMap ?? null,
        }),
        evidenceIds: Array.isArray(item.evidenceIds) ? item.evidenceIds.slice() : [],
        reasons: Array.isArray(item.reasons) ? item.reasons.slice() : [],
        riskReasons: Array.isArray(item.riskReasons) ? item.riskReasons.slice() : [],
      })),
    } : null;
    this.lastEquityCycleAt = this.lastCycle?.equityCycle?.finishedAt ?? 0;
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
      evidence: {
        activeCount: tradingEvidenceStore.list().length,
        lastOperations: this.lastCycle?.evidenceOps ?? null,
      },
      equity: {
        configured: kisConfigured(),
        cadenceMs: EQUITY_CADENCE_MS,
        lastCycleAt: this.lastEquityCycleAt || null,
        status: equityPaperLoop.status(),
      },
      session: paperTradingSession.state(),
    };
  }

  start(config: Partial<PaperLoopConfig> = {}) {
    const next: PaperLoopConfig = { ...this.config, ...config };
    validateConfig(next);
    this.config = next;
    if (this.timer) return this.status();

    this.timer = setInterval(() => {
      void this.runCycle().catch((error) => console.error('Black Oracle paper loop cycle failed:', error));
    }, this.config.intervalMs);
    this.timer.unref?.();
    return this.status();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    return this.status();
  }

  private async runEvidenceOps(target: PaperLoopEvidenceOps) {
    try {
      const before = await syncAnalyzedNarsEvidence();
      target.importedBeforeConsume = before.imported;
    } catch (error) {
      target.errors.push(`pre-sync: ${error instanceof Error ? error.message : 'unknown error'}`);
    }

    try {
      const consumed = await consumeNarsEvidencePackets(12);
      target.consumedPackets = consumed.filter((item) => item.status === 'ANALYZED').length;
    } catch (error) {
      target.errors.push(`consume: ${error instanceof Error ? error.message : 'unknown error'}`);
    }

    try {
      const after = await syncAnalyzedNarsEvidence();
      target.importedAfterConsume = after.imported;
    } catch (error) {
      target.errors.push(`post-sync: ${error instanceof Error ? error.message : 'unknown error'}`);
    }

    try {
      const acquisitions = await acquirePendingEvidenceCoverage(2);
      target.acquisitionRequests = acquisitions.length;
      target.acquisitionSourcesIngested = acquisitions.reduce((sum, item) => sum + item.ingested, 0);
      for (const item of acquisitions) {
        if (item.error) target.errors.push(`acquire ${item.market}: ${item.error}`);
      }
    } catch (error) {
      target.errors.push(`acquire: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  private async maybeRunEquityCycle(startedAt: number) {
    if (!kisConfigured()) return null;
    if (startedAt - this.lastEquityCycleAt < EQUITY_CADENCE_MS) return null;
    const cycle = await equityPaperLoop.runCycle(6);
    this.lastEquityCycleAt = cycle.finishedAt;
    return cycle;
  }

  async runCycle(): Promise<PaperLoopCycleResult> {
    if (this.cycleInProgress) throw new Error('A Paper loop cycle is already in progress.');
    this.cycleInProgress = true;
    const startedAt = Date.now();
    const result: PaperLoopCycleResult = {
      startedAt,
      finishedAt: startedAt,
      scanned: 0,
      entered: 0,
      exited: 0,
      held: 0,
      noTrade: 0,
      evidenceOps: emptyEvidenceOps(),
      equityCycle: null,
      errors: [],
      markets: [],
    };

    try {
      // Evidence operations are best-effort and never grant execution authority by themselves.
      // Crypto can continue technical-first if NARS is unavailable; evidence-required equities fail closed at their own entry gate.
      await this.runEvidenceOps(result.evidenceOps);

      const universe = await buildKrwLiquidityUniverse(Math.max(this.config.maxMarkets, 8), 30);
      const liquidityByMarket = new Map(universe.map((item) => [item.market, item]));
      const state = paperTradingSession.state();
      const openMarkets = state.portfolio.positions
        .filter((position) => position.market.startsWith('KRW-'))
        .map((position) => position.market);
      const eligibleCandidates = universe.filter((item) => item.eligible).slice(0, this.config.maxMarkets).map((item) => item.market);
      const orderedMarkets = [...new Set([...openMarkets, ...eligibleCandidates])];

      for (const market of orderedMarkets) {
        const currentState = paperTradingSession.state();
        const currentlyOpen = currentState.portfolio.positions.map((position) => position.market);
        const alreadyOpen = currentlyOpen.includes(market);
        const newEntryAllowed = alreadyOpen || currentlyOpen.length < this.config.maxOpenPositions;

        try {
          let liquidity: LiquiditySnapshot | undefined = liquidityByMarket.get(market);
          if (!liquidity) liquidity = await getMarketLiquidity(market);
          const evidence = tradingEvidenceStore.aggregate(market);
          const externalEvidenceAvailable = evidence.activeCount > 0;
          const policy = getAssetDecisionPolicy(market);
          const step = await paperTradingSession.step(
            market,
            externalEvidenceAvailable ? evidence.score : undefined,
            liquidity,
            newEntryAllowed,
            externalEvidenceAvailable,
            evidence,
          );

          let coverageRequestKey: string | null = null;
          if (policy.evidenceRequestOnGap && step.technicalEntryCandidate && !externalEvidenceAvailable) {
            const request = buildEvidenceCoverageRequest(market, Date.now(), {
              trigger: 'ENTRY_CANDIDATE',
              strategyId: step.strategyVersion,
              reason: `${policy.assetClass} policy requires source-backed evidence for new risk. Acquire evidence and re-evaluate; do not execute from this request.`,
            });
            await evidenceCoverageRequestStore.enqueue(request);
            coverageRequestKey = request.requestKey;
          }

          const hasOpenPositionAfterStep = step.portfolio.positions.some((position) => position.market === market);
          const trace = buildDecisionTrace({
            timestamp: Date.now(),
            market,
            decision: step.decision,
            multiTimeframe: step.multiTimeframe,
            evidence,
            microstructure: step.microstructure,
            challenger: step.challenger,
            tradeMap: step.tradeMap,
            preTradeReview: step.preTradeReview,
            hasOpenPositionAfterStep,
          });
          trace.reasons.push(
            policy.evidenceRequiredForNewRisk
              ? `${policy.assetClass}: evidence-required new-risk policy.`
              : `${policy.assetClass}: technical-first policy; external evidence is optional context.`,
          );
          if (coverageRequestKey) {
            trace.reasons.push(`Evidence coverage request ${coverageRequestKey} queued for NARS acquisition/re-analysis.`);
          }

          result.scanned += 1;
          if (trace.action === 'ENTER') result.entered += 1;
          else if (trace.action === 'EXIT') result.exited += 1;
          else if (trace.action === 'HOLD') result.held += 1;
          else result.noTrade += 1;
          result.markets.push({ ...trace, decision: trace.action });
        } catch (error) {
          result.errors.push({ market, error: error instanceof Error ? error.message : 'Unknown Paper loop error.' });
        }
        await sleep(350);
      }

      try {
        result.equityCycle = await this.maybeRunEquityCycle(startedAt);
      } catch (error) {
        result.errors.push({ market: 'KRX', error: `Equity Paper cycle: ${error instanceof Error ? error.message : 'unknown error'}` });
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
