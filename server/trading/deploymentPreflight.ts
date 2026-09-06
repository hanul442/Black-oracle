import { buildEvidenceRefreshReadiness, type EvidenceRefreshReadiness } from './evidenceReadiness.ts';
import { isAllowedProductionSchedulerTarget } from '../../supabase/functions/_shared/paperSchedulerPolicy.ts';

export type PaperDeploymentPreflightBlocker =
  | 'ENVIRONMENT_NOT_READY'
  | 'SUPABASE_RUNTIME_UNREACHABLE'
  | 'RUNTIME_CHECKPOINT_MISSING'
  | 'SUPABASE_SCHEDULER_UNREACHABLE'
  | 'SCHEDULER_CONFIG_MISSING'
  | 'SCHEDULER_DISABLED'
  | 'SCHEDULER_TARGET_INVALID'
  | 'SCHEDULER_TARGET_NOT_PRODUCTION';

export type PaperDeploymentPreflight = {
  attempted: boolean;
  environmentReady: boolean;
  supabaseRuntimeReachable: boolean;
  runtimeCheckpointPresent: boolean;
  supabaseSchedulerReachable: boolean;
  schedulerConfigPresent: boolean;
  schedulerEnabled: boolean | null;
  schedulerTargetVercel: boolean | null;
  schedulerTargetProduction: boolean | null;
  schedulerLastOk: boolean | null;
  readyForPaperPreview: boolean;
  readyForProductionPaperRollout: boolean;
  blockers: PaperDeploymentPreflightBlocker[];
};

type EnvLike = Record<string, string | undefined>;
type FetchLike = typeof fetch;

type RuntimeRow = { runtime_id?: unknown };
type SchedulerRow = {
  runtime_id?: unknown;
  enabled?: unknown;
  target_base_url?: unknown;
  last_ok?: unknown;
};

const RUNTIME_TABLE = 'black_oracle_trading_runtime';
const SCHEDULER_TABLE = 'black_oracle_trading_scheduler_config';
const PROBE_TIMEOUT_MS = 5_000;

const endpoint = (baseUrl: string, table: string, runtimeId: string, select: string) => {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/rest/v1/${table}`);
  url.searchParams.set('runtime_id', `eq.${runtimeId}`);
  url.searchParams.set('select', select);
  url.searchParams.set('limit', '1');
  return url.toString();
};

const probeRows = async <T>(
  fetchImpl: FetchLike,
  url: string,
  serviceRoleKey: string,
): Promise<{ reachable: boolean; rows: T[] }> => {
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return { reachable: false, rows: [] };
    const payload = await response.json().catch(() => []);
    return { reachable: true, rows: Array.isArray(payload) ? payload as T[] : [] };
  } catch {
    return { reachable: false, rows: [] };
  }
};

const emptyPreflight = (environment: EvidenceRefreshReadiness): PaperDeploymentPreflight => ({
  attempted: false,
  environmentReady: environment.ready,
  supabaseRuntimeReachable: false,
  runtimeCheckpointPresent: false,
  supabaseSchedulerReachable: false,
  schedulerConfigPresent: false,
  schedulerEnabled: null,
  schedulerTargetVercel: null,
  schedulerTargetProduction: null,
  schedulerLastOk: null,
  readyForPaperPreview: false,
  readyForProductionPaperRollout: false,
  blockers: ['ENVIRONMENT_NOT_READY'],
});

export const probePaperDeploymentPreflight = async (
  env: EnvLike,
  fetchImpl: FetchLike = fetch,
): Promise<PaperDeploymentPreflight> => {
  const environment = buildEvidenceRefreshReadiness(env);
  if (!environment.ready) return emptyPreflight(environment);

  const baseUrl = String(env.SUPABASE_URL).trim();
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY).trim();
  const runtimeId = env.TRADING_RUNTIME_ID?.trim() || 'black-oracle-paper';

  const [runtimeProbe, schedulerProbe] = await Promise.all([
    probeRows<RuntimeRow>(
      fetchImpl,
      endpoint(baseUrl, RUNTIME_TABLE, runtimeId, 'runtime_id'),
      serviceRoleKey,
    ),
    probeRows<SchedulerRow>(
      fetchImpl,
      endpoint(baseUrl, SCHEDULER_TABLE, runtimeId, 'runtime_id,enabled,target_base_url,last_ok'),
      serviceRoleKey,
    ),
  ]);

  const runtimeCheckpointPresent = runtimeProbe.rows.length > 0;
  const scheduler = schedulerProbe.rows[0] ?? null;
  const schedulerConfigPresent = Boolean(scheduler);
  const schedulerEnabled = scheduler ? scheduler.enabled === true : null;
  const schedulerLastOk = scheduler && typeof scheduler.last_ok === 'boolean' ? scheduler.last_ok : null;

  let schedulerTargetVercel: boolean | null = null;
  let schedulerTargetProduction: boolean | null = null;
  if (scheduler && typeof scheduler.target_base_url === 'string' && scheduler.target_base_url.trim()) {
    try {
      const target = new URL(scheduler.target_base_url.trim());
      schedulerTargetVercel = target.protocol === 'https:' && target.hostname.endsWith('.vercel.app');
      schedulerTargetProduction = isAllowedProductionSchedulerTarget(scheduler.target_base_url.trim());
    } catch {
      schedulerTargetVercel = false;
      schedulerTargetProduction = false;
    }
  } else if (scheduler) {
    schedulerTargetVercel = false;
    schedulerTargetProduction = false;
  }

  const blockers: PaperDeploymentPreflightBlocker[] = [];
  if (!runtimeProbe.reachable) blockers.push('SUPABASE_RUNTIME_UNREACHABLE');
  else if (!runtimeCheckpointPresent) blockers.push('RUNTIME_CHECKPOINT_MISSING');
  if (!schedulerProbe.reachable) blockers.push('SUPABASE_SCHEDULER_UNREACHABLE');
  else if (!schedulerConfigPresent) blockers.push('SCHEDULER_CONFIG_MISSING');
  if (schedulerConfigPresent && schedulerEnabled !== true) blockers.push('SCHEDULER_DISABLED');
  if (schedulerConfigPresent && schedulerTargetVercel !== true) blockers.push('SCHEDULER_TARGET_INVALID');
  else if (schedulerConfigPresent && schedulerTargetProduction !== true) blockers.push('SCHEDULER_TARGET_NOT_PRODUCTION');

  const ready = blockers.length === 0;
  return {
    attempted: true,
    environmentReady: true,
    supabaseRuntimeReachable: runtimeProbe.reachable,
    runtimeCheckpointPresent,
    supabaseSchedulerReachable: schedulerProbe.reachable,
    schedulerConfigPresent,
    schedulerEnabled,
    schedulerTargetVercel,
    schedulerTargetProduction,
    schedulerLastOk,
    readyForPaperPreview: ready,
    readyForProductionPaperRollout: ready,
    blockers,
  };
};
