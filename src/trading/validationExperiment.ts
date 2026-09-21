export const BOT_VALIDATION_EXPERIMENT_SCHEMA = 'bot.validation-experiment.v1' as const;

export const REQUIRED_VALIDATION_STAGES = [
  'BACKTEST',
  'OOS',
  'WALK_FORWARD',
  'MONTE_CARLO',
  'EXECUTION_COST_STRESS',
] as const;

export type ValidationStage = (typeof REQUIRED_VALIDATION_STAGES)[number];

export interface ValidationWindow {
  startAt: string;
  endAt: string;
}

export interface ValidationSplitManifest {
  train: ValidationWindow;
  outOfSample: ValidationWindow;
  walkForwardFolds: number;
}

export interface ValidationExecutionAssumptions {
  feeBps: number;
  spreadBps: number;
  slippageBps: number;
}

export interface ValidationExperimentManifest {
  schema: typeof BOT_VALIDATION_EXPERIMENT_SCHEMA;
  experimentId: string;
  strategyId: string;
  strategyRevision: string;
  codeRevision: string;
  engineId: string;
  engineVersion: string;
  dataSnapshotId: string;
  observedThrough: string;
  pointInTimeSafe: true;
  split: ValidationSplitManifest;
  execution: ValidationExecutionAssumptions;
  stages: readonly ValidationStage[];
  promotionAuthority: false;
  executionAuthority: false;
  capitalAuthority: false;
}

export interface ValidationExperimentInput {
  experimentId: string;
  strategyId: string;
  strategyRevision: string;
  codeRevision: string;
  engineId: string;
  engineVersion: string;
  dataSnapshotId: string;
  observedThrough: string;
  pointInTimeSafe: boolean;
  split: ValidationSplitManifest;
  execution: ValidationExecutionAssumptions;
  stages: readonly ValidationStage[];
  promotionAuthority?: boolean;
  executionAuthority?: boolean;
  capitalAuthority?: boolean;
}

function requireIdentity(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function parseTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be an ISO timestamp`);
  return parsed;
}

function validateWindow(window: ValidationWindow, field: string): ValidationWindow {
  const start = parseTimestamp(window.startAt, `${field}.startAt`);
  const end = parseTimestamp(window.endAt, `${field}.endAt`);
  if (start >= end) throw new Error(`${field} must have startAt < endAt`);
  return { startAt: window.startAt, endAt: window.endAt };
}

function validateExecutionAssumptions(
  execution: ValidationExecutionAssumptions,
): ValidationExecutionAssumptions {
  for (const [field, value] of Object.entries(execution)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`execution.${field} must be finite and >= 0`);
    }
  }
  return { ...execution };
}

function validateStages(stages: readonly ValidationStage[]): readonly ValidationStage[] {
  const unique = new Set(stages);
  if (unique.size !== stages.length) throw new Error('validation stages must be unique');
  for (const required of REQUIRED_VALIDATION_STAGES) {
    if (!unique.has(required)) throw new Error(`missing required validation stage: ${required}`);
  }
  if (unique.size !== REQUIRED_VALIDATION_STAGES.length) {
    throw new Error('unknown validation stage');
  }
  return Object.freeze([...REQUIRED_VALIDATION_STAGES]);
}

export function createValidationExperimentManifest(
  input: ValidationExperimentInput,
): Readonly<ValidationExperimentManifest> {
  if (!input.pointInTimeSafe) {
    throw new Error('point-in-time-safe data is required for validation');
  }
  if (input.promotionAuthority || input.executionAuthority || input.capitalAuthority) {
    throw new Error('validation experiment cannot grant promotion, execution, or capital authority');
  }

  const train = validateWindow(input.split.train, 'split.train');
  const outOfSample = validateWindow(input.split.outOfSample, 'split.outOfSample');
  if (Date.parse(train.endAt) > Date.parse(outOfSample.startAt)) {
    throw new Error('train and out-of-sample windows must not overlap');
  }
  if (!Number.isInteger(input.split.walkForwardFolds) || input.split.walkForwardFolds < 2) {
    throw new Error('split.walkForwardFolds must be an integer >= 2');
  }

  const observedThrough = parseTimestamp(input.observedThrough, 'observedThrough');
  if (observedThrough < Date.parse(outOfSample.endAt)) {
    throw new Error('observedThrough cannot precede the end of the out-of-sample window');
  }

  const manifest: ValidationExperimentManifest = {
    schema: BOT_VALIDATION_EXPERIMENT_SCHEMA,
    experimentId: requireIdentity(input.experimentId, 'experimentId'),
    strategyId: requireIdentity(input.strategyId, 'strategyId'),
    strategyRevision: requireIdentity(input.strategyRevision, 'strategyRevision'),
    codeRevision: requireIdentity(input.codeRevision, 'codeRevision'),
    engineId: requireIdentity(input.engineId, 'engineId'),
    engineVersion: requireIdentity(input.engineVersion, 'engineVersion'),
    dataSnapshotId: requireIdentity(input.dataSnapshotId, 'dataSnapshotId'),
    observedThrough: input.observedThrough,
    pointInTimeSafe: true,
    split: Object.freeze({ train: Object.freeze(train), outOfSample: Object.freeze(outOfSample), walkForwardFolds: input.split.walkForwardFolds }),
    execution: Object.freeze(validateExecutionAssumptions(input.execution)),
    stages: validateStages(input.stages),
    promotionAuthority: false,
    executionAuthority: false,
    capitalAuthority: false,
  };

  return Object.freeze(manifest);
}
