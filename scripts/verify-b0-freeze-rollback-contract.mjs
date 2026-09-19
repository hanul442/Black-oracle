import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export const validateFreezeRollbackContract = (contract) => {
  assert.equal(contract.sprint, 'B0');
  assert.equal(contract.workPackage, 'B0.4');
  assert.equal(contract.status, 'CONTRACT_COMPLETE');
  assert.equal(contract.b0Decision, 'EXTEND');
  assert.equal(contract.releaseReady, false);
  assert.equal(contract.b1ImplementationAuthorized, false);
  assert.equal(contract.productionMutation, false);
  assert.equal(contract.productionCutoverAuthorized, false);

  const invariants = contract.invariants;
  assert.equal(invariants.tradingAuthority, 'PAPER_ONLY');
  for (const authority of ['LIVE_ORDER_ROUTE', 'BROKER_CREDENTIAL', 'WITHDRAWAL_PERMISSION', 'REAL_MONEY_PAYMENT']) {
    assert.ok(invariants.forbiddenAuthorities.includes(authority));
  }
  assert.equal(invariants.deterministicRisk.sovereign, true);
  assert.deepEqual(invariants.deterministicRisk.bypassSources, []);
  assert.equal(invariants.report.independentProduct, true);
  assert.equal(invariants.report.requiredOrderInput, false);
  assert.equal(invariants.report.riskOverrideAuthority, false);
  assert.deepEqual(invariants.betaLegacyAccess, ['READ_ONLY', 'NONE']);
  assert.equal(invariants.performanceAggregation, 'SEPARATE_ONLY');
  assert.deepEqual(invariants.performanceStreams, ['BACKTEST', 'FORWARD', 'PAPER']);
  assert.equal(invariants.unavailablePresentation, 'UNAVAILABLE_NOT_ZERO_OR_SUCCESS');
  assert.equal(invariants.proCapacitySemantics, 'CAPACITY_ONLY');
  assert.equal(invariants.proWorkloadProfileSemantics, 'WORKLOAD_ONLY_NOT_ENTITLEMENT');

  for (const state of ['positions', 'orders', 'paper-runtime-ledger', 'canonical-event-ledger', 'checkpoints', 'strategy-identity', 'qualification-cohort']) {
    assert.ok(invariants.protectedState.includes(state));
  }
  for (const mutation of ['RESET', 'REKEY', 'RESEED', 'BULK_REWRITE', 'TRUNCATE']) {
    assert.ok(invariants.forbiddenLegacyMutations.includes(mutation));
  }
  for (const state of ['MISSING', 'STALE', 'FAILED', 'PARTIAL', 'UNRUN']) {
    assert.ok(invariants.unavailableStates.includes(state));
  }

  assert.equal(contract.rollback.code.exactPriorCommitOrArtifactRequired, true);
  assert.equal(contract.rollback.code.runtimeRevisionMustBeVerifiable, true);
  assert.equal(contract.rollback.code.genericRailwayRedeployAllowed, false);
  assert.equal(contract.rollback.database.legacyDownMigrationAllowed, false);
  assert.equal(contract.rollback.database.legacyDataRewriteAllowed, false);
  assert.equal(contract.rollback.database.cascadeAllowed, false);
  assert.equal(contract.rollback.database.dropBehavior, 'RESTRICT');
  assert.equal(contract.rollback.database.protectedStateMutationAllowed, false);
  assert.equal(contract.rollback.b0_3Candidate.executed, false);
  assert.equal(contract.rollback.b0_3Candidate.rollbackExecuted, false);
  assert.match(contract.rollback.supabaseRuntimeStatus.activeBundleSha256, /^[a-f0-9]{64}$/);
  assert.match(contract.rollback.supabaseRuntimeStatus.rollbackBundleSha256, /^[a-f0-9]{64}$/);

  const gates = new Map(contract.exitGate.map((gate) => [gate.criterion, gate.result]));
  assert.equal(gates.get('SERVICE_SOURCE_TRUTH'), 'BLOCKED');
  assert.equal(gates.get('STATE_OWNERSHIP_AND_SCHEDULER_TARGETS'), 'PARTIAL');
  assert.equal(gates.get('BETA_NAMESPACE_CANNOT_MUTATE_LEGACY'), 'BLOCKED');
  assert.equal(gates.get('ROLLBACK_AND_PROTECTED_QUALIFICATION_DOCUMENTED'), 'PASS');
  assert.equal(gates.get('VALIDATOR_REGRESSION_TYPECHECK_BUILD'), 'PASS');
  assert.equal(gates.get('NO_PRODUCTION_CUTOVER_BY_DOCUMENTATION'), 'PASS');

  assert.ok(contract.stopConditions.includes('UNVERIFIABLE_DEPLOYMENT_SHA'));
  assert.ok(contract.stopConditions.includes('UNKNOWN_OR_DEGRADED_RUNTIME_HEALTH'));
  assert.ok(contract.remainingBlockers.length > 0);
  return true;
};

const contract = JSON.parse(await readFile(new URL('../ops/b0-freeze-rollback-contract.json', import.meta.url), 'utf8'));
validateFreezeRollbackContract(contract);
console.log(`B0.4 freeze/rollback contract valid; B0 decision=${contract.b0Decision}, releaseReady=${contract.releaseReady}`);
