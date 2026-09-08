import test from 'node:test';
import assert from 'node:assert/strict';
import type { ResearchFeatureObservation, ResearchFeatureOutcome } from '../../src/trading/research/featureOutcome';
import { SupabaseResearchPersistence } from './researchPersistence';
import { ResearchFeatureStore } from './researchStore';

const observation: ResearchFeatureObservation = {
  id: 'cycle-1:KRW-BTC:1H:breakout.donchian.v1:1.0.0',
  cycleId: 'cycle-1',
  timestamp: 1_000,
  market: 'KRW-BTC',
  timeframe: '1H',
  featureFamily: 'BREAKOUT',
  featureName: 'breakout.donchian.v1',
  featureVersion: '1.0.0',
  rawValue: 1,
  normalizedValue: 0.5,
  direction: 'BULLISH',
  confidence: 0.8,
  status: 'SHADOW',
  strategyVersion: 'test',
  codeCommit: 'commit',
  configVersion: 'config',
  provenance: 'PROSPECTIVE',
  referencePrice: 100,
  executionDecision: 'NO_TRADE',
  evidenceScore: null,
  evidenceConfidence: 0,
  oracleTradeScore: 65,
  metadata: { authority: 'OBSERVATION_ONLY' },
};

const outcome: ResearchFeatureOutcome = {
  observationId: observation.id,
  horizon: '1H',
  futureReturn: 0.02,
  mfe: 0.03,
  mae: -0.01,
  resolvedAt: 3_601_000,
};

test('normalized Supabase writer delivers observations before outcomes with idempotent conflicts', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(null, { status: 201 });
  }) as typeof fetch;

  const persistence = new SupabaseResearchPersistence({
    url: 'https://example.supabase.co',
    serviceRoleKey: 'service-role-test',
    fetchImpl,
  });

  const result = await persistence.persist({ observations: [observation], outcomes: [outcome] });
  assert.equal(result.persisted, true);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /research_feature_observations/);
  assert.match(calls[0].url, /on_conflict=id/);
  assert.match(calls[1].url, /research_feature_outcomes/);
  assert.match(decodeURIComponent(calls[1].url), /on_conflict=observation_id,horizon/);
  assert.equal((calls[0].init.headers as Record<string, string>).Prefer, 'resolution=ignore-duplicates,return=minimal');

  const observationBody = JSON.parse(String(calls[0].init.body));
  assert.equal(observationBody[0].cycle_id, 'cycle-1');
  assert.equal(observationBody[0].execution_decision, 'NO_TRADE');
  assert.equal(observationBody[0].metadata.authority, 'OBSERVATION_ONLY');

  const status = persistence.status();
  assert.equal(status.deliveredObservations, 1);
  assert.equal(status.deliveredOutcomes, 1);
  assert.equal(status.lastError, null);
});

test('legacy research checkpoints become pending and clear only after explicit persistence acknowledgement', () => {
  const store = new ResearchFeatureStore();
  store.restore({
    schemaVersion: 1,
    observations: [observation],
    outcomes: [outcome],
  });

  assert.deepEqual(store.persistenceBacklog(), { observations: 1, outcomes: 1 });
  const pending = store.pendingPersistence();
  assert.equal(pending.observations.length, 1);
  assert.equal(pending.outcomes.length, 1);

  store.markPersisted(pending);
  assert.deepEqual(store.persistenceBacklog(), { observations: 0, outcomes: 0 });
});
