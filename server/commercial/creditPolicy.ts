import {
  CREDIT_ACTION_CATALOG_V1,
  CREDIT_UNIT,
  PLAN_RECURRING_CREDITS,
  creditCatalogEntry,
  isValidCreditAmount,
  planSatisfies,
  type AlertRule,
  type CreditActionType,
  type CreditQuote,
  type PlanTier,
} from '../../src/commercial/creditContracts';

export const CREDIT_POLICY_VERSION = 1 as const;

export type AlertQuoteInput = {
  accountId: string;
  plan: PlanTier;
  subjectCount: number;
  durationMs: number;
  rule: AlertRule;
  crossAsset: boolean;
  semanticAiRequired: boolean;
  customEvidenceCondition?: boolean;
  now?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const roundToCreditUnit = (credits: number) =>
  Math.max(0, Math.ceil(credits / CREDIT_UNIT) * CREDIT_UNIT);

const alertDurationCredits = (durationMs: number) => {
  const days = Math.max(1, durationMs / DAY_MS);
  if (days <= 1) return 100;
  if (days <= 7) return 200;
  if (days <= 30) return 400;
  if (days <= 90) return 900;
  return 900 + Math.ceil((days - 90) / 30) * 300;
};

const countAlertLeaves = (rule: AlertRule): number =>
  rule.kind === 'CONDITION'
    ? 1
    : rule.children.reduce((sum, child) => sum + countAlertLeaves(child), 0);

const hasComplexBooleanLogic = (rule: AlertRule): boolean => {
  if (rule.kind === 'CONDITION') return false;
  const nestedGroup = rule.children.some((child) => child.kind === 'GROUP');
  const mixedOr = rule.operator === 'OR';
  const manyConditions = countAlertLeaves(rule) > 3;
  return nestedGroup || mixedOr || manyConditions;
};

export const quoteFixedCreditAction = (input: {
  accountId: string;
  plan: PlanTier;
  actionType: CreditActionType;
  now?: number;
  scopeSummary: string;
  freshSearchRequired?: boolean;
  analystCount?: number | null;
  debateRounds?: number | null;
}): CreditQuote => {
  const entry = creditCatalogEntry(input.actionType);
  if (!entry) throw new Error(`Unknown Credit action: ${input.actionType}.`);
  if (!planSatisfies(input.plan, entry.minimumPlan)) {
    throw new Error(`${input.actionType} requires ${entry.minimumPlan} or higher.`);
  }
  if (entry.quoteRequired || entry.defaultCredits == null) {
    throw new Error(`${input.actionType} requires a scoped quote.`);
  }
  if (!isValidCreditAmount(entry.defaultCredits)) {
    throw new Error(`Catalog price for ${input.actionType} violates ${CREDIT_UNIT}-Credit denomination.`);
  }

  const now = input.now ?? Date.now();
  return {
    quoteId: `quote:${input.accountId}:${input.actionType}:${now}`,
    contractVersion: 1,
    accountId: input.accountId,
    plan: input.plan,
    actionType: input.actionType,
    credits: entry.defaultCredits,
    expiresAt: now + 15 * 60 * 1000,
    scopeSummary: input.scopeSummary,
    freshSearchRequired: Boolean(input.freshSearchRequired),
    analystCount: input.analystCount ?? null,
    debateRounds: input.debateRounds ?? null,
    maxFutureCharge: null,
    requiresExplicitApproval: true,
  };
};

export const quoteAlert = (input: AlertQuoteInput): CreditQuote => {
  const entry = creditCatalogEntry('ALERT_CREATE');
  if (!entry || !planSatisfies(input.plan, entry.minimumPlan)) {
    throw new Error('Alerts require Plus or higher.');
  }
  const now = input.now ?? Date.now();
  const leafCount = countAlertLeaves(input.rule);
  let credits = alertDurationCredits(input.durationMs);

  if (leafCount >= 2 && leafCount <= 3) credits += 100;
  else if (leafCount >= 4) credits += 200;

  if (hasComplexBooleanLogic(input.rule)) credits += 200;
  if (input.crossAsset || input.subjectCount > 1) credits += 200;
  if (input.semanticAiRequired) credits += 300;
  if (input.customEvidenceCondition) credits += 300;

  credits = roundToCreditUnit(credits);

  return {
    quoteId: `quote:${input.accountId}:ALERT_CREATE:${now}`,
    contractVersion: 1,
    accountId: input.accountId,
    plan: input.plan,
    actionType: 'ALERT_CREATE',
    credits,
    expiresAt: now + 15 * 60 * 1000,
    scopeSummary: `Alert over ${Math.max(1, input.subjectCount)} subject(s), ${leafCount} condition(s).`,
    freshSearchRequired: false,
    analystCount: input.semanticAiRequired ? 1 : 0,
    debateRounds: 0,
    maxFutureCharge: null,
    requiresExplicitApproval: true,
  };
};

export const recurringCreditAllowance = (plan: PlanTier) =>
  plan === 'ENTERPRISE'
    ? null
    : PLAN_RECURRING_CREDITS[plan];

export const validateCreditCatalog = () => {
  const errors: string[] = [];
  const seen = new Set<CreditActionType>();

  for (const entry of CREDIT_ACTION_CATALOG_V1) {
    if (seen.has(entry.actionType)) errors.push(`Duplicate actionType: ${entry.actionType}`);
    seen.add(entry.actionType);
    if (entry.defaultCredits != null && !isValidCreditAmount(entry.defaultCredits)) {
      errors.push(`${entry.actionType} default price is not a multiple of ${CREDIT_UNIT}.`);
    }
    if (!entry.quoteRequired && entry.defaultCredits == null) {
      errors.push(`${entry.actionType} has no default price but quoteRequired=false.`);
    }
  }

  return { valid: errors.length === 0, errors };
};
