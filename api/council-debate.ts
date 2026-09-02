const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.4-mini';

const json = (response: any, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

const isAuthorizedInternalCall = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return false;
  const presented = authorization.slice('Bearer '.length).trim();
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && presented === secret);
};

const clampText = (value: unknown, max = 4_000) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const compactItems = (items: unknown, maxItems: number) => {
  if (!Array.isArray(items)) return [];
  return items.slice(0, maxItems).map((item: any) => ({
    id: clampText(item?.id, 160),
    title: clampText(item?.title, 500),
    summary: clampText(item?.summary, 1_200),
    category: clampText(item?.category, 160),
    evidenceType: clampText(item?.evidenceType, 80),
    reliability: Number.isFinite(Number(item?.reliability)) ? Number(item.reliability) : null,
    confidence: Number.isFinite(Number(item?.confidence)) ? Number(item.confidence) : null,
    probability: Number.isFinite(Number(item?.probability)) ? Number(item.probability) : null,
    signalStrength: Number.isFinite(Number(item?.signalStrength)) ? Number(item.signalStrength) : null,
    impactScore: Number.isFinite(Number(item?.impactScore)) ? Number(item.impactScore) : null,
  }));
};

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
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: 'low' },
      instructions,
      input: JSON.stringify(input),
      max_output_tokens: maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) {
    const code = typeof payload?.error?.code === 'string' ? payload.error.code : `http_${response.status}`;
    const message = typeof payload?.error?.message === 'string' ? payload.error.message : 'OpenAI request failed.';
    throw new Error(`${code}: ${message}`);
  }

  return {
    data: JSON.parse(extractOutputText(payload)),
    responseId: typeof payload?.id === 'string' ? payload.id : null,
    usage: payload?.usage ?? null,
  };
};

const lensSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['lensId', 'probability', 'confidence', 'stance', 'actionImplication', 'claim', 'evidenceIds', 'counterEvidenceIds', 'keyRisks', 'invalidation', 'counterfactual'],
  properties: {
    lensId: { type: 'string' },
    probability: { type: 'number', minimum: 0, maximum: 1 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    stance: { type: 'string', enum: ['BULLISH', 'BEARISH', 'NEUTRAL', 'UNCERTAIN'] },
    actionImplication: { type: 'string', enum: ['ENTER', 'HOLD', 'EXIT', 'NO_TRADE'] },
    claim: { type: 'string' },
    evidenceIds: { type: 'array', items: { type: 'string' } },
    counterEvidenceIds: { type: 'array', items: { type: 'string' } },
    keyRisks: { type: 'array', items: { type: 'string' } },
    invalidation: { type: 'string' },
    counterfactual: { type: 'string' },
  },
};

const debateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['crossExamination', 'rebuttals', 'finalPositions', 'dissent', 'adjudication', 'weightObservations'],
  properties: {
    crossExamination: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['challenger', 'target', 'question', 'issue', 'evidenceIds'],
        properties: {
          challenger: { type: 'string' }, target: { type: 'string' }, question: { type: 'string' },
          issue: { type: 'string' }, evidenceIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    rebuttals: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['lensId', 'response', 'probabilityAfter', 'confidenceAfter', 'changed'],
        properties: {
          lensId: { type: 'string' }, response: { type: 'string' },
          probabilityAfter: { type: 'number', minimum: 0, maximum: 1 },
          confidenceAfter: { type: 'number', minimum: 0, maximum: 1 }, changed: { type: 'boolean' },
        },
      },
    },
    finalPositions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['lensId', 'probability', 'confidence', 'vote', 'reason'],
        properties: {
          lensId: { type: 'string' }, probability: { type: 'number', minimum: 0, maximum: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          vote: { type: 'string', enum: ['ENTER', 'HOLD', 'EXIT', 'NO_TRADE'] }, reason: { type: 'string' },
        },
      },
    },
    dissent: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['lensId', 'argument', 'evidenceIds', 'materiality'],
        properties: {
          lensId: { type: 'string' }, argument: { type: 'string' }, evidenceIds: { type: 'array', items: { type: 'string' } },
          materiality: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
        },
      },
    },
    adjudication: {
      type: 'object', additionalProperties: false,
      required: ['probability', 'confidence', 'decision', 'dominantArgument', 'unresolvedUncertainty', 'triggers', 'invalidation', 'preservedDissent'],
      properties: {
        probability: { type: 'number', minimum: 0, maximum: 1 }, confidence: { type: 'number', minimum: 0, maximum: 1 },
        decision: { type: 'string', enum: ['ENTER', 'HOLD', 'EXIT', 'NO_TRADE'] }, dominantArgument: { type: 'string' },
        unresolvedUncertainty: { type: 'array', items: { type: 'string' } }, triggers: { type: 'array', items: { type: 'string' } },
        invalidation: { type: 'string' }, preservedDissent: { type: 'array', items: { type: 'string' } },
      },
    },
    weightObservations: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['lensId', 'observation', 'suggestedDirection', 'reason'],
        properties: {
          lensId: { type: 'string' }, observation: { type: 'string' },
          suggestedDirection: { type: 'string', enum: ['UP', 'DOWN', 'UNCHANGED'] }, reason: { type: 'string' },
        },
      },
    },
  },
};

const lenses = [
  { id: 'momentum_trend', role: 'Momentum / Trend', focus: '4H directional structure, 1H regime, 15m timing, EMA stack, MACD, RSI, momentum persistence.' },
  { id: 'mean_reversion', role: 'Mean Reversion', focus: 'Range behavior, overextension, Bollinger position, RSI/Stoch RSI extremes and reversion risk.' },
  { id: 'event_news', role: 'Event / News', focus: 'Event evidence, catalysts, contradictions, source reliability, time decay and narrative-to-price transmission.' },
  { id: 'macro_cross_asset', role: 'Macro / Cross-asset', focus: 'Rates, liquidity, FX, risk appetite, policy and cross-asset confirmation.' },
  { id: 'liquidity_execution', role: 'Liquidity / Execution', focus: 'Spread, depth, turnover, slippage, data freshness, execution feasibility and microstructure.' },
  { id: 'risk', role: 'Risk', focus: 'Tail risk, invalidation, drawdown, asymmetry, hidden correlation and reasons to NO_TRADE.' },
];

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }
  if (!isAuthorizedInternalCall(request.headers.authorization)) {
    return json(response, 401, { success: false, error: 'Unauthorized internal invocation.' });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return json(response, 503, { success: false, error: 'OPENAI_API_KEY is not configured.' });

  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const context = {
    question: clampText(body.question, 1_500), market: clampText(body.market, 120), timeframe: clampText(body.timeframe, 80),
    signals: compactItems(body.signals, 30), hypotheses: compactItems(body.hypotheses, 12),
    evidence: compactItems(body.evidence, 50), scenarios: compactItems(body.scenarios, 12),
  };
  if (!context.question && context.hypotheses.length === 0) {
    return json(response, 400, { success: false, error: 'A question or at least one hypothesis is required.' });
  }
  if (JSON.stringify(context).length > 90_000) {
    return json(response, 413, { success: false, error: 'Council context is too large.' });
  }

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const startedAt = Date.now();

  try {
    const independent = await Promise.all(lenses.map(async (lens) => {
      const result = await callStructured(
        apiKey,
        model,
        [
          `You are the ${lens.role} analytical lens inside Black Oracle.`,
          `Focus: ${lens.focus}`,
          'Round 0 is independent. You cannot see other lenses.',
          'Use only supplied data. Never invent facts, prices, sources or evidence IDs.',
          'Separate probability from confidence. Preserve uncertainty. NO_TRADE is valid when evidence is insufficient.',
          'Any action implication is advisory only. You have no order authority.',
        ].join('\n'),
        { lensId: lens.id, context },
        `black_oracle_${lens.id}`,
        lensSchema,
        1_100,
      );
      return { ...result.data, lensId: lens.id, responseId: result.responseId, usage: result.usage };
    }));

    const adjudicator = await callStructured(
      apiKey,
      model,
      [
        'You are Black Oracle Meta-Adjudicator.',
        'Run structured cross-examination over the independent positions, then rebuttal adjustments and final positions.',
        'Challenge ignored evidence, regime mismatch, overweighted features, stale assumptions, execution feasibility and tail risk.',
        'Preserve material dissent instead of averaging it away.',
        'Unsupported claims must not dominate. Reference supplied evidence IDs when evidence exists.',
        'Weight observations are Challenger suggestions only; never mutate production weights.',
        'The final decision is advisory and cannot execute an order. Prefer NO_TRADE when uncertainty is material.',
      ].join('\n'),
      { context, independentPositions: independent.map(({ usage, responseId, ...position }) => position) },
      'black_oracle_council_debate',
      debateSchema,
      3_200,
    );

    return json(response, 200, {
      success: true,
      mode: 'ADVISORY_ONLY',
      model,
      startedAt,
      finishedAt: Date.now(),
      independent,
      debate: adjudicator.data,
      adjudicatorResponseId: adjudicator.responseId,
      adjudicatorUsage: adjudicator.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Council error.';
    console.error('Black Oracle Council failed:', message.slice(0, 500));
    return json(response, 502, { success: false, error: message.slice(0, 500) });
  }
}
