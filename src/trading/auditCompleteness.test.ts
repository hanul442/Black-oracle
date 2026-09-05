import test from 'node:test';
import assert from 'node:assert/strict';
import { assessAuditCompleteness } from './auditCompleteness';

test('HOLD does not require execution or outcome linkage', () => {
  const result = assessAuditCompleteness({
    action: 'HOLD',
    timestamp: 1,
    market: 'KRW-BTC',
    regime: 'TREND',
    oracleTradeScore: 70,
    confidence: 0.8,
    strategyDisposition: 'TREND_MOMENTUM',
    riskDisposition: 'APPROVE',
    evidenceActiveCount: 2,
    evidenceIds: ['ev-1', 'ev-2'],
    forecastAvailable: true,
    scenarioLinked: true,
    councilLinked: true,
    primaryReason: 'Trend remains intact.',
  });

  assert.equal(result.score, 100);
  assert.equal(result.grade, 'COMPLETE');
  assert.equal(result.dimensions.find((item) => item.id === 'EXECUTION_TRACE')?.state, 'NOT_APPLICABLE');
  assert.equal(result.dimensions.find((item) => item.id === 'OUTCOME')?.state, 'NOT_APPLICABLE');
});

test('ENTER is weak when evidence, scenario, council and execution links are missing', () => {
  const result = assessAuditCompleteness({
    action: 'ENTER',
    timestamp: 1,
    market: 'KRW-BTC',
    regime: 'TREND',
    oracleTradeScore: 70,
    confidence: 0.8,
    strategyDisposition: 'TREND_MOMENTUM',
    riskDisposition: 'APPROVE',
    evidenceActiveCount: 0,
    evidenceIds: [],
    forecastAvailable: false,
    scenarioLinked: false,
    councilLinked: false,
    executionLinked: false,
    primaryReason: 'Technical trigger fired.',
  });

  assert.equal(result.score, 43);
  assert.equal(result.grade, 'WEAK');
  assert.deepEqual(result.missing.sort(), ['COUNCIL', 'EVIDENCE', 'EXECUTION_TRACE', 'FORECAST_SCENARIO'].sort());
});

test('EXIT requires execution and outcome linkage', () => {
  const result = assessAuditCompleteness({
    action: 'EXIT',
    timestamp: 1,
    market: 'KRW-BTC',
    regime: 'TREND',
    oracleTradeScore: 40,
    confidence: 0.7,
    strategyDisposition: 'TREND_MOMENTUM',
    riskDisposition: 'APPROVE',
    evidenceActiveCount: 1,
    evidenceIds: ['ev-1'],
    forecastAvailable: true,
    scenarioLinked: true,
    councilLinked: true,
    executionLinked: true,
    outcomeLinked: true,
    primaryReason: 'Protective exit.',
  });

  assert.equal(result.score, 100);
  assert.equal(result.applicable, 8);
  assert.equal(result.missing.length, 0);
});
