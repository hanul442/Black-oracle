import { buildDecisionTrace, type DecisionTrace } from '../../src/trading/decisionTrace';
import type { LiquiditySnapshot } from '../../src/trading/types';
import { tradingEvidenceStore } from './evidenceStore';
import { paperTradingSession } from './paperSession';
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
        markets: this.lastCycle.markets.map((item) => ({
          ...item,
          evidenceIds: item.evidenceIds.slice(),
          reasons: item.reasons.slice(),
          riskReasons: item.riskReasons.slice(),
        })),
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
      markets: checkpoint.lastCycle.markets.map((item) => ({
        ...item,
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

    const result: PaperLoopCycleResult = {
      startedAt,
      finishedAt: startedAt,
      scanned: 0,
      entered: 0,
      exited: 0,
      held: 0,
      noTrade: 0,
      errors: [],
      markets: [],
    };

    try {
      const universe = await buildKrwLiquidityUniverse(Math.max(this.config.maxMarkets, 8), 30);
      const liquidityByMarket = new Map(universe.map((item) => [item.market, item]));
      const state = paperTradingSession.state();
      const openMarkets = state.portfolio.positions.map((position) => position.market);
      const eligibleCandidates = universe.filter((item) => item.eligible).slice(0, this.config.maxMarkets).map((item) => item.market);
      const orderedMarkets = [...new Set([...openMarkets, ...eligibleCandidates])];

      for (const market of orderedMarkets) {
        const currentState = paperTradingSession.state();
        const currentlyOpen = currentState.portfolio.positions.map((position) => position.market);
        const alreadyOpen = currentlyOpen.includes(market);
        if (!alreadyOpen && currentlyOpen.length >= this.config.maxOpenPositions) continue;

        try {
          let liquidity: LiquiditySnapshot | undefined = liquidityByMarket.get(market);
          if (!liquidity) liquidity = await getMarketLiquidity(market);
          const evidence = tradingEvidenceStore.aggregate(market);
          const step = await paperTradingSession.step(
            market,
            evidence.activeCount > 0 ? evidence.score : undefined,
            liquidity,
          );
          const hasOpenPositionAfterStep = step.portfolio.positions.some((position) => position.market === market);
          const trace = buildDecisionTrace({
            timestamp: Date.now(),
            market,
            decision: step.decision,
            multiTimeframe: step.multiTimeframe,
            evidence,
            hasOpenPositionAfterStep,
          });

          result.scanned += 1;
          if (trace.action === 'ENTER') result.entered += 1;
          else if (trace.action === 'EXIT') result.exited += 1;
          else if (trace.action === 'HOLD') result.held += 1;
          else result.noTrade += 1;
          result.markets.push({ ...trace, decision: trace.action });
        } catch (error) {
          result.errors.push({
            market,
            error: error instanceof Error ? error.message : 'Unknown Paper loop error.',
          });
        }

        await sleep(350);
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