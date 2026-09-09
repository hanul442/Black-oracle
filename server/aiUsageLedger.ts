export type OpenAIUsageContext = {
  feature: string;
  operation: string;
  model: string;
  responseId?: string | null;
  webSearchCalls?: number;
  traceId?: string | null;
  market?: string | null;
  strategyId?: string | null;
  evidenceId?: string | null;
  metadata?: Record<string, unknown>;
};

type ModelRate = { input: number; cachedInput: number; output: number };

export const AI_PRICE_BOOK_VERSION = 'openai-2026-09-09';

// USD per 1M text tokens. Web Search is billed separately below.
const PRICE_BOOK: Record<string, ModelRate> = {
  'gpt-5.6-luna': { input: 0.20, cachedInput: 0.02, output: 1.20 },
  'gpt-5.6-terra': { input: 2.00, cachedInput: 0.20, output: 12.00 },
  'gpt-5.6-sol': { input: 4.00, cachedInput: 0.40, output: 20.00 },
  'gpt-5.6': { input: 4.00, cachedInput: 0.40, output: 20.00 },
};
const WEB_SEARCH_USD_PER_CALL = 0.01;

const integer = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

export const normalizeOpenAIUsage = (usage: any) => {
  const inputTokens = integer(usage?.input_tokens ?? usage?.prompt_tokens);
  const cachedInputTokens = Math.min(
    inputTokens,
    integer(usage?.input_tokens_details?.cached_tokens ?? usage?.prompt_tokens_details?.cached_tokens),
  );
  const outputTokens = integer(usage?.output_tokens ?? usage?.completion_tokens);
  const reasoningTokens = integer(
    usage?.output_tokens_details?.reasoning_tokens ?? usage?.completion_tokens_details?.reasoning_tokens,
  );
  return { inputTokens, cachedInputTokens, outputTokens, reasoningTokens };
};

export const estimateOpenAICostUsd = (
  model: string,
  usage: ReturnType<typeof normalizeOpenAIUsage>,
  webSearchCalls = 0,
) => {
  const normalizedModel = model.trim().toLowerCase();
  const rate = PRICE_BOOK[normalizedModel];
  const searchCost = Math.max(0, webSearchCalls) * WEB_SEARCH_USD_PER_CALL;
  if (!rate) return searchCost;
  const uncachedInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    uncachedInput / 1_000_000 * rate.input
    + usage.cachedInputTokens / 1_000_000 * rate.cachedInput
    + usage.outputTokens / 1_000_000 * rate.output
    + searchCost
  );
};

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  return base && key ? { base, key } : null;
};

export const recordOpenAIUsage = async (usagePayload: any, context: OpenAIUsageContext) => {
  const db = dbConfig();
  const usage = normalizeOpenAIUsage(usagePayload);
  const webSearchCalls = integer(context.webSearchCalls);
  const estimatedCostUsd = estimateOpenAICostUsd(context.model, usage, webSearchCalls);
  if (!db) return { persisted: false, estimatedCostUsd, ...usage };

  const response = await fetch(`${db.base}/rest/v1/black_oracle_ai_usage`, {
    method: 'POST',
    headers: {
      apikey: db.key,
      Authorization: `Bearer ${db.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      occurred_at: new Date().toISOString(),
      feature: context.feature.slice(0, 120),
      operation: context.operation.slice(0, 160),
      model: context.model.slice(0, 120),
      response_id: context.responseId ?? null,
      input_tokens: usage.inputTokens,
      cached_input_tokens: usage.cachedInputTokens,
      output_tokens: usage.outputTokens,
      reasoning_tokens: usage.reasoningTokens,
      web_search_calls: webSearchCalls,
      estimated_cost_usd: Number(estimatedCostUsd.toFixed(8)),
      price_book_version: AI_PRICE_BOOK_VERSION,
      trace_id: context.traceId ?? null,
      market: context.market ?? null,
      strategy_id: context.strategyId ?? null,
      evidence_id: context.evidenceId ?? null,
      metadata: context.metadata ?? {},
    }),
  });
  if (!response.ok) {
    throw new Error(`AI usage ledger write failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  }
  return { persisted: true, estimatedCostUsd, ...usage };
};

export const getAiBudgetStatus = async () => {
  const db = dbConfig();
  if (!db) return null;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [budgetResponse, usageResponse] = await Promise.all([
    fetch(`${db.base}/rest/v1/black_oracle_ai_budget?id=eq.default&select=monthly_budget_usd,hard_cap_usd,soft_limit_ratio,enabled&limit=1`, {
      headers: { apikey: db.key, Authorization: `Bearer ${db.key}` }, cache: 'no-store',
    }),
    fetch(`${db.base}/rest/v1/black_oracle_ai_usage?occurred_at=gte.${encodeURIComponent(monthStart.toISOString())}&select=estimated_cost_usd`, {
      headers: { apikey: db.key, Authorization: `Bearer ${db.key}` }, cache: 'no-store',
    }),
  ]);
  if (!budgetResponse.ok || !usageResponse.ok) return null;
  const budgetRows = await budgetResponse.json() as any[];
  const usageRows = await usageResponse.json() as any[];
  const budget = budgetRows[0];
  if (!budget) return null;
  const spentUsd = usageRows.reduce((sum, row) => sum + (Number(row.estimated_cost_usd) || 0), 0);
  const monthlyBudgetUsd = Number(budget.monthly_budget_usd) || 10;
  const hardCapUsd = Number(budget.hard_cap_usd) || 15;
  const softLimitRatio = Number(budget.soft_limit_ratio) || 0.8;
  const softLimitUsd = monthlyBudgetUsd * softLimitRatio;
  return {
    enabled: Boolean(budget.enabled),
    spentUsd: Number(spentUsd.toFixed(6)),
    monthlyBudgetUsd,
    hardCapUsd,
    softLimitUsd: Number(softLimitUsd.toFixed(2)),
    softLimited: spentUsd >= softLimitUsd,
    hardLimited: spentUsd >= hardCapUsd,
    remainingToHardCapUsd: Number(Math.max(0, hardCapUsd - spentUsd).toFixed(6)),
  };
};

export const allowNonCriticalAiCall = async () => {
  const status = await getAiBudgetStatus().catch(() => null);
  return !status || !status.enabled || !status.hardLimited;
};
