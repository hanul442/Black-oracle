export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');
  return response.status(200).json({
    success: true,
    deprecated: true,
    count: 0,
    mergedCount: 0,
    sourcesAnalyzed: 0,
    replacement: 'trading-evidence-refresh',
    message: 'Legacy Firebase RSS mutation is disabled. Source-backed trading evidence is handled by the v0.3 evidence ingestion pipeline.',
    executionAuthority: false,
  });
}
