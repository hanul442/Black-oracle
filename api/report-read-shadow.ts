import { PLAN_TIERS, type PlanTier } from '../src/commercial/creditContracts';
import { readPublishedReportArtifacts, readReportCards } from '../server/research/reportStore';
import { projectPublishedReportForPlan } from '../server/research/reportViewProjection';

const json = (response: any, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

const isAuthorizedInternalCall = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return false;
  const presented = authorization.slice('Bearer '.length).trim();
  const accepted = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return Boolean(presented && accepted.includes(presented));
};

const planOf = (value: unknown): PlanTier => {
  const normalized = String(value ?? 'CORE').toUpperCase();
  return (PLAN_TIERS as readonly string[]).includes(normalized)
    ? normalized as PlanTier
    : 'CORE';
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }
  if (!isAuthorizedInternalCall(request.headers.authorization)) {
    return json(response, 401, { success: false, error: 'Unauthorized internal invocation.' });
  }

  const reportId = String(request.query?.reportId ?? '').trim();
  const plan = planOf(request.query?.plan);
  const versionRaw = Number(request.query?.version);
  const version = Number.isFinite(versionRaw) && versionRaw >= 1 ? Math.trunc(versionRaw) : null;

  try {
    if (!reportId) {
      const limitRaw = Number(request.query?.limit ?? 50);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.trunc(limitRaw))) : 50;
      const cards = await readReportCards(limit);
      return json(response, 200, {
        success: true,
        mode: 'REPORT_FIRST_SHADOW_READ',
        plan,
        count: cards.length,
        cards,
      });
    }

    const artifacts = await readPublishedReportArtifacts(reportId, version);
    if (!artifacts) {
      return json(response, 404, { success: false, error: 'Report not found.' });
    }

    return json(response, 200, {
      success: true,
      mode: 'REPORT_FIRST_SHADOW_READ',
      plan,
      view: projectPublishedReportForPlan(artifacts, plan),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Report read failure.';
    return json(response, 500, { success: false, error: message });
  }
}
