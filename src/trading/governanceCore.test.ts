import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDeterministicGovernancePackage } from './governanceCore';
import type { EvidenceAggregate } from './evidence';
import type { LiquiditySnapshot, MultiTimeframeSnapshot } from './types';

const evidence = (score: number, activeCount = 3, confidence = 0.78): EvidenceAggregate => ({
  market: 'KRW-BTC',
  score,
  confidence,
  activeCount,
  bullishWeight: score > 0 ? 1.8 : 0.15,
  bearishWeight: score < 0 ? 1.8 : 0.15,
  contradictionCount: 0,
  asOf: 1_000_000,
  evidenceIds: activeCount ? Array.from({ length: activeCount }, (_, index) => `ev-${index + 1}`) : [],
  reasons: activeCount ? ['Structured evidence is active.'] : ['No active structured trading evidence is available.'],
});

const multiTimeframe = (directionalScore = 62, confidence = 0.82): MultiTimeframeSnapshot => ({
  market: 'KRW-BTC',
  asOf: 1_000_000,
  action: directionalScore > 20 ? 'BUY' : directionalScore < -20 ? 'SELL' : 'WAIT',
  directionalScore,
  oracleTradeScore: directionalScore > 0 ? 78 : 30,
  confidence,
  aligned: true,
  positionRiskMultiplier: 1,
  frames: {
    fourHour: {} as any,
    oneHour: { indicators: { atrPct: 0.018 } } as any,
    fifteenMinute: {} as any,
  },
  reasons: [],
});

const liquidity = (eligible = true): LiquiditySnapshot => ({
  market: 'KRW-BTC',
  tradePrice: 100_000_000,
  accTradePrice24h: 300_000_000_000,
  signedChangeRate: 0.012,
  spreadBps: 4,
  top5BidDepthKrw: 1_000_000_000,
  top5AskDepthKrw: 900_000_000,
  orderbookImbalance: 0.08,
  warning: false,
  score: eligible ? 92 : 20,
  eligible,
  reasons: eligible ? [] : ['Liquidity gate failed.'],
});

test('missing evidence produces deterministic insufficient governance', () => {
  const value = buildDeterministicGovernancePackage({
    market: 'KRW-BTC',
    evidence: evidence(0, 0, 0),
    multiTimeframe: multiTimeframe(),
    liquidity: liquidity(),
    now: 1_000_000,
  });

  assert.equal(value.impact.disposition, 'INSUFFICIENT');
  assert.equal(value.evidenceIds.length, 0);
  assert.equal(value.scenarios.branches.length, 4);
  assert.ok(value.council.rankings.every((item) => item.disposition === 'INSUFFICIENT'));
});

test('bullish evidence and aligned technical context can advance a long thesis', () => {
  const value = buildDeterministicGovernancePackage({
    market: 'KRW-BTC',
    evidence: evidence(68),
    multiTimeframe: multiTimeframe(70, 0.86),
    liquidity: liquidity(),
    now: 1_000_000,
  });

  const probabilityMass = value.scenarios.branches.reduce((sum, item) => sum + item.probability, 0);
  assert.ok(Math.abs(probabilityMass - 1) < 0.00001);
  const top = [...value.council.rankings].sort((a, b) => a.rank - b.rank)[0];
  const topScenario = value.scenarios.branches.find((item) => item.id === top.scenarioId);
  assert.equal(top.disposition, 'ADVANCE');
  assert.equal(topScenario?.label, 'BULL');
});

test('bearish evidence may advance a bearish/base scenario but never a bullish one as the leading Council thesis', () => {
  const value = buildDeterministicGovernancePackage({
    market: 'KRW-BTC',
    evidence: evidence(-82),
    multiTimeframe: multiTimeframe(48, 0.76),
    liquidity: liquidity(),
    now: 1_000_000,
  });

  assert.equal(value.impact.direction, 'BEARISH');
  const top = [...value.council.rankings].sort((a, b) => a.rank - b.rank)[0];
  const topScenario = value.scenarios.branches.find((item) => item.id === top.scenarioId);
  if (top.disposition === 'ADVANCE') assert.notEqual(topScenario?.direction, 'UP');
});

test('same inputs produce stable governance identifiers', () => {
  const input = {
    market: 'KRW-BTC',
    evidence: evidence(60),
    multiTimeframe: multiTimeframe(),
    liquidity: liquidity(),
    now: 1_000_000,
  };
  const left = buildDeterministicGovernancePackage(input);
  const right = buildDeterministicGovernancePackage(input);

  assert.equal(left.id, right.id);
  assert.equal(left.scenarios.id, right.scenarios.id);
  assert.equal(left.council.id, right.council.id);
  assert.deepEqual(left.council.rankings, right.council.rankings);
});
