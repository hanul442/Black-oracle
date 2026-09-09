import { INDICATOR_CATALOG, factoryEligibleIndicators } from '../../src/trading/indicatorCatalog';
import { allowNonCriticalAiCall, getAiBudgetStatus, recordOpenAIUsage } from '../aiUsageLedger';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.6-terra';
const FALLBACK_MODEL = 'gpt-5.6-luna';

export type AiStrategyHypothesis = {
  title: string;
  thesis: string;
  indicators: string[];
  interpretations: Array<{ indicator: string; mode: 'CONTINUATION' | 'REVERSION' | 'FILTER'; rationale: string }>;
  regime: string;
  falsification: string;
};

export type AiStrategyResearchResult = {
  id: string;
  market: string;
  model: string;
  guidedSeed: number;
  hypotheses: AiStrategyHypothesis[];
  responseId: string | null;
  skipped: boolean;
  reused?: boolean;
  reason?: string;
};

const extractOutputText = (payload: any) => {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  for (const item of payload?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('Strategy researcher response did not contain output text.');
};

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  if (!base || !key) return null;
  return { base, key, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
};

const stableSeed = (value: string) => {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash & 0x7fffffff) || 4_420_623;
};

const researchId = (market: string, date = new Date()) => `sf-ai-${market}-${date.toISOString().slice(0, 10)}`;

const loadCachedDailyResearch = async (market: string): Promise<AiStrategyResearchResult | null> => {
  const db = dbConfig();
  if (!db) return null;
  const id = researchId(market);
  const query = new URL(`${db.base}/rest/v1/black_oracle_strategy_research_hypotheses`);
  query.searchParams.set('id', `eq.${id}`);
  query.searchParams.set('select', 'id,market,model,response_id,guided_seed,hypotheses,blind_metrics_exposed,execution_authority,promotion_authority');
  query.searchParams.set('limit', '1');
  const response = await fetch(query, { headers: db.headers, cache: 'no-store' });
  if (!response.ok) return null;
  const rows = await response.json() as any[];
  const row = rows[0];
  if (!row || row.blind_metrics_exposed !== false || row.execution_authority !== false || row.promotion_authority !== false) return null;
  const hypotheses = Array.isArray(row.hypotheses) ? row.hypotheses as AiStrategyHypothesis[] : [];
  if (!hypotheses.length) return null;
  return {
    id: String(row.id),
    market: String(row.market),
    model: String(row.model),
    guidedSeed: Number(row.guided_seed) || dailyDeterministicStrategySeed(market),
    hypotheses,
    responseId: row.response_id ? String(row.response_id) : null,
    skipped: false,
    reused: true,
    reason: 'Reused the persisted daily AI research packet; no additional model call was made.',
  };
};

const loadDevelopmentResearchMemory = async (market: string) => {
  const db = dbConfig();
  if (!db) return [];
  const query = new URL(`${db.base}/rest/v1/black_oracle_strategy_experiments`);
  query.searchParams.set('market', `eq.${market}`);
  // Deliberately omit blind_validation: the AI researcher must not learn from the locked holdout.
  query.searchParams.set('select', 'id,hypothesis,genome,development_validation,score,lifecycle,hard_gate_reasons,fatal_reasons,created_at');
  query.searchParams.set('order', 'created_at.desc');
  query.searchParams.set('limit', '24');
  const response = await fetch(query, { headers: db.headers, cache: 'no-store' });
  if (!response.ok) return [];
  return await response.json() as any[];
};

const persistResearch = async (result: AiStrategyResearchResult, inputScope: Record<string, unknown>) => {
  const db = dbConfig();
  if (!db || result.skipped) return false;
  const response = await fetch(`${db.base}/rest/v1/black_oracle_strategy_research_hypotheses?on_conflict=id`, {
    method: 'POST',
    headers: { ...db.headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: result.id,
      research_date: new Date().toISOString().slice(0, 10),
      market: result.market,
      model: result.model,
      response_id: result.responseId,
      guided_seed: result.guidedSeed,
      hypotheses: result.hypotheses,
      input_scope: inputScope,
      blind_metrics_exposed: false,
      execution_authority: false,
      promotion_authority: false,
    }),
  });
  if (!response.ok) throw new Error(`Strategy research persistence failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  return true;
};

const researcherSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['hypotheses'],
  properties: {
    hypotheses: {
      type: 'array',
      minItems: 4,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'thesis', 'indicators', 'interpretations', 'regime', 'falsification'],
        properties: {
          title: { type: 'string' },
          thesis: { type: 'string' },
          indicators: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'string' } },
          interpretations: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['indicator', 'mode', 'rationale'],
              properties: {
                indicator: { type: 'string' },
                mode: { type: 'string', enum: ['CONTINUATION', 'REVERSION', 'FILTER'] },
                rationale: { type: 'string' },
              },
            },
          },
          regime: { type: 'string' },
          falsification: { type: 'string' },
        },
      },
    },
  },
};

export const dailyDeterministicStrategySeed = (market = 'KRW-BTC', date = new Date()) =>
  stableSeed(`${date.toISOString().slice(0, 10)}|${market}|BLACK_ORACLE_STRATEGY_FACTORY`);

export const runAiStrategyHypothesisResearch = async (market = 'KRW-BTC'): Promise<AiStrategyResearchResult> => {
  const normalizedMarket = market.trim().toUpperCase();
  const fallbackSeed = dailyDeterministicStrategySeed(normalizedMarket);
  const cached = await loadCachedDailyResearch(normalizedMarket).catch(() => null);
  if (cached) return cached;

  if (!(await allowNonCriticalAiCall())) {
    return { id: researchId(normalizedMarket), market: normalizedMarket, model: 'none', guidedSeed: fallbackSeed, hypotheses: [], responseId: null, skipped: true, reason: 'AI hard cap reached; deterministic daily seed will be used.' };
  }
  const apiKey = String(process.env.OPENAI_API_KEY ?? '').trim();
  if (!apiKey) {
    return { id: researchId(normalizedMarket), market: normalizedMarket, model: 'none', guidedSeed: fallbackSeed, hypotheses: [], responseId: null, skipped: true, reason: 'OPENAI_API_KEY is unavailable; deterministic daily seed will be used.' };
  }

  const budget = await getAiBudgetStatus().catch(() => null);
  const model = budget?.softLimited
    ? (process.env.OPENAI_FAST_MODEL?.trim() || FALLBACK_MODEL)
    : (process.env.OPENAI_STRATEGY_RESEARCH_MODEL?.trim() || DEFAULT_MODEL);
  const eligible = factoryEligibleIndicators();
  const allowedIds = new Set(eligible.map((item) => item.id));
  const developmentMemory = await loadDevelopmentResearchMemory(normalizedMarket);
  const inputScope = {
    market: normalizedMarket,
    allowedIndicators: eligible.map((item) => ({ id: item.id, family: item.family, purpose: item.purpose, correlatedWith: item.correlatedWith })),
    recentDevelopmentExperiments: developmentMemory,
    omittedFields: ['blind_validation'],
  };

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: 'low' },
      max_output_tokens: 2_400,
      instructions: [
        'You are the research hypothesis generator for Black Oracle Strategy Factory.',
        'Generate diverse, falsifiable technical-factor hypotheses, not trading instructions.',
        'Use ONLY indicator IDs in ALLOWED_INDICATORS. Do not invent unavailable data.',
        'Avoid redundant combinations of highly correlated factors unless the hypothesis explicitly tests redundancy.',
        'Use recent DEVELOPMENT-only experiment failures to explore genuinely different combinations.',
        'Locked Blind metrics are intentionally withheld. Never infer or request them.',
        'Prefer 2-5 economically distinct factors. Include regime and falsification logic.',
        'You have no execution, promotion, capital-allocation, Champion, or LIVE authority.',
      ].join('\n'),
      input: JSON.stringify({ ALLOWED_INDICATORS: inputScope.allowedIndicators, DEVELOPMENT_MEMORY: developmentMemory }),
      text: { format: { type: 'json_schema', name: 'black_oracle_strategy_research', strict: true, schema: researcherSchema } },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) throw new Error(`Strategy AI researcher failed (${response.status}): ${String(payload?.error?.message || '').slice(0, 300)}`);
  const parsed = JSON.parse(extractOutputText(payload));
  const hypotheses: AiStrategyHypothesis[] = (Array.isArray(parsed?.hypotheses) ? parsed.hypotheses : [])
    .map((item: any) => ({
      title: String(item?.title || '').slice(0, 240),
      thesis: String(item?.thesis || '').slice(0, 1200),
      indicators: Array.from(new Set((Array.isArray(item?.indicators) ? item.indicators : []).map(String).filter((id: string) => allowedIds.has(id)))).slice(0, 6),
      interpretations: (Array.isArray(item?.interpretations) ? item.interpretations : []).filter((row: any) => allowedIds.has(String(row?.indicator))).slice(0, 8).map((row: any) => ({ indicator: String(row.indicator), mode: row.mode === 'REVERSION' || row.mode === 'FILTER' ? row.mode : 'CONTINUATION', rationale: String(row?.rationale || '').slice(0, 600) })),
      regime: String(item?.regime || 'ANY').slice(0, 120),
      falsification: String(item?.falsification || '').slice(0, 800),
    }))
    .filter((item: AiStrategyHypothesis) => item.indicators.length >= 2)
    .slice(0, 8);

  const responseId = typeof payload?.id === 'string' ? payload.id : null;
  const guidedSeed = stableSeed(`${fallbackSeed}|${JSON.stringify(hypotheses.map((item) => [item.indicators, item.interpretations.map((row) => row.mode)]))}`);
  const result: AiStrategyResearchResult = {
    id: researchId(normalizedMarket),
    market: normalizedMarket,
    model,
    guidedSeed,
    hypotheses,
    responseId,
    skipped: false,
    reused: false,
  };

  await recordOpenAIUsage(payload?.usage, {
    feature: 'strategy_research',
    operation: 'daily_factor_hypothesis_generation',
    model,
    responseId,
    market: normalizedMarket,
    metadata: { hypothesisCount: hypotheses.length, blindMetricsExposed: false, eligibleIndicatorCount: INDICATOR_CATALOG.length },
  }).catch((error) => console.warn('Strategy Research AI usage ledger write failed:', error));
  await persistResearch(result, { market: normalizedMarket, developmentExperimentCount: developmentMemory.length, allowedIndicatorIds: [...allowedIds], blindMetricsExposed: false });
  return result;
};
