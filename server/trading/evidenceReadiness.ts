export type EvidenceRefreshReadiness = {
  persistenceSupabase: boolean;
  supabaseUrlConfigured: boolean;
  serviceRoleConfigured: boolean;
  classifierConfigured: boolean;
  ready: boolean;
  missing: Array<'TRADING_PERSISTENCE_BACKEND' | 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY' | 'OPENAI_API_KEY'>;
};

type EnvLike = Record<string, string | undefined>;

const configured = (value: string | undefined) => Boolean(value?.trim());

/**
 * Returns deployment-readiness booleans only. Secret values are never copied into the result.
 * The scheduler authenticates to Vercel with the Supabase service-role key, so readiness
 * intentionally requires that same variable on the Vercel runtime rather than treating an
 * unrelated CRON_SECRET as an equivalent scheduler credential.
 */
export const buildEvidenceRefreshReadiness = (env: EnvLike): EvidenceRefreshReadiness => {
  const persistenceSupabase = String(env.TRADING_PERSISTENCE_BACKEND ?? '').trim().toLowerCase() === 'supabase';
  const supabaseUrlConfigured = configured(env.SUPABASE_URL);
  const serviceRoleConfigured = configured(env.SUPABASE_SERVICE_ROLE_KEY);
  const classifierConfigured = configured(env.OPENAI_API_KEY);

  const missing: EvidenceRefreshReadiness['missing'] = [];
  if (!persistenceSupabase) missing.push('TRADING_PERSISTENCE_BACKEND');
  if (!supabaseUrlConfigured) missing.push('SUPABASE_URL');
  if (!serviceRoleConfigured) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!classifierConfigured) missing.push('OPENAI_API_KEY');

  return {
    persistenceSupabase,
    supabaseUrlConfigured,
    serviceRoleConfigured,
    classifierConfigured,
    ready: missing.length === 0,
    missing,
  };
};
