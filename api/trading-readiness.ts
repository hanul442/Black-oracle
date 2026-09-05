import { probePaperDeploymentPreflight } from '../server/trading/deploymentPreflight.js';
import { buildEvidenceRefreshReadiness } from '../server/trading/evidenceReadiness.js';
import {
  EVIDENCE_REFRESH_TIMEOUT_MS,
  MAX_SCHEDULER_DOWNSTREAM_BUDGET_MS,
  PAPER_CYCLE_TIMEOUT_MS,
  SCHEDULER_DOWNSTREAM_BUDGET_MS,
} from '../supabase/functions/_shared/paperSchedulerPolicy.js';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');

  const env = process.env as Record<string, string | undefined>;
  const evidenceRefresh = buildEvidenceRefreshReadiness(env);
  const deploymentPreflight = await probePaperDeploymentPreflight(env);

  return response.status(200).json({
    success: true,
    mode: 'PAPER',
    evidenceRefresh,
    deploymentPreflight,
    scheduler: {
      expectedOrder: ['EVIDENCE_REFRESH', 'PAPER_CYCLE'],
      protectiveExitAuthority: true,
      deploymentAuthority: false,
      evidenceTimeoutMs: EVIDENCE_REFRESH_TIMEOUT_MS,
      paperCycleTimeoutMs: PAPER_CYCLE_TIMEOUT_MS,
      downstreamBudgetMs: SCHEDULER_DOWNSTREAM_BUDGET_MS,
      internalBudgetCeilingMs: MAX_SCHEDULER_DOWNSTREAM_BUDGET_MS,
    },
    secretValuesExposed: false,
  });
}
