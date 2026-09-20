import { allowNonCriticalAiCall, recordOpenAIUsage } from '../aiUsageLedger';
import type { CreditActionType } from '../../src/commercial/creditContracts';

const OPENAI_URL = 'https://api.openai.com/v1/responses';

export const DEFAULT_REPORT_FAST_MODEL = 'gpt-5.6-luna';
export const DEFAULT_REPORT_DEEP_MODEL = 'gpt-5.6-terra';

export type ReportAiUsageContext = {
  operation: string;
  reportId: string;
  analystId?: string | null;
  debateId?: string | null;
  creditJobId?: string | null;
  creditActionType?: CreditActionType | null;
  market?: string | null;
  metadata?: Record<string, unknown>;
};

export const resolveReportOpenAIKey = () =>
  process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_API?.trim() || '';

export const reportAiBudgetAllowsCall = async () =>
  allowNonCriticalAiCall();

const extractOutputText = (payload: any) => {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  for (const item of payload?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) {
        return content.text;
      }
    }
  }
  throw new Error('OpenAI response did not contain output text.');
};

export const callReportStructured = async <T>(input: {
  apiKey: string;
  model: string;
  instructions: string;
  payload: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  usage: ReportAiUsageContext;
  reasoningEffort?: 'low' | 'medium';
}): Promise<{ data: T; responseId: string | null; rawUsage: unknown }> => {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      store: false,
      reasoning: { effort: input.reasoningEffort ?? 'low' },
      instructions: input.instructions,
      input: JSON.stringify(input.payload),
      max_output_tokens: input.maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name: input.schemaName,
          strict: true,
          schema: input.schema,
        },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) {
    const code = typeof payload?.error?.code === 'string' ? payload.error.code : `http_${response.status}`;
    const message = typeof payload?.error?.message === 'string' ? payload.error.message : 'OpenAI request failed.';
    throw new Error(`${code}: ${message}`);
  }

  const responseId = typeof payload?.id === 'string' ? payload.id : null;
  await recordOpenAIUsage(payload?.usage, {
    feature: 'report_research',
    operation: input.usage.operation,
    model: input.model,
    responseId,
    market: input.usage.market ?? null,
    reportId: input.usage.reportId,
    analystId: input.usage.analystId ?? null,
    debateId: input.usage.debateId ?? null,
    creditJobId: input.usage.creditJobId ?? null,
    creditActionType: input.usage.creditActionType ?? null,
    metadata: input.usage.metadata ?? {},
  }).catch((error) => console.warn('Report AI usage ledger write failed:', error));

  return {
    data: JSON.parse(extractOutputText(payload)) as T,
    responseId,
    rawUsage: payload?.usage ?? null,
  };
};
