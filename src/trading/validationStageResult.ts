import {
  REQUIRED_VALIDATION_STAGES,
  type ValidationExperimentManifest,
  type ValidationStage,
} from './validationExperiment';

export const BOT_VALIDATION_STAGE_RESULT_SCHEMA = 'bot.validation-stage-result.v1' as const;
export const BOT_VALIDATION_EVALUATION_SCHEMA = 'bot.validation-evaluation.v1' as const;

export type ValidationGateStatus = 'PASS' | 'BLOCKED' | 'INSUFFICIENT_DATA';

export interface ValidationStageMetrics {
  sampleCount: number;
  tradeCount: number;
  totalReturnPct?: number;
  maxDrawdownPct?: number;
  sharpe?: number;
}

export interface ValidationStageResultInput {
  experimentId: string;
  strategyId: string;
  strategyRevision: string;
  codeRevision: string;
  engineId: string;
  engineVersion: string;
  dataSnapshotId: string;
  stage: ValidationStage;
  completedAt: string;
  outputFingerprint: string;
  metrics: ValidationStageMetrics;
  diagnostics?: Readonly<Record<string, number | string | boolean | null>>;
  promotionAuthority?: boolean;
  executionAuthority?: boolean;
  capitalAuthority?: boolean;
}

export interface ValidationStageResult extends ValidationStageResultInput {
  schema: typeof BOT_VALIDATION_STAGE_RESULT_SCHEMA;
  promotionAuthority: false;
  executionAuthority: false;
  capitalAuthority: false;
}

export interface ValidationGateInput {
  gateId: string;
  status: ValidationGateStatus;
  reason: string;
  researchIds?: readonly string[];
}

export interface ValidationEvaluation {
  schema: typeof BOT_VALIDATION_EVALUATION_SCHEMA;
  experimentId: string;
  evaluatedAt: string;
  status: ValidationGateStatus;
  stageResultFingerprints: Readonly<Record<ValidationStage, string>>;
  gates: readonly Readonly<ValidationGateInput>[];
  promotionAuthority: false;
  executionAuthority: false;
  capitalAuthority: false;
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function requireTimestamp(value: string, field: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`);
  return value;
}

function requireNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be an integer >= 0`);
  return value;
}

function requireFiniteOptional(value: number | undefined, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) throw new Error(`${field} must be finite`);
  return value;
}

function assertAuthorityFalse(input: {
  promotionAuthority?: boolean;
  executionAuthority?: boolean;
  capitalAuthority?: boolean;
}): void {
  if (input.promotionAuthority || input.executionAuthority || input.capitalAuthority) {
    throw new Error('validation evidence cannot grant promotion, execution, or capital authority');
  }
}

function assertLineage(manifest: ValidationExperimentManifest, input: ValidationStageResultInput): void {
  const pairs: Array<[string, string, string]> = [
    ['experimentId', manifest.experimentId, input.experimentId],
    ['strategyId', manifest.strategyId, input.strategyId],
    ['strategyRevision', manifest.strategyRevision, input.strategyRevision],
    ['codeRevision', manifest.codeRevision, input.codeRevision],
    ['engineId', manifest.engineId, input.engineId],
    ['engineVersion', manifest.engineVersion, input.engineVersion],
    ['dataSnapshotId', manifest.dataSnapshotId, input.dataSnapshotId],
  ];
  for (const [field, expected, actual] of pairs) {
    if (expected !== actual) throw new Error(`${field} does not match validation experiment manifest`);
  }
  if (!manifest.stages.includes(input.stage)) {
    throw new Error(`stage ${input.stage} is not declared by validation experiment manifest`);
  }
}

export function createValidationStageResult(
  manifest: ValidationExperimentManifest,
  input: ValidationStageResultInput,
): Readonly<ValidationStageResult> {
  assertAuthorityFalse(input);
  assertLineage(manifest, input);

  const metrics: ValidationStageMetrics = {
    sampleCount: requireNonNegativeInteger(input.metrics.sampleCount, 'metrics.sampleCount'),
    tradeCount: requireNonNegativeInteger(input.metrics.tradeCount, 'metrics.tradeCount'),
  };
  const totalReturnPct = requireFiniteOptional(input.metrics.totalReturnPct, 'metrics.totalReturnPct');
  const maxDrawdownPct = requireFiniteOptional(input.metrics.maxDrawdownPct, 'metrics.maxDrawdownPct');
  const sharpe = requireFiniteOptional(input.metrics.sharpe, 'metrics.sharpe');
  if (totalReturnPct !== undefined) metrics.totalReturnPct = totalReturnPct;
  if (maxDrawdownPct !== undefined) metrics.maxDrawdownPct = maxDrawdownPct;
  if (sharpe !== undefined) metrics.sharpe = sharpe;

  const diagnostics = input.diagnostics ? Object.freeze({ ...input.diagnostics }) : undefined;
  for (const [key, value] of Object.entries(diagnostics ?? {})) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`diagnostics.${key} must be finite`);
    }
  }

  return Object.freeze({
    schema: BOT_VALIDATION_STAGE_RESULT_SCHEMA,
    experimentId: requireText(input.experimentId, 'experimentId'),
    strategyId: requireText(input.strategyId, 'strategyId'),
    strategyRevision: requireText(input.strategyRevision, 'strategyRevision'),
    codeRevision: requireText(input.codeRevision, 'codeRevision'),
    engineId: requireText(input.engineId, 'engineId'),
    engineVersion: requireText(input.engineVersion, 'engineVersion'),
    dataSnapshotId: requireText(input.dataSnapshotId, 'dataSnapshotId'),
    stage: input.stage,
    completedAt: requireTimestamp(input.completedAt, 'completedAt'),
    outputFingerprint: requireText(input.outputFingerprint, 'outputFingerprint'),
    metrics: Object.freeze(metrics),
    ...(diagnostics ? { diagnostics } : {}),
    promotionAuthority: false,
    executionAuthority: false,
    capitalAuthority: false,
  });
}

function aggregateGateStatus(gates: readonly ValidationGateInput[]): ValidationGateStatus {
  if (gates.some((gate) => gate.status === 'BLOCKED')) return 'BLOCKED';
  if (gates.some((gate) => gate.status === 'INSUFFICIENT_DATA')) return 'INSUFFICIENT_DATA';
  return 'PASS';
}

export function evaluateValidationExperiment(
  manifest: ValidationExperimentManifest,
  results: readonly ValidationStageResult[],
  gates: readonly ValidationGateInput[],
  evaluatedAt: string,
): Readonly<ValidationEvaluation> {
  if (results.length !== REQUIRED_VALIDATION_STAGES.length) {
    throw new Error('exactly one result per required validation stage is required');
  }

  const byStage = new Map<ValidationStage, ValidationStageResult>();
  for (const result of results) {
    assertLineage(manifest, result);
    if (byStage.has(result.stage)) throw new Error(`duplicate validation stage result: ${result.stage}`);
    byStage.set(result.stage, result);
  }
  for (const stage of REQUIRED_VALIDATION_STAGES) {
    if (!byStage.has(stage)) throw new Error(`missing validation stage result: ${stage}`);
  }
  if (gates.length === 0) throw new Error('at least one explicit validation gate is required');

  const gateIds = new Set<string>();
  const normalizedGates = gates.map((gate) => {
    const gateId = requireText(gate.gateId, 'gate.gateId');
    if (gateIds.has(gateId)) throw new Error(`duplicate validation gate: ${gateId}`);
    gateIds.add(gateId);
    const reason = requireText(gate.reason, 'gate.reason');
    if (!['PASS', 'BLOCKED', 'INSUFFICIENT_DATA'].includes(gate.status)) {
      throw new Error(`unsupported validation gate status: ${gate.status}`);
    }
    return Object.freeze({
      gateId,
      status: gate.status,
      reason,
      ...(gate.researchIds ? { researchIds: Object.freeze([...gate.researchIds]) } : {}),
    });
  });

  const stageResultFingerprints = Object.fromEntries(
    REQUIRED_VALIDATION_STAGES.map((stage) => [stage, requireText(byStage.get(stage)!.outputFingerprint, `${stage}.outputFingerprint`)]),
  ) as Record<ValidationStage, string>;

  return Object.freeze({
    schema: BOT_VALIDATION_EVALUATION_SCHEMA,
    experimentId: manifest.experimentId,
    evaluatedAt: requireTimestamp(evaluatedAt, 'evaluatedAt'),
    status: aggregateGateStatus(normalizedGates),
    stageResultFingerprints: Object.freeze(stageResultFingerprints),
    gates: Object.freeze(normalizedGates),
    promotionAuthority: false,
    executionAuthority: false,
    capitalAuthority: false,
  });
}
