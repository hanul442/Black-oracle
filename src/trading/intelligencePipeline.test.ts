import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFinalDecision, type TradingIntelligencePackage } from './intelligencePipeline';
import type { ExecutionDecision } from './types';

const baseEnter: ExecutionDecision = {
  action: 'ENTER',
  side: 'BUY',
  notional: 20_000,
  quantity: 0,
  confidence: 0.72,
  stopLossPrice: 90,
  takeProfitPrice: 120,
  riskDisposition: 'APPROVE',
  riskReasons: ['risk ok'],
  reasons: ['technical and deterministic risk gates passed'],
};

const supportedPackage = (now = 1_000_000): TradingIntelligencePackage => ({
  market: 'KRW-BTC',
  generatedAt: now - 1_000,
  expiresAt: now + 60_000,
  executionAuthority: false,
  evidenceIds: ['ev-1'],
  impact: {
    market: 'KRW-BTC',
    scope: 'CANDIDATE',
    disposition: 'MATERIAL',
    direction: 'BULLISH',
    materiality: 0.8,
    confidence: 0.8,
    evidenceIds: ['ev-1'],
    reasons: ['material catalyst'],
    asOf: now - 1_000,
    expiresAt: now + 60_000,
    executionAuthority: false,
  },
  scenarios: {
    market: 'KRW-BTC',
    asOf: now - 1_000,
    expiresAt: now + 60_000,
    executionAuthority: false,
    sourceEvidenceIds: ['ev-1'],
    branches: [
      { id: 'bull', market: 'KRW-BTC', label: 'BULL', probability: 0.35, confidence: 0.7, direction: 'UP', thesis: 'bull', triggerConditions: [], invalidationConditions: [], watchItems: [], evidenceIds: ['ev-1'] },
      { id: 'base', market: 'KRW-BTC', label: 'BASE', probability: 0.35, confidence: 0.7, direction: 'FLAT', thesis: 'base', triggerConditions: [], invalidationConditions: [], watchItems: [], evidenceIds: ['ev-1'] },
      { id: 'bear', market: 'KRW-BTC', label: 'BEAR', probability: 0.2, confidence: 0.65, direction: 'DOWN', thesis: 'bear', triggerConditions: [], invalidationConditions: [], watchItems: [], evidenceIds: ['ev-1'] },
      { id: 'tail', market: 'KRW-BTC', label: 'TAIL', probability: 0.1, confidence: 0.55, direction: 'VOLATILE', thesis: 'tail', triggerConditions: [], invalidationConditions: [], watchItems: [], evidenceIds: ['ev-1'] },
    ],
  },
  council: {
    market: 'KRW-BTC',
    asOf: now - 1_000,
    expiresAt: now + 60_000,
    recommendedScenarioId: 'bull',
    executionAuthority: false,
    crossScenarioObservations: [],
    rankings: [{
      scenarioId: 'bull', rank: 1, consensusScore: 0.8, probabilityEstimate: 0.42, confidence: 0.72,
      disposition: 'ADVANCE', dominantSupport: 'support', dominantChallenge: 'risk', unresolvedUncertainty: [], preservedDissent: [],
    }],
  },
});

test('observe-only mode records an intelligence block without changing current Paper action', () => {
  const now = 1_000_000;
  const bearish = supportedPackage(now);
  bearish.impact.direction = 'BEARISH';
  const decision = buildFinalDecision({ market: 'KRW-BTC', executionDecision: baseEnter, hasOpenPositionBefore: false, intelligence: bearish, mode: 'OBSERVE_ONLY', now });
  assert.equal(decision.baseAction, 'ENTER');
  assert.equal(decision.proposedAction, 'NO_TRADE');
  assert.equal(decision.action, 'ENTER');
  assert.equal(decision.intelligenceDisposition, 'OPPOSED');
});

test('enforce mode blocks a new entry when intelligence is missing', () => {
  const decision = buildFinalDecision({ market: 'KRW-BTC', executionDecision: baseEnter, hasOpenPositionBefore: false, intelligence: null, mode: 'ENFORCE', now: 1_000_000 });
  assert.equal(decision.proposedAction, 'NO_TRADE');
  assert.equal(decision.action, 'NO_TRADE');
  assert.equal(decision.intelligenceDisposition, 'INSUFFICIENT');
});

test('supported fresh intelligence preserves deterministic entry eligibility', () => {
  const now = 1_000_000;
  const decision = buildFinalDecision({ market: 'KRW-BTC', executionDecision: baseEnter, hasOpenPositionBefore: false, intelligence: supportedPackage(now), mode: 'ENFORCE', now });
  assert.equal(decision.action, 'ENTER');
  assert.equal(decision.intelligenceDisposition, 'SUPPORTED');
});

test('protective exits cannot be blocked by Council or intelligence', () => {
  const exitDecision: ExecutionDecision = {
    action: 'EXIT', side: 'SELL', notional: 10_000, quantity: 1, confidence: 1,
    stopLossPrice: 90, takeProfitPrice: 120, riskDisposition: 'NOT_EVALUATED', riskReasons: [], reasons: ['protective stop-loss was reached'],
  };
  const now = 1_000_000;
  const packageValue = supportedPackage(now);
  packageValue.impact.direction = 'BEARISH';
  packageValue.council.rankings[0].disposition = 'CHALLENGE';
  const decision = buildFinalDecision({ market: 'KRW-BTC', executionDecision: exitDecision, hasOpenPositionBefore: true, intelligence: packageValue, mode: 'ENFORCE', now });
  assert.equal(decision.action, 'EXIT');
  assert.equal(decision.proposedAction, 'EXIT');
});
