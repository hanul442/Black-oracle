import { qualificationWindowConfigFromEnv } from './qualificationWindow';

export type QualificationReleaseState =
  | 'BLOCKED'
  | 'ARMED_PENDING_TIME'
  | 'READY_FOR_FIRST_QUALIFYING_CYCLE';

export type QualificationReleaseBlocker =
  | 'PERSISTENCE_NOT_SUPABASE'
  | 'DEPLOYMENT_ENV_NOT_PRODUCTION'
  | 'DEPLOYED_REVISION_MISSING'
  | 'WINDOW_PIN_NOT_CONFIGURED'
  | 'WINDOW_PIN_INVALID'
  | 'PIN_REVISION_MISMATCH'
  | 'ARMING_TIME_NOT_REACHED';

export interface QualificationReleaseReadiness {
  state: QualificationReleaseState;
  persistenceSupabase: boolean;
  deploymentEnvironment: string | null;
  productionEnvironment: boolean;
  deployedRevision: string | null;
  windowPinConfigured: boolean;
  windowPinValid: boolean;
  windowId: string | null;
  armedAt: number | null;
  armingTimeReached: boolean | null;
  sourceRevision: string | null;
  sourceRevisionMatchesDeployedRevision: boolean | null;
  readyForQualificationStart: boolean;
  blockers: QualificationReleaseBlocker[];
  configurationError: string | null;
  deploymentAuthority: false;
  qualificationStartAuthority: false;
}

type EnvLike = Record<string, string | undefined>;

const clean = (value: unknown) => String(value ?? '').trim();

/**
 * Read-only release guard for starting a fresh empirical PAPER qualification window.
 * It never writes runtime state, changes scheduler configuration, deploys code, or starts qualification.
 */
export const buildQualificationReleaseReadiness = (
  env: EnvLike,
  now = Date.now(),
): QualificationReleaseReadiness => {
  const persistenceSupabase = clean(env.TRADING_PERSISTENCE_BACKEND).toLowerCase() === 'supabase';
  const deploymentEnvironment = clean(env.VERCEL_ENV) || null;
  const productionEnvironment = deploymentEnvironment === 'production';
  const deployedRevision = clean(env.VERCEL_GIT_COMMIT_SHA) || null;

  const rawPinValues = [
    clean(env.PAPER_QUALIFICATION_WINDOW_ID),
    clean(env.PAPER_QUALIFICATION_ARMED_AT),
    clean(env.PAPER_QUALIFICATION_SOURCE_REVISION),
  ];
  const windowPinConfigured = rawPinValues.some(Boolean);

  let config: ReturnType<typeof qualificationWindowConfigFromEnv> = null;
  let configurationError: string | null = null;
  try {
    config = qualificationWindowConfigFromEnv(env as NodeJS.ProcessEnv);
  } catch (error) {
    configurationError = error instanceof Error ? error.message : 'Invalid qualification window configuration.';
  }

  const windowPinValid = Boolean(config) && !configurationError;
  const sourceRevisionMatchesDeployedRevision = config && deployedRevision
    ? config.sourceRevision === deployedRevision
    : config
      ? false
      : null;
  const armingTimeReached = config
    ? Number.isFinite(now) && now >= config.armedAt
    : null;

  const blockers: QualificationReleaseBlocker[] = [];
  if (!persistenceSupabase) blockers.push('PERSISTENCE_NOT_SUPABASE');
  if (!productionEnvironment) blockers.push('DEPLOYMENT_ENV_NOT_PRODUCTION');
  if (!deployedRevision) blockers.push('DEPLOYED_REVISION_MISSING');
  if (!windowPinConfigured) blockers.push('WINDOW_PIN_NOT_CONFIGURED');
  else if (!windowPinValid) blockers.push('WINDOW_PIN_INVALID');
  if (config && deployedRevision && sourceRevisionMatchesDeployedRevision !== true) blockers.push('PIN_REVISION_MISMATCH');
  if (config && armingTimeReached !== true) blockers.push('ARMING_TIME_NOT_REACHED');

  const structuralBlockers = blockers.filter((blocker) => blocker !== 'ARMING_TIME_NOT_REACHED');
  const state: QualificationReleaseState = structuralBlockers.length
    ? 'BLOCKED'
    : armingTimeReached
      ? 'READY_FOR_FIRST_QUALIFYING_CYCLE'
      : 'ARMED_PENDING_TIME';

  return {
    state,
    persistenceSupabase,
    deploymentEnvironment,
    productionEnvironment,
    deployedRevision,
    windowPinConfigured,
    windowPinValid,
    windowId: config?.id ?? null,
    armedAt: config?.armedAt ?? null,
    armingTimeReached,
    sourceRevision: config?.sourceRevision ?? null,
    sourceRevisionMatchesDeployedRevision,
    readyForQualificationStart: state === 'READY_FOR_FIRST_QUALIFYING_CYCLE',
    blockers,
    configurationError,
    deploymentAuthority: false,
    qualificationStartAuthority: false,
  };
};
