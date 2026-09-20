import { evaluateAndPersistForecastShadow } from '../server/research/forecastEvaluationService';
import type { PriceObservation } from '../server/research/forecastEvaluation';

const isAuthorizedInternalCall = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return false;
  const presented = authorization.slice('Bearer '.length).trim();
  const accepted = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return Boolean(presented && accepted.includes(presented));
};

const normalizeObservations = (raw: unknown): PriceObservation[] => {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 5000).flatMap((item: any) => {
    const timestamp = Number(item?.timestamp);
    const high = Number(item?.high);
    const low = Number(item?.low);
    const close = Number(item?.close);
    const open = Number(item?.open);
    if (![timestamp, high, low, close].every(Number.isFinite)) return [];
    return [{
      timestamp,
      high,
      low,
      close,
      open: Number.isFinite(open) ? open : undefined,
    }];
  });
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  if (!isAuthorizedInternalCall(request.headers.authorization)) {
    return response.status(401).json({ success: false, error: 'Unauthorized internal invocation.' });
  }

  const forecastId = String(request.body?.forecastId ?? '').trim();
  const observations = normalizeObservations(request.body?.observations);
  if (!forecastId || !observations.length) {
    return response.status(400).json({ success: false, error: 'forecastId and price observations are required.' });
  }

  try {
    const evaluation = await evaluateAndPersistForecastShadow({
      forecastId,
      observations,
      evaluatedAt: Number.isFinite(Number(request.body?.evaluatedAt))
        ? Number(request.body.evaluatedAt)
        : Date.now(),
    });
    return response.status(200).json({
      success: true,
      mode: 'FORECAST_EVALUATION_SHADOW',
      executionAuthority: false,
      evaluation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown forecast evaluation failure.';
    return response.status(500).json({ success: false, error: message });
  }
}
