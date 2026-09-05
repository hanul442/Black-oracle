import { buildEvidenceRefreshReadiness } from '../server/trading/evidenceReadiness.js';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');

  const evidenceRefresh = buildEvidenceRefreshReadiness(process.env as Record<string, string | undefined>);

  return response.status(200).json({
    success: true,
    mode: 'PAPER',
    evidenceRefresh,
    scheduler: {
      expectedOrder: ['EVIDENCE_REFRESH', 'PAPER_CYCLE'],
      protectiveExitAuthority: true,
      deploymentAuthority: false,
    },
    secretValuesExposed: false,
  });
}
