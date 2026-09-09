import { dailyDeterministicStrategySeed, runAiStrategyHypothesisResearch } from '../server/trading/strategyHypothesisResearcher';
import { appendCanonicalEvents, buildStrategyFactoryCanonicalEvents } from '../server/eventLedger';

const json = (response: any, status: number, body: Record<string, unknown>) => response.status(status).json(body);

const authorized = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return false;
  const presented = authorization.slice('Bearer '.length).trim();
  const accepted = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return Boolean(presented) && accepted.includes(presented);
};

const integer = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
};

const decimal = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }
  if (!authorized(request.headers.authorization)) {
    return json(response, 401, { success: false, error: 'Unauthorized Strategy Factory scheduler invocation.' });
  }
  if ((process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
    return json(response, 503, { success: false, error: 'Autonomous Strategy Factory requires Supabase persistence.' });
  }

  try {
    const runtime: any = await import('../server/trading/runtime-bundle.mjs');
    if (typeof runtime.runCryptoStrategyFactory !== 'function') {
      throw new Error('Runtime bundle does not export runCryptoStrategyFactory.');
    }
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const market = String(body.market ?? 'KRW-BTC').trim().toUpperCase();
    const unit = integer(body.unit, 60, 15, 240);
    const normalizedUnit = [15, 60, 240].includes(unit) ? unit : 60;

    const explicitSeed = body.seed == null
      ? null
      : integer(body.seed, 4_420_623, 1, 2_147_483_647);
    let aiResearch: Awaited<ReturnType<typeof runAiStrategyHypothesisResearch>> | null = null;
    if (explicitSeed == null && body.aiResearch !== false) {
      try {
        aiResearch = await runAiStrategyHypothesisResearch(market);
      } catch (error) {
        console.warn('Strategy AI researcher failed; deterministic daily seed will be used:', error);
      }
    }
    const seed = explicitSeed
      ?? aiResearch?.guidedSeed
      ?? dailyDeterministicStrategySeed(market);
    const guidedSeeds = aiResearch && !aiResearch.skipped
      ? aiResearch.hypotheses.map((hypothesis) => ({
          indicators: hypothesis.indicators,
          reversionIndicators: hypothesis.interpretations
            .filter((row) => row.mode === 'REVERSION')
            .map((row) => row.indicator),
        }))
      : [];
    const seedSource = explicitSeed != null ? 'EXPLICIT' : aiResearch && !aiResearch.skipped ? 'AI_GUIDED' : 'DAILY_DETERMINISTIC';

    // Scheduler defaults are deliberately bounded. AI hypotheses occupy a bounded part of generation 1;
    // the rest remains seeded systematic/random exploration. Research cannot touch execution authority.
    const run = await runtime.runCryptoStrategyFactory({
      market,
      unit: normalizedUnit,
      bars: integer(body.bars, 900, 700, 2_000),
      candidatesPerGeneration: integer(body.candidatesPerGeneration ?? body.candidates, 16, 8, 128),
      generations: integer(body.generations, 2, 1, 4),
      parentPoolSize: integer(body.parentPoolSize, 8, 4, 32),
      blindFraction: decimal(body.blindFraction, 0.20, 0.20, 0.35),
      walkForwardFolds: integer(body.walkForwardFolds, 4, 2, 6),
      seed,
      topN: integer(body.topN, 20, 1, 30),
      guidedSeeds,
    });

    let eventLedger: Record<string, unknown> = { persisted: false, attempted: 0 };
    try {
      eventLedger = await appendCanonicalEvents(buildStrategyFactoryCanonicalEvents(run, {
        market,
        unit: normalizedUnit,
        seed,
        seedSource,
        aiResearch,
      }));
    } catch (ledgerError) {
      console.error('Strategy Factory canonical event append failed:', ledgerError);
      eventLedger = {
        persisted: false,
        attempted: 0,
        error: ledgerError instanceof Error ? ledgerError.message : 'Unknown canonical event ledger error.',
      };
    }

    return json(response, 200, {
      success: true,
      researchOnly: true,
      aiResearch,
      seedSource,
      guidedFactorSetsInjected: guidedSeeds.length,
      automaticChampionPromotion: false,
      automaticLiveDeployment: false,
      eventLedger,
      run,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown autonomous Strategy Factory error.';
    console.error('Autonomous Strategy Factory cycle failed:', error);
    return json(response, 500, { success: false, researchOnly: true, error: message });
  }
}
