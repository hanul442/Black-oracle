export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    if (String(process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
      return response.status(503).json({ success: false, available: false, error: 'Trading grade requires Supabase persistence in this deployment.' });
    }

    const [
      { tradingCheckpointStore },
      { buildPaperReadinessSnapshotFromCheckpoint },
      { normalizeGradeSurveillance, summarizeGradeSurveillance, appendGradeSnapshot },
    ] = await Promise.all([
      import('../server/trading/persistence.js'),
      import('../server/trading/paperReadinessSnapshot.js'),
      import('../src/trading/gradeSurveillance.js'),
    ]);

    const checkpoint = await tradingCheckpointStore.load();
    if (!checkpoint) return response.status(200).json({ success: true, available: false, now: Date.now() });

    const now = Date.now();
    const current = buildPaperReadinessSnapshotFromCheckpoint(checkpoint, now);
    const persisted = normalizeGradeSurveillance(checkpoint.gradeSurveillance);
    const withCurrent = appendGradeSnapshot(persisted, current.snapshot);
    const surveillance = summarizeGradeSurveillance(withCurrent);

    return response.status(200).json({
      success: true,
      available: true,
      now,
      current: current.snapshot,
      input: current.input,
      surveillance: {
        ...surveillance,
        historyCount: withCurrent.history.length,
        recentHistory: withCurrent.history.slice(-96),
      },
      executionAuthority: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown trading grade error.';
    console.error('Black Oracle trading grade error:', error);
    return response.status(500).json({ success: false, available: false, error: message });
  }
}
