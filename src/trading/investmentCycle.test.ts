import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInvestmentCycle } from './investmentCycle';
import type { CommitteeCrossReview, CommitteeNomination } from './investmentCommittee';

const nominations: CommitteeNomination[] = [
  { memberId: 'trend_momentum', market: 'KRX-A', horizon: 'SHORT', rank: 1, thesis: 'A', strategyId: 'S1', score: 90, evidenceIds: ['e1'], signalIds: ['s1'], dataGaps: [] },
  { memberId: 'sector_rotation', market: 'KRX-A', horizon: 'SHORT', rank: 1, thesis: 'A', strategyId: 'S2', score: 88, evidenceIds: ['e2'], signalIds: ['s2'], dataGaps: [] },
  { memberId: 'trend_momentum', market: 'KRX-B', horizon: 'SHORT', rank: 2, thesis: 'B', strategyId: 'S1', score: 86, evidenceIds: ['e3'], signalIds: ['s3'], dataGaps: [] },
];

const reviews: CommitteeCrossReview[] = [
  { reviewerId: 'trade_architect', market: 'KRX-A', horizon: 'SHORT', score: 90, confidence: 0.8, support: ['ok'], objections: [], dataGaps: [], hardReject: false },
  { reviewerId: 'portfolio_risk', market: 'KRX-A', horizon: 'SHORT', score: 85, confidence: 0.8, support: ['ok'], objections: [], dataGaps: [], hardReject: false },
  { reviewerId: 'adversarial_red_team', market: 'KRX-A', horizon: 'SHORT', score: 80, confidence: 0.8, support: ['survived'], objections: [], dataGaps: [], hardReject: false },
  { reviewerId: 'trade_architect', market: 'KRX-B', horizon: 'SHORT', score: 90, confidence: 0.8, support: ['ok'], objections: [], dataGaps: [], hardReject: false },
  { reviewerId: 'portfolio_risk', market: 'KRX-B', horizon: 'SHORT', score: 90, confidence: 0.8, support: ['ok'], objections: [], dataGaps: [], hardReject: false },
  { reviewerId: 'adversarial_red_team', market: 'KRX-B', horizon: 'SHORT', score: 90, confidence: 0.8, support: ['ok'], objections: [], dataGaps: [], hardReject: false },
];

test('cycle enforces sector strength and KRX universe gate before Head Council', () => {
  const result = buildInvestmentCycle({
    asOf: Date.now(),
    marketStateId: 'market-state-1',
    sectorSignals: [
      { sector: 'SEMICONDUCTOR', horizon: 'SHORT', relativeStrength: 90, breadth: 80, volumeParticipation: 80, evidenceScore: 80, earningsOrFundamentalMomentum: 75 },
      { sector: 'WEAK', horizon: 'SHORT', relativeStrength: 30, breadth: 30, volumeParticipation: 30, evidenceScore: 30, earningsOrFundamentalMomentum: 30 },
    ],
    equities: [
      { market: 'KRX-A', symbol: '000001', name: 'A', sector: 'SEMICONDUCTOR', dailyVolume: 800_000, marketCapKrw: 500_000_000_000, cryptoLinked: false },
      { market: 'KRX-B', symbol: '000002', name: 'B', sector: 'WEAK', dailyVolume: 800_000, marketCapKrw: 500_000_000_000, cryptoLinked: false },
    ],
    nominations,
    reviews,
  });

  assert.equal(result.counts.equitiesEligible, 2);
  assert.equal(result.counts.nominations, 2);
  assert.equal(result.shortlist.length, 1);
  assert.equal(result.shortlist[0].market, 'KRX-A');
  assert.equal(result.mode, 'SHADOW');
  assert.equal(result.executionAuthority, false);
});

test('cycle blocks unknown market cap instead of silently passing', () => {
  const result = buildInvestmentCycle({
    asOf: Date.now(),
    marketStateId: 'market-state-1',
    sectorSignals: [{ sector: 'SEMICONDUCTOR', horizon: 'SHORT', relativeStrength: 90, breadth: 80, volumeParticipation: 80, evidenceScore: 80 }],
    equities: [{ market: 'KRX-A', symbol: '000001', name: 'A', sector: 'SEMICONDUCTOR', dailyVolume: 800_000, marketCapKrw: null, cryptoLinked: false }],
    nominations,
    reviews,
  });

  assert.equal(result.counts.equitiesEligible, 0);
  assert.ok(result.blockers.some((item) => item.includes('No KRX equity')));
});
