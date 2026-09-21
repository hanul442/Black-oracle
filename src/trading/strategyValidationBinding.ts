import type { ValidationEvaluation, ValidationGateStatus } from './validationStageResult';
import type { ValidationStage } from './validationExperiment';

export const BOT_STRATEGY_VALIDATION_BINDING_SCHEMA = 'bot.strategy-validation-binding.v1' as const;

export interface StrategyValidationCandidateIdentity {
  strategyId: string;
  strategyRevision: string;
}

export interface StrategyValidationBindingInput extends StrategyValidationCandidateIdentity {
  experimentId: string;
  evaluation: ValidationEvaluation;
  promotionAuthority?: boolean;
  executionAuthority?: boolean;
  capitalAuthority?: boolean;
}

export interface StrategyValidationBinding extends StrategyValidationCandidateIdentity {
  schema: typeof BOT_STRATEGY_VALIDATION_BINDING_SCHEMA;
  experimentId: string;
  validationStatus: ValidationGateStatus;
  validationEligible: boolean;
  stageResultFingerprints: Readonly<Record<ValidationStage, string>>;
  promotionAuthority: false;
  executionAuthority: false;
  capitalAuthority: false;
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function assertAuthorityFalse(input: {
  promotionAuthority?: boolean;
  executionAuthority?: boolean;
  capitalAuthority?: boolean;
}): void {
  if (input.promotionAuthority || input.executionAuthority || input.capitalAuthority) {
    throw new Error('strategy validation binding cannot grant promotion, execution, or capital authority');
  }
}

export function bindStrategyCandidateToValidation(
  input: StrategyValidationBindingInput,
): Readonly<StrategyValidationBinding> {
  assertAuthorityFalse(input);
  const strategyId = requireText(input.strategyId, 'strategyId');
  const strategyRevision = requireText(input.strategyRevision, 'strategyRevision');
  const experimentId = requireText(input.experimentId, 'experimentId');

  if (input.evaluation.experimentId !== experimentId) {
    throw new Error('evaluation experimentId does not match Strategy Factory validation binding');
  }

  const stageResultFingerprints = Object.freeze({ ...input.evaluation.stageResultFingerprints });
  if (Object.keys(stageResultFingerprints).length === 0) {
    throw new Error('canonical validation stage-result fingerprints are required');
  }

  return Object.freeze({
    schema: BOT_STRATEGY_VALIDATION_BINDING_SCHEMA,
    strategyId,
    strategyRevision,
    experimentId,
    validationStatus: input.evaluation.status,
    validationEligible: input.evaluation.status === 'PASS',
    stageResultFingerprints,
    promotionAuthority: false,
    executionAuthority: false,
    capitalAuthority: false,
  });
}
