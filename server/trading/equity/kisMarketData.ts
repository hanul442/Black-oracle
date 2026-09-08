import type { Candle } from '../../../src/trading/types';

export interface KisQuote {
  symbol: string;
  price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  changeRate: number | null;
  asOf: number;
}

type KisEnvironment = 'demo' | 'real';

type TokenState = { value: string; expiresAt: number } | null;

const asNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const yyyymmdd = (timestamp: number) => {
  const date = new Date(timestamp);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

const parseKstDate = (value: string) => {
  if (!/^\d{8}$/.test(value)) return 0;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));
  return Date.UTC(y, m - 1, d, 6, 30, 0, 0); // 15:30 KST daily close anchor.
};

export class KisDomesticStockMarketData {
  private readonly appKey: string;
  private readonly appSecret: string;
  private readonly environment: KisEnvironment;
  private readonly baseUrl: string;
  private token: TokenState = null;

  constructor(options: { appKey: string; appSecret: string; environment?: KisEnvironment }) {
    this.appKey = options.appKey.trim();
    this.appSecret = options.appSecret.trim();
    this.environment = options.environment ?? 'demo';
    if (!this.appKey || !this.appSecret) throw new Error('KIS app key and app secret are required.');
    this.baseUrl = this.environment === 'demo'
      ? 'https://openapivts.koreainvestment.com:29443'
      : 'https://openapi.koreainvestment.com:9443';
  }

  private async accessToken() {
    const now = Date.now();
    if (this.token && this.token.expiresAt - now > 60_000) return this.token.value;
    const response = await fetch(`${this.baseUrl}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ grant_type: 'client_credentials', appkey: this.appKey, appsecret: this.appSecret }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({} as any));
    if (!response.ok || typeof payload?.access_token !== 'string') {
      throw new Error(`KIS token request failed (${response.status}): ${String(payload?.msg1 ?? payload?.error_description ?? 'unknown').slice(0, 200)}`);
    }
    const expiresInSeconds = Math.max(300, Number(payload?.expires_in ?? 86_400));
    this.token = { value: payload.access_token, expiresAt: now + expiresInSeconds * 1_000 };
    return this.token.value;
  }

  private async get(path: string, trId: string, params: Record<string, string>) {
    const token = await this.accessToken();
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        authorization: `Bearer ${token}`,
        appkey: this.appKey,
        appsecret: this.appSecret,
        tr_id: trId,
        custtype: 'P',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({} as any));
    if (!response.ok || payload?.rt_cd !== '0') {
      throw new Error(`KIS ${trId} failed (${response.status}): ${String(payload?.msg1 ?? payload?.msg_cd ?? 'unknown').slice(0, 240)}`);
    }
    return payload;
  }

  async quote(symbol: string): Promise<KisQuote> {
    if (!/^\d{6}$/.test(symbol)) throw new Error('Korean equity symbol must be a six-digit code.');
    const payload = await this.get('/uapi/domestic-stock/v1/quotations/inquire-price', 'FHKST01010100', {
      FID_COND_MRKT_DIV_CODE: 'J',
      FID_INPUT_ISCD: symbol,
    });
    const output = payload?.output ?? {};
    const price = asNumber(output.stck_prpr);
    if (price == null || price <= 0) throw new Error(`KIS quote did not return a valid price for ${symbol}.`);
    return {
      symbol,
      price,
      open: asNumber(output.stck_oprc),
      high: asNumber(output.stck_hgpr),
      low: asNumber(output.stck_lwpr),
      volume: asNumber(output.acml_vol),
      changeRate: asNumber(output.prdy_ctrt) == null ? null : Number(output.prdy_ctrt) / 100,
      asOf: Date.now(),
    };
  }

  async dailyCandles(symbol: string, targetBars = 240): Promise<Candle[]> {
    if (!/^\d{6}$/.test(symbol)) throw new Error('Korean equity symbol must be a six-digit code.');
    const desired = Math.max(200, Math.min(1_000, Math.trunc(targetBars)));
    const rows = new Map<string, any>();
    let endAt = Date.now();

    for (let page = 0; page < 8 && rows.size < desired; page += 1) {
      const startAt = endAt - 180 * 24 * 60 * 60 * 1_000;
      const payload = await this.get('/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice', 'FHKST03010100', {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: symbol,
        FID_INPUT_DATE_1: yyyymmdd(startAt),
        FID_INPUT_DATE_2: yyyymmdd(endAt),
        FID_PERIOD_DIV_CODE: 'D',
        FID_ORG_ADJ_PRC: '0',
      });
      const pageRows = Array.isArray(payload?.output2) ? payload.output2 : [];
      if (!pageRows.length) break;
      let oldest = Number.POSITIVE_INFINITY;
      for (const row of pageRows) {
        const date = String(row?.stck_bsop_date ?? '');
        const timestamp = parseKstDate(date);
        const open = asNumber(row?.stck_oprc);
        const high = asNumber(row?.stck_hgpr);
        const low = asNumber(row?.stck_lwpr);
        const close = asNumber(row?.stck_clpr);
        const volume = asNumber(row?.acml_vol);
        if (!timestamp || open == null || high == null || low == null || close == null || volume == null) continue;
        rows.set(date, { market: `KRX-${symbol}`, timeframeMinutes: 1440, timestamp, open, high, low, close, volume });
        oldest = Math.min(oldest, timestamp);
      }
      if (!Number.isFinite(oldest)) break;
      endAt = oldest - 24 * 60 * 60 * 1_000;
      // Demo REST is rate-limited; avoid burst requests.
      await new Promise((resolve) => setTimeout(resolve, this.environment === 'demo' ? 1_050 : 120));
    }

    return [...rows.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-desired);
  }
}

export const createKisDomesticStockMarketDataFromEnv = () => new KisDomesticStockMarketData({
  appKey: process.env.KIS_APP_KEY ?? '',
  appSecret: process.env.KIS_APP_SECRET ?? '',
  environment: String(process.env.KIS_ENV ?? 'demo').toLowerCase() === 'real' ? 'real' : 'demo',
});
