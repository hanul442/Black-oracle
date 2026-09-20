import {
  DOMAIN_LEAD_BY_REPORT_TYPE,
  REPORT_ANALYST_REGISTRY,
  reportAnalystById,
  type AnalystCostClass,
  type ReportAnalystDefinition,
} from '../../src/report/analystRegistry';
import type { ReportType } from '../../src/report/contracts';

export const ACTIVATION_ROUTER_VERSION = 1 as const;

export type AnalystActivationRequest = {
  reportType: ReportType;
  availableEvidenceDomains: string[];
  changedEvidenceDomains?: string[];
  requestedAnalystIds?: string[];
  materialEvent?: boolean;
  materialGradeChange?: boolean;
  highUncertainty?: boolean;
  forceRedTeam?: boolean;
  maxSpecialists?: number;
  allowedCostClasses?: AnalystCostClass[];
};

export type AnalystActivationDecision = {
  routerVersion: typeof ACTIVATION_ROUTER_VERSION;
  reportType: ReportType;
  lead: ReportAnalystDefinition;
  specialists: ReportAnalystDefinition[];
  redTeam: ReportAnalystDefinition | null;
  skipped: Array<{ analystId: string; reason: string }>;
  reasons: string[];
};

const DEFAULT_SPECIALISTS: Readonly<Record<ReportType, readonly string[]>> = {
  MARKET: ['technical_structure', 'flow_liquidity', 'macro_cross_asset'],
  INDUSTRY: ['industry_structure', 'macro_cross_asset', 'policy_regulation'],
  SECTOR: ['industry_structure', 'technical_structure', 'flow_liquidity', 'macro_cross_asset'],
  COMPANY: ['fundamental_valuation', 'earnings_expectations', 'industry_structure', 'event_catalyst'],
  SECURITY: ['fundamental_valuation', 'technical_structure', 'flow_liquidity', 'event_catalyst'],
  EVENT: ['event_catalyst', 'fundamental_valuation', 'macro_cross_asset', 'policy_regulation'],
  CRYPTO: ['technical_structure', 'flow_liquidity', 'macro_cross_asset', 'crypto_market_structure'],
};

const intersectionCount = (left: readonly string[], right: Set<string>) =>
  left.reduce((count, item) => count + (right.has(item) ? 1 : 0), 0);

export const selectReportAnalysts = (request: AnalystActivationRequest): AnalystActivationDecision => {
  const lead = reportAnalystById(DOMAIN_LEAD_BY_REPORT_TYPE[request.reportType]);
  if (!lead) throw new Error(`Missing domain lead for report type ${request.reportType}.`);

  const available = new Set(request.availableEvidenceDomains.map((item) => item.trim()).filter(Boolean));
  const changed = new Set((request.changedEvidenceDomains ?? []).map((item) => item.trim()).filter(Boolean));
  const allowedCostClasses = new Set(request.allowedCostClasses ?? ['LIGHT', 'STANDARD', 'HEAVY']);
  const requested = new Set(request.requestedAnalystIds ?? []);
  const defaultRank = new Map(DEFAULT_SPECIALISTS[request.reportType].map((id, index) => [id, index] as const));
  const skipped: AnalystActivationDecision['skipped'] = [];

  const candidateSpecialists = REPORT_ANALYST_REGISTRY
    .filter((analyst) => analyst.analystClass === 'SPECIALIST')
    .filter((analyst) => analyst.supportedReportTypes.includes(request.reportType))
    .map((analyst) => {
      const evidenceMatches = intersectionCount(analyst.evidenceDomains, available);
      const changedMatches = intersectionCount(analyst.evidenceDomains, changed);
      const isRequested = requested.has(analyst.analystId);
      const defaultOrder = defaultRank.get(analyst.analystId);
      const defaultBonus = defaultOrder == null ? 0 : Math.max(1, 10 - defaultOrder);
      const score = evidenceMatches * 10 + changedMatches * 15 + defaultBonus + (isRequested ? 100 : 0);
      return { analyst, score, evidenceMatches, changedMatches, isRequested };
    })
    .sort((a, b) => b.score - a.score || a.analyst.analystId.localeCompare(b.analyst.analystId));

  const eligible = candidateSpecialists.filter((candidate) => {
    if (!allowedCostClasses.has(candidate.analyst.costClass)) {
      skipped.push({ analystId: candidate.analyst.analystId, reason: `Cost class ${candidate.analyst.costClass} is not allowed for this run.` });
      return false;
    }
    if (!candidate.isRequested && candidate.evidenceMatches === 0) {
      skipped.push({ analystId: candidate.analyst.analystId, reason: 'No relevant evidence domain is available.' });
      return false;
    }
    return true;
  });

  const maxSpecialists = Math.max(1, Math.min(8, Math.trunc(request.maxSpecialists ?? 5)));
  const specialists = eligible.slice(0, maxSpecialists).map((candidate) => candidate.analyst);

  for (const candidate of eligible.slice(maxSpecialists)) {
    skipped.push({ analystId: candidate.analyst.analystId, reason: `Excluded by maxSpecialists=${maxSpecialists} cost-control limit.` });
  }

  const redTeamRequested = Boolean(
    request.forceRedTeam
    || request.materialEvent
    || request.materialGradeChange
    || request.highUncertainty,
  );
  const redTeam = redTeamRequested ? reportAnalystById('adversarial_research') : null;

  return {
    routerVersion: ACTIVATION_ROUTER_VERSION,
    reportType: request.reportType,
    lead,
    specialists,
    redTeam,
    skipped,
    reasons: [
      'The Domain Lead is always selected for synthesis.',
      `Selected ${specialists.length} specialist(s) from available/changed evidence domains.`,
      redTeam
        ? 'Red Team selected because the request contains a material-change or uncertainty trigger.'
        : 'Red Team skipped because no material-change/uncertainty trigger requires it.',
    ],
  };
};
