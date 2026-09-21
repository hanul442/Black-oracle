import legacyMarketChartHandler from './market-chart-kis';
import { loadYahooKrxCandles } from '../server/trading/equity/yahooKrxMarketData';
import { loadLseCandles, lseConfigured } from '../server/market/lseMarketData';

const DAY_UNIT = 1_440;
const MAX_CHART_UNIT = 43_200;

const boundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

const kisConfigured = () => Boolean(
  String(process.env.KIS_APP_KEY ?? '').trim()
  && String(process.env.KIS_APP_SECRET ?? '').trim(),
);

const krxTruth = (payload: any, unit: number, receivedAt: number) => {
  const observedAt = Number.isFinite(payload?.asOf) ? Number(payload.asOf) : null;
  const available = payload?.available === true && Array.isArray(payload?.candles) && payload.candles.length >= 2;
  const quality = available ? (unit >= DAY_UNIT ? 'EOD' : 'LIVE') : 'UNAVAILABLE';
  return {
    provider: 'KOREA_INVESTMENT_SECURITIES',
    source: 'KIS_OFFICIAL',
    quality,
    observedAt,
    receivedAt,
    freshnessAgeMinutes: observedAt == null ? null : Math.max(0, (receivedAt - observedAt) / 60_000),
    delayMinutes: null,
    executionEligible: false,
    researchOnly: true,
    reason: available
      ? 'Official KIS read-only chart data. This display surface does not grant execution suitability or trading authority.'
      : 'Official KIS chart data is unavailable. Missing prices are not inferred or substituted on the KIS path.',
  };
};

const runKisWithTruthContract = async (request: any, response: any, unit: number) => {
  let statusCode = 200;
  const proxy = {
    setHeader: (name: string, value: unknown) => { response.setHeader(name, value); return proxy; },
    status: (code: number) => { statusCode = code; return proxy; },
    json: (payload: any) => {
      const receivedAt = Date.now();
      const marketData = krxTruth(payload, unit, receivedAt);
      return response.status(statusCode).json({
        ...payload,
        marketData,
        warning: payload?.warning ?? (marketData.quality === 'UNAVAILABLE'
          ? 'KRX market data is unavailable. No price or execution suitability is inferred.'
          : 'KRX chart data is read-only research/display data; execution suitability is false on this surface.'),
      });
    },
  };
  return legacyMarketChartHandler(request, proxy);
};

/**
 * Market-data provider router for the public chart surface.
 *
 * - Crypto and search keep the existing official/public handlers.
 * - KRX uses KIS when credentials exist and normalizes provenance/freshness/
 *   suitability into the same truth contract as the fallback path.
 * - Without a brokerage account, KRX falls back to Yahoo delayed data for
 *   research/display only. The response carries explicit provenance and never
 *   claims execution eligibility.
 */
export default async function handler(request: any, response: any) {
  const provider = String(request.query?.provider ?? '').trim().toUpperCase();
  if (request.method === 'GET' && provider === 'LSE') {
    response.setHeader('Cache-Control', 'private, max-age=5');
    const symbol = String(request.query?.symbol ?? '').trim();
    const unit = boundedInt(request.query?.unit, 60, 1, MAX_CHART_UNIT);
    const count = boundedInt(request.query?.count, 120, 12, 5_000);
    const dataset = String(request.query?.dataset ?? '').trim() || undefined;

    if (!symbol) {
      return response.status(400).json({
        success: false,
        available: false,
        provider: 'LONDON_STRATEGIC_EDGE',
        error: 'symbol is required when provider=LSE.',
      });
    }
    if (!lseConfigured()) {
      return response.status(503).json({
        success: false,
        available: false,
        configured: false,
        provider: 'LONDON_STRATEGIC_EDGE',
        error: 'LSE_API_KEY is not configured.',
      });
    }

    try {
      const chart = await loadLseCandles({
        symbol,
        timeframeMinutes: unit,
        count,
        dataset,
        start: String(request.query?.start ?? '').trim() || undefined,
        end: String(request.query?.end ?? '').trim() || undefined,
      });
      const observedAt = chart.candles.at(-1)?.timestamp ?? null;
      return response.status(200).json({
        success: true,
        available: chart.candles.length >= 2,
        market: `LSE:${chart.symbol}`,
        symbol: chart.symbol,
        source: chart.source,
        assetClass: dataset ? dataset.toUpperCase() : 'MULTI_ASSET',
        configured: true,
        unit,
        timeframe: chart.timeframe,
        count: chart.candles.length,
        asOf: observedAt,
        candles: chart.candles,
        marketData: chart.truth,
        warning: 'LSE Vault REST is enabled for internal research/model inputs. It does not grant execution authority and must not be republished as a downstream bulk feed.',
      });
    } catch (error) {
      return response.status(502).json({
        success: false,
        available: false,
        configured: true,
        provider: 'LONDON_STRATEGIC_EDGE',
        error: error instanceof Error ? error.message : 'Unknown LSE market data error.',
      });
    }
  }

  const searchMode = String(request.query?.search ?? '') === '1' || request.query?.q != null;
  const market = String(request.query?.market ?? '').trim().toUpperCase();
  const isKrx = /^KRX-\d{6}$/.test(market);

  if (request.method !== 'GET' || searchMode || !isKrx) {
    return legacyMarketChartHandler(request, response);
  }

  const unit = boundedInt(request.query?.unit, DAY_UNIT, 1, MAX_CHART_UNIT);
  if (kisConfigured()) {
    return runKisWithTruthContract(request, response, unit);
  }

  response.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');
  const count = boundedInt(request.query?.count, 60, 12, 120);
  const symbol = market.slice(4);

  try {
    const chart = await loadYahooKrxCandles(symbol, unit, count);
    const observedAt = chart.candles.at(-1)?.timestamp ?? null;
    return response.status(200).json({
      success: true,
      available: chart.candles.length >= 2,
      market,
      source: 'YAHOO_FINANCE',
      sourceSymbol: chart.yahooSymbol,
      assetClass: 'EQUITY',
      configured: true,
      unit,
      count: chart.candles.length,
      asOf: observedAt,
      candles: chart.candles.map((item) => ({
        timestamp: item.timestamp,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      })),
      marketData: {
        provider: chart.provenance.provider,
        source: chart.provenance.source,
        quality: chart.provenance.quality,
        observedAt: chart.provenance.observedAt,
        receivedAt: chart.provenance.receivedAt,
        freshnessAgeMinutes: chart.provenance.observedAt == null ? null : Math.max(0, (chart.provenance.receivedAt - chart.provenance.observedAt) / 60_000),
        delayMinutes: chart.provenance.delayMinutes,
        executionEligible: false,
        researchOnly: true,
        researchIntradayAllowed: chart.researchIntradayAllowed,
        reason: chart.provenance.reason,
      },
      warning: 'KRX fallback is delayed research/display data. It is not permitted to authorize intraday Paper or live execution.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Yahoo KRX fallback error.';
    return response.status(200).json({
      success: true,
      available: false,
      market,
      assetClass: 'EQUITY',
      configured: true,
      source: 'YAHOO_FINANCE',
      marketData: {
        provider: 'YAHOO_FINANCE',
        source: 'YAHOO_FINANCE',
        quality: 'UNAVAILABLE',
        observedAt: null,
        receivedAt: Date.now(),
        freshnessAgeMinutes: null,
        executionEligible: false,
        researchOnly: true,
        delayMinutes: 20,
        reason: 'Yahoo KRX fallback failed. Missing prices are not inferred.',
      },
      error: message,
    });
  }
}