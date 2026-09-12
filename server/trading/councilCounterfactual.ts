export type CouncilCounterfactualClassification =
  | 'CANDIDATE_AVOIDED_LOSS'
  | 'CANDIDATE_FALSE_BLOCK_COST'
  | 'SHADOW_BLOCK_FLAT_OUTCOME'
  | 'NO_SHADOW_BLOCK_SIGNAL';

export type CouncilCounterfactualObservation = {
  tradeId: string;
  market: string;
  entryTraceId: string;
  outcomeTraceId: string | null;
  netPnl: number;
  returnPct: number;
  deterministicVerdict: string | null;
  redTeamResult: string | null;
  aiStance: string | null;
  shadowBlockSignal: boolean;
  blockSignalSources: Array<'DETERMINISTIC_COUNCIL_REJECT' | 'DETERMINISTIC_RED_TEAM_INVALIDATED' | 'AI_COUNCIL_DISSENT'>;
  classification: CouncilCounterfactualClassification;
  candidateAvoidedLossKrw: number;
  candidateFalseBlockCostKrw: number;
};

export type CouncilCounterfactualReport = {
  runtimeId: string;
  status: 'INSUFFICIENT_DATA' | 'EARLY_OBSERVATION';
  closedOutcomeCount: number;
  eligibleSampleCount: number;
  excludedMissingLineage: number;
  excludedMissingEntryReview: number;
  shadowBlockSignalCount: number;
  candidateAvoidedLossKrw: number;
  candidateFalseBlockCostKrw: number;
  candidateNetBenefitKrw: number;
  observations: CouncilCounterfactualObservation[];
  causalClaimAllowed: false;
  policyChangeAuthority: false;
  executionAuthority: false;
  note: string;
};

const finiteNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeMarket = (value: unknown) => String(value ?? '').trim().toUpperCase();

export const buildCouncilCounterfactualReport = (
  runtimeId: string,
  outcomeRows: any[],
  councilRows: any[],
  aiReviewRows: any[],
): CouncilCounterfactualReport => {
  const normalizedRuntimeId = String(runtimeId ?? '').trim();
  const councilByTrace = new Map<string, any>();
  for (const row of Array.isArray(councilRows) ? councilRows : []) {
    const traceId = String(row?.trace?.traceId ?? '').trim();
    if (!traceId || String(row?.runtime_id ?? '') !== normalizedRuntimeId) continue;
    if (String(row?.event_type ?? '') !== 'COUNCIL') continue;
    if (String(row?.event_name ?? '') !== 'DETERMINISTIC_COUNCIL_REVIEWED') continue;
    if (row?.execution_authority !== false) continue;
    councilByTrace.set(traceId, row);
  }

  const aiByReviewKey = new Map<string, any>();
  for (const row of Array.isArray(aiReviewRows) ? aiReviewRows : []) {
    const reviewKey = String(row?.review_key ?? '').trim();
    if (!reviewKey || String(row?.runtime_id ?? '') !== normalizedRuntimeId) continue;
    if (row?.execution_authority !== false || row?.advisory_only !== true) continue;
    aiByReviewKey.set(reviewKey, row);
  }

  const observations: CouncilCounterfactualObservation[] = [];
  let excludedMissingLineage = 0;
  let excludedMissingEntryReview = 0;
  const outcomes = Array.isArray(outcomeRows) ? outcomeRows : [];

  for (const row of outcomes) {
    if (String(row?.runtime_id ?? '') !== normalizedRuntimeId) continue;
    if (String(row?.event_type ?? '') !== 'OUTCOME') continue;
    if (String(row?.event_name ?? '') !== 'PAPER_TRADE_CLOSED_OUTCOME') continue;

    const entryTraceId = String(row?.links?.entryTraceId ?? '').trim();
    if (!entryTraceId) {
      excludedMissingLineage += 1;
      continue;
    }

    const council = councilByTrace.get(entryTraceId) ?? null;
    const ai = aiByReviewKey.get(entryTraceId) ?? null;
    if (!council && !ai) {
      excludedMissingEntryReview += 1;
      continue;
    }

    const netPnl = finiteNumber(row?.trace?.netPnl);
    const returnPct = finiteNumber(row?.trace?.returnPct);
    if (netPnl == null || returnPct == null) {
      excludedMissingLineage += 1;
      continue;
    }

    const deterministicVerdict = council?.trace?.verdict == null ? null : String(council.trace.verdict).toUpperCase();
    const redTeamResult = council?.trace?.redTeamResult == null ? null : String(council.trace.redTeamResult).toUpperCase();
    const aiStance = ai?.ai_stance == null ? null : String(ai.ai_stance).toUpperCase();
    const blockSignalSources: CouncilCounterfactualObservation['blockSignalSources'] = [];
    if (deterministicVerdict === 'REJECT') blockSignalSources.push('DETERMINISTIC_COUNCIL_REJECT');
    if (redTeamResult === 'INVALIDATED') blockSignalSources.push('DETERMINISTIC_RED_TEAM_INVALIDATED');
    if (aiStance === 'DISSENT') blockSignalSources.push('AI_COUNCIL_DISSENT');
    const shadowBlockSignal = blockSignalSources.length > 0;

    let classification: CouncilCounterfactualClassification = 'NO_SHADOW_BLOCK_SIGNAL';
    let candidateAvoidedLossKrw = 0;
    let candidateFalseBlockCostKrw = 0;
    if (shadowBlockSignal && netPnl < 0) {
      classification = 'CANDIDATE_AVOIDED_LOSS';
      candidateAvoidedLossKrw = -netPnl;
    } else if (shadowBlockSignal && netPnl > 0) {
      classification = 'CANDIDATE_FALSE_BLOCK_COST';
      candidateFalseBlockCostKrw = netPnl;
    } else if (shadowBlockSignal) {
      classification = 'SHADOW_BLOCK_FLAT_OUTCOME';
    }

    observations.push({
      tradeId: String(row?.trace?.tradeId ?? row?.links?.tradeId ?? row?.id ?? ''),
      market: normalizeMarket(row?.market),
      entryTraceId,
      outcomeTraceId: row?.trace?.traceId == null ? null : String(row.trace.traceId),
      netPnl,
      returnPct,
      deterministicVerdict,
      redTeamResult,
      aiStance,
      shadowBlockSignal,
      blockSignalSources,
      classification,
      candidateAvoidedLossKrw,
      candidateFalseBlockCostKrw,
    });
  }

  observations.sort((a, b) => Math.abs(b.netPnl) - Math.abs(a.netPnl) || a.tradeId.localeCompare(b.tradeId));
  const candidateAvoidedLossKrw = observations.reduce((sum, item) => sum + item.candidateAvoidedLossKrw, 0);
  const candidateFalseBlockCostKrw = observations.reduce((sum, item) => sum + item.candidateFalseBlockCostKrw, 0);

  return {
    runtimeId: normalizedRuntimeId,
    status: observations.length ? 'EARLY_OBSERVATION' : 'INSUFFICIENT_DATA',
    closedOutcomeCount: outcomes.filter((row) => String(row?.runtime_id ?? '') === normalizedRuntimeId && String(row?.event_name ?? '') === 'PAPER_TRADE_CLOSED_OUTCOME').length,
    eligibleSampleCount: observations.length,
    excludedMissingLineage,
    excludedMissingEntryReview,
    shadowBlockSignalCount: observations.filter((item) => item.shadowBlockSignal).length,
    candidateAvoidedLossKrw,
    candidateFalseBlockCostKrw,
    candidateNetBenefitKrw: candidateAvoidedLossKrw - candidateFalseBlockCostKrw,
    observations,
    causalClaimAllowed: false,
    policyChangeAuthority: false,
    executionAuthority: false,
    note: observations.length
      ? 'Counterfactual values assume a shadow Council REJECT, Red Team INVALIDATED, or AI DISSENT would have blocked the entry and therefore produced zero trade P&L. They are diagnostic candidates, not causal avoided-loss claims.'
      : 'No closed trade currently has both preserved entry lineage and a preserved entry-time Council/AI shadow review. No counterfactual claim is produced.',
  };
};

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  return base && key ? {
    base,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  } : null;
};

const readJson = async (url: URL, headers: Record<string, string>) => {
  const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Council counterfactual read failed (${response.status}): ${(await response.text()).slice(0, 400)}`);
  return await response.json() as any[];
};

export const readCouncilCounterfactualReport = async (
  runtimeId: string,
  limit = 200,
): Promise<CouncilCounterfactualReport> => {
  const normalizedRuntimeId = String(runtimeId ?? '').trim();
  if (!normalizedRuntimeId) throw new Error('Council counterfactual requires a runtime id.');
  const boundedLimit = Math.max(1, Math.min(500, Math.trunc(Number(limit) || 200)));
  const db = dbConfig();
  if (!db) return buildCouncilCounterfactualReport(normalizedRuntimeId, [], [], []);

  const outcomesUrl = new URL(`${db.base}/rest/v1/black_oracle_events`);
  outcomesUrl.searchParams.set('select', 'id,event_key,occurred_at,runtime_id,event_type,event_name,market,execution_authority,trace,links');
  outcomesUrl.searchParams.set('runtime_id', `eq.${normalizedRuntimeId}`);
  outcomesUrl.searchParams.set('event_type', 'eq.OUTCOME');
  outcomesUrl.searchParams.set('event_name', 'eq.PAPER_TRADE_CLOSED_OUTCOME');
  outcomesUrl.searchParams.set('order', 'occurred_at.desc');
  outcomesUrl.searchParams.set('limit', String(boundedLimit));

  const councilUrl = new URL(`${db.base}/rest/v1/black_oracle_events`);
  councilUrl.searchParams.set('select', 'id,event_key,occurred_at,runtime_id,event_type,event_name,market,execution_authority,trace,links');
  councilUrl.searchParams.set('runtime_id', `eq.${normalizedRuntimeId}`);
  councilUrl.searchParams.set('event_type', 'eq.COUNCIL');
  councilUrl.searchParams.set('event_name', 'eq.DETERMINISTIC_COUNCIL_REVIEWED');
  councilUrl.searchParams.set('order', 'occurred_at.desc');
  councilUrl.searchParams.set('limit', '500');

  const aiUrl = new URL(`${db.base}/rest/v1/black_oracle_ai_council_reviews`);
  aiUrl.searchParams.set('select', 'review_key,runtime_id,market,decision_timestamp,reviewed_action,deterministic_verdict,ai_stance,confidence,advisory_only,execution_authority');
  aiUrl.searchParams.set('runtime_id', `eq.${normalizedRuntimeId}`);
  aiUrl.searchParams.set('order', 'decision_timestamp.desc');
  aiUrl.searchParams.set('limit', '500');

  const [outcomes, councils, aiReviews] = await Promise.all([
    readJson(outcomesUrl, db.headers),
    readJson(councilUrl, db.headers),
    readJson(aiUrl, db.headers),
  ]);
  return buildCouncilCounterfactualReport(normalizedRuntimeId, outcomes, councils, aiReviews);
};
