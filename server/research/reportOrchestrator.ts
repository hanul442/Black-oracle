import type { AnalystReview, ReportType } from '../../src/report/contracts';
import { selectReportAnalysts, type AnalystActivationDecision } from './activationRouter';
import { decideDebatePolicy, type DebatePolicyDecision } from './reportPolicy';

export const REPORT_ORCHESTRATOR_VERSION = 1 as const;

export type ResearchRunPlanInput = {
  reportType: ReportType;
  availableEvidenceDomains: string[];
  changedEvidenceDomains?: string[];
  requestedAnalystIds?: string[];
  materialEvent?: boolean;
  materialGradeChange?: boolean;
  highUncertainty?: boolean;
  maxSpecialists?: number;
};

export type ResearchRunPlan = {
  orchestratorVersion: typeof REPORT_ORCHESTRATOR_VERSION;
  activation: AnalystActivationDecision;
  expectedSpecialistCalls: number;
  expectedLeadCalls: 1;
  redTeamPreselected: boolean;
};

export const planResearchRun = (input: ResearchRunPlanInput): ResearchRunPlan => {
  const activation = selectReportAnalysts({
    reportType: input.reportType,
    availableEvidenceDomains: input.availableEvidenceDomains,
    changedEvidenceDomains: input.changedEvidenceDomains,
    requestedAnalystIds: input.requestedAnalystIds,
    materialEvent: input.materialEvent,
    materialGradeChange: input.materialGradeChange,
    highUncertainty: input.highUncertainty,
    maxSpecialists: input.maxSpecialists,
  });

  return {
    orchestratorVersion: REPORT_ORCHESTRATOR_VERSION,
    activation,
    expectedSpecialistCalls: activation.specialists.length,
    expectedLeadCalls: 1,
    redTeamPreselected: Boolean(activation.redTeam),
  };
};

export const planPostReviewSynthesis = (input: {
  reportType: ReportType;
  reviews: AnalystReview[];
  materialEvent: boolean;
  materialGradeChange: boolean;
  highUncertainty: boolean;
  explicitDebateRequest?: boolean;
}): DebatePolicyDecision =>
  decideDebatePolicy(input);
