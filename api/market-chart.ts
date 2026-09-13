import legacyMarketChartHandler from './market-chart-kis';
import { loadYahooKrxCandles } from '../server/trading/equity/yahooKrxMarketData';

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

/**
 * Market-data provider router for the public chart surface.
 *
 * - Crypto and search keep the existing official/public handlers.
 * - KRX uses KIS when credentials exist.
 * - Without a brokerage account, KRX falls back to Yahoo delayed data for
 *   research/display only. The response carries explicit provenance and never
 *   claims execution eligibility.
 */
export default async function handler(request: any, response: any) {
  const searchMode = String(request.query?.search ?? '') === '1' || request.query?.q != null;
  const market = String(request.query?.market ?? '').trim().toUpperCase();
  const isKrx = /^KRX-\d{6}$/.test(market);

  if (request.method !== 'GET' || searchMode || !isKrx || kisConfigured()) {
    return legacyMarketChartHandler(request, response);
  }

  response.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');
  const unit = boundedInt(request.query?.unit, DAY_UNIT, 1, MAX_CHART_UNIT);
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
        quality: 'DELAYED',
        executionEligible: false,
        researchOnly: true,
        delayMinutes: 20,
      },
      error: message,
    });
  }
}
