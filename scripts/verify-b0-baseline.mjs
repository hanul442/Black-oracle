import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateB0Baseline(manifest) {
  assert.equal(manifest.schemaVersion, 5);
  assert.equal(manifest.program, 'B0_FROZEN_BASELINE');
  assert.match(manifest.baselineSha, /^[a-f0-9]{40}$/);
  assert.equal(manifest.constitution, 'BLACK_ORACLE_PRODUCT_CONSTITUTION_V2');
  assert.equal(manifest.masterPlan, 'BLACK_ORACLE_BETA_SPRINT_MASTER_PLAN_V2');
  assert.equal(manifest.b0Status, 'IN_PROGRESS');

  const p = manifest.policy;
  assert.equal(p.tradingMode, 'PAPER_ONLY');
  assert.equal(p.reportRequiredForOrder, false);
  assert.equal(p.reportCanAuthorizeExecution, false);
  assert.equal(p.reportEvidenceAuthority, 'RESEARCH_GRADE_ONLY');
  assert.equal(p.executionEvidenceRequiresRevalidation, true);
  assert.equal(p.deterministicRiskSovereign, true);
  assert.equal(p.historicalAuditMutation, 'FORBIDDEN');
  assert.deepEqual(p.performanceStreams, ['BACKTEST', 'FORWARD', 'PAPER']);
  assert.equal(p.missingPerformance, 'UNKNOWN');
  assert.deepEqual(p.plans, ['Core', 'Plus', 'Pro', 'Max', 'Enterprise']);
  assert.deepEqual(p.proCapacityMultipliers, [1, 2, 5, 20]);
  assert.equal(p.capacityChangesEntitlements, false);
  assert.deepEqual(p.workloadPresets, ['Balanced', 'Strategy', 'Research']);

  const requiredSafety = ['POSITIONS','RISK','STOPS','PROTECTION','DECISION_REPLAY','AUDIT_HISTORY','FRESHNESS_STATUS','CRITICAL_ALERTS'];
  assert.deepEqual(p.creditSafetyExemptSurfaces, requiredSafety);

  const serviceNames = manifest.railway.services.map((s) => s.name).sort();
  assert.deepEqual(serviceNames, [
    'black-oracle-web',
    'black-oracle-paper-vnext',
    'black-oracle-paper-s2-shadow',
    'black-oracle-paper-v9-multiasset'
  ].sort());

  for (const service of manifest.railway.services) {
    assert.match(service.deploymentSha, /^[a-f0-9]{40}$/);
    if (service.configuredSha !== null) assert.match(service.configuredSha, /^[a-f0-9]{40}$/);
    assert.equal(service.deploymentStatus, 'SUCCESS');
    assert.equal(service.runtimeHealth, 'UNKNOWN');
  }

  const vnext = manifest.railway.services.find((s) => s.name === 'black-oracle-paper-vnext');
  assert.ok(vnext);
  assert.notEqual(vnext.configuredSha, vnext.deploymentSha);

  assert.ok(manifest.schedulerMappings.some((s) => s.runtimeId === 'black-oracle-paper-vnext-s1r2' && s.enabled));
  assert.ok(manifest.checkpointObservations.some((s) => s.runtimeId === 'black-oracle-paper-native-shadow'));
  const v03Owner = manifest.runtimeOwners.find((s) => s.runtimeId === 'black-oracle-paper-vnext-100m-v03');
  assert.ok(v03Owner);
  assert.equal(v03Owner.ownerService, 'black-oracle-web');
  assert.equal(v03Owner.status, 'VERIFIED');
  assert.ok(manifest.operationalObservations.some((s) => s.state === 'NOT_READY'));
  assert.ok(manifest.activeCronJobs.length >= 3);
  assert.ok(Array.isArray(manifest.blockers) && manifest.blockers.length > 0);

  const storage = manifest.storageAuthority;
  assert.equal(storage.inspectionMode, 'SANITIZED_READ_ONLY_METADATA');
  assert.equal(storage.scopedPublicTables, 47);
  assert.equal(storage.rlsEnabledTables, storage.scopedPublicTables);
  assert.equal(storage.browserGrantedTables, 0);
  assert.equal(storage.tablesWithPolicies, 0);
  assert.equal(storage.serviceRoleDestructiveTables, 44);
  assert.deepEqual(storage.appendOnlyServiceRoleTables, [
    'black_oracle_events',
    'research_feature_observations',
    'research_feature_outcomes'
  ]);
  assert.equal(storage.betaWriteNamespace.exists, false);
  assert.equal(storage.betaWriteNamespace.legacyMutationDeniedByDatabase, false);
  assert.equal(storage.betaWriteNamespace.enforcementStatus, 'NOT_ENFORCED');
  assert.equal(storage.scopedFunctions, 35);
  assert.equal(storage.securityDefinerFunctions, 7);
  assert.deepEqual(storage.browserExecutableFunctions, [
    { name: 'nars_official_series_version', securityDefiner: false }
  ]);
  assert.deepEqual(storage.viewsWithoutSecurityInvoker, [
    'nars_cluster_metrics_v1',
    'nars_cluster_review_queue_v1',
    'nars_story_wire_v1'
  ]);
  assert.equal(storage.viewsWithoutSecurityInvokerBrowserReadable, false);
  assert.deepEqual(storage.edgeFunctionsWithoutJwt.map((f) => [f.name, f.authorization, f.reviewStatus]), [
    ['nars-shadow-poll', 'CUSTOM_HASHED_HEADER', 'VERIFIED_FAIL_CLOSED'],
    ['nars-evidence-acquire', 'CUSTOM_HASHED_HEADER', 'VERIFIED_FAIL_CLOSED'],
    ['black-oracle-runtime-status', 'PUBLIC_READ_ONLY_STATUS', 'REQUIRES_OUTPUT_AND_ENUMERATION_REVIEW']
  ]);
  assert.equal(storage.conclusion, 'DECLARED_READ_ONLY_NOT_DATABASE_ENFORCED');

  const readiness = manifest.runtimeReadinessContract;
  assert.equal(readiness.version, 'BO-RUNTIME-STATUS-v0.3');
  assert.equal(readiness.sourceStatus, 'MERGE_AND_DEPLOY_PENDING');
  assert.equal(readiness.productionVersion, 'BO-RUNTIME-STATUS-v0.2');
  assert.match(readiness.productionSourceSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(readiness.publicRuntimeIds, [
    'black-oracle-paper',
    'black-oracle-paper-native-shadow'
  ]);
  assert.deepEqual(readiness.readyRequires, [
    'PERSISTED_CHECKPOINT',
    'FRESH_CHECKPOINT',
    'REQUIRED_SCHEDULER_ENABLED',
    'REQUIRED_SCHEDULER_FRESH',
    'REQUIRED_SCHEDULER_2XX',
    'REQUIRED_SCHEDULER_LAST_OK',
    'ZERO_CYCLE_ERRORS',
    'EVIDENCE_ATTACHMENT_NOT_FAILED'
  ]);
  assert.equal(readiness.http409Ready, false);
  assert.equal(readiness.schedulerHeartbeatCanRefreshCheckpoint, false);
  assert.equal(readiness.unknownReady, false);
  assert.equal(readiness.authority, 'OBSERVABILITY_ONLY');

  return {
    contractValid: true,
    releaseReady: false,
    b0Status: manifest.b0Status,
    unresolved: manifest.blockers
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = JSON.parse(readFileSync(new URL('../ops/b0-baseline.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify(validateB0Baseline(manifest), null, 2));
}
