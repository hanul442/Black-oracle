import { allowNonCriticalAiCall, recordOpenAIUsage, type OpenAIUsageContext } from './aiUsageLedger';

const OPENAI_URL = 'https://api.openai.com/v1/responses';

const extractOutputText = (payload: any) => {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  for (const item of payload?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
};

const extractUrls = (payload: any) => {
  const urls = new Set<string>();
  for (const item of payload?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content ?? []) {
      for (const annotation of content?.annotations ?? []) {
        const url = annotation?.url || annotation?.url_citation?.url;
        if (typeof url === 'string' && url.startsWith('http')) urls.add(url);
      }
    }
  }
  return [...urls];
};

const countWebSearchCalls = (payload: any) =>
  Array.isArray(payload?.output)
    ? payload.output.filter((item: any) => item?.type === 'web_search_call').length
    : 0;

const hasLegacyWebSearch = (options: any) =>
  Array.isArray(options?.config?.tools) &&
  options.config.tools.some((tool: any) => Boolean(tool?.googleSearch));

class OpenAICompatError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'OpenAICompatError';
    this.status = status;
    this.code = code;
  }
}

type AdapterUsageContext = Omit<OpenAIUsageContext, 'model' | 'responseId' | 'webSearchCalls'> & {
  critical?: boolean;
};

/**
 * Compatibility layer used while the original Oracle/RSS server is being
 * migrated away from the historical GoogleGenAI call shape. Production
 * calls are sent only to the OpenAI Responses API and metered into the
 * Black Oracle AI Cost Ledger when Supabase persistence is configured.
 */
export class LegacyOpenAIAdapter {
  private apiKey: string;
  private usageContext: AdapterUsageContext;

  constructor({ apiKey, usageContext }: { apiKey?: string; usageContext?: Partial<AdapterUsageContext> }) {
    this.apiKey = String(apiKey || '').trim();
    this.usageContext = {
      feature: usageContext?.feature || 'legacy_openai_adapter',
      operation: usageContext?.operation || 'generate_content',
      critical: Boolean(usageContext?.critical),
      traceId: usageContext?.traceId ?? null,
      market: usageContext?.market ?? null,
      strategyId: usageContext?.strategyId ?? null,
      evidenceId: usageContext?.evidenceId ?? null,
      metadata: usageContext?.metadata ?? {},
    };
  }

  models = {
    generateContent: async (options: any) => {
      if (!this.apiKey) {
        throw new OpenAICompatError('OpenAI API key is not configured.', 503, 'missing_api_key');
      }
      if (!this.usageContext.critical && !(await allowNonCriticalAiCall())) {
        throw new OpenAICompatError('Black Oracle AI monthly hard cap reached; non-critical AI call suppressed.', 429, 'ai_budget_hard_cap');
      }

      const prompt = typeof options?.contents === 'string'
        ? options.contents
        : JSON.stringify(options?.contents ?? '');
      const model = process.env.OPENAI_FAST_MODEL?.trim() || 'gpt-5.6-luna';
      const webSearch = hasLegacyWebSearch(options);

      const body: Record<string, unknown> = {
        model,
        store: false,
        reasoning: { effort: 'low' },
        input: prompt,
        max_output_tokens: 4_000,
      };
      if (webSearch) body.tools = [{ type: 'web_search' }];

      const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      });

      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        const code = typeof payload?.error?.code === 'string' ? payload.error.code : `http_${response.status}`;
        const message = typeof payload?.error?.message === 'string' ? payload.error.message : 'OpenAI request failed.';
        throw new OpenAICompatError(`${code}: ${message}`, response.status, code);
      }

      const responseId = typeof payload?.id === 'string' ? payload.id : null;
      const webSearchCalls = countWebSearchCalls(payload);
      await recordOpenAIUsage(payload?.usage, {
        feature: this.usageContext.feature,
        operation: this.usageContext.operation,
        model,
        responseId,
        webSearchCalls,
        traceId: this.usageContext.traceId,
        market: this.usageContext.market,
        strategyId: this.usageContext.strategyId,
        evidenceId: this.usageContext.evidenceId,
        metadata: { ...this.usageContext.metadata, requestedWebSearch: webSearch },
      }).catch((error) => console.warn('Black Oracle AI usage ledger write failed:', error));

      const text = extractOutputText(payload);
      const urls = extractUrls(payload);
      return {
        text,
        responseId,
        usage: payload?.usage ?? null,
        candidates: [{
          groundingMetadata: {
            groundingChunks: urls.map((uri) => ({ web: { uri } })),
          },
        }],
      };
    },
  };
}
