import assert from 'node:assert/strict';
import test from 'node:test';
import { REQUIRED_VALIDATION_STAGES, type ValidationStage } from './validationExperiment';
import type { ValidationEvaluation } from './validationStageResult';
import { bindStrategyCandidateToValidation } from './strategyValidationBinding';
import { routeChampionChallenger } from './championChallengerRouter';
import { arbitrateGovernance } from './governanceArbiter';
import { evaluateBotRiskExecutionBoundary } from '../../server/trading/botRiskExecutionBoundary';
import { buildUpbitOrderDryRun, reconcileUpbitDryRun, type RiskApprovedIntent } from './upbitDryRunReconciliation';
import { evaluateLiveCanaryReadiness } from './liveCanaryReadiness';
import { attributeObservedOutcome } from './outcomeAttribution';

const T = '2026-09-22T00:00:30.000Z';
const OBSERVED = '2026-09-22T00:00:20.000Z';
const EXPIRES = '2026-09-22T00:01:30.000Z';

function evaluation(experimentId: string): ValidationEvaluation {
  const fingerprints = Object.fromEntries(REQUIRED_VALIDATION_STAGES.map((stage) => [stage, `sha256:${experimentId}:${stage}`])) as Record<ValidationStage, string>;
  return {
    schema: 'bot.validation-evaluation.v1', experimentId, evaluatedAt: OBSERVED, status: 'PASS',
    stageResultFingerprints: fingerprints, gates: [{ gateId: 's13', status: 'PASS', reason: 'deterministic fixture' }],
    promotionAuthority: false, executionAuthority: false, capitalAuthority: false,
  };
}

function governedPaperFixture(options: { killSwitch?: boolean; staleGovernance?: boolean; councilReject?: boolean } = {}) {
  const champion = bindStrategyCandidateToValidation({ strategyId: 'alpha-champion', strategyRevision: 'r13', experimentId: 'exp-s13-champion', evaluation: evaluation('exp-s13-champion') });
  const challenger = bindStrategyCandidateToValidation({ strategyId: 'alpha-challenger', strategyRevision: 'r13', experimentId: 'exp-s13-challenger', evaluation: evaluation('exp-s13-challenger') });
  const router = routeChampionChallenger({
    champion: { role: 'CHAMPION', binding: champion, comparisonScore: 2, observedAt: OBSERVED, maxAgeMs: 60_000, regimeFit: true },
    challenger: { role: 'CHALLENGER', binding: challenger, comparisonScore: 1, observedAt: OBSERVED, maxAgeMs: 60_000, regimeFit: true },
    evaluatedAt: T,
  });
  const findingTime = options.staleGovernance ? '2026-09-21T23:00:00.000Z' : OBSERVED;
  const governance = arbitrateGovernance({
    routerDecision: router,
    council: { sourceId: 'council-s13', strategyId: 'alpha-champion', strategyRevision: 'r13', observedAt: findingTime, maxAgeMs: 60_000, verdict: options.councilReject ? 'REJECT' : 'APPROVE', evidenceFingerprints: ['ev:council:s13'] },
    redTeam: { sourceId: 'redteam-s13', strategyId: 'alpha-champion', strategyRevision: 'r13', observedAt: findingTime, maxAgeMs: 60_000, verdict: 'CLEAR', evidenceFingerprints: ['ev:redteam:s13'] },
    evaluatedAt: T,
  });
  const risk = evaluateBotRiskExecutionBoundary({
    contractVersion: 'bot.risk-execution-boundary.v1', now: T, mode: 'PAPER',
    governance: {
      contractVersion: 'bot.governance-decision.v1', decisionId: 'gov-s13', outcome: governance.action,
      strategyId: governance.strategyId ?? undefined, strategyRevision: governance.strategyRevision ?? undefined,
      evidenceFingerprint: `gov:${governance.reason}:s13`, decidedAt: governance.evaluatedAt,
      executionAuthority: false, capitalAuthority: false, riskBypassAuthority: false, liveAuthority: false,
    },
    risk: governance.action === 'APPROVE' ? {
      snapshotId: 'risk-s13', strategyId: 'alpha-champion', strategyRevision: 'r13', observedAt: OBSERVED,
      maxAgeMs: 60_000, killSwitchEngaged: options.killSwitch ?? false, duplicateIntent: false, marketDataFresh: true, limitsSatisfied: true,
    } : undefined,
  });
  return { champion, challenger, router, governance, risk };
}

function riskApprovedIntent(risk: ReturnType<typeof evaluateBotRiskExecutionBoundary>): RiskApprovedIntent {
  if (risk.outcome !== 'ALLOW_INTENT' || !risk.strategyId || !risk.strategyRevision) throw new Error('risk did not allow fixture');
  return {
    contractVersion: 'bot.risk-execution-boundary.v1', decision: 'APPROVE', mode: risk.mode,
    intentId: 'intent-s13', market: 'KRW-BTC', side: 'BUY', quantity: 0.001, referencePrice: 100_000_000,
    evaluatedAt: risk.evaluatedAt, expiresAt: EXPIRES, strategyId: risk.strategyId,
    routerDecisionId: 'router-s13', governanceDecisionId: risk.governanceDecisionId, riskDecisionId: risk.decisionId,
    eventLedgerId: 'event-ledger-s13', decisionReplayId: 'decision-replay-s13', killSwitchActive: false,
    executionAuthority: false, capitalAuthority: false, liveAuthority: false,
  };
}

function fullPaperChain() {
  const upstream = governedPaperFixture();
  const intent = riskApprovedIntent(upstream.risk);
  const dryRun = buildUpbitOrderDryRun({ adapter: 'UPBIT', operation: 'ORDER_DRY_RUN', risk: intent, idempotencyKey: 'idem-s13', requestedAt: T });
  const reconciliation = reconcileUpbitDryRun(dryRun, dryRun);
  const readiness = evaluateLiveCanaryReadiness({
    mode: 'PAPER', evaluatedAt: T, killSwitchActive: false,
    adapterHealth: { adapter: 'UPBIT', status: 'HEALTHY', observedAt: OBSERVED, expiresAt: EXPIRES }, reconciliation,
    expectedRequestId: dryRun.requestId, expectedIdempotencyKey: dryRun.idempotencyKey,
    expectedEventLedgerId: dryRun.lineage.eventLedgerId, expectedDecisionReplayId: dryRun.lineage.decisionReplayId,
  });
  const attribution = attributeObservedOutcome({
    evaluatedAt: T, maxOutcomeAgeMs: 60_000, dryRun, readiness,
    outcome: { outcomeId: 'outcome-s13', mode: 'PAPER', market: 'KRW-BTC', observedAt: T,
      sourceEventLedgerId: dryRun.lineage.eventLedgerId, sourceDecisionReplayId: dryRun.lineage.decisionReplayId,
      requestId: dryRun.requestId, idempotencyKey: dryRun.idempotencyKey, realizedPnl: 1_000, realizedReturn: 0.01 },
  });
  return { ...upstream, dryRun, reconciliation, readiness, attribution };
}

test('S13 deterministic PAPER fixture preserves lineage and never gains financial authority', () => {
  const chain = fullPaperChain();
  assert.equal(chain.router.action, 'SELECT');
  assert.equal(chain.governance.action, 'APPROVE');
  assert.equal(chain.risk.outcome, 'ALLOW_INTENT');
  assert.equal(chain.dryRun.status, 'DRY_RUN');
  assert.equal(chain.reconciliation.status, 'MATCH');
  assert.equal(chain.readiness.status, 'READY');
  assert.equal(chain.attribution.status, 'ATTRIBUTED');
  for (const boundary of [chain.router, chain.governance, chain.risk, chain.dryRun, chain.readiness, chain.attribution]) {
    assert.equal(boundary.executionAuthority, false);
    assert.equal(boundary.capitalAuthority, false);
    assert.equal(boundary.liveAuthority, false);
  }
  assert.equal(chain.attribution.eventLedgerId, chain.dryRun.lineage.eventLedgerId);
  assert.equal(chain.attribution.decisionReplayId, chain.dryRun.lineage.decisionReplayId);
});

test('stale governance evidence and Council rejection terminate before deterministic Risk', () => {
  for (const fixture of [governedPaperFixture({ staleGovernance: true }), governedPaperFixture({ councilReject: true })]) {
    assert.equal(fixture.governance.action, 'NO_TRADE');
    assert.equal(fixture.risk.outcome, 'NO_TRADE');
    assert.deepEqual(fixture.risk.reasonCodes, ['GOVERNANCE_NO_TRADE']);
  }
});

test('kill switch terminates at Risk and cannot construct the downstream approved fixture', () => {
  const fixture = governedPaperFixture({ killSwitch: true });
  assert.equal(fixture.risk.outcome, 'NO_TRADE');
  assert.deepEqual(fixture.risk.reasonCodes, ['KILL_SWITCH_ENGAGED']);
  assert.throws(() => riskApprovedIntent(fixture.risk), /did not allow/);
});

test('reconciliation mismatch fails readiness closed', () => {
  const chain = fullPaperChain();
  const observed = { ...chain.dryRun, referencePrice: chain.dryRun.referencePrice + 1 };
  const reconciliation = reconcileUpbitDryRun(chain.dryRun, observed);
  const readiness = evaluateLiveCanaryReadiness({
    mode: 'PAPER', evaluatedAt: T, killSwitchActive: false,
    adapterHealth: { adapter: 'UPBIT', status: 'HEALTHY', observedAt: OBSERVED, expiresAt: EXPIRES }, reconciliation,
    expectedRequestId: chain.dryRun.requestId, expectedIdempotencyKey: chain.dryRun.idempotencyKey,
    expectedEventLedgerId: chain.dryRun.lineage.eventLedgerId, expectedDecisionReplayId: chain.dryRun.lineage.decisionReplayId,
  });
  assert.equal(reconciliation.status, 'NO_TRADE');
  assert.equal(readiness.status, 'NO_TRADE');
});

test('outcome lineage mismatch is terminal and suppresses numeric attribution', () => {
  const chain = fullPaperChain();
  const attribution = attributeObservedOutcome({
    evaluatedAt: T, maxOutcomeAgeMs: 60_000, dryRun: chain.dryRun, readiness: chain.readiness,
    outcome: { outcomeId: 'outcome-mismatch', mode: 'PAPER', market: 'KRW-BTC', observedAt: T,
      sourceEventLedgerId: 'wrong-ledger', sourceDecisionReplayId: chain.dryRun.lineage.decisionReplayId,
      requestId: chain.dryRun.requestId, idempotencyKey: chain.dryRun.idempotencyKey, realizedPnl: 99, realizedReturn: 0.99 },
  });
  assert.equal(attribution.status, 'NO_TRADE');
  assert.equal(attribution.reason, 'LINEAGE_MISMATCH');
  assert.equal(attribution.realizedPnl, null);
  assert.equal(attribution.realizedReturn, null);
});
