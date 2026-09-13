import assert from 'node:assert/strict';
import test from 'node:test';
import { buildKrxShortHorizonMarketSectorSnapshot, krxSessionProgress } from './krxMarketSectorObservation';

const middayKst = Date.UTC(2026, 8, 11, 3, 0, 0);

const indexes = [
  {
    code: '0001',
    name: 'KOSPI',
    value: 3400,
    changeRate: 0.01,
    turnoverKrw: 6_000_000_000_000,
    previousTurnoverKrw: 12_000_000_000_000,
    high: 3410,
    low: 3370,
    advancingIssues: 600,
    flatIssues: 50,
    decliningIssues: 250,
  },
  {
    code: '1001',
    name: 'KOSDAQ',
    value: 920,
    changeRate: 0.02,
    turnoverKrw: 5_000_000_000_000,
    previousTurnoverKrw: 9_000_000_000_000,
    high: 928,
    low: 910,
    advancingIssues: 1000,
    flatIssues: 100,
    decliningIssues: 500,
  },
];

const equities = [
  { market: 'KRX-000660', sector: '반도체', changeRate: 0.045, volumeTurnoverRate: 2.4, evidenceScore: 70, evidenceCount: 2, warning: false },
  { market: 'KRX-005930', sector: '반도체', changeRate: 0.028, volumeTurnoverRate: 1.8, evidenceScore: 40, evidenceCount: 1, warning: false },
  { market: 'KRX-042700', sector: '반도체', changeRate: 0.035, volumeTurnoverRate: 2.0, evidenceScore: 55, evidenceCount: 1, warning: false },
  { market: 'KRX-105560', sector: '은행', changeRate: -0.004, volumeTurnoverRate: 0.5, evidenceScore: -20, evidenceCount: 1, warning: false },
  { market: 'KRX-055550', sector: '은행', changeRate: 0.001, volumeTurnoverRate: 0.6, evidenceScore: null, evidenceCount: 0, warning: false },
  { market: 'KRX-086790', sector: '은행', changeRate: -0.008, volumeTurnoverRate: 0.4, evidenceScore: -35, evidenceCount: 1, warning: false },
];

test('KRX session progress is bounded and reflects KST trading hours', () => {
  assert.equal(krxSessionProgress(Date.UTC(2026, 8, 11, 0, 0, 0)), 0);
  assert.ok(krxSessionProgress(middayKst) > 0.45 && krxSessionProgress(middayKst) < 0.47);
  assert.equal(krxSessionProgress(Date.UTC(2026, 8, 11, 7, 0, 0)), 1);
});

test('builds a SHORT market state from official-index observations and ranks sectors', () => {
  const snapshot = buildKrxShortHorizonMarketSectorSnapshot({ asOf: middayKst, indexes, equities });
  const marketState = snapshot.marketRuntime.marketStates.SHORT;

  assert.equal(snapshot.horizon, 'SHORT');
  assert.ok(marketState);
  assert.ok((marketState?.score ?? 0) > 50);
  assert.ok((marketState?.confidence ?? 0) > 0.5);
  assert.equal(snapshot.sectorScores[0]?.sector, '반도체');
  assert.ok((snapshot.sectorScores[0]?.score.score ?? 0) > (snapshot.sectorScores[1]?.score.score ?? 0));
  assert.equal(snapshot.sectorScores[0]?.constituentCount, 3);
  assert.ok(snapshot.sectorScores[0]?.dataGaps.some((gap) => /fundamental/i.test(gap)));
});

test('missing index and evidence inputs stay explicit DATA_GAPs instead of fabricated coverage', () => {
  const snapshot = buildKrxShortHorizonMarketSectorSnapshot({
    asOf: middayKst,
    indexes: [],
    equities: [{ market: 'KRX-005930', sector: '반도체', changeRate: 0.01, volumeTurnoverRate: null, evidenceScore: null, evidenceCount: 0, warning: false }],
    indexErrors: ['KOSPI unavailable', 'KOSDAQ unavailable'],
  });

  const marketState = snapshot.marketRuntime.marketStates.SHORT;
  assert.ok(marketState);
  assert.equal(marketState?.indexTrendScore, 50);
  assert.equal(marketState?.breadthScore, 50);
  assert.ok(snapshot.dataGaps.some((gap) => /KOSPI unavailable/i.test(gap)));
  assert.ok(snapshot.dataGaps.some((gap) => /no active source-backed KRX equity Evidence/i.test(gap)));
  assert.ok(snapshot.sectorScores[0]?.dataGaps.some((gap) => /volume-turnover percentile is unavailable/i.test(gap)));
});