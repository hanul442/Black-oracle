import { getAiBudgetStatus } from '../server/aiUsageLedger';

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  return base && key ? { base, key } : null;
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  const db = dbConfig();
  const budget = await getAiBudgetStatus().catch(() => null);
  if (!db) return response.status(200).json({ success: true, configured: false, budget, byFeature: [], byModel: [] });

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const query = new URL(`${db.base}/rest/v1/black_oracle_ai_usage`);
  query.searchParams.set('occurred_at', `gte.${monthStart.toISOString()}`);
  query.searchParams.set('select', 'feature,model,input_tokens,cached_input_tokens,output_tokens,web_search_calls,estimated_cost_usd,occurred_at');
  query.searchParams.set('order', 'occurred_at.desc');
  query.searchParams.set('limit', '5000');
  const usageResponse = await fetch(query, { headers: { apikey: db.key, Authorization: `Bearer ${db.key}` }, cache: 'no-store' });
  if (!usageResponse.ok) {
    return response.status(502).json({ success: false, error: `AI usage read failed (${usageResponse.status}).`, budget });
  }
  const rows = await usageResponse.json() as any[];
  const aggregate = (key: 'feature' | 'model') => {
    const map = new Map<string, { calls: number; inputTokens: number; cachedInputTokens: number; outputTokens: number; webSearchCalls: number; costUsd: number }>();
    for (const row of rows) {
      const label = String(row?.[key] || 'unknown');
      const current = map.get(label) ?? { calls: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, webSearchCalls: 0, costUsd: 0 };
      current.calls += 1;
      current.inputTokens += Number(row.input_tokens) || 0;
      current.cachedInputTokens += Number(row.cached_input_tokens) || 0;
      current.outputTokens += Number(row.output_tokens) || 0;
      current.webSearchCalls += Number(row.web_search_calls) || 0;
      current.costUsd += Number(row.estimated_cost_usd) || 0;
      map.set(label, current);
    }
    return [...map.entries()].map(([name, value]) => ({ name, ...value, costUsd: Number(value.costUsd.toFixed(6)) })).sort((a, b) => b.costUsd - a.costUsd);
  };

  return response.status(200).json({
    success: true,
    configured: true,
    monthStart: monthStart.toISOString(),
    budget,
    totalCalls: rows.length,
    byFeature: aggregate('feature'),
    byModel: aggregate('model'),
    recent: rows.slice(0, 20),
  });
}
