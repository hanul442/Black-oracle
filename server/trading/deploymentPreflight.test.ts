import assert from 'node:assert/strict';
import test from 'node:test';
import { probePaperDeploymentPreflight } from './deploymentPreflight.ts';

const readyEnv = {
  TRADING_PERSISTENCE_BACKEND: 'supabase',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-value',
  OPENAI_API_KEY: 'openai-secret-value',
  TRADING_RUNTIME_ID: 'black-oracle-paper',
};

const buildFetch = (target = 'https://black-oracle.vercel.app', enabled = true, lastOk = false) => {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('black_oracle_trading_runtime')) {
      return new Response(JSON.stringify([{ runtime_id: 'black-oracle-paper' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('black_oracle_trading_scheduler_config')) {
      return new Response(JSON.stringify([{
        runtime_id: 'black-oracle-paper',
        enabled,
        target_base_url: target,
        last_ok: lastOk,
      }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls };
};

test('production PAPER preflight passes only with real read-only runtime + scheduler checks', async () => {
  const { fetchImpl, calls } = buildFetch();
  const result = await probePaperDeploymentPreflight(readyEnv, fetchImpl);

  assert.equal(result.attempted, true);
  assert.equal(result.environmentReady, true);
  assert.equal(result.supabaseRuntimeReachable, true);
  assert.equal(result.runtimeCheckpointPresent, true);
  assert.equal(result.supabaseSchedulerReachable, true);
  assert.equal(result.schedulerConfigPresent, true);
  assert.equal(result.schedulerEnabled, true);
  assert.equal(result.schedulerTargetVercel, true);
  assert.equal(result.schedulerTargetProduction, true);
  assert.equal(result.schedulerLastOk, false, 'old scheduler telemetry is informational and must not block a corrected rollout');
  assert.equal(result.readyForPaperPreview, true);
  assert.equal(result.readyForProductionPaperRollout, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(calls.length, 2);

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /service-role-secret-value/);
  assert.doesNotMatch(serialized, /openai-secret-value/);
  assert.doesNotMatch(serialized, /example\.supabase\.co/);
  assert.doesNotMatch(serialized, /black-oracle\.vercel\.app/);
});

test('missing environment configuration fails closed without probing Supabase', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response('unexpected', { status: 500 });
  }) as typeof fetch;

  const result = await probePaperDeploymentPreflight({ ...readyEnv, OPENAI_API_KEY: '' }, fetchImpl);
  assert.equal(result.attempted, false);
  assert.equal(result.readyForPaperPreview, false);
  assert.equal(result.readyForProductionPaperRollout, false);
  assert.deepEqual(result.blockers, ['ENVIRONMENT_NOT_READY']);
  assert.equal(calls, 0);
});

test('valid preview target may pass Paper preview but cannot pass production rollout', async () => {
  const { fetchImpl } = buildFetch('https://black-oracle-feature-preview.vercel.app');
  const result = await probePaperDeploymentPreflight(readyEnv, fetchImpl);

  assert.equal(result.schedulerTargetVercel, true);
  assert.equal(result.schedulerTargetProduction, false);
  assert.equal(result.readyForPaperPreview, true);
  assert.equal(result.readyForProductionPaperRollout, false);
  assert.deepEqual(result.blockers, ['SCHEDULER_TARGET_NOT_PRODUCTION']);
});

test('invalid scheduler target fails both preview and production preflight', async () => {
  const { fetchImpl } = buildFetch('http://localhost:3000');
  const result = await probePaperDeploymentPreflight(readyEnv, fetchImpl);

  assert.equal(result.schedulerTargetVercel, false);
  assert.equal(result.readyForPaperPreview, false);
  assert.equal(result.readyForProductionPaperRollout, false);
  assert.ok(result.blockers.includes('SCHEDULER_TARGET_INVALID'));
});
