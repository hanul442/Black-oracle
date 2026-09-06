import { runWalkForwardValidation, type BlindValidationResult, type BlindValidationSample } from '../../src/trading/blindValidation';
import { buildCostStressValidation } from '../../src/trading/costStress';
import type { ExperimentLedgerEvent } from '../../src/trading/experimentLedger';
import type { GradeSurveillanceCheckpoint } from '../../src/trading/gradeSurveillance';
import { summarizeGradeSurveillance } from '../../src/trading/gradeSurveillance';
import { buildMonteCarloValidation } from '../../src/trading/monteCarlo';
import {
  buildStrategyPromotionEligibility,
  summarizePromotionParityFromLedger,
  type PromotionEvidenceVerdict,
  type StrategyPromotionStage,
} from '../../src/trading/promotionHardGate';
import type { ClosedPaperTrade } from '../../src/trading/performance';
import type { TradingLedgerEvent } from '../../src/trading/types';
import type { InputValidationLedgerRecord } from '../../src/trading/validationDataset';
import { summarizeValidationSamples } from '../../src/trading/validationLedger';

export interface PromotionEvidenceCheckpointLike {
  savedAt: number;
  session: {
    ledger: TradingLedgerEvent[];
    closedTrades: ClosedPaperTrade[];
  };
  loop: {
    validationSamples?: BlindValidationSample[];
    cycleHistory?: Array<{
      markets?: Array<{ evidenceIds?: string[] }>;
    }>;
  };
  gradeSurveillance?: GradeSurveillanceCheckpoint;
  experimentLedger?: ExperimentLedgerEvent[];
}

export interface PromotionEvidenceAssemblerOptions {
  stage: StrategyPromotionStage;
  inputValidation?: InputValidationLedgerRecord[] | null;
  researchConfigurationId?: string | null;
  /** Optional external override for controlled research comparisons. Default is deterministic closed-trade cost stress. */
  costStressVerdict?: PromotionEvidenceVerdict | null;
}

const inferUniqueResearchConfigurationId = (events: ExperimentLedgerEvent[]): string | null => {
  const ids = [...new Set((events ?? []).flatMap((event) => {
    const value = event.payload?.researchConfigurationId;
    return typeof value === 'string' && /^rcfg-v1-[0-9a-f]{16}$/i.test(value.trim()) ? [value.trim().toLowerCase()] : [];
  }))];
  return ids.length === 1 ? ids[0] : null;
};

const buildAuditCoverage = (cycles: PromotionEvidenceCheckpointLike['loop']['cycleHistory']): number | null => {
  const decisions = (cycles ?? []).flatMap((cycle) => Array.isArray(cycle.markets) ? cycle.markets : []);
  if (!decisions.length) return null;
  const linked = decisions.filter((decision) => Array.isArray(decision.evidenceIds) && decision.evidenceIds.length > 0).length;
  return linked / decisions.length;
};

const inferHorizonMs = (samples: BlindValidationSample[]) => {
  const horizons = samples
    .map((sample) => sample.targetTimestamp - sample.anchorTimestamp)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!horizons.length) return 4 * 60 * 60_000;
  return horizons[Math.floor(horizons.length / 2)];
};

const rebuildBlindValidation = (samples: BlindValidationSample[]): BlindValidationResult => {
  const summary = summarizeValidationSamples(samples, { minSamples: 60, minObservationDays: 14 });
  return {
    ...summary,
    provenance: {
      noLookahead: true,
      anchorRule: 'FIRST_PERSISTED_PRICE_AT_OR_AFTER_DECISION',
      targetRule: 'FIRST_PERSISTED_PRICE_AT_OR_AFTER_ANCHOR_PLUS_HORIZON',
      horizonMs: inferHorizonMs(samples),
      minSamples: 60,
      minObservationDays: 14,
    },
    samples: samples.slice(),
  };
};

/**
 * Assemble only evidence that can be traced to the persisted PAPER checkpoint plus
 * explicitly supplied input-validation evidence. Ambiguous research configuration
 * lineage is intentionally returned as missing rather than guessed.
 */
export const assembleStrategyPromotionEvidence = (
  checkpoint: PromotionEvidenceCheckpointLike,
  options: PromotionEvidenceAssemblerOptions,
) => {
  const validationSamples = Array.isArray(checkpoint.loop.validationSamples) ? checkpoint.loop.validationSamples : [];
  const blindValidation = rebuildBlindValidation(validationSamples);
  const walkForward = runWalkForwardValidation(validationSamples);
  const closedReturns = (checkpoint.session.closedTrades ?? []).map((trade) => trade.returnPct);
  const monteCarlo = buildMonteCarloValidation(closedReturns);
  const costStress = buildCostStressValidation(closedReturns);
  const effectiveCostStressVerdict = options.costStressVerdict ?? costStress.verdict;
  const auditCoverage = buildAuditCoverage(checkpoint.loop.cycleHistory);
  const grade = summarizeGradeSurveillance(checkpoint.gradeSurveillance).current?.rating ?? null;
  const experimentEvents = Array.isArray(checkpoint.experimentLedger) ? checkpoint.experimentLedger : [];
  const explicitResearchConfigurationId = options.researchConfigurationId?.trim().toLowerCase() || null;
  const inferredResearchConfigurationId = inferUniqueResearchConfigurationId(experimentEvents);
  const researchConfigurationId = explicitResearchConfigurationId ?? inferredResearchConfigurationId;
  const parity = summarizePromotionParityFromLedger(checkpoint.session.ledger ?? []);

  const eligibility = buildStrategyPromotionEligibility({
    stage: options.stage,
    inputValidation: options.inputValidation ?? null,
    blindValidation,
    walkForward,
    monteCarlo,
    costStressVerdict: effectiveCostStressVerdict,
    auditCoverage,
    rating: grade,
    researchConfigurationId,
    parity,
  });

  return {
    schemaVersion: 1 as const,
    generatedAt: Date.now(),
    sourceCheckpointSavedAt: checkpoint.savedAt,
    stage: options.stage,
    evidence: {
      inputValidationRecords: options.inputValidation?.length ?? 0,
      blindValidation,
      walkForward,
      monteCarlo,
      costStress,
      costStressVerdict: effectiveCostStressVerdict,
      costStressSource: options.costStressVerdict ? 'EXPLICIT_OVERRIDE' as const : 'DETERMINISTIC_CLOSED_TRADE_STRESS' as const,
      auditCoverage,
      rating: grade,
      researchConfigurationId,
      researchConfigurationSource: explicitResearchConfigurationId ? 'EXPLICIT' as const : inferredResearchConfigurationId ? 'UNIQUE_EXPERIMENT_LINEAGE' as const : 'MISSING_OR_AMBIGUOUS' as const,
      parity,
    },
    eligibility,
    promotionAuthority: false as const,
    executionAuthority: false as const,
    liveDeploymentAuthority: false as const,
  };
};
