import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFinalDecision, type TradingIntelligencePackage } from './intelligencePipeline';
import type { ExecutionDecision } from './types';

const baseEnter: ExecutionDecision = {
  action: 'ENTER', side: 'BUY', notional: 20_000, quantity: 0, confidence: 0.75,
  stopLossPrice: 95, takeProfitPrice: 110, riskDisposition: 'APPROVE', riskReasons: ['risk pass'], reasons: ['technical pass'],
};

const packageValue = (disposition: 'ADVANCE' | 'MONITOR', now = 1_000_000): TradingIntelligencePackage => ({
  market: 'KRW-BTC', generatedAt: now - 1_000, expiresAt: now + 60_000, evidenceIds: ['ev-1'], executionAuthority: false,
  impact: {
    market: 'KRW-BTC', scope: 'CANDIDATE', disposition: disposition === 'ADVANCE' ? 'MATERIAL' : 'WATCH', direction: disposition === 'ADVANCE' ? 'BULLISH' : 'MIXED',
    materiality: 0.8, confidence: 0.8, evidenceIds: ['ev-1'], reasons: [], asOf: now - 1_000, expiresAt: now + 60_000, executionAuthority: false,
  },
  scenarios: {
    market: 'KRW-BTC', asOf: now - 1_000, expiresAt: now + 60_000, sourceEvidenceIds: ['ev-1'], executionAuthority: false,
    branches: [
      { id: 'bull', market: 'KRW-BTC', label: 'BULL', probability: 0.55, confidence: 0.78, direction: 'UP', thesis: '', triggerConditions: [], invalidationConditions: [], watchItems: [], evidenceIds: ['ev-1'] },
      { id: 'bear', market: 'KRW-BTC', label: 'BEAR', probability: 0.25, confidence: 0.65, direction: 'DOWN', thesis: '', triggerConditions: [], invalidationConditions: [], watchItems: [], evidenceIds: ['ev-1'] },
      { id: 'tail', market: 'KRW-BTC', label: 'TAIL', probability: 0.20, confidence: 0.6, direction: 'VOLATILE', thesis: '', triggerConditions: [], invalidationConditions: [], watchItems: [], evidenceIds: ['ev-1'] },
    ],
  },
  council: {
    market: 'KRW-BTC', asOf: now - 1_000, expiresAt: now + 60_000, recommendedScenarioId: 'bull', executionAuthority: false, crossScenarioObservations: [],
    rankings: [{ scenarioId: 'bull', rank: 1, consensusScore: 0.8, probabilityEstimate: 0.55, confidence: 0.78, disposition, dominantSupport: '', dominantChallenge: '', unresolvedUncertainty: [], preservedDissent: [] }],
  },
});

test('balanced policy preserves cautionary entry for backward compatibility', () => {
  const decision = buildFinalDecision({ market: 'KRW-BTC', executionDecision: baseEnter, hasOpenPositionBefore: false, intelligence: packageValue('MONITOR'), mode: 'ENFORCE', policy: 'BALANCED', now: 1_000_000 });
  assert.equal(decision.intelligenceDisposition, 'CAUTION');
  assert.equal(decision.action, 'ENTER');
});

test('strict consensus blocks cautionary entry', () => {
  const decision = buildFinalDecision({ market: 'KRW-BTC', executionDecision: baseEnter, hasOpenPositionBefore: false, intelligence: packageValue('MONITOR'), mode: 'ENFORCE', policy: 'STRICT_CONSENSUS', now: 1_000_000 });
  assert.equal(decision.intelligenceDisposition, 'CAUTION');
  assert.equal(decision.action, 'NO_TRADE');
});

test('strict consensus permits only supported evidence plus advancing Council', () => {
  const decision = buildFinalDecision({ market: 'KRW-BTC', executionDecision: baseEnter, hasOpenPositionBefore: false, intelligence: packageValue('ADVANCE'), mode: 'ENFORCE', policy: 'STRICT_CONSENSUS', now: 1_000_000 });
  assert.equal(decision.intelligenceDisposition, 'SUPPORTED');
  assert.equal(decision.action, 'ENTER');
});

test('strict consensus still cannot block protective exit', () => {
  const exit: ExecutionDecision = { ...baseEnter, action: 'EXIT', side: 'SELL', quantity: 1, reasons: ['Protective stop-loss was reached.'], riskDisposition: 'NOT_EVALUATED' };
  const decision = buildFinalDecision({ market: 'KRW-BTC', executionDecision: exit, hasOpenPositionBefore: true, intelligence: null, mode: 'ENFORCE', policy: 'STRICT_CONSENSUS', now: 1_000_000 });
  assert.equal(decision.action, 'EXIT');
});
