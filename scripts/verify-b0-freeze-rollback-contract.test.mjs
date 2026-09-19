import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateFreezeRollbackContract } from './verify-b0-freeze-rollback-contract.mjs';

const source = JSON.parse(await readFile(new URL('../ops/b0-freeze-rollback-contract.json', import.meta.url), 'utf8'));

const valid = (candidate) => {
  try {
    return validateFreezeRollbackContract(candidate);
  } catch {
    return false;
  }
};

test('accepts the fail-closed B0.4 contract', () => assert.equal(valid(source), true));

for (const [name, mutate] of [
  ['live authority', (c) => { c.invariants.tradingAuthority = 'LIVE'; }],
  ['Report/order coupling', (c) => { c.invariants.report.requiredOrderInput = true; }],
  ['Risk bypass', (c) => { c.invariants.deterministicRisk.bypassSources = ['REPORT']; }],
  ['collapsed performance streams', (c) => { c.invariants.performanceAggregation = 'COMBINED'; }],
  ['missing data as zero', (c) => { c.invariants.unavailablePresentation = 'ZERO'; }],
  ['legacy write authority', (c) => { c.invariants.betaLegacyAccess = ['READ_WRITE']; }],
  ['capacity grants features', (c) => { c.invariants.proCapacitySemantics = 'FEATURE_TIER'; }],
  ['profile grants entitlements', (c) => { c.invariants.proWorkloadProfileSemantics = 'ENTITLEMENT'; }],
  ['generic Railway redeploy', (c) => { c.rollback.code.genericRailwayRedeployAllowed = true; }],
  ['cascading rollback', (c) => { c.rollback.database.cascadeAllowed = true; }],
  ['legacy down migration', (c) => { c.rollback.database.legacyDownMigrationAllowed = true; }],
  ['false namespace pass', (c) => { c.exitGate.find((g) => g.criterion === 'BETA_NAMESPACE_CANNOT_MUTATE_LEGACY').result = 'PASS'; }],
  ['false B0 pass', (c) => { c.b0Decision = 'PASS'; }],
  ['B1 authorization', (c) => { c.b1ImplementationAuthorized = true; }],
  ['production cutover', (c) => { c.productionCutoverAuthorized = true; }]
]) {
  test(`rejects ${name}`, () => {
    const candidate = structuredClone(source);
    mutate(candidate);
    assert.equal(valid(candidate), false);
  });
}
