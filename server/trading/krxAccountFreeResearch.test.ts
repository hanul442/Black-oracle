import assert from 'node:assert/strict';
import test from 'node:test';
import { EquityExposureRegistry } from '../../src/trading/equityExposureRegistry';
import { projectInvestmentCycleEvents } from '../../src/trading/investmentCycleReadModel';
import { buildKrxShadowResearchCanonicalEvents } from './equity/krxShadowResearchEvents';
import { buildKrxUniversePacket } from './equity/krxUniverseBuilder';
import type { KrxShadowResearchCycleResult } from './equity/krxShadowResearchLoop';
import type { KisStockProfile } from './equity/kisMarketData';

const AS_OF = Date.UTC(2026, 8, 11, 6, 30, 0, 0);

const profile: KisStockProfile = {
  symbol: '000660',
  price: 250_000,
  open: 245_000,
  high: 252_000,
  low: 244_000,
  volume: 2_000_000,
  changeRate: 0.025,
  asOf: AS_OF,
  marketName: 'KOSPI',
  sectorName: '전기전자',
  listedShares: 700_000_000,
  marketCapKrw: 175_000_000_000_000,
  htsMarketCapRaw: null,
  foreignNetBuyQty: null,
  programNetBuyQty: null,
  foreignHoldingQty: null,
  foreignExhaustionRate: null,
  volumeTurnoverRate: 0.2857,
  per: null,
  pbr: null,
  eps: null,
  bps: null,
  temporaryStop: null,
  investmentCaution: null,
  marketWarningCode: null,
  shortTermOverheat: null,
  liquidationTrading: null,
  managementIssueCode: null,
};

test('official KRX EOD provider stays fail-closed when exposure and current-session designation metadata are unresolved', async () => {
  const exposure = new EquityExposureRegistry();
  const packet = await buildKrxUniversePacket({
    source: 'KRX_OFFICIAL_EOD',
    async volumeRank() {
      return [{
        symbol: '000660',
        name: 'SK하이닉스',
        price: profile.price,
        volume: Number(profile.volume),
        turnoverKrw: 500_000_000_000,
        changeRate: profile.changeRate,
        rank: 1,
        marketName: profile.marketName,
      }];
    },
    async stockProfile() {
      return profile;
    },
    qualificationDataGaps() {
      return ['Official KRX EOD fallback does not provide current-session suspension/designation warning flags; nomination remains research-only.'];
    },
  }, exposure, { asOf: AS_OF, profileDelayMs: 0 });

  assert.equal(packet.source, 'KRX_OFFICIAL_EOD');
  assert.equal(packet.profiled, 1);
  assert.equal(packet.eligible, 0);
  assert.equal(packet.blocked, 1);
  assert.equal(packet.rows[0]?.candidate.marketCapKrw, profile.marketCapKrw);
  assert.equal(packet.rows[0]?.exposure.status, 'UNKNOWN');
  assert.equal(packet.rows[0]?.decision.eligible, false);
  assert.equal(packet.rows[0]?.decision.dataGaps.some((value) => value.includes('source-backed company exposure')), true);
  assert.equal(packet.rows[0]?.decision.dataGaps.some((value) => value.includes('current-session suspension/designation')), true);
});

test('blocked account-free Committee readiness is visible without inventing a nomination', () => {
  const cycle: KrxShadowResearchCycleResult = {
    startedAt: AS_OF,
    finishedAt: AS_OF + 1_000,
    tradingDate: '20260911',
    source: 'KRX_OFFICIAL_EOD',
    mode: 'SHADOW',
    executionAuthority: false,
    universe: {
      asOf: AS_OF,
      source: 'KRX_OFFICIAL_EOD',
      mode: 'SHADOW',
      executionAuthority: false,
      discovered: 1,
      volumePrefiltered: 1,
      profiled: 1,
      eligible: 0,
      blocked: 1,
      rows: [],
      reasons: [],
    },
    marketSector: {
      asOf: AS_OF,
      horizon: 'SHORT',
      marketRuntime: {
        mode: 'SHADOW',
        executionAuthority: false,
        marketStates: {
          SHORT: {
            id: `market-state::SHORT::${AS_OF}`,
            horizon: 'SHORT',
            asOf: AS_OF,
            score: 65,
            confidence: 0.55,
            stance: 'RISK_ON',
            riskMultiplier: 0.9,
            indexTrendScore: 65,
            breadthScore: 60,
            turnoverScore: 50,
            volatilityScore: 50,
            evidenceScore: 50,
            sourceIds: ['KRX:MDCSTAT01501:20260911'],
            dataGaps: ['Index DATA_GAP: prior turnover unavailable.'],
            reasons: [],
          },
        },
        sectorPackets: [],
        blockers: [],
      },
      sectorScores: [{
        sector: '전기전자',
        constituentCount: 10,
        positiveCount: 7,
        breadthPct: 70,
        dataGaps: [],
        score: {
          sector: '전기전자',
          horizon: 'SHORT',
          relativeStrength: 70,
          breadth: 70,
          volumeParticipation: 70,
          evidenceScore: 50,
          earningsOrFundamentalMomentum: null,
          riskPenalty: 0,
          score: 66.8,
          stance: 'BULLISH',
        },
      }],
      benchmarkChangeRate: 0.01,
      sessionProgress: 1,
      dataGaps: ['Index DATA_GAP: prior turnover unavailable.'],
      sourceIds: ['KRX:MDCSTAT01501:20260911'],
    },
    committeeCandidates: [{
      market: 'KRX-000660',
      symbol: '000660',
      name: 'SK하이닉스',
      sector: '전기전자',
      horizon: 'SHORT',
      rank: 1,
      score: 78,
      sectorScore: 66.8,
      changeRate: 0.025,
      dailyVolume: 2_000_000,
      marketCapKrw: 175_000_000_000_000,
      evidenceScore: 0,
      evidenceCount: 0,
      evidenceIds: [],
      hardGateEligible: false,
      nominationReady: false,
      blockers: ['Crypto-linked equity classification is unavailable.'],
    }],
    nominationReadyCount: 0,
    blockers: ['Crypto-linked equity classification is UNKNOWN; source-backed exposure classification is required before nomination.'],
    sourceIds: ['KRX:MDCSTAT01501:20260911'],
  };

  const events = buildKrxShadowResearchCanonicalEvents(cycle, 'black-oracle-paper-s2-shadow');
  assert.equal(events.every((item) => item.executionAuthority === false), true);
  assert.equal(events.some((item) => item.eventName === 'V10_UNIVERSE_GATE_EVALUATED' && item.action === 'BLOCKED'), true);
  assert.equal(events.some((item) => item.eventName === 'V10_NOMINATION_READINESS_BLOCKED'), true);
  assert.equal(events.some((item) => item.eventName === 'V10_COMMITTEE_NOMINATION'), false);

  const projection = projectInvestmentCycleEvents(events.map((item) => ({
    ...item,
    occurredAt: Number(item.occurredAt),
  })), { now: AS_OF + 60_000 });

  assert.equal(projection.stages.find((item) => item.id === 'MARKET_STATE')?.status, 'LIVE');
  assert.equal(projection.stages.find((item) => item.id === 'SECTOR_STATE')?.status, 'LIVE');
  assert.equal(projection.stages.find((item) => item.id === 'UNIVERSE_GATE')?.status, 'LIVE');
  assert.equal(projection.stages.find((item) => item.id === 'NOMINATION')?.status, 'LIVE');
  assert.equal(projection.funnel.nominated, 0);
  assert.equal(projection.blockers.some((value) => value.includes('Crypto-linked')), true);
});
