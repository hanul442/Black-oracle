import { readCanonicalEvents } from '../server/eventLedger';

const boundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const type = typeof request.query?.type === 'string' && request.query.type.trim()
      ? request.query.type.trim().toUpperCase()
      : null;
    const market = typeof request.query?.market === 'string' && request.query.market.trim()
      ? request.query.market.trim().toUpperCase()
      : null;
    const limit = boundedInt(request.query?.limit, 300, 1, 500);
    const events = await readCanonicalEvents({ limit, type, market });

    return response.status(200).json({
      success: true,
      canonical: true,
      appendOnly: true,
      coverage: 'CUTOVER_FORWARD',
      source: 'black_oracle_events',
      count: events.length,
      events,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown canonical event ledger error.';
    console.error('Black Oracle canonical event API failed:', error);
    return response.status(500).json({ success: false, canonical: true, appendOnly: true, error: message, events: [] });
  }
}
