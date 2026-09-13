import {
  EQUITY_MIN_DAILY_VOLUME,
  evaluateEquityUniverseCandidate,
  type EquityUniverseCandidate,
  type EquityUniverseDecision,
} from '../../../src/trading/equityUniversePolicy';
import type { EquityExposureResolution } from '../../../src/trading/equityExposureRegistry';
import type { KisRankedStock, KisStockProfile } from './kisMarketData';

export interface KrxUniverseMarketData {
  volumeRank(limit?: number): Promise<KisRankedStock[]>;
  stockProfile(symbol: string): Promise<KisStockProfile>;
}

export interface KrxExposureResolver {
  resolve(market: string, asOf?: number): EquityExposureResolution;
}

export interface KrxUniverseRow {
  candidate: EquityUniverseCandidate;
  decision: EquityUniverseDecision;
  rank: number;
  price: number;
  turnoverKrw: number;
  changeRate: number | null;
  marketName: string | null;
  profile: {
    foreignNetBuyQty: number | null;
    programNetBuyQty: number | null;
    foreignHoldingQty: number | null;
    foreignExhaustionRate: number | null;
    volumeTurnoverRate: number | null;
    per: number | null;
    pbr: number | null;
  };
  exposure: EquityExposureResolution;
  dataErrors: string[];
}

export interface KrxUniversePacket {
  asOf: number;
  source: 'KIS';
  mode: 'SHADOW';
  executionAuthority: false;
  discovered: number;
  volumePrefiltered: number;
  profiled: number;
  eligible: number;
  blocked: number;
  rows: KrxUniverseRow[];
  reasons: string[];
}

const meaningfulWarningCode = (value: string | null) => {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  return !['0', '00', '000', 'NONE', 'N'].includes(normalized);
};

const profileWarning = (profile: KisStockProfile) => Boolean(
  profile.investmentCaution
  || profile.shortTermOverheat
  || profile.liquidationTrading
  || meaningfulWarningCode(profile.marketWarningCode)
  || meaningfulWarningCode(profile.managementIssueCode),
);

const sleep = (ms: number) => ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

export const buildKrxUniversePacket = async (
  marketData: KrxUniverseMarketData,
  exposureResolver: KrxExposureResolver,
  options: {
    discoveryLimit?: number;
    maxProfiles?: number;
    profileDelayMs?: number;
    asOf?: number;
  } = {},
): Promise<KrxUniversePacket> => {
  const asOf = options.asOf ?? Date.now();
  const discoveryLimit = Math.max(1, Math.min(100, Math.trunc(options.discoveryLimit ?? 100)));
  const maxProfiles = Math.max(1, Math.min(discoveryLimit, Math.trunc(options.maxProfiles ?? 60)));
  const profileDelayMs = Math.max(0, Math.trunc(options.profileDelayMs ?? 150));
  const ranked = await marketData.volumeRank(discoveryLimit);
  const liquid = ranked.filter((stock) => stock.volume >= EQUITY_MIN_DAILY_VOLUME).slice(0, maxProfiles);
  const rows: KrxUniverseRow[] = [];

  for (let index = 0; index < liquid.length; index += 1) {
    const stock = liquid[index];
    const market = `KRX-${stock.symbol}`;
    const exposure = exposureResolver.resolve(market, asOf);
    const dataErrors: string[] = [];
    let profile: KisStockProfile | null = null;
    try {
      profile = await marketData.stockProfile(stock.symbol);
    } catch (error) {
      dataErrors.push(error instanceof Error ? error.message : 'Unknown KIS profile error.');
    }

    const candidate: EquityUniverseCandidate = {
      market,
      symbol: stock.symbol,
      name: stock.name,
      sector: profile?.sectorName ?? null,
      dailyVolume: profile?.volume ?? stock.volume ?? null,
      marketCapKrw: profile?.marketCapKrw ?? null,
      cryptoLinked: exposure.cryptoLinked,
      cryptoLinkReasons: exposure.reasons,
      suspended: profile?.temporaryStop ?? false,
      warning: profile ? profileWarning(profile) : false,
    };
    const decision = evaluateEquityUniverseCandidate(candidate);
    if (!profile) decision.dataGaps.push('KIS stock profile is unavailable.');
    decision.dataGaps.push(...exposure.dataGaps);

    rows.push({
      candidate,
      decision,
      rank: stock.rank,
      price: profile?.price ?? stock.price,
      turnoverKrw: stock.turnoverKrw,
      changeRate: profile?.changeRate ?? stock.changeRate,
      marketName: profile?.marketName ?? stock.marketName,
      profile: {
        foreignNetBuyQty: profile?.foreignNetBuyQty ?? null,
        programNetBuyQty: profile?.programNetBuyQty ?? null,
        foreignHoldingQty: profile?.foreignHoldingQty ?? null,
        foreignExhaustionRate: profile?.foreignExhaustionRate ?? null,
        volumeTurnoverRate: profile?.volumeTurnoverRate ?? null,
        per: profile?.per ?? null,
        pbr: profile?.pbr ?? null,
      },
      exposure,
      dataErrors,
    });

    if (index < liquid.length - 1) await sleep(profileDelayMs);
  }

  const eligible = rows.filter((row) => row.decision.eligible).length;
  return {
    asOf,
    source: 'KIS',
    mode: 'SHADOW',
    executionAuthority: false,
    discovered: ranked.length,
    volumePrefiltered: ranked.filter((stock) => stock.volume >= EQUITY_MIN_DAILY_VOLUME).length,
    profiled: rows.length,
    eligible,
    blocked: rows.length - eligible,
    rows,
    reasons: [
      `Discovered ${ranked.length} KRX-ranked stocks; ${ranked.filter((stock) => stock.volume >= EQUITY_MIN_DAILY_VOLUME).length} passed the 500,000-share prefilter.`,
      `${rows.length} candidates were profiled with KIS before the market-cap, warning and crypto-exposure hard gates.`,
      'Crypto exposure must resolve from source-backed registry records; UNKNOWN remains blocked.',
    ],
  };
};
