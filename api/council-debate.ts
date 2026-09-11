import { allowNonCriticalAiCall, getAiBudgetStatus, recordOpenAIUsage } from '../server/aiUsageLedger';
import {
  COUNCIL_CONSTITUTION_VERSION,
  RED_TEAM_PERSONA,
  buildCouncilPersonaInstructions,
  buildRedTeamInstructions,
  resolveCouncilPersonas,
  type CouncilPersonaDefinition,
} from '../src/trading/councilConstitution';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_FAST_MODEL = 'gpt-5.6-luna';
const DEFAULT_ESCALATION_MODEL = 'gpt-5.6-terra';

const json = (response: any, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

const isAuthorizedInternalCall = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return false;
  const presented = authorization.slice('Bearer '.length).trim();
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && presented === secret);
};

const resolveOpenAIKey = () =>
  process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_API?.trim() || '';

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
    source: clampText(item?.source, 500),
    timestamp: Number.isFinite(Number(item?.timestamp)) ? Number(item.timestamp) : null,
  }));
};

const compactObject = (value: unknown, maxChars = 14_000): unknown => {
  if (!value || typeof value !== 'object') return null;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > maxChars) {
      return { omitted: true, reason: `Field exceeded ${maxChars} characters and was not sent to Council.` };
    }
    return JSON.parse(serialized);
  } catch {
    return null;
  }
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
  usage: { operation: string; market?: string; metadata?: Record<string, unknown> },
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

  const responseId = typeof payload?.id === 'string' ? payload.id : null;
  await recordOpenAIUsage(payload?.usage, {
    feature: 'council',
    operation: usage.operation,
    model,
    responseId,
    market: usage.market ?? null,
    metadata: usage.metadata ?? {},
  }).catch((error) => console.warn('Council AI usage ledger write failed:', error));

  return {
    data: JSON.parse(extractOutputText(payload)),
    responseId,
    usage: payload?.usage ?? null,
  };
};

const distributionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['long', 'short', 'noTrade'],
  properties: {
    long: { type: 'number', minimum: 0, maximum: 1 },
    short: { type: 'number', minimum: 0, maximum: 1 },
    noTrade: { type: 'number', minimum: 0, maximum: 1 },
  },
};

const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'personaId', 'team', 'thesis', 'facts', 'inferences', 'assumptions', 'supportingEvidenceIds',
    'contradictingEvidenceIds', 'dataGaps', 'strongestCounterargument', 'invalidationConditions',
    'directionDistribution', 'confidenceBand', 'confidenceScore', 'decision', 'materialUncertainties',
  ],
  properties: {
    personaId: { type: 'string' },
    team: { type: 'string', enum: ['PRIMARY', 'SPECIALIST'] },
    thesis: { type: 'string' },
    facts: { type: 'array', items: { type: 'string' } },
    inferences: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
    supportingEvidenceIds: { type: 'array', items: { type: 'string' } },
    contradictingEvidenceIds: { type: 'array', items: { type: 'string' } },
    dataGaps: { type: 'array', items: { type: 'string' } },
    strongestCounterargument: { type: 'string' },
    invalidationConditions: { type: 'array', items: { type: 'string' } },
    directionDistribution: distributionSchema,
    confidenceBand: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    confidenceScore: { type: 'number', minimum: 0, maximum: 1 },
    decision: { type: 'string', enum: ['SUPPORT_LONG', 'SUPPORT_SHORT', 'SUPPORT_NO_TRADE', 'INSUFFICIENT_DATA'] },
    materialUncertainties: { type: 'array', items: { type: 'string' } },
  },
};

const redTeamSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'personaId', 'primaryFailureHypothesis', 'strongestCounterevidenceIds', 'hiddenAssumptions',
    'alternativeExplanation', 'missingInformation', 'earliestFailureSignal', 'whatWouldChangeMyView',
    'result', 'severity', 'materialChallenges',
  ],
  properties: {
    personaId: { type: 'string' },
    primaryFailureHypothesis: { type: 'string' },
    strongestCounterevidenceIds: { type: 'array', items: { type: 'string' } },
    hiddenAssumptions: { type: 'array', items: { type: 'string' } },
    alternativeExplanation: { type: 'string' },
    missingInformation: { type: 'array', items: { type: 'string' } },
    earliestFailureSignal: { type: 'string' },
    whatWouldChangeMyView: { type: 'string' },
    result: { type: 'string', enum: ['INVALIDATED', 'SERIOUSLY_CHALLENGED', 'PARTIALLY_SURVIVED', 'SURVIVED'] },
    severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    materialChallenges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['targetPersonaId', 'issue', 'question', 'evidenceIds'],
        properties: {
          targetPersonaId: { type: 'string' },
          issue: { type: 'string' },
          question: { type: 'string' },
          evidenceIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const revisionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'personaId', 'revision', 'response', 'probabilityBefore', 'probabilityAfter',
    'confidenceBandAfter', 'confidenceScoreAfter', 'decisionAfter', 'reason', 'remainingUncertainty',
  ],
  properties: {
    personaId: { type: 'string' },
    revision: { type: 'string', enum: ['MAINTAIN', 'REVISE', 'REVERSE'] },
    response: { type: 'string' },
    probabilityBefore: distributionSchema,
    probabilityAfter: distributionSchema,
    confidenceBandAfter: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    confidenceScoreAfter: { type: 'number', minimum: 0, maximum: 1 },
    decisionAfter: { type: 'string', enum: ['SUPPORT_LONG', 'SUPPORT_SHORT', 'SUPPORT_NO_TRADE', 'INSUFFICIENT_DATA'] },
    reason: { type: 'string' },
    remainingUncertainty: { type: 'array', items: { type: 'string' } },
  },
};

const arbiterSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'capitalDecision', 'directionDistribution', 'confidenceBand', 'confidenceScore', 'principalEvidenceIds',
    'principalCounterevidenceIds', 'dominantArgument', 'unresolvedUncertainty', 'criticalDataGaps',
    'preservedDissent', 'redTeamResult', 'strategyCompatibility', 'tradeQuality', 'evidenceIndependence',
    'dataCompleteness', 'reasonForNoTrade', 'crossExamination', 'dissent', 'weightObservations',
  ],
  properties: {
    capitalDecision: { type: 'string', enum: ['LONG', 'SHORT', 'NO_TRADE'] },
    directionDistribution: distributionSchema,
    confidenceBand: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    confidenceScore: { type: 'number', minimum: 0, maximum: 1 },
    principalEvidenceIds: { type: 'array', items: { type: 'string' } },
    principalCounterevidenceIds: { type: 'array', items: { type: 'string' } },
    dominantArgument: { type: 'string' },
    unresolvedUncertainty: { type: 'array', items: { type: 'string' } },
    criticalDataGaps: { type: 'array', items: { type: 'string' } },
    preservedDissent: { type: 'array', items: { type: 'string' } },
    redTeamResult: { type: 'string', enum: ['INVALIDATED', 'SERIOUSLY_CHALLENGED', 'PARTIALLY_SURVIVED', 'SURVIVED'] },
    strategyCompatibility: { type: 'string', enum: ['SUPPORTED', 'CONDITIONAL', 'UNSUPPORTED', 'INSUFFICIENT_DATA'] },
    tradeQuality: { type: 'string', enum: ['GOOD', 'MARGINAL', 'POOR', 'INSUFFICIENT_DATA'] },
    evidenceIndependence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] },
    dataCompleteness: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    reasonForNoTrade: { type: 'string' },
    crossExamination: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['challenger', 'target', 'question', 'issue', 'evidenceIds'],
        properties: {
          challenger: { type: 'string' },
          target: { type: 'string' },
          question: { type: 'string' },
          issue: { type: 'string' },
          evidenceIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    dissent: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['personaId', 'argument', 'evidenceIds', 'materiality'],
        properties: {
          personaId: { type: 'string' },
          argument: { type: 'string' },
          evidenceIds: { type: 'array', items: { type: 'string' } },
          materiality: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
        },
      },
    },
    weightObservations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['personaId', 'observation', 'suggestedDirection', 'reason'],
        properties: {
          personaId: { type: 'string' },
          observation: { type: 'string' },
          suggestedDirection: { type: 'string', enum: ['UP', 'DOWN', 'UNCHANGED'] },
          reason: { type: 'string' },
        },
      },
    },
  },
};

const normalizeDistribution = (value: any) => {
  const long = Math.max(0, Number(value?.long) || 0);
  const short = Math.max(0, Number(value?.short) || 0);
  const noTrade = Math.max(0, Number(value?.noTrade) || 0);
  const total = long + short + noTrade;
  if (total <= 0) return { long: 0, short: 0, noTrade: 1 };
  return { long: long / total, short: short / total, noTrade: noTrade / total };
};

const dominantProbability = (distribution: any) => {
  const normalized = normalizeDistribution(distribution);
  return Math.max(normalized.long, normalized.short, normalized.noTrade);
};

const toLegacyStance = (decision: string) => decision === 'SUPPORT_LONG'
  ? 'BULLISH'
  : decision === 'SUPPORT_SHORT'
    ? 'BEARISH'
    : decision === 'INSUFFICIENT_DATA'
      ? 'UNCERTAIN'
      : 'NEUTRAL';

const toLegacyAction = (decision: string) => decision === 'SUPPORT_LONG'
  ? 'ENTER'
  : decision === 'SUPPORT_SHORT'
    ? 'EXIT'
    : 'NO_TRADE';

const analysisForResponse = (analysis: any) => ({
  ...analysis,
  directionDistribution: normalizeDistribution(analysis.directionDistribution),
  lensId: analysis.personaId,
  probability: dominantProbability(analysis.directionDistribution),
  confidence: Number(analysis.confidenceScore) || 0,
  stance: toLegacyStance(analysis.decision),
  actionImplication: toLegacyAction(analysis.decision),
  claim: analysis.thesis,
  evidenceIds: analysis.supportingEvidenceIds,
  counterEvidenceIds: analysis.contradictingEvidenceIds,
  keyRisks: [...(analysis.materialUncertainties ?? []), ...(analysis.dataGaps ?? [])].slice(0, 12),
  invalidation: Array.isArray(analysis.invalidationConditions) ? analysis.invalidationConditions.join(' | ') : '',
  counterfactual: analysis.strongestCounterargument,
});

const buildContext = (body: any) => ({
  question: clampText(body.question, 1_500),
  market: clampText(body.market, 120),
  timeframe: clampText(body.timeframe, 80),
  proposedAction: clampText(body.proposedAction, 80),
  strategy: compactObject(body.strategy),
  marketState: compactObject(body.marketState),
  signals: compactItems(body.signals, 30),
  hypotheses: compactItems(body.hypotheses, 12),
  evidence: compactItems(body.evidence, 50),
  scenarios: compactItems(body.scenarios, 12),
  performance: compactObject(body.performance),
  tradeMap: compactObject(body.tradeMap),
  microstructure: compactObject(body.microstructure),
  portfolio: compactObject(body.portfolio),
  macro: compactObject(body.macro),
  fundamentals: compactObject(body.fundamentals),
  derivatives: compactObject(body.derivatives),
});

const resolveRequestedSpecialists = (body: any, context: ReturnType<typeof buildContext>) => {
  const requested = new Set<string>(
    Array.isArray(body.requestedSpecialists)
      ? body.requestedSpecialists.map((value: unknown) => String(value || '').trim()).filter(Boolean)
      : [],
  );
  if (context.macro) requested.add('macro_cross_asset');
  if (context.fundamentals) requested.add('fundamental_valuation');
  if (context.microstructure) requested.add('microstructure_flow');
  if (context.derivatives) requested.add('derivatives_positioning');
  if (context.portfolio) requested.add('portfolio_context');
  return Array.from(requested);
};

const shouldEscalate = (independent: any[], redTeam: any, body: any) => {
  if (body?.forceEscalation === true || String(body?.riskLevel || '').toUpperCase() === 'HIGH') return true;
  if (redTeam?.result === 'INVALIDATED' || redTeam?.result === 'SERIOUSLY_CHALLENGED') return true;
  const decisions = independent.map((item) => item?.decision).filter(Boolean);
  const directional = new Set(decisions.filter((value) => value === 'SUPPORT_LONG' || value === 'SUPPORT_SHORT'));
  const noTrade = decisions.includes('SUPPORT_NO_TRADE') || decisions.includes('INSUFFICIENT_DATA');
  const actionable = decisions.some((value) => value === 'SUPPORT_LONG' || value === 'SUPPORT_SHORT');
  return directional.size > 1 || (actionable && noTrade) || actionable;
};

const challengesForPersona = (redTeam: any, personaId: string) =>
  Array.isArray(redTeam?.materialChallenges)
    ? redTeam.materialChallenges.filter((challenge: any) => challenge?.targetPersonaId === personaId)
    : [];

const revisePersona = async (
  apiKey: string,
  model: string,
  persona: CouncilPersonaDefinition,
  context: unknown,
  original: any,
  redTeam: any,
  market: string,
) => callStructured(
  apiKey,
  model,
  [
    buildCouncilPersonaInstructions(persona),
    '',
    'REBUTTAL PROTOCOL:',
    '- Review only the supplied Red Team challenge and your own original analysis.',
    '- Choose MAINTAIN, REVISE or REVERSE. Persistence is not rewarded.',
    '- Keep probability and confidence separate.',
    '- Do not use Red Team conclusions as evidence; use only referenced supplied evidence or identified logic/data gaps.',
    '- probabilityBefore must reproduce the original distribution; probabilityAfter is your revised distribution.',
  ].join('\n'),
  {
    context,
    originalAnalysis: original,
    redTeamChallenges: challengesForPersona(redTeam, persona.id),
    redTeamSummary: {
      result: redTeam?.result,
      primaryFailureHypothesis: redTeam?.primaryFailureHypothesis,
      hiddenAssumptions: redTeam?.hiddenAssumptions,
      missingInformation: redTeam?.missingInformation,
    },
  },
  `black_oracle_v3_revision_${persona.id}`,
  revisionSchema,
  1_200,
  { operation: `v3_revision:${persona.id}`, market, metadata: { persona: persona.title } },
);

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }
  if (!isAuthorizedInternalCall(request.headers.authorization)) {
    return json(response, 401, { success: false, error: 'Unauthorized internal invocation.' });
  }

  const apiKey = resolveOpenAIKey();
  if (!apiKey) return json(response, 503, { success: false, error: 'OpenAI API key is not configured.' });
  if (!(await allowNonCriticalAiCall())) {
    return json(response, 200, {
      success: true,
      skipped: true,
      budgetLimited: true,
      mode: 'ADVISORY_ONLY',
      executionAuthority: false,
      constitutionVersion: COUNCIL_CONSTITUTION_VERSION,
      reason: 'AI hard cap reached. Council skipped; deterministic trading/risk logic remains authoritative.',
    });
  }

  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const context = buildContext(body);
  if (!context.question && context.hypotheses.length === 0 && !context.strategy) {
    return json(response, 400, { success: false, error: 'A question, strategy, or at least one hypothesis is required.' });
  }
  if (JSON.stringify(context).length > 90_000) {
    return json(response, 413, { success: false, error: 'Council context is too large.' });
  }

  const requestedSpecialists = resolveRequestedSpecialists(body, context);
  const personas = resolveCouncilPersonas(requestedSpecialists);
  const fastModel = process.env.OPENAI_FAST_MODEL?.trim() || DEFAULT_FAST_MODEL;
  const escalationModel = process.env.OPENAI_COUNCIL_ESCALATION_MODEL?.trim() || DEFAULT_ESCALATION_MODEL;
  const startedAt = Date.now();

  try {
    const independentResults = await Promise.all(personas.map(async (persona) => {
      const result = await callStructured(
        apiKey,
        fastModel,
        [
          buildCouncilPersonaInstructions(persona),
          '',
          'ROUND 0 — BLIND INDEPENDENT ANALYSIS:',
          '- You cannot see any other Council analysis.',
          '- Do not predict what other agents will conclude.',
          '- The three direction probabilities must sum to 1.',
          '- INSUFFICIENT_DATA is required when missing information prevents a defensible domain conclusion.',
        ].join('\n'),
        { personaId: persona.id, context },
        `black_oracle_v3_${persona.id}`,
        analysisSchema,
        1_400,
        { operation: `v3_round0:${persona.id}`, market: context.market, metadata: { persona: persona.title, team: persona.team } },
      );
      return { ...result.data, personaId: persona.id, team: persona.team, responseId: result.responseId, usage: result.usage };
    }));

    const redTeamCall = await callStructured(
      apiKey,
      fastModel,
      [
        buildRedTeamInstructions(),
        '',
        'INDEPENDENT RED TEAM:',
        '- Primary positions are claims to attack, not evidence.',
        '- Use the underlying supplied context and evidence IDs for factual support.',
        '- Target only material weaknesses. Maximum three material challenges.',
      ].join('\n'),
      {
        personaId: RED_TEAM_PERSONA.id,
        context,
        primaryPositions: independentResults.map(({ usage, responseId, ...position }) => position),
      },
      'black_oracle_v3_red_team',
      redTeamSchema,
      1_700,
      { operation: 'v3_red_team', market: context.market, metadata: { persona: RED_TEAM_PERSONA.title } },
    );
    const redTeam = { ...redTeamCall.data, personaId: RED_TEAM_PERSONA.id, responseId: redTeamCall.responseId, usage: redTeamCall.usage };

    const budget = await getAiBudgetStatus().catch(() => null);
    const escalationRequested = shouldEscalate(independentResults, redTeam, body);
    const escalated = escalationRequested && !budget?.softLimited;
    const adjudicatorModel = escalated ? escalationModel : fastModel;

    const revisions = escalated
      ? await Promise.all(personas.map(async (persona) => {
          const original = independentResults.find((item) => item.personaId === persona.id);
          const result = await revisePersona(apiKey, adjudicatorModel, persona, context, original, redTeam, context.market);
          return { ...result.data, personaId: persona.id, responseId: result.responseId, usage: result.usage };
        }))
      : [];

    const finalPositions = independentResults.map((original) => {
      const revision = revisions.find((item) => item.personaId === original.personaId);
      if (!revision) return original;
      return {
        ...original,
        directionDistribution: normalizeDistribution(revision.probabilityAfter),
        confidenceBand: revision.confidenceBandAfter,
        confidenceScore: revision.confidenceScoreAfter,
        decision: revision.decisionAfter,
        materialUncertainties: revision.remainingUncertainty,
        revision: revision.revision,
        revisionReason: revision.reason,
      };
    });

    const arbiter = await callStructured(
      apiKey,
      adjudicatorModel,
      [
        `BLACK ORACLE AI COUNCIL v3 / ${COUNCIL_CONSTITUTION_VERSION}`,
        'You are the Decision Arbiter.',
        'You do not perform a new independent market analysis.',
        'Judge whether the submitted evidence and analyses justify capital exposure.',
        'Do not use majority voting, confidence averaging, seniority weighting, or consensus as evidence.',
        'Evaluate evidence quality and independence, strategy validation, regime compatibility, Red Team findings, trade asymmetry, data completeness, calibration context and unresolved dissent.',
        'Prefer NO_TRADE when uncertainty exceeds demonstrated edge.',
        'Preserve material minority dissent.',
        'Weight observations are research suggestions only and cannot mutate production weights.',
        'executionAuthority=false. Deterministic Policy and Risk retain final veto authority.',
      ].join('\n'),
      {
        context,
        round0: independentResults.map(({ usage, responseId, ...position }) => position),
        redTeam: (() => { const { usage, responseId, ...value } = redTeam; return value; })(),
        revisions: revisions.map(({ usage, responseId, ...revision }) => revision),
        finalPositions: finalPositions.map(({ usage, responseId, ...position }) => position),
      },
      'black_oracle_v3_arbiter',
      arbiterSchema,
      2_500,
      {
        operation: escalated ? 'v3_arbiter_escalated' : 'v3_arbiter_fast',
        market: context.market,
        metadata: { escalationRequested, escalated, softLimited: Boolean(budget?.softLimited) },
      },
    );

    const legacyIndependent = independentResults.map(analysisForResponse);
    const legacyFinalPositions = finalPositions.map((position) => {
      const normalized = analysisForResponse(position);
      return {
        lensId: normalized.lensId,
        probability: normalized.probability,
        confidence: normalized.confidence,
        vote: normalized.actionImplication,
        reason: normalized.thesis,
      };
    });
    const legacyRebuttals = revisions.map((revision) => ({
      lensId: revision.personaId,
      response: revision.response,
      probabilityAfter: dominantProbability(revision.probabilityAfter),
      confidenceAfter: revision.confidenceScoreAfter,
      changed: revision.revision !== 'MAINTAIN',
    }));
    const capitalDecision = arbiter.data.capitalDecision;
    const legacyDecision = capitalDecision === 'LONG' ? 'ENTER' : capitalDecision === 'SHORT' ? 'EXIT' : 'NO_TRADE';
    const adjudication = {
      probability: dominantProbability(arbiter.data.directionDistribution),
      confidence: Number(arbiter.data.confidenceScore) || 0,
      decision: legacyDecision,
      capitalDecision,
      directionDistribution: normalizeDistribution(arbiter.data.directionDistribution),
      confidenceBand: arbiter.data.confidenceBand,
      dominantArgument: arbiter.data.dominantArgument,
      unresolvedUncertainty: arbiter.data.unresolvedUncertainty,
      triggers: [],
      invalidation: redTeam.earliestFailureSignal || '',
      preservedDissent: arbiter.data.preservedDissent,
      principalEvidenceIds: arbiter.data.principalEvidenceIds,
      principalCounterevidenceIds: arbiter.data.principalCounterevidenceIds,
      criticalDataGaps: arbiter.data.criticalDataGaps,
      redTeamResult: arbiter.data.redTeamResult,
      strategyCompatibility: arbiter.data.strategyCompatibility,
      tradeQuality: arbiter.data.tradeQuality,
      evidenceIndependence: arbiter.data.evidenceIndependence,
      dataCompleteness: arbiter.data.dataCompleteness,
      reasonForNoTrade: arbiter.data.reasonForNoTrade,
      executionAuthority: false,
    };

    return json(response, 200, {
      success: true,
      mode: 'ADVISORY_ONLY',
      executionAuthority: false,
      constitutionVersion: COUNCIL_CONSTITUTION_VERSION,
      architecture: 'PRIMARY_TEAM_RED_TEAM_ARBITER',
      fastModel,
      adjudicatorModel,
      requestedSpecialists,
      activePersonas: personas.map((persona) => ({ id: persona.id, title: persona.title, team: persona.team })),
      redTeamPersona: { id: RED_TEAM_PERSONA.id, title: RED_TEAM_PERSONA.title },
      escalationRequested,
      escalated,
      budget,
      startedAt,
      finishedAt: Date.now(),
      independent: legacyIndependent,
      v3: {
        round0: independentResults,
        redTeam,
        revisions,
        finalPositions,
        arbiter: arbiter.data,
      },
      debate: {
        crossExamination: arbiter.data.crossExamination,
        rebuttals: legacyRebuttals,
        finalPositions: legacyFinalPositions,
        dissent: arbiter.data.dissent.map((item: any) => ({
          lensId: item.personaId,
          argument: item.argument,
          evidenceIds: item.evidenceIds,
          materiality: item.materiality,
        })),
        adjudication,
        weightObservations: arbiter.data.weightObservations.map((item: any) => ({
          lensId: item.personaId,
          observation: item.observation,
          suggestedDirection: item.suggestedDirection,
          reason: item.reason,
        })),
      },
      adjudicatorResponseId: arbiter.responseId,
      adjudicatorUsage: arbiter.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Council error.';
    console.error('Black Oracle Council v3 failed:', message.slice(0, 500));
    return json(response, 502, { success: false, error: message.slice(0, 500) });
  }
}
