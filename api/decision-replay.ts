import { readDecisionReplay } from '../server/decisionReplay';

const textQuery = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');

  const traceId = textQuery(request.query?.traceId, 500);
  if (!traceId) {
    return response.status(400).json({ success: false, error: 'traceId is required.' });
  }

  const runtimeId = textQuery(request.query?.runtimeId, 200)
    ?? process.env.TRADING_RUNTIME_ID?.trim()
    ?? 'black-oracle-paper';

  try {
    const replay = await readDecisionReplay(traceId, runtimeId);
    return response.status(200).json({
      success: true,
      canonical: true,
      replayVersion: 1,
      ...replay,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Decision Replay error.';
    console.error('Black Oracle Decision Replay failed:', error);
    return response.status(500).json({ success: false, replayVersion: 1, error: message, timeline: [] });
  }
}
