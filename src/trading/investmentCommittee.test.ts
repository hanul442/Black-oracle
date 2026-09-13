import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHeadCouncilShortlist, type CommitteeCrossReview, type CommitteeNomination } from './investmentCommittee';

const nomination = (memberId: string, market: string, score: number): CommitteeNomination => ({
  memberId,
  market,
  horizon: 'SHORT',
  rank: 1,
  thesis: `${market} thesis`,
  strategyId: 'TEST',
  score,
  evidenceIds: ['e1'],
  signalIds: ['s1'],
  dataGaps: [],
});

const review = (reviewerId: string, market: string, score: number, hardReject = false): CommitteeCrossReview => ({
  reviewerId,
  market,
  horizon: 'SHORT',
  score,
  confidence: 0.8,
  support: score >= 60 ? ['support'] : [],
  objections: score < 40 ? ['objection', 'second objection'] : [],
  dataGaps: [],
  hardReject,
});

test('head council keeps roughly top 30% after cross review', () => {
  const markets = ['KRX-A', 'KRX-B', 'KRX-C', 'KRX-D'];
  const nominations = markets.flatMap((market, index) => [
    nomination('trend_momentum', market, 90 - index * 15),
    nomination('sector_rotation', market, 88 - index * 15),
  ]);
  const reviews = markets.flatMap((market, index) => [
    review('trade_architect', market, 92 - index * 18),
    review('portfolio_risk', market, 90 - index * 18),
    review('adversarial_red_team', market, 88 - index * 18),
  ]);

  const result = buildHeadCouncilShortlist(nominations, reviews, { survivalFraction: 0.30, minCrossReviews: 3 });
  assert.equal(result.filter((item) => item.survived).length, 2);
  assert.equal(result[0].market, 'KRX-A');
});

test('hard veto removes candidate before ranking survival', () => {
  const nominations = [nomination('trend_momentum', 'KRX-A', 95), nomination('sector_rotation', 'KRX-A', 95)];
  const reviews = [review('trade_architect', 'KRX-A', 95), review('portfolio_risk', 'KRX-A', 95), review('adversarial_red_team', 'KRX-A', 95, true)];
  const [result] = buildHeadCouncilShortlist(nominations, reviews);
  assert.equal(result.hardRejected, true);
  assert.equal(result.survived, false);
  assert.equal(result.finalScore, 0);
});

test('insufficient cross-review coverage cannot survive', () => {
  const nominations = [nomination('trend_momentum', 'KRX-A', 90)];
  const reviews = [review('trade_architect', 'KRX-A', 90)];
  const [result] = buildHeadCouncilShortlist(nominations, reviews, { minCrossReviews: 3 });
  assert.equal(result.survived, false);
});
