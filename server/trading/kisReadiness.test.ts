import assert from 'node:assert/strict';
import test from 'node:test';
import { readKisPaperReadiness } from './kisReadiness';

test('KIS readiness is blocked when credentials are missing', () => {
  const readiness = readKisPaperReadiness({
    TRADING_RUNTIME_ID: 'black-oracle-paper-vnext-v9-multiasset',
    KIS_ENV: 'demo',
  });

  assert.equal(readiness.status, 'BLOCKED');
  assert.equal(readiness.ready, false);
  assert.equal(readiness.paperOnly, true);
  assert.equal(readiness.brokerageExecutionAuthority, false);
  assert.equal(readiness.credentials.appKeyPresent, false);
  assert.equal(readiness.credentials.appSecretPresent, false);
  assert.deepEqual(readiness.reasons, [
    'KIS_APP_KEY is not configured.',
    'KIS_APP_SECRET is not configured.',
  ]);
});

test('KIS readiness accepts demo market-data credentials without granting brokerage authority', () => {
  const readiness = readKisPaperReadiness({
    TRADING_RUNTIME_ID: 'black-oracle-paper-vnext-v9-multiasset',
    KIS_ENV: 'demo',
    KIS_APP_KEY: 'configured-key',
    KIS_APP_SECRET: 'configured-secret',
  });

  assert.equal(readiness.status, 'READY');
  assert.equal(readiness.ready, true);
  assert.equal(readiness.marketDataEnvironment, 'demo');
  assert.equal(readiness.paperOnly, true);
  assert.equal(readiness.brokerageExecutionAuthority, false);
  assert.deepEqual(readiness.reasons, []);
});

test('KIS readiness blocks an unsupported environment value', () => {
  const readiness = readKisPaperReadiness({
    KIS_ENV: 'production',
    KIS_APP_KEY: 'configured-key',
    KIS_APP_SECRET: 'configured-secret',
  });

  assert.equal(readiness.status, 'BLOCKED');
  assert.equal(readiness.marketDataEnvironment, null);
  assert.deepEqual(readiness.reasons, ['KIS_ENV must be demo or real.']);
});
