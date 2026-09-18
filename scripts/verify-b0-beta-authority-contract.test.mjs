import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateBetaAuthorityContract } from './verify-b0-beta-authority-contract.mjs';

const source = JSON.parse(fs.readFileSync(new URL('../ops/b0-beta-authority-contract.json', import.meta.url), 'utf8'));
const fixture = () => structuredClone(source);

test('B0.3 authority design validates without claiming enforcement', () => {
  assert.deepEqual(validateBetaAuthorityContract(fixture()), {
    contractValid: true,
    applied: false,
    b0_3Complete: false
  });
});

for (const [name, change] of [
  ['service_role use', c => { c.serverIdentity.serviceRoleAllowed = true; }],
  ['RLS bypass', c => { c.serverIdentity.bypassRls = true; }],
  ['inherited authority', c => { c.serverIdentity.inherit = true; }],
  ['server object creation', c => { c.betaNamespace.serverCanCreateObjects = true; }],
  ['browser namespace access', c => { c.betaNamespace.browserRolesHaveUsage = true; }],
  ['direct legacy table grant', c => { c.legacyBoundary.directTableGrants.push('public.black_oracle_events'); }],
  ['legacy update privilege', c => { c.legacyBoundary.forbiddenPrivileges = c.legacyBoundary.forbiddenPrivileges.filter(p => p !== 'UPDATE'); }],
  ['security definer by default', c => { c.readModelRules.securityDefinerDefault = 'ALLOWED'; }],
  ['production DDL authorization', c => { c.deploymentGate.productionDdlAuthorized = true; }],
  ['false enforcement claim', c => { c.status = 'APPLIED'; }],
  ['destructive rollback', c => { c.deploymentGate.rollback = 'DROP_LEGACY_OBJECTS'; }]
]) {
  test(`rejects ${name}`, () => {
    const contract = fixture();
    change(contract);
    assert.throws(() => validateBetaAuthorityContract(contract));
  });
}
