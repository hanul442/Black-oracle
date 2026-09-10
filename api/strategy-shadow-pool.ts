import {
  readStrategyShadowPool,
  S2_STRATEGY_RESEARCH_RUNTIME_ID,
} from '../server/trading/strategyShadowPool';

const json = (response: any, status: number, body: Record<string, unknown>) => response.status(status).json(body);

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  const market = String(request.query?.market ?? '').trim().toUpperCase();
  if (!/^(KRW-[A-Z0-9]+|KRX-\d{6})$/.test(market)) {
    return json(response, 400, { success: false, error: 'market must be KRW-* or KRX-######.' });
  }
  const limit = Math.max(1, Math.min(20, Math.trunc(Number(request.query?.limit ?? 8)) || 8));

  try {
    const pool = await readStrategyShadowPool(market, limit);
    return json(response, 200, {
      success: true,
      researchOnly: true,
      runtimeId: S2_STRATEGY_RESEARCH_RUNTIME_ID,
      ...pool,
    });
  } catch (error) {
    return json(response, 500, {
      success: false,
      researchOnly: true,
      runtimeId: S2_STRATEGY_RESEARCH_RUNTIME_ID,
      executionAuthority: false,
      promotionAuthority: false,
      error: error instanceof Error ? error.message : 'Unknown Strategy shadow-pool error.',
    });
  }
}
