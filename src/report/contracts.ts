/**
 * BLACK ORACLE report-first domain contracts.
 *
 * Additive contract only:
 * - no API wiring
 * - no database migration
 * - no AutoTrade/runtime authority
 *
 * Product source: Product Constitution v3 draft.
 */

export const REPORT_CONTRACT_VERSION = 1 as const;

export const REPORT_TYPES = [
  'MARKET',
  'INDUSTRY',
  'SECTOR',
  'COMPANY',
  'SECURITY',
  'EVENT',
  'CRYPTO',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_STATUSES = [
  'PUBLISHED',
  'CORRECTED',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const INVESTMENT_ATTRACTIVENESS_GRADES = [
  'AAA+',
  'AAA',
  'AAA-',
  'AA+',
  'AA',
  'AA-',
  'A+',
  'A',
  'A-',
  'BBB',
  'BB',
  'B',
  'CCC',
  'CC',
  'C',
  'D+',
  'D',
  'D-',
  'F+',
  'F',
  'F-',
] as const;

export type InvestmentAttractivenessGrade = (typeof INVESTMENT_ATTRACTIVENESS_GRADES)[number];

export const ANALYST_REVIEW_STANCES = [
  'STRONGLY_POSITIVE',
  'POSITIVE',
  'NEUTRAL',
  'NEGATIVE',
  'STRONGLY_NEGATIVE',
  'INSUFFICIENT_DATA',
] as const;

export type AnalystReviewStance = (typeof ANALYST_REVIEW_STANCES)[number];

export const EVIDENCE_CLASSES = [
  'FACT',
  'RESEARCH',
  'SIGNAL',
  'SENTIMENT',
  'INFERENCE',
  'COUNTEREVIDENCE',
  'DATA_GAP',
] as const;

export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export type EvidenceReference = {
  evidenceId: string;
  evidenceClass: EvidenceClass;
  title?: string | null;
  source?: string | null;
  observedAt?: number | null;
  publishedAt?: number | null;
  freshness?: 'CURRENT' | 'DELAYED' | 'STALE' | 'UNKNOWN';
  provenanceUrl?: string | null;
};

export type ReportSubject = {
  subjectId: string;
  subjectType: 'MARKET' | 'INDUSTRY' | 'SECTOR' | 'COMPANY' | 'SECURITY' | 'CRYPTO_ASSET' | 'EVENT';
  canonicalSymbol?: string | null;
  displayName: string;
  market?: string | null;
  assetClass?: string | null;
};

export type AnalystIdentity = {
  analystId: string;
  role: string;
  domain: string;
  methodVersion: string;
  promptVersion: string;
  configVersion?: string | null;
  forecastHorizon?: string | null;
};

export type AnalystReview = {
  reviewId: string;
  reportId: string;
  reportVersion: number;
  analyst: AnalystIdentity;
  asOf: number;
  knowledgeCutoff: number;
  stance: AnalystReviewStance;
  confidence: number | null;
  assessment: string;
  facts: string[];
  inferences: string[];
  assumptions: string[];
  supportingEvidence: EvidenceReference[];
  counterevidence: EvidenceReference[];
  dataGaps: string[];
  strongestCounterargument: string | null;
  invalidationConditions: string[];
  forecastContribution?: {
    horizon?: string | null;
    expectedDirection?: 'UP' | 'DOWN' | 'RANGE' | 'UNCERTAIN';
    fairValue?: number | null;
    currency?: string | null;
    lowerBound?: number | null;
    upperBound?: number | null;
    rationale?: string | null;
  } | null;
};

export type DebateTurn = {
  turnId: string;
  round: number;
  sequence: number;
  analystId: string;
  targetAnalystId?: string | null;
  claim: string;
  evidenceIds: string[];
  counterevidenceIds: string[];
  concession?: string | null;
  unresolvedIssue?: string | null;
  createdAt: number;
};

export type DebateSession = {
  debateId: string;
  reportId: string;
  reportVersion: number;
  triggered: boolean;
  triggerReason: string | null;
  participantAnalystIds: string[];
  redTeamAnalystId?: string | null;
  turns: DebateTurn[];
  materialDisagreements: string[];
  resolvedDisagreements: string[];
  unresolvedDisagreements: string[];
  summary: string | null;
  startedAt: number | null;
  completedAt: number | null;
};

export type DomainLeadSynthesis = {
  synthesisId: string;
  reportId: string;
  reportVersion: number;
  leadAnalyst: AnalystIdentity;
  asOf: number;
  grade: InvestmentAttractivenessGrade | null;
  confidence: number | null;
  oneLineAssessment: string;
  thesis: string;
  supportingPoints: string[];
  opposingPoints: string[];
  preservedDissent: string[];
  majorRisks: string[];
  invalidationConditions: string[];
  limitations: string[];
};

export type ForecastPoint = {
  at: number;
  value: number;
};

export type ForecastScenario = {
  label: 'BULL' | 'BASE' | 'BEAR';
  targetPrice: number | null;
  currency: string | null;
  probability: number | null;
  rationale: string;
  path?: ForecastPoint[];
};

export type ReportForecast = {
  forecastId: string;
  reportId: string;
  reportVersion: number;
  publishedAt: number;
  asOf: number;
  horizonLabel: string;
  horizonEndAt: number | null;
  scenarios: ForecastScenario[];
  supportZones: Array<{ lower: number; upper: number; rationale: string[] }>;
  resistanceZones: Array<{ lower: number; upper: number; rationale: string[] }>;
  invalidationConditions: string[];
  status: 'ACTIVE' | 'MATURED' | 'INVALIDATED' | 'UNAVAILABLE';
};

export type ForecastEvaluation = {
  evaluationId: string;
  forecastId: string;
  evaluatedAt: number;
  observationStartAt: number;
  observationEndAt: number;
  actualStartPrice: number | null;
  actualEndPrice: number | null;
  actualHighPrice: number | null;
  actualLowPrice: number | null;
  directionResult: 'CORRECT' | 'INCORRECT' | 'AMBIGUOUS' | 'NOT_EVALUABLE';
  baseTargetAbsoluteErrorPct: number | null;
  timingErrorMs: number | null;
  brierScore?: number | null;
  notes: string[];
};

export type GeneralActionGuide = {
  horizon: string | null;
  attractivenessSummary: string;
  approach: 'OBSERVE' | 'STAGED_APPROACH' | 'AVOID_CHASING' | 'CAUTIOUS' | 'NO_GUIDANCE';
  approachRationale: string[];
  supportResistanceSummary: string | null;
  risks: string[];
  invalidationConditions: string[];
};

export type ReportVersion = {
  contractVersion: typeof REPORT_CONTRACT_VERSION;
  reportId: string;
  version: number;
  reportType: ReportType;
  status: ReportStatus;
  subject: ReportSubject;
  asOf: number;
  evidenceCutoff: number;
  createdAt: number;
  publishedAt: number;
  correctedAt?: number | null;
  supersedesReportVersionId?: string | null;
  correctionReason?: string | null;
  grade: InvestmentAttractivenessGrade | null;
  confidence: number | null;
  oneLineAssessment: string;
  executiveSummary: string;
  sectionKeys: string[];
  evidenceIds: string[];
  analystReviewIds: string[];
  debateId: string | null;
  leadSynthesisId: string | null;
  forecastId: string | null;
  generalActionGuide?: GeneralActionGuide | null;
  limitations: string[];
};

export type ReportCardProjection = {
  reportId: string;
  version: number;
  reportType: ReportType;
  subjectId: string;
  displayName: string;
  canonicalSymbol?: string | null;
  currentPrice?: number | null;
  currency?: string | null;
  grade: InvestmentAttractivenessGrade | null;
  previousGrade?: InvestmentAttractivenessGrade | null;
  oneLineAssessment: string;
  publishedAt: number | null;
  isNew: boolean;
  isMaterialGradeChange: boolean;
};

export type ReportTrace = {
  reportId: string;
  reportVersion: number;
  evidenceIds: string[];
  analystReviewIds: string[];
  debateId: string | null;
  leadSynthesisId: string | null;
  forecastId: string | null;
  sourceEventIds: string[];
};

export const isInvestmentAttractivenessGrade = (
  value: unknown,
): value is InvestmentAttractivenessGrade =>
  typeof value === 'string'
  && (INVESTMENT_ATTRACTIVENESS_GRADES as readonly string[]).includes(value);

export const reportVersionKey = (reportId: string, version: number) =>
  `${reportId}:v${Math.max(1, Math.trunc(version))}`;
