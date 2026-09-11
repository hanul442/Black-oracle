import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShadowCouncil } from './council';
import type { EvidenceAggregate } from './evidence';

const evidence = (overrides: Partial<EvidenceAggregate> = {}): EvidenceAggregate => ({
  market: 'KRW-BTC',
  score: 0,
  confidence: 0,
  activeCount: 0,
  bullishWeight: 0,
  bearishWeight: 0,
  contradictionCount: 0,
  asOf: Date.now(),
  evidenceIds: [],
  reasons: [],
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

const decision = (action: 'ENTER' | 'EXIT' | 'HOLD' = 'ENTER') => ({
  action,
  side: action === 'EXIT' ? 'SELL' : 'BUY',
  confidence: 0.72,
  notional: action === 'ENTER' ? 1_000_000 : 0,
  quantity: 0,
  stopLossPrice: action === 'ENTER' ? 95 : null,
  takeProfitPrice: action === 'ENTER' ? 110 : null,
  takeProfit1Price: action === 'ENTER' ? 105 : null,
  takeProfit2Price: action === 'ENTER' ? 110 : null,
  expectedLossAtStop: action === 'ENTER' ? 10_000 : null,
  riskDisposition: 'NOT_EVALUATED',
  reasons: ['test'],
  riskReasons: [],
}) as any;

test('Council v3 never receives execution or promotion authority', () => {
  const council = buildShadowCouncil({ market: 'KRW-BTC', decision: decision(), multiTimeframe: mtf(), evidence: evidence() });
  assert.equal(council.mode, 'SHADOW');
  assert.equal(council.executionAuthority, false);
  assert.equal(council.promotionAuthority, false);
  assert.equal(council.decisionMethod, 'EVIDENCE_GATED');
  assert.equal(council.members.length, 5);
});

test('Council v3 uses professional primary-team roles plus an independent Red Team', () => {
  const council = buildShadowCouncil({ market: 'KRW-BTC', decision: decision(), multiTimeframe: mtf(), evidence: evidence() });
  assert.deepEqual(
    council.members.map((member) => member.role),
    [
      'CHIEF_MARKET_STRATEGIST',
      'EVIDENCE_INTELLIGENCE',
      'QUANT_MODEL_VALIDATION',
      'TRADE_ARCHITECT',
      'ADVERSARIAL_RESEARCH',
    ],
  );
  assert.equal(council.members.at(-1)?.team, 'RED_TEAM');
});

test('Crypto Evidence Intelligence abstains when no external Evidence exists', () => {
  const council = buildShadowCouncil({ market: 'KRW-BTC', decision: decision(), multiTimeframe: mtf(), evidence: evidence() });
  assert.equal(council.members.find((member) => member.role === 'EVIDENCE_INTELLIGENCE')?.vote, 'ABSTAIN');
});

test('Equity Evidence Intelligence rejects new risk when source-backed Evidence is missing', () => {
  const council = buildShadowCouncil({ market: 'KRX-005930', decision: decision(), multiTimeframe: mtf(), evidence: evidence({ market: 'KRX-005930' }) });
  assert.equal(council.members.find((member) => member.role === 'EVIDENCE_INTELLIGENCE')?.vote, 'REJECT');
  assert.equal(council.verdict, 'REJECT');
});

test('vote counts are observability only; missing quant validation makes an otherwise healthy entry conditional', () => {
  const council = buildShadowCouncil({
    market: 'KRW-BTC',
    decision: decision(),
    multiTimeframe: mtf(),
    evidence: evidence({ activeCount: 1, bullishWeight: 0.8, score: 35, confidence: 0.75, evidenceIds: ['e1'] }),
  });
  assert.equal(council.members.find((member) => member.role === 'QUANT_MODEL_VALIDATION')?.vote, 'ABSTAIN');
  assert.equal(council.verdict, 'CONDITIONAL');
  assert.match(council.summary, /not a majority-vote decision rule/i);
});

test('Red Team can invalidate an entry when contradictions and adverse microstructure stack', () => {
  const council = buildShadowCouncil({
    market: 'KRW-BTC',
    decision: decision(),
    multiTimeframe: mtf('DOWNTREND'),
    evidence: evidence({ activeCount: 2, score: 15, confidence: 0.7, contradictionCount: 2, evidenceIds: ['e1', 'e2'] }),
    microstructure: { available: true, direction: 'BEARISH', confidence: 0.8 } as any,
  });
  assert.equal(council.redTeamResult, 'INVALIDATED');
  assert.equal(council.verdict, 'REJECT');
  assert.ok(council.criticalDissent.length > 0);
});
