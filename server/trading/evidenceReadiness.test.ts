import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvidenceRefreshReadiness } from './evidenceReadiness.ts';

test('Evidence refresh readiness requires durable persistence, database credentials, classifier, and scheduler secret', () => {
  const readiness = buildEvidenceRefreshReadiness({
    TRADING_PERSISTENCE_BACKEND: 'supabase',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
    OPENAI_API_KEY: 'classifier-secret',
    CRON_SECRET: 'scheduler-secret',
  });

  assert.deepEqual(readiness, {
    persistenceSupabase: true,
    supabaseUrlConfigured: true,
    serviceRoleConfigured: true,
    classifierConfigured: true,
    schedulerSecretConfigured: true,
    ready: true,
    missing: [],
  });

  const serialized = JSON.stringify(readiness);
  assert.equal(serialized.includes('service-role-secret'), false);
  assert.equal(serialized.includes('classifier-secret'), false);
  assert.equal(serialized.includes('scheduler-secret'), false);
});

test('CRON secret cannot replace the Supabase database credential', () => {
  const readiness = buildEvidenceRefreshReadiness({
    TRADING_PERSISTENCE_BACKEND: 'supabase',
    SUPABASE_URL: 'https://example.supabase.co',
    CRON_SECRET: 'cron-only',
    OPENAI_API_KEY: 'classifier-secret',
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.serviceRoleConfigured, false);
  assert.equal(readiness.schedulerSecretConfigured, true);
  assert.deepEqual(readiness.missing, ['SUPABASE_SERVICE_ROLE_KEY']);
});

test('service role cannot replace the dedicated scheduler secret', () => {
  const readiness = buildEvidenceRefreshReadiness({
    TRADING_PERSISTENCE_BACKEND: 'supabase',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
    OPENAI_API_KEY: 'classifier-secret',
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.serviceRoleConfigured, true);
  assert.equal(readiness.schedulerSecretConfigured, false);
  assert.deepEqual(readiness.missing, ['CRON_SECRET']);
});

test('readiness reports every missing deployment requirement without exposing values', () => {
  const readiness = buildEvidenceRefreshReadiness({});
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.missing, [
    'TRADING_PERSISTENCE_BACKEND',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'CRON_SECRET',
  ]);
});
