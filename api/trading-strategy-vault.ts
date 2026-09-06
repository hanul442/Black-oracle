const json = (response: any, status: number, body: Record<string, unknown>) => response.status(status).json(body);

const isAuthorizedOperator = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return false;
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) return false;
  return authorization.slice('Bearer '.length) === configured;
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  if (!isAuthorizedOperator(request.headers.authorization)) {
    return json(response, 401, {
      success: false,
      available: false,
      error: 'Unauthorized Strategy Vault inspection.',
      executionAuthority: false,
      promotionAuthority: false,
      capitalAuthority: false,
    });
  }

  if (String(process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
    return json(response, 503, {
      success: false,
      available: false,
      error: 'Strategy Vault inspection requires Supabase persistence in this deployment.',
      executionAuthority: false,
      promotionAuthority: false,
      capitalAuthority: false,
    });
  }

  try {
    const [{ tradingCheckpointStore }, { StrategyVault }] = await Promise.all([
      import('../server/trading/persistence.js'),
      import('../src/trading/strategyVault.js'),
    ]);
    const checkpoint = await tradingCheckpointStore.load();
    if (!checkpoint) {
      return json(response, 200, {
        success: true,
        available: false,
        message: 'No persisted PAPER checkpoint is available.',
        executionAuthority: false,
        promotionAuthority: false,
        capitalAuthority: false,
      });
    }

    const vault = checkpoint.strategyVault ? StrategyVault.restore(checkpoint.strategyVault) : new StrategyVault();
    const snapshot = vault.checkpoint();
    const states = {
      research: snapshot.entries.filter((entry) => entry.state === 'RESEARCH').length,
      incubators: snapshot.entries.filter((entry) => entry.state === 'INCUBATOR').length,
      challengers: snapshot.entries.filter((entry) => entry.state === 'CHALLENGER').length,
      championCandidates: snapshot.entries.filter((entry) => entry.state === 'CHAMPION_CANDIDATE').length,
      retired: snapshot.entries.filter((entry) => entry.state === 'RETIRED').length,
    };
    const reviews = {
      pending: snapshot.reviews.filter((review) => review.decision === 'PENDING').length,
      approved: snapshot.reviews.filter((review) => review.decision === 'APPROVED').length,
      rejected: snapshot.reviews.filter((review) => review.decision === 'REJECTED').length,
    };

    return json(response, 200, {
      success: true,
      available: true,
      now: Date.now(),
      sourceCheckpoint: { savedAt: checkpoint.savedAt, reason: checkpoint.reason },
      summary: { entries: snapshot.entries.length, states, reviews: { total: snapshot.reviews.length, ...reviews } },
      entries: snapshot.entries,
      reviews: snapshot.reviews,
      mutationEndpointAvailable: false,
      automaticPromotion: false,
      automaticDemotion: false,
      executionAuthority: false,
      promotionAuthority: false,
      capitalAuthority: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Strategy Vault inspection error.';
    console.error('Black Oracle Strategy Vault inspection error:', error);
    return json(response, 500, {
      success: false,
      available: false,
      error: message,
      executionAuthority: false,
      promotionAuthority: false,
      capitalAuthority: false,
    });
  }
}
