import {
  CREDIT_ACTION_CATALOG_V1,
  type CreditActionType,
} from '../../src/commercial/creditContracts';

export type AiCostRow = {
  id?: string | null;
  estimated_cost_usd?: number | string | null;
  metadata?: Record<string, unknown> | null;
};

export type CreditActionCostStats = {
  actionType: CreditActionType;
  jobs: number;
  calls: number;
  totalCostUsd: number;
  meanJobCostUsd: number;
  p50JobCostUsd: number;
  p90JobCostUsd: number;
  p99JobCostUsd: number;
  maxJobCostUsd: number;
  plannedCredits: number | null;
  quoteRequired: boolean;
};

const percentile = (sorted: number[], probability: number) => {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const roundUsd = (value: number) => Number(value.toFixed(8));

export const aggregateCreditActionCosts = (rows: AiCostRow[]): CreditActionCostStats[] => {
  const validActions = new Set(CREDIT_ACTION_CATALOG_V1.map((entry) => entry.actionType));
  const catalog = new Map(CREDIT_ACTION_CATALOG_V1.map((entry) => [entry.actionType, entry] as const));
  const jobs = new Map<string, { actionType: CreditActionType; costUsd: number; calls: number }>();

  rows.forEach((row, index) => {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const actionType = String(metadata.creditActionType ?? '') as CreditActionType;
    if (!validActions.has(actionType)) return;

    const creditJobId = String(metadata.creditJobId ?? '').trim();
    const jobKey = creditJobId || `unlinked:${row.id ?? index}`;
    const cost = Number(row.estimated_cost_usd ?? 0);
    const current = jobs.get(jobKey) ?? { actionType, costUsd: 0, calls: 0 };
    if (current.actionType !== actionType) return;
    current.costUsd += Number.isFinite(cost) ? Math.max(0, cost) : 0;
    current.calls += 1;
    jobs.set(jobKey, current);
  });

  const byAction = new Map<CreditActionType, Array<{ costUsd: number; calls: number }>>();
  for (const job of jobs.values()) {
    const list = byAction.get(job.actionType) ?? [];
    list.push({ costUsd: job.costUsd, calls: job.calls });
    byAction.set(job.actionType, list);
  }

  return [...byAction.entries()]
    .map(([actionType, actionJobs]) => {
      const sortedCosts = actionJobs.map((job) => job.costUsd).sort((a, b) => a - b);
      const totalCostUsd = sortedCosts.reduce((sum, value) => sum + value, 0);
      const entry = catalog.get(actionType)!;
      return {
        actionType,
        jobs: actionJobs.length,
        calls: actionJobs.reduce((sum, job) => sum + job.calls, 0),
        totalCostUsd: roundUsd(totalCostUsd),
        meanJobCostUsd: roundUsd(totalCostUsd / Math.max(1, actionJobs.length)),
        p50JobCostUsd: roundUsd(percentile(sortedCosts, 0.50)),
        p90JobCostUsd: roundUsd(percentile(sortedCosts, 0.90)),
        p99JobCostUsd: roundUsd(percentile(sortedCosts, 0.99)),
        maxJobCostUsd: roundUsd(sortedCosts.at(-1) ?? 0),
        plannedCredits: entry.defaultCredits,
        quoteRequired: entry.quoteRequired,
      };
    })
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd);
};
