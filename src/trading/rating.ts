export const ORACLE_GRADE_ORDER = [
  'AAA+', 'AAA', 'AAA-',
  'AA+', 'AA', 'AA-',
  'A+', 'A', 'A-',
  'BBB', 'BB', 'B', 'CCC', 'CC', 'C',
  'D+', 'D', 'D-',
  'F+', 'F', 'F-',
] as const;

export type OracleGrade = typeof ORACLE_GRADE_ORDER[number];
export type OracleRatingTrend = 'UP' | 'STABLE' | 'DOWN' | 'NEW';
export type OracleDeploymentStatus = 'CHAMPION' | 'CHALLENGER' | 'INCUBATOR' | 'EXPERIMENT' | 'REJECT' | 'RETIRED';
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
  bands: OracleRatingBand[];
  highConfidenceThreshold: number;
  mediumConfidenceThreshold: number;
}

export interface OracleRatingResult {
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
  reasons: string[];
}

/**
 * Initial presentation mapping only. These cutoffs are governance defaults rather
 * than claims of statistical significance and should be recalibrated against the
 * empirical distribution of validated Black Oracle experiments once sample depth
 * is sufficient.
 */
export const DEFAULT_ORACLE_RATING_BANDS: OracleRatingBand[] = [
  { grade: 'AAA+', minScore: 97 },
  { grade: 'AAA', minScore: 94 },
  { grade: 'AAA-', minScore: 91 },
  { grade: 'AA+', minScore: 88 },
  { grade: 'AA', minScore: 85 },
  { grade: 'AA-', minScore: 82 },
  { grade: 'A+', minScore: 79 },
  { grade: 'A', minScore: 76 },
  { grade: 'A-', minScore: 73 },
  { grade: 'BBB', minScore: 68 },
  { grade: 'BB', minScore: 63 },
  { grade: 'B', minScore: 58 },
  { grade: 'CCC', minScore: 53 },
  { grade: 'CC', minScore: 48 },
  { grade: 'C', minScore: 43 },
  { grade: 'D+', minScore: 38 },
  { grade: 'D', minScore: 33 },
  { grade: 'D-', minScore: 28 },
  { grade: 'F+', minScore: 20 },
  { grade: 'F', minScore: 10 },
  { grade: 'F-', minScore: 0 },
];

export const DEFAULT_ORACLE_RATING_CONFIG: OracleRatingConfig = {
  bands: DEFAULT_ORACLE_RATING_BANDS,
  highConfidenceThreshold: 0.8,
  mediumConfidenceThreshold: 0.6,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const gradeIndex = (grade: OracleGrade) => ORACLE_GRADE_ORDER.indexOf(grade);

export const gradeFromScore = (
  score: number,
  config: OracleRatingConfig = DEFAULT_ORACLE_RATING_CONFIG,
): OracleGrade => {
  const safeScore = clamp(Number.isFinite(score) ? score : 0, 0, 100);
  const bands = config.bands.slice().sort((a, b) => b.minScore - a.minScore);
  return bands.find((band) => safeScore >= band.minScore)?.grade ?? 'F-';
};

export const worseGrade = (left: OracleGrade, right: OracleGrade): OracleGrade => (
  gradeIndex(left) >= gradeIndex(right) ? left : right
);

export const capGrade = (grade: OracleGrade, maximumAllowed: OracleGrade): OracleGrade => (
  gradeIndex(grade) < gradeIndex(maximumAllowed) ? maximumAllowed : grade
);

export const deploymentStatusForGrade = (grade: OracleGrade): OracleDeploymentStatus => {
  const index = gradeIndex(grade);
  if (index <= gradeIndex('AA-')) return 'CHAMPION';
  if (index <= gradeIndex('A-')) return 'CHALLENGER';
  if (grade === 'BBB') return 'INCUBATOR';
  if (grade === 'BB' || grade === 'B') return 'EXPERIMENT';
  if (grade === 'CCC' || grade === 'CC' || grade === 'C') return 'REJECT';
  return 'RETIRED';
};

export const ratingTrend = (
  current: OracleGrade,
  history: OracleRatingHistoryPoint[] = [],
): OracleRatingTrend => {
  if (history.length === 0) return 'NEW';
  const previous = history.slice().sort((a, b) => b.timestamp - a.timestamp)[0]?.grade;
  if (!previous) return 'NEW';
  const currentIndex = gradeIndex(current);
  const previousIndex = gradeIndex(previous);
  if (currentIndex < previousIndex) return 'UP';
  if (currentIndex > previousIndex) return 'DOWN';
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
    ? available.reduce((sum, dimension) => sum + Math.min(100, Math.max(0, dimension.score ?? 0)) * dimension.weight, 0) / availableWeight
    : 0;

  const confidenceScore = availableWeight > 0
    ? (
      available.reduce((sum, dimension) => {
        const dimensionConfidence = clamp(dimension.confidence ?? 1, 0, 1);
        return sum + dimensionConfidence * dimension.weight;
      }, 0) / availableWeight
    ) * coverage
    : 0;

  const baseGrade = gradeFromScore(rawScore, config);
  const failedGates = gates.filter((gate) => !gate.passed);
  const maxAllowedGrade = failedGates.length > 0
    ? failedGates.map((gate) => gate.maxGrade).reduce((worst, grade) => worseGrade(worst, grade))
    : null;
  const grade = maxAllowedGrade ? capGrade(baseGrade, maxAllowedGrade) : baseGrade;

  const missingRequiredDimensions = usable
    .filter((dimension) => dimension.required && (dimension.score == null || !Number.isFinite(dimension.score)))
    .map((dimension) => dimension.key);

  const reasons: string[] = [
    `Composite score ${rawScore.toFixed(2)} produced base grade ${baseGrade}.`,
    `Metric coverage is ${(coverage * 100).toFixed(1)}% with confidence ${(confidenceScore * 100).toFixed(1)}%.`,
  ];

  if (failedGates.length > 0) {
    reasons.push(`Hard gates capped the grade at ${maxAllowedGrade}: ${failedGates.map((gate) => gate.reason).join(' | ')}`);
  }
  if (missingRequiredDimensions.length > 0) {
    reasons.push(`Required dimensions missing: ${missingRequiredDimensions.join(', ')}.`);
  }

  return {
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
    reasons,
  };
};
