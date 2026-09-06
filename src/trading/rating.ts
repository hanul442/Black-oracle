export const ORACLE_GRADE_ORDER = [
  'AAA+', 'AAA0', 'AAA-',
  'AA+', 'AA0', 'AA-',
  'A+', 'A0', 'A-',
  'BBB+', 'BBB0', 'BBB-',
  'BB+', 'BB0', 'BB-',
  'B+', 'B0', 'B-',
  'CCC+', 'CCC0', 'CCC-',
  'CC+', 'CC0', 'CC-',
  'C+', 'C0', 'C-',
  'D+', 'D0', 'D-',
  'F+', 'F0', 'F-',
] as const;

export type OracleGrade = typeof ORACLE_GRADE_ORDER[number];
export type OracleRatingTrend = 'UP' | 'STABLE' | 'DOWN' | 'NEW';
export type OracleDeploymentStatus = 'CHAMPION_CANDIDATE' | 'CHALLENGER' | 'INCUBATOR' | 'EXPERIMENT' | 'REJECT' | 'RETIRED';
export type OracleRatingConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export interface OracleRatingBand {
  grade: OracleGrade;
  minScore: number;
}

export interface OracleRatingDimension {
  key: string;
  label: string;
  score: number | null;
  weight: number;
  confidence?: number;
  required?: boolean;
}

export interface OracleRatingGate {
  key: string;
  passed: boolean;
  maxGrade: OracleGrade;
  reason: string;
}

export interface OracleRatingHistoryPoint {
  timestamp: number;
  grade: OracleGrade;
}

export interface OracleRatingConfig {
  version: string;
  bands: OracleRatingBand[];
  highConfidenceThreshold: number;
  mediumConfidenceThreshold: number;
}

export interface OracleRatingResult {
  version: string;
  grade: OracleGrade;
  baseGrade: OracleGrade;
  rawScore: number;
  coverage: number;
  confidenceScore: number;
  confidence: OracleRatingConfidence;
  trend: OracleRatingTrend;
  deploymentStatus: OracleDeploymentStatus;
  maxAllowedGrade: OracleGrade | null;
  appliedGateKeys: string[];
  missingRequiredDimensions: string[];
  dimensions: OracleRatingDimension[];
  reasons: string[];
  executionAuthority: false;
}

/**
 * Governance presentation bands, not statistically universal thresholds.
 * The bands are deliberately versioned and must be recalibrated from Black Oracle's
 * own validated experiment population once sample depth is sufficient.
 */
export const DEFAULT_ORACLE_RATING_BANDS: OracleRatingBand[] = [
  { grade: 'AAA+', minScore: 98 }, { grade: 'AAA0', minScore: 96 }, { grade: 'AAA-', minScore: 94 },
  { grade: 'AA+', minScore: 92 }, { grade: 'AA0', minScore: 90 }, { grade: 'AA-', minScore: 88 },
  { grade: 'A+', minScore: 86 }, { grade: 'A0', minScore: 84 }, { grade: 'A-', minScore: 82 },
  { grade: 'BBB+', minScore: 79 }, { grade: 'BBB0', minScore: 76 }, { grade: 'BBB-', minScore: 73 },
  { grade: 'BB+', minScore: 70 }, { grade: 'BB0', minScore: 67 }, { grade: 'BB-', minScore: 64 },
  { grade: 'B+', minScore: 61 }, { grade: 'B0', minScore: 58 }, { grade: 'B-', minScore: 55 },
  { grade: 'CCC+', minScore: 52 }, { grade: 'CCC0', minScore: 49 }, { grade: 'CCC-', minScore: 46 },
  { grade: 'CC+', minScore: 43 }, { grade: 'CC0', minScore: 40 }, { grade: 'CC-', minScore: 37 },
  { grade: 'C+', minScore: 34 }, { grade: 'C0', minScore: 31 }, { grade: 'C-', minScore: 28 },
  { grade: 'D+', minScore: 25 }, { grade: 'D0', minScore: 20 }, { grade: 'D-', minScore: 15 },
  { grade: 'F+', minScore: 10 }, { grade: 'F0', minScore: 5 }, { grade: 'F-', minScore: 0 },
];

export const DEFAULT_ORACLE_RATING_CONFIG: OracleRatingConfig = {
  version: 'BO-RATING-v0.2-governance',
  bands: DEFAULT_ORACLE_RATING_BANDS,
  highConfidenceThreshold: 0.8,
  mediumConfidenceThreshold: 0.6,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const gradeIndex = (grade: OracleGrade) => ORACLE_GRADE_ORDER.indexOf(grade);

export const gradeFromScore = (score: number, config: OracleRatingConfig = DEFAULT_ORACLE_RATING_CONFIG): OracleGrade => {
  const safeScore = clamp(Number.isFinite(score) ? score : 0, 0, 100);
  return config.bands.slice().sort((a, b) => b.minScore - a.minScore).find((band) => safeScore >= band.minScore)?.grade ?? 'F-';
};

export const worseGrade = (left: OracleGrade, right: OracleGrade): OracleGrade => gradeIndex(left) >= gradeIndex(right) ? left : right;
export const capGrade = (grade: OracleGrade, maximumAllowed: OracleGrade): OracleGrade => gradeIndex(grade) < gradeIndex(maximumAllowed) ? maximumAllowed : grade;

export const deploymentStatusForGrade = (grade: OracleGrade): OracleDeploymentStatus => {
  const index = gradeIndex(grade);
  if (index <= gradeIndex('AA-')) return 'CHAMPION_CANDIDATE';
  if (index <= gradeIndex('A-')) return 'CHALLENGER';
  if (index <= gradeIndex('BBB-')) return 'INCUBATOR';
  if (index <= gradeIndex('B-')) return 'EXPERIMENT';
  if (index <= gradeIndex('C-')) return 'REJECT';
  return 'RETIRED';
};

export const ratingTrend = (current: OracleGrade, history: OracleRatingHistoryPoint[] = []): OracleRatingTrend => {
  if (!history.length) return 'NEW';
  const previous = history.slice().sort((a, b) => b.timestamp - a.timestamp)[0]?.grade;
  if (!previous) return 'NEW';
  if (gradeIndex(current) < gradeIndex(previous)) return 'UP';
  if (gradeIndex(current) > gradeIndex(previous)) return 'DOWN';
  return 'STABLE';
};

const confidenceLabel = (score: number, config: OracleRatingConfig): OracleRatingConfidence => {
  if (score >= config.highConfidenceThreshold) return 'HIGH';
  if (score >= config.mediumConfidenceThreshold) return 'MEDIUM';
  if (score > 0) return 'LOW';
  return 'INSUFFICIENT';
};

export const buildOracleRating = (
  dimensions: OracleRatingDimension[],
  gates: OracleRatingGate[] = [],
  history: OracleRatingHistoryPoint[] = [],
  config: OracleRatingConfig = DEFAULT_ORACLE_RATING_CONFIG,
): OracleRatingResult => {
  const usable = dimensions.filter((dimension) => Number.isFinite(dimension.weight) && dimension.weight > 0);
  const totalWeight = usable.reduce((sum, dimension) => sum + dimension.weight, 0);
  const available = usable.filter((dimension) => dimension.score != null && Number.isFinite(dimension.score));
  const availableWeight = available.reduce((sum, dimension) => sum + dimension.weight, 0);
  const coverage = totalWeight > 0 ? availableWeight / totalWeight : 0;
  const rawScore = availableWeight > 0
    ? available.reduce((sum, dimension) => sum + clamp(dimension.score ?? 0, 0, 100) * dimension.weight, 0) / availableWeight
    : 0;
  const confidenceScore = availableWeight > 0
    ? (available.reduce((sum, dimension) => sum + clamp(dimension.confidence ?? 1, 0, 1) * dimension.weight, 0) / availableWeight) * coverage
    : 0;

  const baseGrade = gradeFromScore(rawScore, config);
  const failedGates = gates.filter((gate) => !gate.passed);
  const maxAllowedGrade = failedGates.length
    ? failedGates.map((gate) => gate.maxGrade).reduce((worst, grade) => worseGrade(worst, grade))
    : null;
  const grade = maxAllowedGrade ? capGrade(baseGrade, maxAllowedGrade) : baseGrade;
  const missingRequiredDimensions = usable
    .filter((dimension) => dimension.required && (dimension.score == null || !Number.isFinite(dimension.score)))
    .map((dimension) => dimension.key);

  const reasons = [
    `Composite score ${rawScore.toFixed(2)} produced base grade ${baseGrade}.`,
    `Metric coverage ${(coverage * 100).toFixed(1)}%; rating confidence ${(confidenceScore * 100).toFixed(1)}%.`,
  ];
  if (failedGates.length) reasons.push(`Hard gates capped grade at ${maxAllowedGrade}: ${failedGates.map((gate) => gate.reason).join(' | ')}`);
  if (missingRequiredDimensions.length) reasons.push(`Required dimensions missing: ${missingRequiredDimensions.join(', ')}.`);

  return {
    version: config.version,
    grade,
    baseGrade,
    rawScore,
    coverage,
    confidenceScore,
    confidence: confidenceLabel(confidenceScore, config),
    trend: ratingTrend(grade, history),
    deploymentStatus: deploymentStatusForGrade(grade),
    maxAllowedGrade,
    appliedGateKeys: failedGates.map((gate) => gate.key),
    missingRequiredDimensions,
    dimensions: usable,
    reasons,
    executionAuthority: false,
  };
};
