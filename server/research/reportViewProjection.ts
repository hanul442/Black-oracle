import type { PlanTier } from '../../src/commercial/creditContracts';
import type {
  AnalystReview,
  DebateSession,
  DomainLeadSynthesis,
  ReportForecast,
  ReportVersion,
} from '../../src/report/contracts';
import { hasEntitlement } from '../commercial/entitlements';

export type PublishedReportArtifacts = {
  report: ReportVersion;
  analystReviews: AnalystReview[];
  debate: DebateSession | null;
  synthesis: DomainLeadSynthesis | null;
  forecast: ReportForecast | null;
};

const debatePreview = (debate: DebateSession | null) => {
  const first = debate?.turns?.[0];
  if (!first) return null;
  return {
    analystId: first.analystId,
    claim: first.claim.slice(0, 360),
    hasMore: debate!.turns.length > 1 || Boolean(debate!.redTeamAnalystId),
  };
};

export const projectPublishedReportForPlan = (
  artifacts: PublishedReportArtifacts,
  plan: PlanTier,
) => {
  const report = artifacts.report;
  const base = {
    reportId: report.reportId,
    version: report.version,
    reportType: report.reportType,
    subject: report.subject,
    publishedAt: report.publishedAt,
    grade: report.grade,
    confidence: report.confidence,
    oneLineAssessment: report.oneLineAssessment,
    availableSections: report.sectionKeys,
    debatePreview: debatePreview(artifacts.debate),
    paywall: {
      fullDebate: !hasEntitlement(plan, 'VIEW_FULL_DEBATE'),
      fullReport: !hasEntitlement(plan, 'VIEW_FULL_REPORT'),
      evidenceDetail: !hasEntitlement(plan, 'VIEW_EVIDENCE_DETAIL'),
      forecast: !hasEntitlement(plan, 'VIEW_FORECAST'),
    },
  };

  if (plan === 'CORE') return base;

  const plusView = {
    ...base,
    debate: hasEntitlement(plan, 'VIEW_FULL_DEBATE') ? artifacts.debate : null,
    leadConclusion: hasEntitlement(plan, 'VIEW_LEAD_CONCLUSION') && artifacts.synthesis
      ? {
          analyst: artifacts.synthesis.leadAnalyst,
          oneLineAssessment: artifacts.synthesis.oneLineAssessment,
          thesis: artifacts.synthesis.thesis,
          confidence: artifacts.synthesis.confidence,
          preservedDissent: artifacts.synthesis.preservedDissent,
        }
      : null,
  };

  if (!hasEntitlement(plan, 'VIEW_FULL_REPORT')) return plusView;

  return {
    ...plusView,
    fullReport: {
      executiveSummary: report.executiveSummary,
      analystReviews: artifacts.analystReviews,
      synthesis: artifacts.synthesis,
      generalActionGuide: report.generalActionGuide ?? null,
      limitations: report.limitations,
    },
    forecast: hasEntitlement(plan, 'VIEW_FORECAST') ? artifacts.forecast : null,
  };
};
