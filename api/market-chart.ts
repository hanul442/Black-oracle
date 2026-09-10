const boundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

const SUPPORTED_UNITS = new Set([1, 3, 5, 10, 15, 30, 60, 240]);

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, available: false, error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'public, max-age=20, stale-while-revalidate=40');
  const market = String(request.query?.market ?? '').trim().toUpperCase();
  const unit = boundedInt(request.query?.unit, 60, 1, 240);
  const count = boundedInt(request.query?.count, 48, 12, 120);

  if (!/^KRW-[A-Z0-9]+$/.test(market)) {
    return response.status(200).json({ success: true, available: false, market, error: 'Public chart is currently available for KRW crypto markets only.' });
  }
  if (!SUPPORTED_UNITS.has(unit)) {
    return response.status(400).json({ success: false, available: false, market, error: 'Unsupported candle unit.' });
  }

  try {
    const url = new URL(`https://api.upbit.com/v1/candles/minutes/${unit}`);
    url.searchParams.set('market', market);
    url.searchParams.set('count', String(count));
    const result = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'BlackOracle/1.0' },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!result.ok) {
      return response.status(200).json({ success: true, available: false, market, error: `Market data upstream returned ${result.status}.` });
    }
    const raw = await result.json() as any[];
    const candles = raw.slice().reverse().map((item) => ({
      timestamp: item?.timestamp ? Date.parse(String(item.timestamp)) : Date.parse(String(item?.candle_date_time_utc ?? '')),
      open: Number(item?.opening_price ?? 0),
      high: Number(item?.high_price ?? 0),
      low: Number(item?.low_price ?? 0),
      close: Number(item?.trade_price ?? 0),
      volume: Number(item?.candle_acc_trade_volume ?? 0),
    })).filter((item) => Number.isFinite(item.timestamp) && item.timestamp > 0 && Number.isFinite(item.close) && item.close > 0);

    return response.status(200).json({
      success: true,
      available: candles.length >= 2,
      source: 'UPBIT_PUBLIC',
      market,
      unit,
      count: candles.length,
      candles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown public market data error.';
    return response.status(200).json({ success: true, available: false, market, error: message });
  }
}
