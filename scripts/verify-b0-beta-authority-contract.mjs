import assert from 'node:assert/strict';
import fs from 'node:fs';

export const validateBetaAuthorityContract = (contract) => {
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.sprint, 'B0');
  assert.equal(contract.workPackage, 'B0.3');
  assert.equal(contract.status, 'DESIGN_ONLY_NOT_APPLIED');

  const identity = contract.serverIdentity;
  assert.equal(identity.databaseRole, 'black_oracle_beta_server');
  assert.equal(identity.inherit, false);
  assert.equal(identity.bypassRls, false);
  assert.equal(identity.superuser, false);
  assert.equal(identity.createDb, false);
  assert.equal(identity.createRole, false);
  assert.equal(identity.replication, false);
  assert.equal(identity.credentialProvisioning, 'OUT_OF_BAND_ROTATABLE_SECRET_NOT_IN_GIT');
  assert.equal(identity.serviceRoleAllowed, false);

  const namespace = contract.betaNamespace;
  assert.equal(namespace.schema, 'black_oracle_beta');
  assert.notEqual(namespace.ownerRole, identity.databaseRole);
  assert.equal(namespace.serverCanCreateObjects, false);
  assert.equal(namespace.browserRolesHaveUsage, false);
  assert.equal(namespace.writableByServer, true);

  const legacy = contract.legacyBoundary;
  assert.deepEqual(legacy.schemas, ['public']);
  assert.deepEqual(legacy.directTableGrants, []);
  assert.deepEqual(legacy.allowedPrivileges, ['SELECT_ON_EXPLICIT_READ_MODELS']);
  for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'CREATE', 'OWNERSHIP', 'SET_ROLE_TO_OPERATIONAL_IDENTITY']) {
    assert.ok(legacy.forbiddenPrivileges.includes(privilege), `missing forbidden privilege: ${privilege}`);
  }
  for (const state of ['positions', 'orders', 'ledger', 'checkpoints', 'strategy_identity', 'qualification_cohort']) {
    assert.ok(legacy.protectedState.includes(state), `missing protected state: ${state}`);
  }

  const reads = contract.readModelRules;
  assert.equal(reads.explicitAllowlistRequired, true);
  assert.equal(reads.securityInvokerRequired, true);
  assert.equal(reads.securityDefinerDefault, 'FORBIDDEN');
  assert.deepEqual(reads.securityDefinerExceptionRequirements, [
    'FIXED_SAFE_SEARCH_PATH',
    'INPUT_VALIDATION',
    'NO_DYNAMIC_SQL',
    'EXPLICIT_EXECUTE_GRANT',
    'NEGATIVE_AUTHORITY_TESTS'
  ]);

  const gate = contract.deploymentGate;
  assert.equal(gate.productionDdlAuthorized, false);
  assert.deepEqual(gate.requiredBeforeApply, [
    'REVIEWED_MIGRATION',
    'EPHEMERAL_DATABASE_TEST',
    'PROHIBITED_LEGACY_MUTATIONS_DENIED',
    'ALLOWED_READ_MODELS_READABLE',
    'BETA_NAMESPACE_WRITES_SUCCEED',
    'ROLLBACK_TESTED',
    'NO_SECRET_IN_REPOSITORY'
  ]);
  assert.equal(gate.rollback, 'REVOKE_BETA_ROLE_AND_DROP_ONLY_BETA_OWNED_OBJECTS');

  return { contractValid: true, applied: false, b0_3Complete: false };
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const contract = JSON.parse(fs.readFileSync(new URL('../ops/b0-beta-authority-contract.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(validateBetaAuthorityContract(contract), null, 2));
}
