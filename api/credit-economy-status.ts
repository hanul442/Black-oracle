import { CREDIT_ACTION_CATALOG_V1, PLAN_RECURRING_CREDITS } from '../src/commercial/creditContracts';
import { aggregateCreditActionCosts } from '../server/commercial/creditCostAnalytics';

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  return base && key ? { base, key } : null;
};

const isAuthorizedInternalCall = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return false;
  const presented = authorization.slice('Bearer '.length).trim();
  const accepted = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return Boolean(presented && accepted.includes(presented));
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  if (!isAuthorizedInternalCall(request.headers.authorization)) {
    return response.status(401).json({ success: false, error: 'Unauthorized internal invocation.' });
  }

  const daysRaw = Number(request.query?.days ?? 30);
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, Math.trunc(daysRaw))) : 30;
  const db = dbConfig();
  if (!db) {
    return response.status(200).json({
      success: true,
      configured: false,
      days,
      recurringCredits: PLAN_RECURRING_CREDITS,
      catalog: CREDIT_ACTION_CATALOG_V1,
      observedCosts: [],
    });
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL(`${db.base}/rest/v1/black_oracle_ai_usage`);
  url.searchParams.set('occurred_at', `gte.${since}`);
  url.searchParams.set('select', 'id,estimated_cost_usd,metadata,occurred_at');
  url.searchParams.set('order', 'occurred_at.desc');
  url.searchParams.set('limit', '10000');

  const usage = await fetch(url, {
    headers: { apikey: db.key, Authorization: `Bearer ${db.key}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!usage.ok) {
    return response.status(502).json({
      success: false,
      error: `AI usage read failed (${usage.status}).`,
    });
  }

  const rows = await usage.json() as any[];
  return response.status(200).json({
    success: true,
    configured: true,
    days,
    usageRows: rows.length,
    recurringCredits: PLAN_RECURRING_CREDITS,
    catalog: CREDIT_ACTION_CATALOG_V1,
    observedCosts: aggregateCreditActionCosts(rows),
  });
}
