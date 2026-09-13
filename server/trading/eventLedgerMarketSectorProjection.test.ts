import assert from 'node:assert/strict';
import test from 'node:test';
import { projectInvestmentCycleEvents } from '../../src/trading/investmentCycleReadModel';
import { buildEvidenceAndEquityCanonicalEvents } from '../eventLedgerEvidenceProjection';

const asOf = Date.UTC(2026, 8, 11, 3, 0, 0);

test('projects KRX Market State and Sector State into the V10 live read model', () => {
  const events = buildEvidenceAndEquityCanonicalEvents({
    finishedAt: asOf,
    evidenceOps: {},
    markets: [],
    equityCycle: {
      finishedAt: asOf,
      decisions: [],
      marketSector: {
        asOf,
        horizon: 'SHORT',
        marketRuntime: {
          marketStates: {
            SHORT: {
              horizon: 'SHORT',
              asOf,
              id: `market-state::SHORT::${asOf}`,
              score: 68.4,
              confidence: 0.72,
              stance: 'RISK_ON',
              riskMultiplier: 0.9,
              indexTrendScore: 66,
              breadthScore: 70,
              turnoverScore: 62,
              volatilityScore: 58,
              evidenceScore: 61,
              fxRiskScore: null,
              ratesRiskScore: null,
              crossAssetScore: null,
              sourceIds: ['KIS:FHPUP02100000:0001', 'KIS:FHPUP02100000:1001'],
              dataGaps: ['FX DATA_GAP'],
              reasons: ['SHORT market-state score 68.4 (RISK_ON).'],
            },
          },
          sectorPackets: [],
          blockers: [],
          mode: 'SHADOW',
          executionAuthority: false,
        },
        sectorScores: [{
          sector: '반도체',
          constituentCount: 4,
          positiveCount: 3,
          breadthPct: 75,
          dataGaps: ['No constituent-level earnings/fundamental momentum score is available.'],
          score: {
            sector: '반도체',
            horizon: 'SHORT',
            relativeStrength: 78,
            breadth: 75,
            volumeParticipation: 72,
            evidenceScore: 68,
            earningsOrFundamentalMomentum: null,
            riskPenalty: 0,
            score: 71.2,
            stance: 'BULLISH',
          },
        }],
      },
    },
  }, 'black-oracle-paper-v9-multiasset');

  const market = events.find((event) => event.eventName === 'V10_MARKET_STATE_OBSERVED');
  const sector = events.find((event) => event.eventName === 'V10_SECTOR_STATE_OBSERVED');
  assert.equal(market?.executionAuthority, false);
  assert.equal(market?.action, 'RISK_ON');
  assert.equal(market?.trace?.horizon, 'SHORT');
  assert.deepEqual(market?.trace?.sourceIds, ['KIS:FHPUP02100000:0001', 'KIS:FHPUP02100000:1001']);
  assert.equal(sector?.executionAuthority, false);
  assert.equal(sector?.trace?.sector, '반도체');
  assert.equal(sector?.action, 'BULLISH');

  const readModel = projectInvestmentCycleEvents(events, { now: asOf + 60_000 });
  assert.equal(readModel.stages.find((stage) => stage.id === 'MARKET_STATE')?.status, 'LIVE');
  assert.equal(readModel.stages.find((stage) => stage.id === 'SECTOR_STATE')?.status, 'LIVE');
  assert.equal(readModel.horizons.find((item) => item.horizon === 'SHORT')?.count, 2);
  assert.ok(readModel.blockers.some((blocker) => /FX DATA_GAP/i.test(blocker)));
  assert.ok(readModel.blockers.some((blocker) => /Investment Committee nomination producer/i.test(blocker)));
  assert.ok(!readModel.blockers.some((blocker) => /Market State producer has not emitted/i.test(blocker)));
  assert.ok(!readModel.blockers.some((blocker) => /Sector Strength producer has not emitted/i.test(blocker)));
});