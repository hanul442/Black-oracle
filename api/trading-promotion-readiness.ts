const json = (response: any, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

const isAuthorizedOperator = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return false;
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) return false;
  return authorization.slice('Bearer '.length) === configured;
};

const PROMOTION_STAGES = [
  'EXPERIMENT_TO_INCUBATOR',
  'INCUBATOR_TO_CHALLENGER',
  'CHALLENGER_TO_CHAMPION_CANDIDATE',
] as const;

type PromotionStage = typeof PROMOTION_STAGES[number];

const promotionStage = (value: unknown): PromotionStage | null => {
  const normalized = String(value ?? 'INCUBATOR_TO_CHALLENGER').toUpperCase();
  return (PROMOTION_STAGES as readonly string[]).includes(normalized) ? normalized as PromotionStage : null;
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
      error: 'Unauthorized promotion-readiness invocation.',
      promotionAuthority: false,
      executionAuthority: false,
    });
  }

  const stage = promotionStage(request.query?.stage);
  if (!stage) {
    return json(response, 400, {
      success: false,
      available: false,
      error: `Invalid promotion stage. Expected one of: ${PROMOTION_STAGES.join(', ')}.`,
      promotionAuthority: false,
      executionAuthority: false,
    });
  }

  if (String(process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
    return json(response, 503, {
      success: false,
      available: false,
      error: 'Promotion readiness requires Supabase persistence in this deployment.',
      promotionAuthority: false,
      executionAuthority: false,
    });
  }

  try {
    const [
      { tradingCheckpointStore },
      { assembleStrategyPromotionEvidence },
      { buildStrategyInputValidationEvidence },
    ] = await Promise.all([
      import('../server/trading/persistence.js'),
      import('../server/trading/promotionEvidenceAssembler.js'),
      import('../server/trading/inputValidationEvidence.js'),
    ]);

    const checkpoint = await tradingCheckpointStore.load();
    if (!checkpoint) {
      return json(response, 200, {
        success: true,
        available: false,
        stage,
        message: 'No persisted PAPER checkpoint is available for promotion review.',
        promotionAuthority: false,
        executionAuthority: false,
        liveDeploymentAuthority: false,
      });
    }

    // First pass discovers the exact markets represented by persisted outcome evidence.
    // It intentionally remains INSUFFICIENT_DATA because no input provenance is supplied.
    const scopeProbe = assembleStrategyPromotionEvidence(checkpoint, { stage });
    const requiredMarkets = scopeProbe.evidence.requiredMarkets;
    if (!requiredMarkets.length) {
      return json(response, 200, {
        success: true,
        available: true,
        stage,
        sourceCheckpoint: { savedAt: checkpoint.savedAt, reason: checkpoint.reason },
        requiredMarkets: [],
        eligibility: scopeProbe.eligibility,
        message: 'No validated market/outcome scope exists yet; promotion evidence remains insufficient.',
        promotionAuthority: false,
        executionAuthority: false,
        liveDeploymentAuthority: false,
      });
    }

    // Promotion validation is explicitly operator-triggered and bounded. Markets are
    // processed sequentially by the underlying builder; each market uses only the
    // strategy-required 15m/60m/240m validation batch.
    const inputValidation = await buildStrategyInputValidationEvidence(requiredMarkets, {
      evaluationCutoff: Date.now(),
      candlesPerTimeframe: 400,
      maxMarkets: 12,
    });
    const evidence = assembleStrategyPromotionEvidence(checkpoint, {
      stage,
      inputValidation: inputValidation.records,
    });

    return json(response, 200, {
      success: true,
      available: true,
      now: Date.now(),
      stage,
      sourceCheckpoint: { savedAt: checkpoint.savedAt, reason: checkpoint.reason },
      inputValidation: {
        generatedAt: inputValidation.generatedAt,
        markets: inputValidation.markets,
        requiredTimeframes: inputValidation.requiredTimeframes,
        requestedCandlesPerTimeframe: inputValidation.requestedCandlesPerTimeframe,
        disposition: inputValidation.disposition,
        records: inputValidation.records.map((record) => ({
          id: record.id,
          market: record.dataset.market,
          timeframeMinutes: record.dataset.timeframeMinutes,
          datasetId: record.dataset.datasetId,
          checksum: record.dataset.checksum,
          candleCount: record.dataset.candleCount,
          integrity: record.integrity.disposition,
          warmup: record.warmup.disposition,
          disposition: record.disposition,
        })),
      },
      promotionEvidence: evidence.evidence,
      eligibility: evidence.eligibility,
      promotionAuthority: false,
      executionAuthority: false,
      liveDeploymentAuthority: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown promotion-readiness error.';
    console.error('Black Oracle promotion readiness error:', error);
    return json(response, 500, {
      success: false,
      available: false,
      stage,
      error: message,
      promotionAuthority: false,
      executionAuthority: false,
      liveDeploymentAuthority: false,
    });
  }
}
