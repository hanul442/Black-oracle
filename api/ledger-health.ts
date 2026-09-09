import { readCanonicalLedgerHealth } from '../server/eventLedgerHealth';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const runtimeId = process.env.TRADING_RUNTIME_ID?.trim() || 'black-oracle-paper';
    const health = await readCanonicalLedgerHealth(runtimeId);
    return response.status(health.status === 'CRITICAL' ? 503 : 200).json({
      success: health.status !== 'CRITICAL',
      canonical: true,
      appendOnly: true,
      health,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown canonical ledger health error.';
    console.error('Canonical ledger health API failed:', error);
    return response.status(503).json({ success: false, canonical: true, error: message });
  }
}
