import type { ReportVersion } from '../../src/report/contracts';
import type { ReportResearchBundle } from './reportAiPipeline';
import {
  appendAnalystReview,
  appendDebateSession,
  appendForecast,
  appendLeadSynthesis,
  appendReportVersion,
} from './reportStore';

export const REPORT_PUBLICATION_VERSION = 1 as const;

export const buildPublishedReportVersion = (input: {
  bundle: ReportResearchBundle;
  publishedAt?: number;
  evidenceCutoff?: number;
  corrected?: boolean;
  correctionReason?: string | null;
  supersedesReportVersionId?: string | null;
}): ReportVersion => {
  const publishedAt = input.publishedAt ?? Date.now();
  const bundle = input.bundle;

  return {
    contractVersion: 1,
    reportId: bundle.reportId,
    version: bundle.reportVersion,
    reportType: bundle.reportType,
    status: input.corrected ? 'CORRECTED' : 'PUBLISHED',
    subject: bundle.subject,
    asOf: bundle.asOf,
    evidenceCutoff: input.evidenceCutoff ?? bundle.knowledgeCutoff,
    createdAt: publishedAt,
    publishedAt,
    correctedAt: input.corrected ? publishedAt : null,
    supersedesReportVersionId: input.supersedesReportVersionId ?? null,
    correctionReason: input.corrected ? input.correctionReason ?? 'Explicit correction.' : null,
    grade: bundle.synthesis.grade,
    confidence: bundle.synthesis.confidence,
    oneLineAssessment: bundle.synthesis.oneLineAssessment,
    executiveSummary: bundle.synthesis.executiveSummary,
    sectionKeys: [
      'EXECUTIVE_SUMMARY',
      'ANALYST_VIEWS',
      ...(bundle.debate ? ['DEBATE'] : []),
      'LEAD_SYNTHESIS',
      ...(bundle.forecast ? ['FORECAST'] : []),
      'ACTION_GUIDE',
    ],
    evidenceIds: bundle.trace.evidenceIds,
    analystReviewIds: bundle.analystReviews.map((review) => review.reviewId),
    debateId: bundle.debate?.debateId ?? null,
    leadSynthesisId: bundle.synthesis.synthesisId,
    forecastId: bundle.forecast?.forecastId ?? null,
    generalActionGuide: bundle.actionGuide,
    limitations: bundle.synthesis.limitations,
  };
};

export const publishResearchBundleShadow = async (input: {
  bundle: ReportResearchBundle;
  publishedAt?: number;
  evidenceCutoff?: number;
}) => {
  const report = buildPublishedReportVersion(input);

  // Append child artifacts first. The Report row is written last and acts as the
  // publication commit marker for read models.
  for (const review of input.bundle.analystReviews) {
    await appendAnalystReview(review);
  }
  if (input.bundle.debate) await appendDebateSession(input.bundle.debate);
  await appendLeadSynthesis(input.bundle.synthesis);
  if (input.bundle.forecast) {
    await appendForecast({
      ...input.bundle.forecast,
      publishedAt: report.publishedAt,
    });
  }
  await appendReportVersion(report);

  return report;
};
