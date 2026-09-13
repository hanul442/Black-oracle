import { readKisPaperReadiness } from '../server/trading/kisReadiness';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  const kis = readKisPaperReadiness(process.env);
  const blockers = [
    ...kis.reasons,
    'Source-backed KRX crypto-exposure classifications are not yet persisted in Production.',
    'Persistent multi-day intraday history is not yet available for robust KRX 1H/4H structure.',
  ];

  return response.status(200).json({
    success: true,
    version: 'V10',
    mode: 'SHADOW',
    executionAuthority: false,
    asOf: Date.now(),
    dataPlane: {
      kis: {
        status: kis.status,
        ready: kis.ready,
        marketDataEnvironment: kis.marketDataEnvironment,
        credentials: kis.credentials,
      },
      marketCap: { status: 'CODE_READY', source: 'KIS inquire-price: current price × listed shares' },
      sector: { status: 'CODE_READY', source: 'KIS bstp_kor_isnm' },
      participantFlow: { status: 'CODE_READY', source: 'KIS foreign/program net flow + price/volume behavior' },
      cryptoExposure: { status: 'DATA_REQUIRED', source: 'source-backed EquityExposureRegistry' },
      timeframeHistory: {
        minuteSession: 'CODE_READY',
        dailyWeeklyMonthly: 'CODE_READY',
        multiDay1h4h: 'DATA_REQUIRED',
      },
    },
    blockers,
  });
}
