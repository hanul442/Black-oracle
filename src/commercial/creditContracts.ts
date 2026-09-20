/**
 * BLACK ORACLE commercial contracts for Plan entitlement and Credits.
 *
 * This file defines product contracts only. It does not charge money,
 * grant Credits, persist wallets, or enable billing.
 */

export const CREDIT_CONTRACT_VERSION = 1 as const;
export const CREDIT_UNIT = 100 as const;

export const PLAN_TIERS = ['CORE', 'PLUS', 'PRO', 'MAX', 'ENTERPRISE'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const CREDIT_WALLET_BUCKETS = [
  'RECURRING_PLAN',
  'PROMOTIONAL',
  'PURCHASED',
] as const;

export type CreditWalletBucket = (typeof CREDIT_WALLET_BUCKETS)[number];

export const CREDIT_ENTRY_KINDS = [
  'GRANT',
  'PURCHASE',
  'RESERVE',
  'DEBIT',
  'RELEASE',
  'REVERSAL',
  'ADJUSTMENT',
] as const;

export type CreditLedgerEntryKind = (typeof CREDIT_ENTRY_KINDS)[number];

export const CREDIT_JOB_STATUSES = [
  'QUOTED',
  'RESERVED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'REVERSED',
] as const;

export type CreditJobStatus = (typeof CREDIT_JOB_STATUSES)[number];

export const CREDIT_ACTION_TYPES = [
  'REPORT_SIMPLE_QUESTION',
  'NEWS_IMPACT_QUICK',
  'FILING_IMPACT_QUICK',
  'WATCHLIST_AI_SUMMARY',
  'GRADE_CHANGE_EXPLANATION',
  'REPORT_MARKER_EXPLANATION',
  'ANALYST_DISAGREEMENT_EXPLANATION',
  'ANALYST_INVITE_STANDARD',
  'ANALYST_INVITE_HIGH_COST',
  'RED_TEAM_FOCUSED_REVIEW',
  'REPORT_SECTION_REANALYSIS',
  'ASSET_COMPARE_2',
  'ASSET_COMPARE_3_TO_5',
  'REPORT_REFRESH',
  'EVENT_IMPACT_ANALYSIS',
  'FORECAST_ALTERNATIVE_HORIZON',
  'FORECAST_ALTERNATIVE_SCENARIO',
  'FORECAST_STRESS_ANALYSIS',
  'DEBATE_EXTRA_ROUND',
  'DEBATE_FULL_RERUN',
  'REPORT_NEW_SECURITY',
  'REPORT_NEW_CRYPTO',
  'REPORT_DEEP_COMPANY',
  'REPORT_DEEP_INDUSTRY_SECTOR',
  'REPORT_DEEP_MARKET',
  'RESEARCH_CUSTOM_DEEP',
  'RESEARCH_MULTI_ASSET_PACK',
  'EVIDENCE_SOURCE_CROSS_CHECK',
  'EVIDENCE_COUNTER_SCAN',
  'EVIDENCE_FRESH_MULTI_SOURCE_SWEEP',
  'EVIDENCE_DEEP_DOSSIER',
  'TECHNICAL_FRESH_INTERPRETATION',
  'TECHNICAL_RECALCULATE_SUPPORT_RESISTANCE',
  'WATCHLIST_FRESH_EVIDENCE_SCAN',
  'WATCHLIST_THEME_SYNTHESIS',
  'ALERT_CREATE',
  'ALERT_TRIGGER_RESEARCH',
  'SCHEDULED_RESEARCH_RUN',
] as const;

export type CreditActionType = (typeof CREDIT_ACTION_TYPES)[number];

export type CreditActionCatalogEntry = {
  actionType: CreditActionType;
  minimumPlan: PlanTier;
  defaultCredits: number | null;
  quoteRequired: boolean;
  description: string;
};

export const CREDIT_ACTION_CATALOG_V1: readonly CreditActionCatalogEntry[] = [
  { actionType: 'REPORT_SIMPLE_QUESTION', minimumPlan: 'PLUS', defaultCredits: 100, quoteRequired: false, description: 'One concise question over an existing entitled report.' },
  { actionType: 'NEWS_IMPACT_QUICK', minimumPlan: 'PLUS', defaultCredits: 100, quoteRequired: false, description: 'Quick impact analysis of one news item.' },
  { actionType: 'FILING_IMPACT_QUICK', minimumPlan: 'PLUS', defaultCredits: 100, quoteRequired: false, description: 'Quick impact analysis of one filing.' },
  { actionType: 'WATCHLIST_AI_SUMMARY', minimumPlan: 'PLUS', defaultCredits: 100, quoteRequired: false, description: 'AI summary from existing watchlist research state.' },
  { actionType: 'GRADE_CHANGE_EXPLANATION', minimumPlan: 'PLUS', defaultCredits: 100, quoteRequired: false, description: 'Explain a Grade change using existing report state.' },
  { actionType: 'REPORT_MARKER_EXPLANATION', minimumPlan: 'PLUS', defaultCredits: 100, quoteRequired: false, description: 'Explain one historical report marker.' },
  { actionType: 'ANALYST_DISAGREEMENT_EXPLANATION', minimumPlan: 'PLUS', defaultCredits: 100, quoteRequired: false, description: 'Explain a bounded analyst disagreement.' },
  { actionType: 'ANALYST_INVITE_STANDARD', minimumPlan: 'PRO', defaultCredits: 200, quoteRequired: false, description: 'Invite one standard specialist to an existing report.' },
  { actionType: 'ANALYST_INVITE_HIGH_COST', minimumPlan: 'PRO', defaultCredits: 300, quoteRequired: false, description: 'Invite one high-cost specialist.' },
  { actionType: 'RED_TEAM_FOCUSED_REVIEW', minimumPlan: 'PRO', defaultCredits: 300, quoteRequired: false, description: 'Focused adversarial review over existing evidence.' },
  { actionType: 'REPORT_SECTION_REANALYSIS', minimumPlan: 'PRO', defaultCredits: 300, quoteRequired: false, description: 'Re-analyze one report section.' },
  { actionType: 'ASSET_COMPARE_2', minimumPlan: 'PRO', defaultCredits: 300, quoteRequired: false, description: 'Compare two assets using existing report state.' },
  { actionType: 'ASSET_COMPARE_3_TO_5', minimumPlan: 'PRO', defaultCredits: 500, quoteRequired: false, description: 'Compare three to five assets using existing report state.' },
  { actionType: 'REPORT_REFRESH', minimumPlan: 'PRO', defaultCredits: 500, quoteRequired: false, description: 'Refresh an existing report with current evidence.' },
  { actionType: 'EVENT_IMPACT_ANALYSIS', minimumPlan: 'PRO', defaultCredits: 500, quoteRequired: true, description: 'Analyze a material event and its report implications.' },
  { actionType: 'FORECAST_ALTERNATIVE_HORIZON', minimumPlan: 'PRO', defaultCredits: 500, quoteRequired: false, description: 'Generate an alternative forecast horizon.' },
  { actionType: 'FORECAST_ALTERNATIVE_SCENARIO', minimumPlan: 'PRO', defaultCredits: 500, quoteRequired: false, description: 'Generate an alternative Bull/Base/Bear scenario.' },
  { actionType: 'FORECAST_STRESS_ANALYSIS', minimumPlan: 'MAX', defaultCredits: 700, quoteRequired: false, description: 'Run a deeper forecast stress analysis.' },
  { actionType: 'DEBATE_EXTRA_ROUND', minimumPlan: 'MAX', defaultCredits: 500, quoteRequired: false, description: 'Run one additional structured debate round.' },
  { actionType: 'DEBATE_FULL_RERUN', minimumPlan: 'MAX', defaultCredits: 700, quoteRequired: false, description: 'Rerun the full debate pipeline.' },
  { actionType: 'REPORT_NEW_SECURITY', minimumPlan: 'MAX', defaultCredits: 1000, quoteRequired: false, description: 'Request a new Security Report.' },
  { actionType: 'REPORT_NEW_CRYPTO', minimumPlan: 'MAX', defaultCredits: 1000, quoteRequired: false, description: 'Request a new Crypto Report.' },
  { actionType: 'REPORT_DEEP_COMPANY', minimumPlan: 'MAX', defaultCredits: 1500, quoteRequired: false, description: 'Request a deep Company Report.' },
  { actionType: 'REPORT_DEEP_INDUSTRY_SECTOR', minimumPlan: 'MAX', defaultCredits: 2000, quoteRequired: false, description: 'Request deep Industry/Sector research.' },
  { actionType: 'REPORT_DEEP_MARKET', minimumPlan: 'MAX', defaultCredits: 2000, quoteRequired: false, description: 'Request a deep Market Report.' },
  { actionType: 'RESEARCH_CUSTOM_DEEP', minimumPlan: 'MAX', defaultCredits: null, quoteRequired: true, description: 'Custom deep research with quoted scope.' },
  { actionType: 'RESEARCH_MULTI_ASSET_PACK', minimumPlan: 'MAX', defaultCredits: null, quoteRequired: true, description: 'Multi-asset research pack with quoted scope.' },
  { actionType: 'EVIDENCE_SOURCE_CROSS_CHECK', minimumPlan: 'PRO', defaultCredits: 200, quoteRequired: false, description: 'Cross-check a bounded claim across sources.' },
  { actionType: 'EVIDENCE_COUNTER_SCAN', minimumPlan: 'PRO', defaultCredits: 300, quoteRequired: false, description: 'Search for counterevidence against a thesis.' },
  { actionType: 'EVIDENCE_FRESH_MULTI_SOURCE_SWEEP', minimumPlan: 'PRO', defaultCredits: 500, quoteRequired: false, description: 'Fresh multi-source evidence sweep.' },
  { actionType: 'EVIDENCE_DEEP_DOSSIER', minimumPlan: 'MAX', defaultCredits: null, quoteRequired: true, description: 'Deep evidence dossier.' },
  { actionType: 'TECHNICAL_FRESH_INTERPRETATION', minimumPlan: 'PRO', defaultCredits: 200, quoteRequired: false, description: 'Fresh technical interpretation over current market data.' },
  { actionType: 'TECHNICAL_RECALCULATE_SUPPORT_RESISTANCE', minimumPlan: 'PRO', defaultCredits: 200, quoteRequired: false, description: 'Recalculate support/resistance interpretation.' },
  { actionType: 'WATCHLIST_FRESH_EVIDENCE_SCAN', minimumPlan: 'PRO', defaultCredits: 300, quoteRequired: false, description: 'Fresh evidence scan for a watchlist.' },
  { actionType: 'WATCHLIST_THEME_SYNTHESIS', minimumPlan: 'PRO', defaultCredits: 500, quoteRequired: false, description: 'Cross-watchlist theme synthesis.' },
  { actionType: 'ALERT_CREATE', minimumPlan: 'PLUS', defaultCredits: null, quoteRequired: true, description: 'Create a duration/complexity-priced Alert.' },
  { actionType: 'ALERT_TRIGGER_RESEARCH', minimumPlan: 'MAX', defaultCredits: null, quoteRequired: true, description: 'Run research triggered by an Alert.' },
  { actionType: 'SCHEDULED_RESEARCH_RUN', minimumPlan: 'MAX', defaultCredits: null, quoteRequired: true, description: 'Run one scheduled research job.' },
] as const;

export const PLAN_RECURRING_CREDITS: Readonly<Record<Exclude<PlanTier, 'ENTERPRISE'>, {
  dailyGrant: number;
  recurringBalanceCap: number;
}>> = {
  CORE: { dailyGrant: 0, recurringBalanceCap: 0 },
  PLUS: { dailyGrant: 500, recurringBalanceCap: 15_000 },
  PRO: { dailyGrant: 1_500, recurringBalanceCap: 45_000 },
  MAX: { dailyGrant: 5_000, recurringBalanceCap: 150_000 },
};

export type CreditWalletBalance = {
  accountId: string;
  recurringPlanCredits: number;
  promotionalCredits: number;
  purchasedCredits: number;
  updatedAt: number;
};

export type CreditQuote = {
  quoteId: string;
  contractVersion: typeof CREDIT_CONTRACT_VERSION;
  accountId: string;
  plan: PlanTier;
  actionType: CreditActionType;
  credits: number;
  expiresAt: number;
  scopeSummary: string;
  freshSearchRequired: boolean;
  analystCount?: number | null;
  debateRounds?: number | null;
  maxFutureCharge?: number | null;
  requiresExplicitApproval: boolean;
};

export type CreditJob = {
  jobId: string;
  quoteId: string;
  accountId: string;
  actionType: CreditActionType;
  status: CreditJobStatus;
  reportId?: string | null;
  alertId?: string | null;
  scheduledJobId?: string | null;
  reservedCredits: number;
  settledCredits: number | null;
  createdAt: number;
  startedAt?: number | null;
  finishedAt?: number | null;
  failureCode?: string | null;
};

export type CreditLedgerEntry = {
  entryId: string;
  accountId: string;
  bucket: CreditWalletBucket;
  kind: CreditLedgerEntryKind;
  credits: number;
  actionType?: CreditActionType | null;
  quoteId?: string | null;
  jobId?: string | null;
  relatedEntryId?: string | null;
  occurredAt: number;
  reason: string;
};

export type AlertOperator = 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'CHANGED' | 'INCREASED_BY' | 'DECREASED_BY';

export type AlertLeafRule = {
  kind: 'CONDITION';
  field:
    | 'PRICE'
    | 'PRICE_CHANGE_PCT'
    | 'GRADE'
    | 'GRADE_CHANGE'
    | 'NEW_REPORT'
    | 'NEW_FILING'
    | 'MATERIAL_EVENT'
    | 'FORECAST_CHANGE'
    | 'SUPPORT_ZONE'
    | 'RESISTANCE_ZONE'
    | 'ANALYST_CONSENSUS'
    | 'SEMANTIC_EVENT';
  operator: AlertOperator;
  value?: string | number | boolean | null;
  semanticPrompt?: string | null;
};

export type AlertRule =
  | AlertLeafRule
  | {
      kind: 'GROUP';
      operator: 'AND' | 'OR';
      children: AlertRule[];
    };

export type AlertTriggeredAction = {
  actionType: Exclude<CreditActionType, 'ALERT_CREATE'>;
  quotedCreditsPerRun: number;
  maxRuns: number;
  maxCreditSpend: number;
};

export type AlertContract = {
  alertId: string;
  accountId: string;
  plan: PlanTier;
  subjectIds: string[];
  rule: AlertRule;
  startsAt: number;
  expiresAt: number;
  monitoringCredits: number;
  semanticAiRequired: boolean;
  triggeredAction?: AlertTriggeredAction | null;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';
  createdAt: number;
};

export const isValidCreditAmount = (credits: unknown): credits is number =>
  typeof credits === 'number'
  && Number.isInteger(credits)
  && credits >= 0
  && credits % CREDIT_UNIT === 0;

const PLAN_RANK: Readonly<Record<PlanTier, number>> = {
  CORE: 0,
  PLUS: 1,
  PRO: 2,
  MAX: 3,
  ENTERPRISE: 4,
};

export const planSatisfies = (plan: PlanTier, minimumPlan: PlanTier) =>
  PLAN_RANK[plan] >= PLAN_RANK[minimumPlan];

export const creditCatalogEntry = (actionType: CreditActionType) =>
  CREDIT_ACTION_CATALOG_V1.find((entry) => entry.actionType === actionType) ?? null;
