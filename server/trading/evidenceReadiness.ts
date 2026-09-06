export type EvidenceRefreshReadiness = {
  persistenceSupabase: boolean;
  supabaseUrlConfigured: boolean;
  serviceRoleConfigured: boolean;
  classifierConfigured: boolean;
  schedulerSecretConfigured: boolean;
  ready: boolean;
  missing: Array<'TRADING_PERSISTENCE_BACKEND' | 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY' | 'OPENAI_API_KEY' | 'CRON_SECRET'>;
};

type EnvLike = Record<string, string | undefined>;

const configured = (value: string | undefined) => Boolean(value?.trim());

/**
 * Returns deployment-readiness booleans only. Secret values are never copied into the result.
 * Supabase service-role remains a database-administration credential. Scheduled downstream
 * Vercel calls use the dedicated CRON_SECRET instead, so both credentials are required for
 * the Evidence-governed PAPER pipeline but they are never treated as interchangeable.
 */
export const buildEvidenceRefreshReadiness = (env: EnvLike): EvidenceRefreshReadiness => {
  const persistenceSupabase = String(env.TRADING_PERSISTENCE_BACKEND ?? '').trim().toLowerCase() === 'supabase';
  const supabaseUrlConfigured = configured(env.SUPABASE_URL);
  const serviceRoleConfigured = configured(env.SUPABASE_SERVICE_ROLE_KEY);
  const classifierConfigured = configured(env.OPENAI_API_KEY);
  const schedulerSecretConfigured = configured(env.CRON_SECRET);

  const missing: EvidenceRefreshReadiness['missing'] = [];
  if (!persistenceSupabase) missing.push('TRADING_PERSISTENCE_BACKEND');
  if (!supabaseUrlConfigured) missing.push('SUPABASE_URL');
  if (!serviceRoleConfigured) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!classifierConfigured) missing.push('OPENAI_API_KEY');
  if (!schedulerSecretConfigured) missing.push('CRON_SECRET');

  return {
    persistenceSupabase,
    supabaseUrlConfigured,
    serviceRoleConfigured,
    classifierConfigured,
    schedulerSecretConfigured,
    ready: missing.length === 0,
    missing,
  };
};
