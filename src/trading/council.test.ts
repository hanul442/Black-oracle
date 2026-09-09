import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShadowCouncil } from './council';
import type { EvidenceAggregate } from './evidence';

const evidence = (overrides: Partial<EvidenceAggregate> = {}): EvidenceAggregate => ({
  activeCount: 0,
  bullishCount: 0,
  bearishCount: 0,
  neutralCount: 0,
  contradictionCount: 0,
  score: 0,
  confidence: 0,
  evidenceIds: [],
  ...overrides,
});

const mtf = (regime = 'UPTREND') => ({
  market: 'KRW-BTC',
  asOf: Date.now(),
  action: 'BUY',
  confidence: 0.72,
  directionalScore: 55,
  oracleTradeScore: 74,
  frames: {
    fourHour: { regime: { regime, confidence: 0.8 } },
    oneHour: { regime: { regime, confidence: 0.8 } },
    fifteenMinute: { regime: { regime, confidence: 0.7 } },
  },
}) as any;

const decision = (action: 'ENTER' | 'EXIT' | 'HOLD' = 'ENTER', riskDisposition: 'APPROVE' | 'REJECT' | 'NOT_EVALUATED' = 'APPROVE') => ({
  action,
  side: action === 'EXIT' ? 'SELL' : 'BUY',
  confidence: 0.72,
  notional: 1_000_000,
  quantity: 0,
  riskDisposition,
  reasons: ['test'],
  riskReasons: riskDisposition === 'REJECT' ? ['risk rejected'] : [],
}) as any;

test('Shadow Council never receives execution or promotion authority', () => {
  const council = buildShadowCouncil({ market: 'KRW-BTC', decision: decision(), multiTimeframe: mtf(), evidence: evidence() });
  assert.equal(council.mode, 'SHADOW');
  assert.equal(council.executionAuthority, false);
  assert.equal(council.promotionAuthority, false);
  assert.equal(council.members.length, 5);
});

test('Crypto Evidence member abstains when no external Evidence exists', () => {
  const council = buildShadowCouncil({ market: 'KRW-BTC', decision: decision(), multiTimeframe: mtf(), evidence: evidence() });
  assert.equal(council.members.find((member) => member.role === 'EVIDENCE')?.vote, 'ABSTAIN');
});

test('Equity Evidence member rejects new risk when source-backed Evidence is missing', () => {
  const council = buildShadowCouncil({ market: 'KRX-005930', decision: decision(), multiTimeframe: mtf(), evidence: evidence() });
  assert.equal(council.members.find((member) => member.role === 'EVIDENCE')?.vote, 'REJECT');
});

test('Risk rejection forces Shadow Council reject verdict', () => {
  const council = buildShadowCouncil({
    market: 'KRW-BTC',
    decision: decision('ENTER', 'REJECT'),
    multiTimeframe: mtf(),
    evidence: evidence({ activeCount: 1, bullishCount: 1, score: 35, confidence: 0.75, evidenceIds: ['e1'] }),
  });
  assert.equal(council.verdict, 'REJECT');
});
