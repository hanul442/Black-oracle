import type { AnalystReview, AnalystReviewStance, ReportType } from '../../src/report/contracts';

export const REPORT_POLICY_VERSION = 1 as const;

export type DebatePolicyInput = {
  reportType: ReportType;
  reviews: AnalystReview[];
  materialEvent: boolean;
  materialGradeChange: boolean;
  highUncertainty: boolean;
  explicitDebateRequest?: boolean;
};

export type DebatePolicyDecision = {
  shouldDebate: boolean;
  shouldRunRedTeam: boolean;
  reasons: string[];
};

const STANCE_POLARITY: Readonly<Record<AnalystReviewStance, number | null>> = {
  STRONGLY_POSITIVE: 2,
  POSITIVE: 1,
  NEUTRAL: 0,
  NEGATIVE: -1,
  STRONGLY_NEGATIVE: -2,
  INSUFFICIENT_DATA: null,
};

const materialStanceSpread = (reviews: AnalystReview[]) => {
  const polarities = reviews
    .map((review) => STANCE_POLARITY[review.stance])
    .filter((value): value is number => value != null);
  if (polarities.length < 2) return 0;
  return Math.max(...polarities) - Math.min(...polarities);
};

const confidenceDispersion = (reviews: AnalystReview[]) => {
  const values = reviews
    .map((review) => review.confidence)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (values.length < 2) return 0;
  return Math.max(...values) - Math.min(...values);
};

export const decideDebatePolicy = (input: DebatePolicyInput): DebatePolicyDecision => {
  const reasons: string[] = [];
  const spread = materialStanceSpread(input.reviews);
  const confidenceSpread = confidenceDispersion(input.reviews);
  const explicit = Boolean(input.explicitDebateRequest);

  if (spread >= 2) reasons.push(`Material analyst stance spread detected (${spread}).`);
  if (confidenceSpread >= 0.35) reasons.push(`Material confidence dispersion detected (${confidenceSpread.toFixed(2)}).`);
  if (input.materialEvent) reasons.push('Material event requires explicit challenge of the updated thesis.');
  if (input.materialGradeChange) reasons.push('Material Grade change requires challenge before publication.');
  if (input.highUncertainty) reasons.push('High uncertainty requires adversarial review.');
  if (explicit) reasons.push('User explicitly requested Debate.');

  const shouldDebate = explicit
    || spread >= 2
    || confidenceSpread >= 0.35
    || input.materialEvent
    || input.materialGradeChange
    || input.highUncertainty;

  const shouldRunRedTeam = explicit
    || spread >= 3
    || input.materialEvent
    || input.materialGradeChange
    || input.highUncertainty;

  if (!shouldDebate) reasons.push('Analyst conclusions are sufficiently convergent; Debate is skipped to reduce cost and latency.');

  return { shouldDebate, shouldRunRedTeam, reasons };
};

export type ReportUpdatePolicyInput = {
  hasNewEvidence: boolean;
  materialEvidenceChange: boolean;
  gradeChanged: boolean;
  forecastChanged: boolean;
  leadConclusionChanged: boolean;
  correctionRequired: boolean;
};

export const shouldPublishNewReportVersion = (input: ReportUpdatePolicyInput) =>
  input.correctionRequired
  || input.materialEvidenceChange
  || input.gradeChanged
  || input.forecastChanged
  || input.leadConclusionChanged;

export const shouldRunFullResearchRefresh = (input: {
  hasNewEvidence: boolean;
  materialEvidenceChange: boolean;
  dataFreshnessRecovered: boolean;
  explicitUserRequest: boolean;
}) =>
  input.explicitUserRequest
  || input.materialEvidenceChange
  || input.dataFreshnessRecovered;
