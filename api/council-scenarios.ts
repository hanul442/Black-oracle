import { verifyFirebaseUser } from '../server/auth/firebaseUser.js';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.4-mini';

const json = (response: any, status: number, body: Record<string, unknown>) => response.status(status).json(body);
const clampText = (value: unknown, max = 4_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const resolveOpenAIKey = () => process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_API?.trim() || '';

const isAuthorizedInternalCall = (authorization: unknown) => {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return false;
  const presented = authorization.slice('Bearer '.length).trim();
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && presented === secret);
};

const compactEvidence = (items: unknown) => Array.isArray(items) ? items.slice(0, 50).map((item: any) => ({
  id: clampText(item?.id, 160),
  market: clampText(item?.market, 120),
  title: clampText(item?.title, 500),
  summary: clampText(item?.summary, 1_200),
  direction: clampText(item?.direction, 40),
  evidenceType: clampText(item?.evidenceType, 80),
  reliability: Number.isFinite(Number(item?.reliability)) ? Number(item.reliability) : null,
  strength: Number.isFinite(Number(item?.strength)) ? Number(item.strength) : null,
  publisher: clampText(item?.publisher || item?.source, 200),
  observedAt: Number.isFinite(Number(item?.observedAt)) ? Number(item.observedAt) : null,
  expiresAt: Number.isFinite(Number(item?.expiresAt)) ? Number(item.expiresAt) : null,
})) : [];

const compactItems = (items: unknown, maxItems: number) => Array.isArray(items) ? items.slice(0, maxItems).map((item: any) => ({
  id: clampText(item?.id, 160),
  title: clampText(item?.title, 500),
  summary: clampText(item?.summary, 1_200),
  category: clampText(item?.category, 160),
  confidence: Number.isFinite(Number(item?.confidence)) ? Number(item.confidence) : null,
  signalStrength: Number.isFinite(Number(item?.signalStrength)) ? Number(item.signalStrength) : null,
})) : [];

const compactScenarios = (items: unknown) => Array.isArray(items) ? items.slice(0, 6).map((item: any) => ({
  id: clampText(item?.id, 160),
  hypothesisId: clampText(item?.hypothesisId, 160),
  title: clampText(item?.title, 500),
  probability: Number.isFinite(Number(item?.probability)) ? Number(item.probability) : null,
  impactScore: Number.isFinite(Number(item?.impactScore)) ? Number(item.impactScore) : null,
  expectedOutcome: clampText(item?.expectedOutcome, 1_500),
  triggerCondition: clampText(item?.triggerCondition, 1_200),
  invalidationCondition: clampText(item?.invalidationCondition, 1_200),
  nextIndicators: Array.isArray(item?.nextIndicators) ? item.nextIndicators.map((value: unknown) => clampText(value, 300)).filter(Boolean).slice(0, 8) : [],
})).filter((item) => item.id && item.title) : [];

const extractOutputText = (payload: any) => {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  for (const item of payload?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('OpenAI response did not contain output text.');
};

const callStructured = async (
  apiKey: string,
  model: string,
  instructions: string,
  input: unknown,
  schemaName: string,
  schema: Record<string, unknown>,
  maxOutputTokens: number,
) => {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: 'low' },
      instructions,
      input: JSON.stringify(input),
      max_output_tokens: maxOutputTokens,
      text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } },
    }),
    signal: AbortSignal.timeout(50_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error?.message === 'string' ? payload.error.message : `OpenAI HTTP ${response.status}`;
    throw new Error(message);
  }
  return { data: JSON.parse(extractOutputText(payload)), responseId: payload?.id ?? null, usage: payload?.usage ?? null };
};

const lensReviewSchema = {
  type: 'object', additionalProperties: false,
  required: ['lensId', 'reviews'],
  properties: {
    lensId: { type: 'string' },
    reviews: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['scenarioId', 'stance', 'probabilityEstimate', 'confidence', 'confidenceEffect', 'feedback', 'watchItems', 'invalidationSignals', 'evidenceIds', 'counterEvidenceIds', 'keyRisks'],
        properties: {
          scenarioId: { type: 'string' },
          stance: { type: 'string', enum: ['SUPPORT', 'CHALLENGE', 'MIXED', 'INSUFFICIENT'] },
          probabilityEstimate: { type: 'number', minimum: 0, maximum: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          confidenceEffect: { type: 'string', enum: ['RAISE', 'LOWER', 'UNCHANGED'] },
          feedback: { type: 'string' },
          watchItems: { type: 'array', items: { type: 'string' } },
          invalidationSignals: { type: 'array', items: { type: 'string' } },
          evidenceIds: { type: 'array', items: { type: 'string' } },
          counterEvidenceIds: { type: 'array', items: { type: 'string' } },
          keyRisks: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const comparisonSchema = {
  type: 'object', additionalProperties: false,
  required: ['rankings', 'crossScenarioObservations', 'recommendedFocusScenarioId', 'reason'],
  properties: {
    rankings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['scenarioId', 'rank', 'consensusScore', 'probabilityEstimate', 'confidence', 'disposition', 'dominantSupport', 'dominantChallenge', 'unresolvedUncertainty', 'preservedDissent'],
        properties: {
          scenarioId: { type: 'string' },
          rank: { type: 'integer', minimum: 1, maximum: 6 },
          consensusScore: { type: 'number', minimum: 0, maximum: 1 },
          probabilityEstimate: { type: 'number', minimum: 0, maximum: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          disposition: { type: 'string', enum: ['ADVANCE', 'MONITOR', 'CHALLENGE', 'INSUFFICIENT'] },
          dominantSupport: { type: 'string' },
          dominantChallenge: { type: 'string' },
          unresolvedUncertainty: { type: 'array', items: { type: 'string' } },
          preservedDissent: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    crossScenarioObservations: { type: 'array', items: { type: 'string' } },
    recommendedFocusScenarioId: { type: 'string' },
    reason: { type: 'string' },
  },
};

const lenses = [
  { id: 'momentum_trend', role: 'Momentum / Trend', focus: '4H directional structure, 1H regime, 15m timing, momentum persistence and regime consistency.' },
  { id: 'mean_reversion', role: 'Mean Reversion', focus: 'Overextension, range behavior, Bollinger position, RSI/Stoch RSI extremes and snapback risk.' },
  { id: 'event_news', role: 'Event / News', focus: 'Source-backed catalysts, contradictions, reliability, time decay and narrative-to-price transmission.' },
  { id: 'macro_cross_asset', role: 'Macro / Cross-asset', focus: 'Rates, liquidity, FX, policy, risk appetite and cross-asset confirmation.' },
  { id: 'liquidity_execution', role: 'Liquidity / Execution', focus: 'Spread, depth, turnover, slippage, freshness and whether the scenario is executable in the stated market.' },
  { id: 'risk', role: 'Risk', focus: 'Tail risk, invalidation, drawdown, hidden correlation, concentration and missing evidence.' },
];

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }

  const internal = isAuthorizedInternalCall(request.headers.authorization);
  const verifiedUser = internal ? null : await verifyFirebaseUser(request.headers.authorization).catch(() => null);
  if (!internal && !verifiedUser) return json(response, 401, { success: false, error: 'Firebase authentication required.' });

  const apiKey = resolveOpenAIKey();
  if (!apiKey) return json(response, 503, { success: false, error: 'OpenAI API key is not configured.' });

  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const scenarios = compactScenarios(body.scenarios);
  if (scenarios.length < 2) return json(response, 400, { success: false, error: 'At least two scenarios are required for Council comparison.' });

  const context = {
    question: clampText(body.question, 1_500),
    market: clampText(body.market, 120),
    timeframe: clampText(body.timeframe, 80),
    signals: compactItems(body.signals, 30),
    hypotheses: compactItems(body.hypotheses, 12),
    evidence: compactEvidence(body.evidence),
    scenarios,
  };
  if (JSON.stringify(context).length > 90_000) return json(response, 413, { success: false, error: 'Council context is too large.' });

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const startedAt = Date.now();
  try {
    const independent = await Promise.all(lenses.map(async (lens) => {
      const result = await callStructured(
        apiKey,
        model,
        [
          `You are the ${lens.role} lens inside Black Oracle.`,
          `Focus: ${lens.focus}`,
          'Review EVERY supplied scenario independently through your lens.',
          'Use only supplied facts and evidence IDs. Never invent prices, sources, evidence or events.',
          'A scenario may be supported, challenged, mixed, or insufficient. Preserve uncertainty.',
          'probabilityEstimate is your scenario plausibility estimate; confidence is confidence in that estimate.',
          'confidenceEffect says whether your lens should raise or lower confidence in the scenario relative to the supplied case.',
          'Watch items and invalidation signals must be observable conditions, not vague advice.',
          'You are advisory only. Do not issue orders or mutate strategy/risk weights.',
        ].join('\n'),
        { lensId: lens.id, context },
        `black_oracle_multi_scenario_${lens.id}`,
        lensReviewSchema,
        2_400,
      );
      return { ...result.data, lensId: lens.id, responseId: result.responseId, usage: result.usage };
    }));

    const comparison = await callStructured(
      apiKey,
      model,
      [
        'You are Black Oracle Meta-Adjudicator comparing multiple scenarios after independent specialist review.',
        'Rank the scenarios by evidence-supported plausibility and robustness, not by narrative attractiveness.',
        'Preserve material dissent. Do not average away contradictions or missing data.',
        'A high probability with low confidence must remain visibly low-confidence.',
        'Use INSUFFICIENT when evidence cannot support a meaningful comparison.',
        'The ranking is research guidance only and has no execution authority.',
      ].join('\n'),
      {
        context,
        lensReviews: independent.map(({ responseId, usage, ...item }) => item),
      },
      'black_oracle_multi_scenario_comparison',
      comparisonSchema,
      3_600,
    );

    return json(response, 200, {
      success: true,
      mode: 'ADVISORY_ONLY',
      executionAuthority: false,
      requesterUid: verifiedUser?.uid ?? null,
      model,
      startedAt,
      finishedAt: Date.now(),
      scenarioIds: scenarios.map((scenario) => scenario.id),
      lenses: independent,
      comparison: comparison.data,
      comparisonResponseId: comparison.responseId,
      usage: { lenses: independent.map((item) => item.usage), comparison: comparison.usage },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Council error.';
    console.error('Black Oracle multi-scenario Council failed:', message.slice(0, 500));
    return json(response, 502, { success: false, error: message.slice(0, 500) });
  }
}
