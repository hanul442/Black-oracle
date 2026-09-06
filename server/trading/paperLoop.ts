import { buildBlindValidationSamples, type BlindValidationSample } from '../../src/trading/blindValidation';
import {
  createCouncilComparisonObservation,
  resolveCouncilComparisonObservations,
  summarizeCouncilComparison,
  type CouncilComparisonObservation,
} from '../../src/trading/councilComparison';
import { buildCouncilV2Challenger } from '../../src/trading/councilV2';
import { buildDecisionTrace, type DecisionTrace } from '../../src/trading/decisionTrace';
import { buildDeterministicGovernancePackage } from '../../src/trading/governanceCore';
import { buildFinalDecision } from '../../src/trading/intelligencePipeline';
import type { MarketPriceSnapshot } from '../../src/trading/marketHistory';
import { assessPortfolioCorrelationRisk } from '../../src/trading/portfolioCorrelationRisk';
import {
  appendStrategyReturnObservation,
  createStrategyReturnObservation,
  createStrategyReturnPanelCheckpoint,
  normalizeStrategyReturnPanel,
  resolveStrategyReturnPanel,
  summarizeStrategyReturnPanel,
  type StrategyReturnPanelCheckpoint,
  type StrategyReturnPanelObservation,
} from '../../src/trading/strategyReturnPanel';
import { buildTradeCaseRecord } from '../../src/trading/tradeCase';
import type { LiquiditySnapshot } from '../../src/trading/types';
import { mergeValidationSamples } from '../../src/trading/validationLedger';
import { tradingEvidenceStore } from './evidenceStore';
import { paperTradingSession } from './paperSession';
import { tradeCaseStore } from './tradeCaseStore';
import { buildKrwLiquidityUniverse, getMarketLiquidity } from './universe';

export interface PaperLoopConfig { intervalMs: number; maxMarkets: number; maxOpenPositions: number; }
export interface PaperLoopCycleResult {
  startedAt: number; finishedAt: number; scanned: number; entered: number; exited: number; held: number; noTrade: number;
  errors: Array<{ market: string; error: string }>;
  markets: Array<DecisionTrace & { decision: DecisionTrace['action'] }>;
}
export interface PaperLoopCheckpoint {
  schemaVersion: 1; running: boolean; config: PaperLoopConfig; cycleCount: number; lastCycle: PaperLoopCycleResult | null;
  marketHistory?: MarketPriceSnapshot[]; cycleHistory?: PaperLoopCycleResult[]; validationSamples?: BlindValidationSample[];
  councilComparisons?: CouncilComparisonObservation[];
  strategyReturnPanel?: StrategyReturnPanelCheckpoint;
}

const DEFAULT_CONFIG: PaperLoopConfig = { intervalMs: 15 * 60 * 1000, maxMarkets: 6, maxOpenPositions: 4 };
const MAX_MARKET_HISTORY_POINTS = 384;
const MAX_CYCLE_HISTORY = 96;
const MAX_VALIDATION_SAMPLES = 10_000;
const MAX_COUNCIL_COMPARISONS = 5_000;
const VALIDATION_HORIZON_MS = 4 * 60 * 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const validateConfig = (config: PaperLoopConfig) => {
  if (!Number.isInteger(config.intervalMs) || config.intervalMs < 5 * 60 * 1000) throw new Error('Paper loop intervalMs must be at least 300000 (5 minutes).');
  if (!Number.isInteger(config.maxMarkets) || config.maxMarkets < 1 || config.maxMarkets > 12) throw new Error('Paper loop maxMarkets must be an integer between 1 and 12.');
  if (!Number.isInteger(config.maxOpenPositions) || config.maxOpenPositions < 1 || config.maxOpenPositions > 8) throw new Error('Paper loop maxOpenPositions must be an integer between 1 and 8.');
};
const cloneHistory = (history: MarketPriceSnapshot[]) => history.map((snapshot) => ({ timestamp: snapshot.timestamp, prices: snapshot.prices.map(([market, price]) => [market, price] as [string, number]) }));
const cloneValidationSample = (sample: BlindValidationSample): BlindValidationSample => ({ ...sample });
const cloneCouncilComparison = (item: CouncilComparisonObservation): CouncilComparisonObservation => ({ ...item, v1: { ...item.v1 }, v2: { ...item.v2 }, executionAuthority: false, promotionAuthority: false });
const cloneCycle = (cycle: PaperLoopCycleResult): PaperLoopCycleResult => ({
  ...cycle,
  errors: cycle.errors.map((item) => ({ ...item })),
  markets: cycle.markets.map((item) => ({
    ...item,
    evidenceIds: item.evidenceIds.slice(), reasons: item.reasons.slice(), riskReasons: item.riskReasons.slice(),
    governance: item.governance ? { ...item.governance, reasons: item.governance.reasons.slice() } : undefined,
    router: { ...item.router, reasons: item.router.reasons.slice() },
    forecast: { ...item.forecast, evidenceIds: item.forecast.evidenceIds.slice(), reasons: item.forecast.reasons.slice() },
  })),
});
const normalizeHistory = (history: unknown): MarketPriceSnapshot[] => {
  if (!Array.isArray(history)) return [];
  return history.flatMap((candidate: any) => {
    if (!Number.isFinite(candidate?.timestamp) || candidate.timestamp <= 0 || !Array.isArray(candidate?.prices)) return [];
    const prices = candidate.prices.flatMap((entry: any): Array<[string, number]> => {
      if (!Array.isArray(entry) || entry.length !== 2) return [];
      const market = String(entry[0] ?? '').toUpperCase(); const price = Number(entry[1]);
      if (!/^KRW-[A-Z0-9]+$/.test(market) || !Number.isFinite(price) || price <= 0) return [];
      return [[market, price]];
    });
    return prices.length ? [{ timestamp: candidate.timestamp, prices }] : [];
  }).sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_MARKET_HISTORY_POINTS);
};
const normalizeValidationSamples = (samples: unknown): BlindValidationSample[] => {
  if (!Array.isArray(samples)) return [];
  return mergeValidationSamples([], samples.flatMap((candidate: any) => {
    const market = String(candidate?.market ?? '').toUpperCase();
    const action = String(candidate?.action ?? '').toUpperCase();
    if (!/^KRW-[A-Z0-9]+$/.test(market) || !['ENTER', 'EXIT', 'HOLD'].includes(action)) return [];
    const numeric = ['decisionTimestamp', 'anchorTimestamp', 'targetTimestamp', 'anchorPrice', 'targetPrice', 'rawReturn', 'directionalReturn'];
    if (numeric.some((field) => !Number.isFinite(candidate?.[field]))) return [];
    return [{
      market,
      decisionTimestamp: Number(candidate.decisionTimestamp),
      anchorTimestamp: Number(candidate.anchorTimestamp),
      targetTimestamp: Number(candidate.targetTimestamp),
      action: action as BlindValidationSample['action'],
      regime: String(candidate.regime ?? 'UNKNOWN'),
      anchorPrice: Number(candidate.anchorPrice),
      targetPrice: Number(candidate.targetPrice),
      rawReturn: Number(candidate.rawReturn),
      directionalReturn: Number(candidate.directionalReturn),
      favorable: Boolean(candidate.favorable),
    }];
  }), MAX_VALIDATION_SAMPLES);
};
const normalizeCouncilComparisons = (items: unknown): CouncilComparisonObservation[] => {
  if (!Array.isArray(items)) return [];
  return items.flatMap((candidate: any) => {
    if (!candidate || typeof candidate.id !== 'string' || !/^KRW-[A-Z0-9]+$/.test(String(candidate.market ?? '').toUpperCase())) return [];
    if (!Number.isFinite(candidate.generatedAt) || !Number.isFinite(candidate.targetTimestamp) || !Number.isFinite(candidate.anchorPrice) || candidate.anchorPrice <= 0) return [];
    if (!candidate.v1 || !candidate.v2) return [];
    return [cloneCouncilComparison({
      ...candidate,
      market: String(candidate.market).toUpperCase(),
      generatedAt: Number(candidate.generatedAt),
      targetTimestamp: Number(candidate.targetTimestamp),
      anchorPrice: Number(candidate.anchorPrice),
      resolvedAt: Number.isFinite(candidate.resolvedAt) ? Number(candidate.resolvedAt) : null,
      targetPrice: Number.isFinite(candidate.targetPrice) ? Number(candidate.targetPrice) : null,
      rawReturn: Number.isFinite(candidate.rawReturn) ? Number(candidate.rawReturn) : null,
      v1DirectionalUtility: Number.isFinite(candidate.v1DirectionalUtility) ? Number(candidate.v1DirectionalUtility) : null,
      v2DirectionalUtility: Number.isFinite(candidate.v2DirectionalUtility) ? Number(candidate.v2DirectionalUtility) : null,
      v1Favorable: typeof candidate.v1Favorable === 'boolean' ? candidate.v1Favorable : null,
      v2Favorable: typeof candidate.v2Favorable === 'boolean' ? candidate.v2Favorable : null,
      executionAuthority: false,
      promotionAuthority: false,
    } as CouncilComparisonObservation)];
  }).sort((a, b) => a.generatedAt - b.generatedAt).slice(-MAX_COUNCIL_COMPARISONS);
};
const normalizeCycleHistory = (history: unknown, fallback: PaperLoopCycleResult | null): PaperLoopCycleResult[] => {
  const source = Array.isArray(history) ? history : fallback ? [fallback] : [];
  return source.filter((candidate: any) => Number.isFinite(candidate?.startedAt) && Number.isFinite(candidate?.finishedAt)).map((candidate: any) => cloneCycle({
    ...candidate, startedAt: Number(candidate.startedAt), finishedAt: Number(candidate.finishedAt), scanned: Number.isInteger(candidate.scanned) ? candidate.scanned : 0,
    entered: Number.isInteger(candidate.entered) ? candidate.entered : 0, exited: Number.isInteger(candidate.exited) ? candidate.exited : 0,
    held: Number.isInteger(candidate.held) ? candidate.held : 0, noTrade: Number.isInteger(candidate.noTrade) ? candidate.noTrade : 0,
    errors: Array.isArray(candidate.errors) ? candidate.errors : [], markets: Array.isArray(candidate.markets) ? candidate.markets : [],
  } as PaperLoopCycleResult)).sort((a, b) => a.finishedAt - b.finishedAt).slice(-MAX_CYCLE_HISTORY);
};

export class PaperLoopController {
  private timer: NodeJS.Timeout | null = null;
  private cycleInProgress = false;
  private config: PaperLoopConfig = { ...DEFAULT_CONFIG };
  private lastCycle: PaperLoopCycleResult | null = null;
  private cycleCount = 0;
  private marketHistory: MarketPriceSnapshot[] = [];
  private cycleHistory: PaperLoopCycleResult[] = [];
  private validationSamples: BlindValidationSample[] = [];
  private councilComparisons: CouncilComparisonObservation[] = [];
  private strategyReturnPanel: StrategyReturnPanelCheckpoint = createStrategyReturnPanelCheckpoint();

  checkpoint(): PaperLoopCheckpoint {
    return {
      schemaVersion: 1, running: this.timer !== null, config: { ...this.config }, cycleCount: this.cycleCount,
      lastCycle: this.lastCycle ? cloneCycle(this.lastCycle) : null, marketHistory: cloneHistory(this.marketHistory),
      cycleHistory: this.cycleHistory.map(cloneCycle), validationSamples: this.validationSamples.map(cloneValidationSample),
      councilComparisons: this.councilComparisons.map(cloneCouncilComparison),
      strategyReturnPanel: normalizeStrategyReturnPanel(this.strategyReturnPanel),
    };
  }
  restore(checkpoint: PaperLoopCheckpoint, resume = false) {
    if (!checkpoint || checkpoint.schemaVersion !== 1) throw new Error('Unsupported Paper loop checkpoint schema.'); validateConfig(checkpoint.config); this.stop(); this.config = { ...checkpoint.config };
    this.cycleCount = Number.isInteger(checkpoint.cycleCount) && checkpoint.cycleCount >= 0 ? checkpoint.cycleCount : 0;
    this.lastCycle = checkpoint.lastCycle ? cloneCycle({ ...checkpoint.lastCycle, noTrade: Number.isInteger(checkpoint.lastCycle.noTrade) ? checkpoint.lastCycle.noTrade : 0, errors: Array.isArray(checkpoint.lastCycle.errors) ? checkpoint.lastCycle.errors : [], markets: Array.isArray(checkpoint.lastCycle.markets) ? checkpoint.lastCycle.markets : [] }) : null;
    this.marketHistory = normalizeHistory(checkpoint.marketHistory); this.cycleHistory = normalizeCycleHistory(checkpoint.cycleHistory, this.lastCycle);
    this.validationSamples = normalizeValidationSamples(checkpoint.validationSamples);
    this.councilComparisons = normalizeCouncilComparisons(checkpoint.councilComparisons);
    this.strategyReturnPanel = normalizeStrategyReturnPanel(checkpoint.strategyReturnPanel);
    if (!this.lastCycle && this.cycleHistory.length) this.lastCycle = cloneCycle(this.cycleHistory[this.cycleHistory.length - 1]);
    if (checkpoint.running && resume) this.start(this.config); return this.status();
  }
  status() {
    return {
      running: this.timer !== null, cycleInProgress: this.cycleInProgress, config: { ...this.config }, cycleCount: this.cycleCount,
      lastCycle: this.lastCycle ? cloneCycle(this.lastCycle) : null, cycleHistory: this.cycleHistory.map(cloneCycle), marketHistory: cloneHistory(this.marketHistory),
      validationSamples: this.validationSamples.map(cloneValidationSample), session: paperTradingSession.state(),
      governance: {
        mode: 'ENFORCE' as const, policy: 'STRICT_CONSENSUS' as const, engine: 'DETERMINISTIC_COUNCIL_CORE_V1' as const,
        entryRule: 'New ENTER requires source-backed Evidence + deterministic Scenario/Council support + deterministic Risk approval.',
        correlationPolicy: 'New concurrent crypto exposure fails closed when aligned correlation history is insufficient; >1 existing market above 0.82 correlation rejects the candidate.',
        protectiveExitAuthority: true,
        challenger: {
          engine: 'COUNCIL-V2-CHALLENGER-0.1' as const,
          executionAuthority: false as const,
          promotionAuthority: false as const,
          comparison: summarizeCouncilComparison(this.councilComparisons),
        },
      },
      strategyResearch: summarizeStrategyReturnPanel(this.strategyReturnPanel),
      validationRetention: {
        horizonMs: VALIDATION_HORIZON_MS,
        retainedSamples: this.validationSamples.length,
        maxSamples: MAX_VALIDATION_SAMPLES,
        noLookahead: true as const,
        councilComparisonSamples: this.councilComparisons.length,
        strategyReturnObservations: this.strategyReturnPanel.observations.length,
      },
    };
  }
  start(config: Partial<PaperLoopConfig> = {}) {
    const next: PaperLoopConfig = { ...this.config, ...config }; validateConfig(next); this.config = next; if (this.timer) return this.status();
    this.timer = setInterval(() => { void this.runCycle().catch((error) => console.error('Black Oracle paper loop cycle failed:', error)); }, this.config.intervalMs); this.timer.unref?.(); return this.status();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; return this.status(); }

  async runCycle(): Promise<PaperLoopCycleResult> {
    if (this.cycleInProgress) throw new Error('A Paper loop cycle is already in progress.'); this.cycleInProgress = true; const startedAt = Date.now();
    const result: PaperLoopCycleResult = { startedAt, finishedAt: startedAt, scanned: 0, entered: 0, exited: 0, held: 0, noTrade: 0, errors: [], markets: [] };
    const cycleMarkPrices: Array<[string, number]> = [];
    try {
      const universe = await buildKrwLiquidityUniverse(Math.max(this.config.maxMarkets, 8), 30); const liquidityByMarket = new Map(universe.map((item) => [item.market, item]));
      const state = paperTradingSession.state(); const openMarkets = state.portfolio.positions.map((position) => position.market);
      const eligibleCandidates = universe.filter((item) => item.eligible).slice(0, this.config.maxMarkets).map((item) => item.market); const orderedMarkets = [...new Set([...openMarkets, ...eligibleCandidates])];

      for (const market of orderedMarkets) {
        const currentState = paperTradingSession.state(); const currentlyOpen = currentState.portfolio.positions.map((position) => position.market); const alreadyOpen = currentlyOpen.includes(market);
        const capacityAllowed = alreadyOpen || currentlyOpen.length < this.config.maxOpenPositions;
        const correlationRisk = alreadyOpen ? null : assessPortfolioCorrelationRisk({ candidateMarket: market, openMarkets: currentlyOpen, marketHistory: this.marketHistory });
        const correlationAllowed = alreadyOpen || correlationRisk?.disposition === 'PASS' || correlationRisk?.disposition === 'WATCH';
        const newEntryAllowed = alreadyOpen || (capacityAllowed && correlationAllowed);
        const newEntryBlockReasons = [
          ...(!capacityAllowed ? [`Paper portfolio open-position limit ${this.config.maxOpenPositions} rejected another concurrent position.`] : []),
          ...(!correlationAllowed && correlationRisk ? correlationRisk.reasons : []),
        ];

        try {
          let liquidity: LiquiditySnapshot | undefined = liquidityByMarket.get(market); if (!liquidity) liquidity = await getMarketLiquidity(market);
          const evidence = tradingEvidenceStore.aggregate(market);
          let councilComparison: CouncilComparisonObservation | null = null;
          let strategyObservation: StrategyReturnPanelObservation | null = null;
          const step = await paperTradingSession.step(
            market, evidence.activeCount > 0 ? evidence.score : undefined, liquidity, newEntryAllowed,
            (context) => {
              const governanceNow = Date.now();
              const governanceInput = { market, evidence, multiTimeframe: context.multiTimeframe, liquidity: context.liquidity, scope: context.hasOpenPositionBefore ? 'HELD' as const : 'CANDIDATE' as const, now: governanceNow };
              const intelligence = buildDeterministicGovernancePackage(governanceInput);
              const challenger = buildCouncilV2Challenger(governanceInput);
              councilComparison = createCouncilComparisonObservation({ base: intelligence, challenger: challenger.challenger }, context.liquidity.tradePrice, VALIDATION_HORIZON_MS);
              strategyObservation = createStrategyReturnObservation(this.strategyReturnPanel, {
                market,
                generatedAt: governanceNow,
                anchorPrice: context.liquidity.tradePrice,
                multiTimeframe: context.multiTimeframe,
                evidence,
                liquidity: context.liquidity,
                horizonMs: VALIDATION_HORIZON_MS,
              });
              const finalDecision = buildFinalDecision({ market, executionDecision: context.executionDecision, hasOpenPositionBefore: context.hasOpenPositionBefore, intelligence, mode: 'ENFORCE', policy: 'STRICT_CONSENSUS', now: intelligence.generatedAt });
              return { intelligence, finalDecision };
            },
            newEntryBlockReasons,
          );
          if (councilComparison && !this.councilComparisons.some((item) => item.id === councilComparison!.id)) {
            this.councilComparisons.push(cloneCouncilComparison(councilComparison));
            if (this.councilComparisons.length > MAX_COUNCIL_COMPARISONS) this.councilComparisons.splice(0, this.councilComparisons.length - MAX_COUNCIL_COMPARISONS);
          }
          if (strategyObservation) this.strategyReturnPanel = appendStrategyReturnObservation(this.strategyReturnPanel, strategyObservation);
          const hasOpenPositionAfterStep = step.portfolio.positions.some((position) => position.market === market);
          const trace = buildDecisionTrace({
            timestamp: Date.now(), market, decision: step.decision, multiTimeframe: step.multiTimeframe, evidence, hasOpenPositionAfterStep,
            governance: step.governance ? { finalDecision: step.governance.finalDecision, intelligencePackageId: step.governance.intelligence.id, scenarioSetId: step.governance.intelligence.scenarios.id, councilRunId: step.governance.intelligence.council.id } : null,
          });

          if (trace.action === 'ENTER' && step.fill) {
            tradeCaseStore.recordEntry(buildTradeCaseRecord({ market, fill: step.fill, trace, multiTimeframe: step.multiTimeframe, governance: step.governance?.intelligence ?? null }));
          } else if (trace.action === 'EXIT') {
            if (step.governance) tradeCaseStore.linkGovernance(market, step.governance.intelligence, trace.governance?.finalDecisionId ?? null);
            tradeCaseStore.closeMarket(market, step.fill?.timestamp ?? trace.timestamp, trace);
          } else if (alreadyOpen || hasOpenPositionAfterStep) {
            tradeCaseStore.appendDecision(market, trace);
            if (step.governance) tradeCaseStore.linkGovernance(market, step.governance.intelligence, trace.governance?.finalDecisionId ?? null);
          }

          result.scanned += 1; if (trace.action === 'ENTER') result.entered += 1; else if (trace.action === 'EXIT') result.exited += 1; else if (trace.action === 'HOLD') result.held += 1; else result.noTrade += 1;
          result.markets.push({ ...trace, decision: trace.action });
          if (Number.isFinite(step.liquidity.tradePrice) && step.liquidity.tradePrice > 0) cycleMarkPrices.push([market, step.liquidity.tradePrice]);
        } catch (error) { result.errors.push({ market, error: error instanceof Error ? error.message : 'Unknown Paper loop error.' }); }
        await sleep(350);
      }

      result.finishedAt = Date.now(); this.lastCycle = cloneCycle(result); this.cycleHistory.push(cloneCycle(result));
      if (this.cycleHistory.length > MAX_CYCLE_HISTORY) this.cycleHistory.splice(0, this.cycleHistory.length - MAX_CYCLE_HISTORY);
      if (cycleMarkPrices.length) {
        this.marketHistory.push({ timestamp: result.finishedAt, prices: cycleMarkPrices.slice().sort((a, b) => a[0].localeCompare(b[0])) });
        if (this.marketHistory.length > MAX_MARKET_HISTORY_POINTS) this.marketHistory.splice(0, this.marketHistory.length - MAX_MARKET_HISTORY_POINTS);
      }
      const recentDecisions = this.cycleHistory.flatMap((cycle) => cycle.markets);
      const newlyEvaluable = buildBlindValidationSamples(recentDecisions, this.marketHistory, VALIDATION_HORIZON_MS);
      this.validationSamples = mergeValidationSamples(this.validationSamples, newlyEvaluable, MAX_VALIDATION_SAMPLES);
      this.councilComparisons = resolveCouncilComparisonObservations(this.councilComparisons, this.marketHistory).slice(-MAX_COUNCIL_COMPARISONS);
      this.strategyReturnPanel = resolveStrategyReturnPanel(this.strategyReturnPanel, this.marketHistory);
      this.cycleCount += 1; return result;
    } finally { this.cycleInProgress = false; }
  }
}

export const paperLoopController = new PaperLoopController();