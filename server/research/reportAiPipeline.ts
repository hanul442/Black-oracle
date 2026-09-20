import { randomUUID } from 'node:crypto';

import type { CreditActionType } from '../../src/commercial/creditContracts';
import {
  type AnalystReview,
  type DebateSession,
  type DebateTurn,
  type DomainLeadSynthesis,
  type EvidenceReference,
  type GeneralActionGuide,
  type ReportForecast,
  type ReportSubject,
  type ReportType,
} from '../../src/report/contracts';
import {
  reportAnalystById,
  type ReportAnalystDefinition,
} from '../../src/report/analystRegistry';
import { planPostReviewSynthesis, planResearchRun } from './reportOrchestrator';
import {
  callReportStructured,
  DEFAULT_REPORT_DEEP_MODEL,
  DEFAULT_REPORT_FAST_MODEL,
  reportAiBudgetAllowsCall,
  resolveReportOpenAIKey,
} from './reportAiClient';
import {
  analystReviewSchema,
  buildAnalystPrompt,
  buildDebatePrompt,
  buildLeadPrompt,
  buildRedTeamPrompt,
  debateTurnSchema,
  leadSynthesisSchema,
  redTeamSchema,
  type AnalystReviewDraft,
  type DebateTurnDraft,
  type LeadSynthesisDraft,
  type RedTeamDraft,
} from './reportAiPrompts';

export type ReportEvidencePacket = EvidenceReference & {
  summary: string;
  domains: string[];
  reliability?: number | null;
  payload?: Record<string, unknown> | null;
};

export type RunReportAiPipelineInput = {
  reportId: string;
  reportVersion: number;
  reportType: ReportType;
  subject: ReportSubject;
  asOf: number;
  knowledgeCutoff: number;
  evidence: ReportEvidencePacket[];
  changedEvidenceDomains?: string[];
  requestedAnalystIds?: string[];
  materialEvent?: boolean;
  materialGradeChange?: boolean;
  highUncertainty?: boolean;
  explicitDebateRequest?: boolean;
  maxSpecialists?: number;
  maxDebateParticipants?: number;
  horizonHint?: string | null;
  marketContext?: Record<string, unknown> | null;
  creditJobId?: string | null;
  creditActionType?: CreditActionType | null;
};

export type ReportResearchBundle = {
  reportId: string;
  reportVersion: number;
  reportType: ReportType;
  subject: ReportSubject;
  asOf: number;
  knowledgeCutoff: number;
  analystReviews: AnalystReview[];
  debate: DebateSession | null;
  synthesis: DomainLeadSynthesis;
  forecast: ReportForecast | null;
  actionGuide: GeneralActionGuide;
  trace: {
    selectedAnalystIds: string[];
    debateParticipantIds: string[];
    redTeamUsed: boolean;
    evidenceIds: string[];
    fastModel: string;
    deepModel: string;
  };
};

const evidenceMap = (items: ReportEvidencePacket[]) =>
  new Map(items.map((item) => [item.evidenceId, item] as const));

const sanitizeEvidenceIds = (
  ids: unknown,
  known: Map<string, ReportEvidencePacket>,
) => Array.isArray(ids)
  ? [...new Set(ids.map(String).filter((id) => known.has(id)))]
  : [];

const evidenceReferences = (
  ids: unknown,
  known: Map<string, ReportEvidencePacket>,
) => sanitizeEvidenceIds(ids, known).map((id) => {
  const item = known.get(id)!;
  return {
    evidenceId: item.evidenceId,
    evidenceClass: item.evidenceClass,
    title: item.title ?? null,
    source: item.source ?? null,
    observedAt: item.observedAt ?? null,
    publishedAt: item.publishedAt ?? null,
    freshness: item.freshness ?? 'UNKNOWN',
    provenanceUrl: item.provenanceUrl ?? null,
  } satisfies EvidenceReference;
});

const compactEvidence = (items: ReportEvidencePacket[]) =>
  items.slice(0, 80).map((item) => ({
    evidenceId: item.evidenceId,
    evidenceClass: item.evidenceClass,
    title: item.title ?? null,
    summary: item.summary.slice(0, 1800),
    domains: item.domains,
    reliability: item.reliability ?? null,
    source: item.source ?? null,
    observedAt: item.observedAt ?? null,
    publishedAt: item.publishedAt ?? null,
    freshness: item.freshness ?? 'UNKNOWN',
  }));

const evidenceForAnalyst = (
  analyst: ReportAnalystDefinition,
  evidence: ReportEvidencePacket[],
) => {
  const domains = new Set(analyst.evidenceDomains);
  const relevant = evidence.filter((item) => item.domains.some((domain) => domains.has(domain)));
  return compactEvidence(relevant.length ? relevant : evidence.slice(0, 12));
};

const toAnalystReview = (
  input: RunReportAiPipelineInput,
  analyst: ReportAnalystDefinition,
  draft: AnalystReviewDraft,
  knownEvidence: Map<string, ReportEvidencePacket>,
): AnalystReview => ({
  reviewId: `review:${input.reportId}:v${input.reportVersion}:${analyst.analystId}:${randomUUID()}`,
  reportId: input.reportId,
  reportVersion: input.reportVersion,
  analyst: {
    analystId: analyst.analystId,
    role: analyst.title,
    domain: analyst.domain,
    methodVersion: analyst.methodVersion,
    promptVersion: analyst.promptVersion,
    forecastHorizon: draft.forecastContribution?.horizon ?? input.horizonHint ?? null,
  },
  asOf: input.asOf,
  knowledgeCutoff: input.knowledgeCutoff,
  stance: draft.stance,
  confidence: draft.confidence == null ? null : Math.max(0, Math.min(1, Number(draft.confidence))),
  assessment: draft.assessment,
  facts: draft.facts ?? [],
  inferences: draft.inferences ?? [],
  assumptions: draft.assumptions ?? [],
  supportingEvidence: evidenceReferences(draft.supportingEvidenceIds, knownEvidence),
  counterevidence: evidenceReferences(draft.counterevidenceIds, knownEvidence),
  dataGaps: draft.dataGaps ?? [],
  strongestCounterargument: draft.strongestCounterargument ?? null,
  invalidationConditions: draft.invalidationConditions ?? [],
  forecastContribution: {
    horizon: draft.forecastContribution?.horizon ?? input.horizonHint ?? null,
    expectedDirection: draft.forecastContribution?.expectedDirection ?? 'UNCERTAIN',
    fairValue: draft.forecastContribution?.fairValue ?? null,
    currency: draft.forecastContribution?.currency ?? null,
    lowerBound: draft.forecastContribution?.lowerBound ?? null,
    upperBound: draft.forecastContribution?.upperBound ?? null,
    rationale: draft.forecastContribution?.rationale ?? null,
  },
});

const STANCE_POLARITY: Readonly<Record<AnalystReview['stance'], number | null>> = {
  STRONGLY_POSITIVE: 2,
  POSITIVE: 1,
  NEUTRAL: 0,
  NEGATIVE: -1,
  STRONGLY_NEGATIVE: -2,
  INSUFFICIENT_DATA: null,
};

export const selectDebateParticipants = (
  reviews: AnalystReview[],
  maxParticipants = 3,
) => {
  const limit = Math.max(2, Math.min(4, Math.trunc(maxParticipants)));
  const scored = reviews
    .map((review) => ({ review, polarity: STANCE_POLARITY[review.stance] }))
    .filter((item): item is { review: AnalystReview; polarity: number } => item.polarity != null)
    .sort((a, b) => a.polarity - b.polarity);

  if (scored.length <= limit) return scored.map((item) => item.review.analyst.analystId);

  const selected = new Set<string>([
    scored[0].review.analyst.analystId,
    scored[scored.length - 1].review.analyst.analystId,
  ]);

  const remaining = scored
    .slice(1, -1)
    .sort((a, b) => (b.review.confidence ?? 0) - (a.review.confidence ?? 0));

  for (const item of remaining) {
    if (selected.size >= limit) break;
    selected.add(item.review.analyst.analystId);
  }
  return [...selected];
};

const otherReviewsForDebate = (reviews: AnalystReview[], analystId: string) =>
  reviews
    .filter((review) => review.analyst.analystId !== analystId)
    .map((review) => ({
      analystId: review.analyst.analystId,
      role: review.analyst.role,
      stance: review.stance,
      confidence: review.confidence,
      assessment: review.assessment,
      supportingEvidenceIds: review.supportingEvidence.map((item) => item.evidenceId),
      counterevidenceIds: review.counterevidence.map((item) => item.evidenceId),
      dataGaps: review.dataGaps,
      strongestCounterargument: review.strongestCounterargument,
    }));

const buildDebateSession = (input: {
  report: RunReportAiPipelineInput;
  debateId: string;
  turns: DebateTurn[];
  participantIds: string[];
  redTeamTurn: DebateTurn | null;
  triggerReason: string;
  startedAt: number;
}): DebateSession => {
  const allTurns = input.redTeamTurn ? [...input.turns, input.redTeamTurn] : input.turns;
  const unresolved = [...new Set(allTurns.map((turn) => turn.unresolvedIssue).filter((value): value is string => Boolean(value)))];
  const concessions = allTurns.map((turn) => turn.concession).filter((value): value is string => Boolean(value));

  return {
    debateId: input.debateId,
    reportId: input.report.reportId,
    reportVersion: input.report.reportVersion,
    triggered: true,
    triggerReason: input.triggerReason,
    participantAnalystIds: input.participantIds,
    redTeamAnalystId: input.redTeamTurn ? 'adversarial_research' : null,
    turns: allTurns,
    materialDisagreements: allTurns.map((turn) => turn.claim),
    resolvedDisagreements: concessions,
    unresolvedDisagreements: unresolved,
    summary: unresolved.length
      ? `${unresolved.length} material disagreement(s) remain after debate.`
      : 'Debate completed without a recorded unresolved material issue.',
    startedAt: input.startedAt,
    completedAt: Date.now(),
  };
};

export const runReportAiPipeline = async (
  input: RunReportAiPipelineInput,
): Promise<ReportResearchBundle> => {
  const apiKey = resolveReportOpenAIKey();
  if (!apiKey) throw new Error('OpenAI API key is not configured.');
  if (!(await reportAiBudgetAllowsCall())) throw new Error('AI budget hard cap reached.');

  if (!input.evidence.length) throw new Error('Report research requires at least one supplied Evidence item.');
  if (input.reportVersion < 1) throw new Error('reportVersion must be >= 1.');

  const availableEvidenceDomains = [...new Set(input.evidence.flatMap((item) => item.domains))];
  const plan = planResearchRun({
    reportType: input.reportType,
    availableEvidenceDomains,
    changedEvidenceDomains: input.changedEvidenceDomains,
    requestedAnalystIds: input.requestedAnalystIds,
    materialEvent: input.materialEvent,
    materialGradeChange: input.materialGradeChange,
    highUncertainty: input.highUncertainty,
    maxSpecialists: input.maxSpecialists,
  });
  const knownEvidence = evidenceMap(input.evidence);
  const fastModel = process.env.OPENAI_REPORT_FAST_MODEL?.trim() || DEFAULT_REPORT_FAST_MODEL;
  const deepModel = process.env.OPENAI_REPORT_DEEP_MODEL?.trim() || DEFAULT_REPORT_DEEP_MODEL;

  const analystReviews = await Promise.all(plan.activation.specialists.map(async (analyst) => {
    const result = await callReportStructured<AnalystReviewDraft>({
      apiKey,
      model: fastModel,
      instructions: buildAnalystPrompt(analyst, input.reportType),
      payload: {
        report: {
          reportId: input.reportId,
          version: input.reportVersion,
          reportType: input.reportType,
          subject: input.subject,
          asOf: input.asOf,
          knowledgeCutoff: input.knowledgeCutoff,
          horizonHint: input.horizonHint ?? null,
        },
        marketContext: input.marketContext ?? null,
        evidence: evidenceForAnalyst(analyst, input.evidence),
      },
      schemaName: `bo_report_review_${analyst.analystId}`,
      schema: analystReviewSchema,
      maxOutputTokens: 1800,
      usage: {
        operation: `analyst_review:${analyst.analystId}`,
        reportId: input.reportId,
        analystId: analyst.analystId,
        creditJobId: input.creditJobId ?? null,
        creditActionType: input.creditActionType ?? null,
        market: input.subject.market ?? input.subject.canonicalSymbol ?? null,
        metadata: { reportType: input.reportType, reportVersion: input.reportVersion },
      },
    });
    return toAnalystReview(input, analyst, result.data, knownEvidence);
  }));

  if (!analystReviews.length) {
    throw new Error('Activation Router selected no eligible Specialist Analyst for supplied Evidence.');
  }

  const debateDecision = planPostReviewSynthesis({
    reportType: input.reportType,
    reviews: analystReviews,
    materialEvent: Boolean(input.materialEvent),
    materialGradeChange: Boolean(input.materialGradeChange),
    highUncertainty: Boolean(input.highUncertainty),
    explicitDebateRequest: input.explicitDebateRequest,
  });

  let debate: DebateSession | null = null;
  let debateParticipantIds: string[] = [];
  if (debateDecision.shouldDebate) {
    const debateId = `debate:${input.reportId}:v${input.reportVersion}:${randomUUID()}`;
    const startedAt = Date.now();
    debateParticipantIds = selectDebateParticipants(analystReviews, input.maxDebateParticipants ?? 3);

    const turns = await Promise.all(debateParticipantIds.map(async (analystId, index) => {
      const analyst = reportAnalystById(analystId);
      const ownReview = analystReviews.find((review) => review.analyst.analystId === analystId);
      if (!analyst || !ownReview) throw new Error(`Missing Debate Analyst definition: ${analystId}.`);

      const result = await callReportStructured<DebateTurnDraft>({
        apiKey,
        model: fastModel,
        instructions: buildDebatePrompt(analyst, input.reportType),
        payload: {
          ownReview,
          opposingReviews: otherReviewsForDebate(analystReviews, analystId),
          evidence: compactEvidence(input.evidence),
        },
        schemaName: `bo_report_debate_${analystId}`,
        schema: debateTurnSchema,
        maxOutputTokens: 900,
        usage: {
          operation: `debate_turn:${analystId}`,
          reportId: input.reportId,
          analystId,
          debateId,
          creditJobId: input.creditJobId ?? null,
          creditActionType: input.creditActionType ?? null,
          market: input.subject.market ?? input.subject.canonicalSymbol ?? null,
          metadata: { reportType: input.reportType, reportVersion: input.reportVersion },
        },
      });

      return {
        turnId: `${debateId}:turn:${index + 1}`,
        round: 1,
        sequence: index + 1,
        analystId,
        targetAnalystId: result.data.targetAnalystId ?? null,
        claim: result.data.claim,
        evidenceIds: sanitizeEvidenceIds(result.data.evidenceIds, knownEvidence),
        counterevidenceIds: sanitizeEvidenceIds(result.data.counterevidenceIds, knownEvidence),
        concession: result.data.concession ?? null,
        unresolvedIssue: result.data.unresolvedIssue ?? null,
        createdAt: Date.now(),
      } satisfies DebateTurn;
    }));

    let redTeamTurn: DebateTurn | null = null;
    if (debateDecision.shouldRunRedTeam) {
      const redTeam = reportAnalystById('adversarial_research');
      if (!redTeam) throw new Error('Red Team Analyst is not registered.');
      const result = await callReportStructured<RedTeamDraft>({
        apiKey,
        model: deepModel,
        instructions: buildRedTeamPrompt(input.reportType),
        payload: {
          analystReviews,
          debateTurns: turns,
          evidence: compactEvidence(input.evidence),
        },
        schemaName: 'bo_report_red_team',
        schema: redTeamSchema,
        maxOutputTokens: 1200,
        usage: {
          operation: 'red_team',
          reportId: input.reportId,
          analystId: redTeam.analystId,
          debateId,
          creditJobId: input.creditJobId ?? null,
          creditActionType: input.creditActionType ?? null,
          market: input.subject.market ?? input.subject.canonicalSymbol ?? null,
          metadata: { reportType: input.reportType, reportVersion: input.reportVersion },
        },
      });
      redTeamTurn = {
        turnId: `${debateId}:red-team`,
        round: 1,
        sequence: turns.length + 1,
        analystId: redTeam.analystId,
        targetAnalystId: null,
        claim: result.data.claim,
        evidenceIds: sanitizeEvidenceIds(result.data.evidenceIds, knownEvidence),
        counterevidenceIds: sanitizeEvidenceIds(result.data.counterevidenceIds, knownEvidence),
        concession: null,
        unresolvedIssue: result.data.unresolvedIssue
          ?? [...(result.data.hiddenAssumptions ?? []), ...(result.data.dataGaps ?? [])].join(' | ')
          ?? null,
        createdAt: Date.now(),
      };
    }

    debate = buildDebateSession({
      report: input,
      debateId,
      turns,
      participantIds: debateParticipantIds,
      redTeamTurn,
      triggerReason: debateDecision.reasons.join(' '),
      startedAt,
    });
  }

  const lead = plan.activation.lead;
  const leadResult = await callReportStructured<LeadSynthesisDraft>({
    apiKey,
    model: deepModel,
    instructions: buildLeadPrompt(lead, input.reportType),
    payload: {
      report: {
        reportId: input.reportId,
        version: input.reportVersion,
        reportType: input.reportType,
        subject: input.subject,
        asOf: input.asOf,
        knowledgeCutoff: input.knowledgeCutoff,
        horizonHint: input.horizonHint ?? null,
      },
      marketContext: input.marketContext ?? null,
      analystReviews,
      debate,
      evidence: compactEvidence(input.evidence),
    },
    schemaName: `bo_report_lead_${lead.analystId}`,
    schema: leadSynthesisSchema,
    maxOutputTokens: 2400,
    reasoningEffort: 'medium',
    usage: {
      operation: `lead_synthesis:${lead.analystId}`,
      reportId: input.reportId,
      analystId: lead.analystId,
      debateId: debate?.debateId ?? null,
      creditJobId: input.creditJobId ?? null,
      creditActionType: input.creditActionType ?? null,
      market: input.subject.market ?? input.subject.canonicalSymbol ?? null,
      metadata: { reportType: input.reportType, reportVersion: input.reportVersion },
    },
  });

  const synthesis: DomainLeadSynthesis = {
    synthesisId: `synthesis:${input.reportId}:v${input.reportVersion}:${randomUUID()}`,
    reportId: input.reportId,
    reportVersion: input.reportVersion,
    leadAnalyst: {
      analystId: lead.analystId,
      role: lead.title,
      domain: lead.domain,
      methodVersion: lead.methodVersion,
      promptVersion: lead.promptVersion,
      forecastHorizon: input.horizonHint ?? null,
    },
    asOf: input.asOf,
    grade: leadResult.data.grade,
    confidence: leadResult.data.confidence == null ? null : Math.max(0, Math.min(1, Number(leadResult.data.confidence))),
    oneLineAssessment: leadResult.data.oneLineAssessment,
    thesis: leadResult.data.thesis,
    supportingPoints: leadResult.data.supportingPoints ?? [],
    opposingPoints: leadResult.data.opposingPoints ?? [],
    preservedDissent: leadResult.data.preservedDissent ?? [],
    majorRisks: leadResult.data.majorRisks ?? [],
    invalidationConditions: leadResult.data.invalidationConditions ?? [],
    limitations: leadResult.data.limitations ?? [],
  };

  const actionGuide: GeneralActionGuide = {
    horizon: leadResult.data.actionGuide.horizon,
    attractivenessSummary: leadResult.data.actionGuide.attractivenessSummary,
    approach: leadResult.data.actionGuide.approach,
    approachRationale: leadResult.data.actionGuide.approachRationale ?? [],
    supportResistanceSummary: leadResult.data.actionGuide.supportResistanceSummary,
    risks: leadResult.data.actionGuide.risks ?? [],
    invalidationConditions: leadResult.data.actionGuide.invalidationConditions ?? [],
  };

  const forecast: ReportForecast | null = leadResult.data.forecast.available
    ? {
        forecastId: `forecast:${input.reportId}:v${input.reportVersion}:${randomUUID()}`,
        reportId: input.reportId,
        reportVersion: input.reportVersion,
        publishedAt: input.asOf,
        asOf: input.asOf,
        horizonLabel: leadResult.data.forecast.horizonLabel,
        horizonEndAt: leadResult.data.forecast.horizonEndAt,
        scenarios: leadResult.data.forecast.scenarios ?? [],
        supportZones: leadResult.data.forecast.supportZones ?? [],
        resistanceZones: leadResult.data.forecast.resistanceZones ?? [],
        invalidationConditions: leadResult.data.forecast.invalidationConditions ?? [],
        status: 'ACTIVE',
      }
    : null;

  return {
    reportId: input.reportId,
    reportVersion: input.reportVersion,
    reportType: input.reportType,
    subject: input.subject,
    asOf: input.asOf,
    knowledgeCutoff: input.knowledgeCutoff,
    analystReviews,
    debate,
    synthesis,
    forecast,
    actionGuide,
    trace: {
      selectedAnalystIds: analystReviews.map((review) => review.analyst.analystId),
      debateParticipantIds,
      redTeamUsed: Boolean(debate?.redTeamAnalystId),
      evidenceIds: input.evidence.map((item) => item.evidenceId),
      fastModel,
      deepModel,
    },
  };
};
