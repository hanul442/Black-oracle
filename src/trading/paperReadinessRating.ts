import { buildOracleRating, type OracleRatingGate, type OracleRatingResult } from './rating.ts';

export type ValidationVerdict = 'PASS' | 'WATCH' | 'REJECT' | 'INSUFFICIENT_DATA';

export interface PaperReadinessRatingInput {
  evidenceCoverage: number | null;
  auditAverage: number | null;
  historicalVerdict: ValidationVerdict;
  walkForwardVerdict: ValidationVerdict;
  monteCarloVerdict: ValidationVerdict;
  integrityCoverageDays: number;
  integrityRequiredDays: number;
  integrityCoverageComplete: boolean;
  fatalRuntimeIncidents: number | null;
  unresolvedCriticalIncidents: number | null;
  runtimeHealthy: boolean;
  closedTrades: number;
  requiredClosedTrades: number;
  observationDays: number;
  requiredObservationDays: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const ratioScore = (value: number | null) => value == null || !Number.isFinite(value) ? null : clamp01(value) * 100;
const verdictScore = (verdict: ValidationVerdict) => verdict === 'PASS' ? 100 : verdict === 'WATCH' ? 60 : verdict === 'INSUFFICIENT_DATA' ? 30 : 0;

export const buildPaperReadinessRating = (input: PaperReadinessRatingInput): OracleRatingResult => {
  const integrityCoverage = input.integrityRequiredDays > 0 ? clamp01(input.integrityCoverageDays / input.integrityRequiredDays) : 0;
  const sampleCoverage = input.requiredClosedTrades > 0 ? clamp01(input.closedTrades / input.requiredClosedTrades) : 0;
  const dayCoverage = input.requiredObservationDays > 0 ? clamp01(input.observationDays / input.requiredObservationDays) : 0;
  const sampleDepthScore = Math.min(sampleCoverage, dayCoverage) * 100;
  const criticalIncidents = Math.max(0, input.fatalRuntimeIncidents ?? 0) + Math.max(0, input.unresolvedCriticalIncidents ?? 0);

  const gates: OracleRatingGate[] = [
    {
      key: 'historical-oos-pass',
      passed: input.historicalVerdict === 'PASS',
      maxGrade: 'BBB0',
      reason: `Historical/OOS validation is ${input.historicalVerdict}.`,
    },
    {
      key: 'walk-forward-pass',
      passed: input.walkForwardVerdict === 'PASS',
      maxGrade: 'BBB0',
      reason: `Walk-forward validation is ${input.walkForwardVerdict}.`,
    },
    {
      key: 'monte-carlo-pass',
      passed: input.monteCarloVerdict === 'PASS',
      maxGrade: 'BBB0',
      reason: `Monte Carlo validation is ${input.monteCarloVerdict}.`,
    },
    {
      key: 'sample-depth',
      passed: input.closedTrades >= input.requiredClosedTrades && input.observationDays >= input.requiredObservationDays,
      maxGrade: 'BBB0',
      reason: `Sample depth is ${input.closedTrades}/${input.requiredClosedTrades} trades and ${input.observationDays.toFixed(1)}/${input.requiredObservationDays} days.`,
    },
    {
      key: 'evidence-coverage',
      passed: (input.evidenceCoverage ?? 0) >= 0.95,
      maxGrade: (input.evidenceCoverage ?? 0) < 0.5 ? 'B0' : (input.evidenceCoverage ?? 0) < 0.8 ? 'BB0' : 'BBB0',
      reason: `Evidence-linked execution coverage is ${((input.evidenceCoverage ?? 0) * 100).toFixed(1)}%.`,
    },
    {
      key: 'audit-completeness',
      passed: (input.auditAverage ?? 0) >= 0.9,
      maxGrade: (input.auditAverage ?? 0) < 0.7 ? 'BB0' : 'BBB0',
      reason: `Execution audit completeness is ${((input.auditAverage ?? 0) * 100).toFixed(1)}%.`,
    },
    {
      key: 'integrity-window',
      passed: input.integrityCoverageComplete,
      maxGrade: 'BBB0',
      reason: `Integrity coverage is ${input.integrityCoverageDays.toFixed(1)}/${input.integrityRequiredDays} days.`,
    },
    {
      key: 'critical-incidents',
      passed: criticalIncidents === 0,
      maxGrade: 'CCC0',
      reason: `${criticalIncidents} fatal/unresolved critical incident(s) remain.`,
    },
    {
      key: 'runtime-health',
      passed: input.runtimeHealthy,
      maxGrade: 'B0',
      reason: 'Current PAPER runtime is not healthy.',
    },
  ];

  return buildOracleRating([
    { key: 'evidence', label: 'Evidence Coverage', score: ratioScore(input.evidenceCoverage), weight: 0.17, confidence: input.evidenceCoverage == null ? 0 : 1, required: true },
    { key: 'audit', label: 'Audit Completeness', score: ratioScore(input.auditAverage), weight: 0.14, confidence: input.auditAverage == null ? 0 : 1, required: true },
    { key: 'historical', label: 'Historical/OOS Validation', score: verdictScore(input.historicalVerdict), weight: 0.17, confidence: input.historicalVerdict === 'INSUFFICIENT_DATA' ? 0.35 : 1, required: true },
    { key: 'walkForward', label: 'Walk-Forward Validation', score: verdictScore(input.walkForwardVerdict), weight: 0.15, confidence: input.walkForwardVerdict === 'INSUFFICIENT_DATA' ? 0.35 : 1, required: true },
    { key: 'monteCarlo', label: 'Monte Carlo Stress', score: verdictScore(input.monteCarloVerdict), weight: 0.15, confidence: input.monteCarloVerdict === 'INSUFFICIENT_DATA' ? 0.35 : 1, required: true },
    { key: 'integrity', label: 'Integrity Coverage', score: integrityCoverage * 100, weight: 0.1, confidence: input.integrityCoverageComplete ? 1 : integrityCoverage, required: true },
    { key: 'sampleDepth', label: 'Sample Depth', score: sampleDepthScore, weight: 0.07, confidence: Math.min(sampleCoverage, dayCoverage), required: true },
    { key: 'runtime', label: 'Runtime Health', score: input.runtimeHealthy ? 100 : 0, weight: 0.05, confidence: 1, required: true },
  ], gates);
};
