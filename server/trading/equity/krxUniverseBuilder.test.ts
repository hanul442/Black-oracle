import assert from 'node:assert/strict';
import test from 'node:test';
import { EquityExposureRegistry } from '../../../src/trading/equityExposureRegistry';
import type { KisRankedStock, KisStockProfile } from './kisMarketData';
import { buildKrxUniversePacket } from './krxUniverseBuilder';

const now = Date.now();
const ranked: KisRankedStock[] = [
  { symbol: '000001', name: 'PASS', price: 10_000, volume: 800_000, turnoverKrw: 8_000_000_000, changeRate: 0.03, rank: 1, marketName: 'KOSPI' },
  { symbol: '000002', name: 'SMALL', price: 2_000, volume: 900_000, turnoverKrw: 1_800_000_000, changeRate: 0.01, rank: 2, marketName: 'KOSDAQ' },
  { symbol: '000003', name: 'LOWVOL', price: 20_000, volume: 200_000, turnoverKrw: 4_000_000_000, changeRate: 0.02, rank: 3, marketName: 'KOSPI' },
];

const profile = (symbol: string): KisStockProfile => ({
  symbol,
  price: symbol === '000002' ? 2_000 : 10_000,
  open: null,
  high: null,
  low: null,
  volume: symbol === '000002' ? 900_000 : 800_000,
  changeRate: 0.02,
  asOf: now,
  marketName: symbol === '000002' ? 'KOSDAQ' : 'KOSPI',
  sectorName: '테스트업종',
  listedShares: symbol === '000002' ? 20_000_000 : 30_000_000,
  marketCapKrw: symbol === '000002' ? 40_000_000_000 : 300_000_000_000,
  htsMarketCapRaw: null,
  foreignNetBuyQty: 12_000,
  programNetBuyQty: 7_000,
  foreignHoldingQty: 1_000_000,
  foreignExhaustionRate: 10,
  volumeTurnoverRate: 2,
  per: 10,
  pbr: 1,
  eps: 1_000,
  bps: 10_000,
  temporaryStop: false,
  investmentCaution: false,
  marketWarningCode: '00',
  shortTermOverheat: false,
  liquidationTrading: false,
  managementIssueCode: '00',
});

test('builder prefilters volume, profiles candidates and applies cap/exposure hard gates', async () => {
  const registry = new EquityExposureRegistry();
  for (const symbol of ['000001', '000002']) {
    registry.upsert({
      market: `KRX-${symbol}`,
      status: 'CLEAR',
      reasons: ['reviewed'],
      sourceType: 'CURATED_RESEARCH',
      sourceId: `source-${symbol}`,
      observedAt: now - 1_000,
      expiresAt: now + 86_400_000,
      confidence: 0.9,
    });
  }
  const marketData = {
    volumeRank: async () => ranked,
    stockProfile: async (symbol: string) => profile(symbol),
  };
  const packet = await buildKrxUniversePacket(marketData, registry, { profileDelayMs: 0, asOf: now });
  assert.equal(packet.discovered, 3);
  assert.equal(packet.volumePrefiltered, 2);
  assert.equal(packet.profiled, 2);
  assert.equal(packet.eligible, 1);
  assert.equal(packet.rows.find((row) => row.candidate.symbol === '000001')?.decision.eligible, true);
  assert.equal(packet.rows.find((row) => row.candidate.symbol === '000002')?.decision.eligible, false);
});

test('unknown crypto exposure blocks even otherwise eligible stock', async () => {
  const registry = new EquityExposureRegistry();
  const marketData = {
    volumeRank: async () => ranked.slice(0, 1),
    stockProfile: async (symbol: string) => profile(symbol),
  };
  const packet = await buildKrxUniversePacket(marketData, registry, { profileDelayMs: 0, asOf: now });
  assert.equal(packet.eligible, 0);
  assert.ok(packet.rows[0].decision.dataGaps.some((item) => item.includes('Crypto-linked')) || packet.rows[0].decision.dataGaps.some((item) => item.includes('exposure classification')));
});
