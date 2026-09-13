import type { KisIndexSnapshot, KisRankedStock, KisStockProfile } from './kisMarketData';

const KRX_JSON_URL = 'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd';
const KRX_REFERER = 'https://data.krx.co.kr/contents/MDC/MAIN/main/index.cmd';
const DAY_MS = 24 * 60 * 60_000;

const asNumber = (value: unknown): number | null => {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (!text || text === '-') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const kstDate = (timestamp: number) => {
  const date = new Date(timestamp + 9 * 60 * 60_000);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
};

const closeTimestampKst = (yyyymmdd: string) => {
  const year = Number(yyyymmdd.slice(0, 4));
  const month = Number(yyyymmdd.slice(4, 6));
  const day = Number(yyyymmdd.slice(6, 8));
  return Date.UTC(year, month - 1, day, 6, 30, 0, 0);
};

const postKrx = async (bld: string, form: Record<string, string>) => {
  const body = new URLSearchParams({
    bld,
    locale: 'ko_KR',
    csvxls_isNo: 'false',
    ...form,
  });
  const response = await fetch(KRX_JSON_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: KRX_REFERER,
      'User-Agent': 'Mozilla/5.0 BlackOracle/1.0 KRX-EOD-research',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`KRX ${bld} returned HTTP ${response.status}.`);
  const payload = await response.json().catch(() => null) as any;
  if (!payload || typeof payload !== 'object') throw new Error(`KRX ${bld} returned a non-JSON payload.`);
  return payload;
};

const rowsOf = (payload: any) => {
  for (const key of ['output', 'OutBlock_1', 'block1']) {
    if (Array.isArray(payload?.[key])) return payload[key] as any[];
  }
  return [] as any[];
};

export interface KrxOfficialEodSnapshot {
  tradingDate: string;
  asOf: number;
  sourceIds: string[];
  rows: Map<string, KisStockProfile & { name: string; turnoverKrw: number }>;
  indexObservations: Array<Pick<KisIndexSnapshot,
    'code' | 'name' | 'value' | 'changeRate' | 'volume' | 'previousVolume' | 'turnoverKrw' | 'previousTurnoverKrw' | 'open' | 'high' | 'low' | 'advancingIssues' | 'flatIssues' | 'decliningIssues' | 'asOf'>>;
}

const marketLabel = (value: unknown) => {
  const text = String(value ?? '').trim().toUpperCase();
  if (text.includes('KOSDAQ')) return 'KOSDAQ';
  if (text.includes('KOSPI')) return 'KOSPI';
  return text || null;
};

const profileFromRows = (
  raw: any,
  sector: { name: string | null; marketName: string | null } | undefined,
  asOf: number,
): (KisStockProfile & { name: string; turnoverKrw: number }) | null => {
  const symbol = String(raw?.ISU_SRT_CD ?? '').trim();
  const price = asNumber(raw?.TDD_CLSPRC);
  if (!/^\d{6}$/.test(symbol) || price == null || price <= 0) return null;
  const listedShares = asNumber(raw?.LIST_SHRS);
  const volume = asNumber(raw?.ACC_TRDVOL);
  const marketCapKrw = asNumber(raw?.MKTCAP) ?? (listedShares != null && listedShares > 0 ? price * listedShares : null);
  const changeRateRaw = asNumber(raw?.FLUC_RT);
  const volumeTurnoverRate = listedShares != null && listedShares > 0 && volume != null
    ? volume / listedShares * 100
    : null;
  return {
    symbol,
    name: String(raw?.ISU_ABBRV ?? raw?.ISU_NM ?? symbol).trim(),
    price,
    open: asNumber(raw?.TDD_OPNPRC),
    high: asNumber(raw?.TDD_HGPRC),
    low: asNumber(raw?.TDD_LWPRC),
    volume,
    changeRate: changeRateRaw == null ? null : changeRateRaw / 100,
    asOf,
    marketName: sector?.marketName ?? marketLabel(raw?.MKT_NM ?? raw?.MKT_TP_NM),
    sectorName: sector?.name ?? null,
    listedShares,
    marketCapKrw,
    htsMarketCapRaw: null,
    foreignNetBuyQty: null,
    programNetBuyQty: null,
    foreignHoldingQty: null,
    foreignExhaustionRate: null,
    volumeTurnoverRate,
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
    turnoverKrw: asNumber(raw?.ACC_TRDVAL) ?? 0,
  };
};

const indexObservation = (
  name: 'KOSPI' | 'KOSDAQ',
  rows: Array<KisStockProfile & { turnoverKrw: number }>,
  asOf: number,
) => {
  const validReturns = rows.map((item) => item.changeRate).filter((value): value is number => value != null && Number.isFinite(value));
  const totalCap = rows.reduce((sum, item) => sum + Math.max(0, item.marketCapKrw ?? 0), 0);
  const weightedReturn = totalCap > 0
    ? rows.reduce((sum, item) => sum + (item.changeRate ?? 0) * Math.max(0, item.marketCapKrw ?? 0), 0) / totalCap
    : validReturns.length ? validReturns.reduce((sum, value) => sum + value, 0) / validReturns.length : null;
  const advancing = validReturns.filter((value) => value > 0).length;
  const flat = validReturns.filter((value) => value === 0).length;
  const declining = validReturns.filter((value) => value < 0).length;
  return {
    code: name === 'KOSPI' ? '0001' as const : '1001' as const,
    name,
    // EOD all-stock statistics do not expose the official index level in this endpoint.
    // A neutral positive sentinel keeps the observation structurally valid while change-rate/breadth drive the research score.
    value: 1,
    changeRate: weightedReturn,
    volume: rows.reduce((sum, item) => sum + Math.max(0, item.volume ?? 0), 0),
    previousVolume: null,
    turnoverKrw: rows.reduce((sum, item) => sum + Math.max(0, item.turnoverKrw ?? 0), 0),
    previousTurnoverKrw: null,
    open: null,
    high: null,
    low: null,
    advancingIssues: advancing,
    flatIssues: flat,
    decliningIssues: declining,
    asOf,
  };
};

export class KrxOfficialEodMarketData {
  readonly source = 'KRX_OFFICIAL_EOD' as const;
  private snapshotPromise: Promise<KrxOfficialEodSnapshot> | null = null;

  private async loadSnapshot(now = Date.now()): Promise<KrxOfficialEodSnapshot> {
    const errors: string[] = [];
    for (let offset = 0; offset < 10; offset += 1) {
      const tradingDate = kstDate(now - offset * DAY_MS);
      try {
        const allPayload = await postKrx('dbms/MDC/STAT/standard/MDCSTAT01501', {
          mktId: 'ALL',
          trdDd: tradingDate,
          share: '1',
          money: '1',
        });
        const allRows = rowsOf(allPayload);
        if (!allRows.length) continue;

        const sectorMap = new Map<string, { name: string | null; marketName: string | null }>();
        for (const [mktId, marketName] of [['STK', 'KOSPI'], ['KSQ', 'KOSDAQ']] as const) {
          try {
            const sectorPayload = await postKrx('dbms/MDC/STAT/standard/MDCSTAT03901', {
              mktId,
              trdDd: tradingDate,
              money: '1',
            });
            for (const row of rowsOf(sectorPayload)) {
              const symbol = String(row?.ISU_SRT_CD ?? '').trim();
              if (!/^\d{6}$/.test(symbol)) continue;
              sectorMap.set(symbol, {
                name: String(row?.IDX_IND_NM ?? '').trim() || null,
                marketName,
              });
            }
          } catch (error) {
            errors.push(`${mktId} sector: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        const asOf = closeTimestampKst(tradingDate);
        const rows = new Map<string, KisStockProfile & { name: string; turnoverKrw: number }>();
        for (const raw of allRows) {
          const profile = profileFromRows(raw, sectorMap.get(String(raw?.ISU_SRT_CD ?? '').trim()), asOf);
          if (profile) rows.set(profile.symbol, profile);
        }
        if (!rows.size) continue;

        const kospiRows = [...rows.values()].filter((item) => item.marketName === 'KOSPI');
        const kosdaqRows = [...rows.values()].filter((item) => item.marketName === 'KOSDAQ');
        return {
          tradingDate,
          asOf,
          sourceIds: [
            `KRX:MDCSTAT01501:${tradingDate}`,
            `KRX:MDCSTAT03901:STK:${tradingDate}`,
            `KRX:MDCSTAT03901:KSQ:${tradingDate}`,
          ],
          rows,
          indexObservations: [
            indexObservation('KOSPI', kospiRows, asOf),
            indexObservation('KOSDAQ', kosdaqRows, asOf),
          ],
        };
      } catch (error) {
        errors.push(`${tradingDate}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    throw new Error(`Official KRX EOD snapshot unavailable. ${errors.slice(-4).join(' | ')}`);
  }

  snapshot() {
    if (!this.snapshotPromise) this.snapshotPromise = this.loadSnapshot();
    return this.snapshotPromise;
  }

  async volumeRank(limit = 100): Promise<KisRankedStock[]> {
    const snapshot = await this.snapshot();
    return [...snapshot.rows.values()]
      .filter((item) => item.volume != null && item.volume > 0)
      .sort((a, b) => Number(b.volume ?? 0) - Number(a.volume ?? 0) || b.turnoverKrw - a.turnoverKrw)
      .slice(0, Math.max(1, Math.min(100, Math.trunc(limit))))
      .map((item, index) => ({
        symbol: item.symbol,
        name: item.name,
        price: item.price,
        volume: Number(item.volume ?? 0),
        turnoverKrw: item.turnoverKrw,
        changeRate: item.changeRate,
        rank: index + 1,
        marketName: item.marketName,
      }));
  }

  async stockProfile(symbol: string): Promise<KisStockProfile> {
    const snapshot = await this.snapshot();
    const profile = snapshot.rows.get(symbol);
    if (!profile) throw new Error(`Official KRX EOD profile missing for ${symbol}.`);
    const { name: _name, turnoverKrw: _turnoverKrw, ...result } = profile;
    return result;
  }

  async sourceIds() {
    return (await this.snapshot()).sourceIds.slice();
  }

  async indexSnapshots() {
    return (await this.snapshot()).indexObservations.map((item) => ({ ...item }));
  }

  async qualificationDataGaps(symbol: string) {
    const snapshot = await this.snapshot();
    const profile = snapshot.rows.get(symbol);
    const gaps = [
      'Official KRX EOD fallback does not provide current-session suspension/designation warning flags in this snapshot; nomination remains research-only.',
    ];
    if (!profile?.sectorName) gaps.push('Official KRX sector classification is unavailable for this symbol/date.');
    return gaps;
  }
}
