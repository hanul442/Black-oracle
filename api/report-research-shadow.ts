import { REPORT_TYPES, type ReportType } from '../src/report/contracts';
import { runReportAiPipeline, type ReportEvidencePacket } from '../server/research/reportAiPipeline';
import { publishResearchBundleShadow } from '../server/research/reportPublication';

const json = (response: any, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

const isAuthorizedInternalCall = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return false;
  const presented = authorization.slice('Bearer '.length).trim();
  const accepted = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return Boolean(presented && accepted.includes(presented));
};

const validReportType = (value: unknown): value is ReportType =>
  typeof value === 'string' && (REPORT_TYPES as readonly string[]).includes(value);

const boundedText = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const finiteNumber = (value: unknown, fallback: number | null = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeEvidence = (raw: unknown): ReportEvidencePacket[] => {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 80).flatMap((item: any) => {
    const evidenceId = boundedText(item?.evidenceId ?? item?.id, 200);
    const summary = boundedText(item?.summary, 1800);
    if (!evidenceId || !summary) return [];

    const evidenceClass = String(item?.evidenceClass ?? item?.evidenceType ?? 'FACT').toUpperCase();
    const allowedClass = ['FACT', 'RESEARCH', 'SIGNAL', 'SENTIMENT', 'INFERENCE', 'COUNTEREVIDENCE', 'DATA_GAP'].includes(evidenceClass)
      ? evidenceClass
      : 'FACT';

    return [{
      evidenceId,
      evidenceClass: allowedClass as ReportEvidencePacket['evidenceClass'],
      title: boundedText(item?.title, 500) || null,
      source: boundedText(item?.source, 500) || null,
      observedAt: finiteNumber(item?.observedAt),
      publishedAt: finiteNumber(item?.publishedAt),
      freshness: ['CURRENT', 'DELAYED', 'STALE', 'UNKNOWN'].includes(String(item?.freshness).toUpperCase())
        ? String(item.freshness).toUpperCase() as ReportEvidencePacket['freshness']
        : 'UNKNOWN',
      provenanceUrl: boundedText(item?.provenanceUrl, 1200) || null,
      summary,
      domains: Array.isArray(item?.domains)
        ? item.domains.map((value: unknown) => boundedText(value, 80)).filter(Boolean).slice(0, 12)
        : [],
      reliability: finiteNumber(item?.reliability),
      payload: null,
    }];
  });
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }
  if (!isAuthorizedInternalCall(request.headers.authorization)) {
    return json(response, 401, { success: false, error: 'Unauthorized internal invocation.' });
  }

  const body = request.body && typeof request.body === 'object' ? request.body : {};
  if (!validReportType(body.reportType)) {
    return json(response, 400, { success: false, error: 'Valid reportType is required.' });
  }

  const reportId = boundedText(body.reportId, 300);
  const subjectId = boundedText(body.subject?.subjectId, 300);
  const displayName = boundedText(body.subject?.displayName, 300);
  if (!reportId || !subjectId || !displayName) {
    return json(response, 400, { success: false, error: 'reportId and subject identity are required.' });
  }

  const evidence = normalizeEvidence(body.evidence);
  if (!evidence.length) {
    return json(response, 400, { success: false, error: 'At least one Evidence item with id and summary is required.' });
  }

  const reportVersion = Math.max(1, Math.trunc(Number(body.reportVersion ?? 1)));
  const asOf = finiteNumber(body.asOf, Date.now())!;
  const knowledgeCutoff = finiteNumber(body.knowledgeCutoff, asOf)!;
  const publishRequested = body.publishShadow === true;
  const publishingEnabled = process.env.BLACK_ORACLE_REPORT_SHADOW_PUBLISH === '1';

  try {
    const bundle = await runReportAiPipeline({
      reportId,
      reportVersion,
      reportType: body.reportType,
      subject: {
        subjectId,
        subjectType: String(body.subject?.subjectType ?? body.reportType) as any,
        canonicalSymbol: boundedText(body.subject?.canonicalSymbol, 120) || null,
        displayName,
        market: boundedText(body.subject?.market, 120) || null,
        assetClass: boundedText(body.subject?.assetClass, 80) || null,
      },
      asOf,
      knowledgeCutoff,
      evidence,
      changedEvidenceDomains: Array.isArray(body.changedEvidenceDomains)
        ? body.changedEvidenceDomains.map((value: unknown) => boundedText(value, 80)).filter(Boolean).slice(0, 30)
        : [],
      requestedAnalystIds: Array.isArray(body.requestedAnalystIds)
        ? body.requestedAnalystIds.map((value: unknown) => boundedText(value, 120)).filter(Boolean).slice(0, 12)
        : [],
      materialEvent: body.materialEvent === true,
      materialGradeChange: body.materialGradeChange === true,
      highUncertainty: body.highUncertainty === true,
      explicitDebateRequest: body.explicitDebateRequest === true,
      maxSpecialists: Math.max(1, Math.min(8, Math.trunc(Number(body.maxSpecialists ?? 5)))),
      maxDebateParticipants: Math.max(2, Math.min(4, Math.trunc(Number(body.maxDebateParticipants ?? 3)))),
      horizonHint: boundedText(body.horizonHint, 80) || null,
      marketContext: body.marketContext && typeof body.marketContext === 'object' ? body.marketContext : null,
      creditJobId: boundedText(body.creditJobId, 200) || null,
      creditActionType: body.creditActionType ?? null,
    });

    let publishedReport = null;
    if (publishRequested) {
      if (!publishingEnabled) {
        return json(response, 409, {
          success: false,
          error: 'Shadow publication is disabled. Set BLACK_ORACLE_REPORT_SHADOW_PUBLISH=1 only in an approved shadow environment.',
          researchCompleted: true,
          bundle,
        });
      }
      publishedReport = await publishResearchBundleShadow({ bundle, publishedAt: Date.now() });
    }

    return json(response, 200, {
      success: true,
      mode: publishRequested ? 'SHADOW_PUBLISHED' : 'SHADOW_RESEARCH_ONLY',
      executionAuthority: false,
      billingAuthority: false,
      published: Boolean(publishedReport),
      report: publishedReport,
      bundle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown report research failure.';
    return json(response, 500, {
      success: false,
      mode: 'SHADOW_RESEARCH_ONLY',
      executionAuthority: false,
      billingAuthority: false,
      error: message,
    });
  }
}
