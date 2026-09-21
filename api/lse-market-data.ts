import {
  loadLseCandles,
  loadLseMeta,
  loadLseSeries,
  loadLseUsage,
  lseConfigured,
} from '../server/market/lseMarketData';

const boundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

const internalPolicy = {
  provider: 'LONDON_STRATEGIC_EDGE',
  purpose: 'INTERNAL_RESEARCH_AND_MODEL_INPUTS',
  executionEligible: false,
  redistributionAllowed: false,
  note: 'Do not expose LSE as a bulk or competing downstream data feed. Validate provider terms before any customer-facing redistribution.',
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'private, max-age=5');
  const kind = String(request.query?.kind ?? 'status').trim().toLowerCase();

  if (kind === 'status') {
    return response.status(200).json({
      success: true,
      configured: lseConfigured(),
      provider: 'LONDON_STRATEGIC_EDGE',
      capabilities: ['candles', 'series', 'meta', 'usage'],
      policy: internalPolicy,
    });
  }

  if (!lseConfigured()) {
    return response.status(503).json({
      success: false,
      configured: false,
      provider: 'LONDON_STRATEGIC_EDGE',
      error: 'LSE_API_KEY is not configured.',
      policy: internalPolicy,
    });
  }

  try {
    if (kind === 'candles') {
      const symbol = String(request.query?.symbol ?? '').trim();
      const unit = boundedInt(request.query?.unit, 60, 1, 43_200);
      const count = boundedInt(request.query?.count, 120, 2, 5_000);
      const data = await loadLseCandles({
        symbol,
        timeframeMinutes: unit,
        count,
        dataset: String(request.query?.dataset ?? '').trim() || undefined,
        start: String(request.query?.start ?? '').trim() || undefined,
        end: String(request.query?.end ?? '').trim() || undefined,
      });
      return response.status(200).json({ success: true, ...data, policy: internalPolicy });
    }

    if (kind === 'series') {
      const symbol = String(request.query?.symbol ?? '').trim();
      const rows = await loadLseSeries({
        symbol,
        dataset: String(request.query?.dataset ?? '').trim() || undefined,
        start: String(request.query?.start ?? '').trim() || undefined,
        end: String(request.query?.end ?? '').trim() || undefined,
        order: String(request.query?.order ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc',
        limit: boundedInt(request.query?.limit, 500, 1, 5_000),
      });
      return response.status(200).json({ success: true, provider: 'LONDON_STRATEGIC_EDGE', symbol, rows, policy: internalPolicy });
    }

    if (kind === 'meta') {
      const data = await loadLseMeta();
      return response.status(200).json({ success: true, provider: 'LONDON_STRATEGIC_EDGE', data, policy: internalPolicy });
    }

    if (kind === 'usage') {
      const data = await loadLseUsage();
      return response.status(200).json({ success: true, provider: 'LONDON_STRATEGIC_EDGE', data, policy: internalPolicy });
    }

    return response.status(400).json({ success: false, error: 'kind must be status, candles, series, meta, or usage.' });
  } catch (error) {
    return response.status(502).json({
      success: false,
      configured: true,
      provider: 'LONDON_STRATEGIC_EDGE',
      error: error instanceof Error ? error.message : 'Unknown LSE market-data error.',
      policy: internalPolicy,
    });
  }
}
