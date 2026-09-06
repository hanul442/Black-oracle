import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvidenceRefreshReadiness } from './evidenceReadiness.ts';

test('Evidence refresh readiness requires Supabase persistence, URL, service role, and classifier', () => {
  const readiness = buildEvidenceRefreshReadiness({
    TRADING_PERSISTENCE_BACKEND: 'supabase',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
    OPENAI_API_KEY: 'classifier-secret',
  });

  assert.deepEqual(readiness, {
    persistenceSupabase: true,
    supabaseUrlConfigured: true,
    serviceRoleConfigured: true,
    classifierConfigured: true,
    ready: true,
    missing: [],
  });

  assert.equal(JSON.stringify(readiness).includes('service-role-secret'), false);
  assert.equal(JSON.stringify(readiness).includes('classifier-secret'), false);
});

test('CRON secret alone does not satisfy the scheduler service-role credential boundary', () => {
  const readiness = buildEvidenceRefreshReadiness({
    TRADING_PERSISTENCE_BACKEND: 'supabase',
    SUPABASE_URL: 'https://example.supabase.co',
    CRON_SECRET: 'cron-only',
    OPENAI_API_KEY: 'classifier-secret',
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.serviceRoleConfigured, false);
  assert.deepEqual(readiness.missing, ['SUPABASE_SERVICE_ROLE_KEY']);
});

test('readiness reports every missing deployment requirement without exposing values', () => {
  const readiness = buildEvidenceRefreshReadiness({});
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.missing, [
    'TRADING_PERSISTENCE_BACKEND',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
  ]);
});
