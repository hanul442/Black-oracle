export type IntelligenceCategory = string;

export type CycleStage = 
  | 'COLLECTING'
  | 'NORMALIZING'
  | 'DEDUPLICATING'
  | 'VERIFYING'
  | 'EXTRACTING_KEYWORDS'
  | 'EXTRACTING_ENTITIES'
  | 'EXTRACTING_SIGNALS'
  | 'CLUSTERING'
  | 'QUESTIONING'
  | 'HYPOTHESIZING'
  | 'EVIDENCE_MAPPING'
  | 'SCENARIO_UPDATING'
  | 'REPORT_QUEUEING';

export type SourceType = 'news' | 'rss' | 'market' | 'economic' | 'central_bank' | 'supply_chain' | 'commodity' | 'government' | 'report' | 'cyber' | 'manual';
export type SourceStatus = 'LIVE' | 'MOCK' | 'MANUAL' | 'FAILED' | 'STALE';


export type OracleCaseStatus =
  | "case_created"
  | "search_running"
  | "initial_analysis_ready"
  | "evidence_gathering"
  | "evidence_updated"
  | "briefing_revised"
  | "archived";

export type OracleCaseType =
  | "asset_analysis"
  | "sector_analysis"
  | "macro_analysis"
  | "risk_analysis"
  | "commodity_analysis"
  | "theme_analysis"
  | "general_intelligence";

export interface OracleCase {
  id: string;
  title: string;
  query: string;
  caseType: OracleCaseType;
  status: OracleCaseStatus;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  linkedSourceIds: string[];
  linkedSignalIds: string[];
  linkedQuestionIds: string[];
  linkedHypothesisIds: string[];
  linkedScenarioIds: string[];
  linkedReportIds: string[];
  activeNodeId?: string;
  confidence?: number;
  summary?: string;
  isSaved?: boolean;
}


export type EvidenceGatheringTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type EvidenceGatheringTaskType =
  | "market_metrics"
  | "valuation_data"
  | "price_volume_data"
  | "latest_sources"
  | "sector_context"
  | "macro_context"
  | "opposing_evidence"
  | "scenario_triggers"
  | "source_trace";

export interface EvidenceGatheringTask {
  id: string;
  caseId: string;
  type: EvidenceGatheringTaskType;
  label: string;
  status: EvidenceGatheringTaskStatus;
  progress?: number;
  resultSummary?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceGatheringSummary {
  caseId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  progress: number;
  evidenceCount: number;
  supportingCount: number;
  opposingCount: number;
  averageCredibility?: number;
  lastUpdatedAt: string;
}

export interface Source {
  id: string;
  title: string;
  sourceName: string;
  sourceType: SourceType | string;
  status: SourceStatus | string;
  originalUrl: string;
  collectedAt: string;
  publishedAt: string;
  reliability: number;
  language: string;
  region: string;
  category: string;
  summary: string;
  rawTextSnippet: string;
  extractedKeywords: string[];
  extractedEntities: string[];
  linkedSignalIds: string[];
  linkedQuestionIds: string[];
  linkedHypothesisIds: string[];
  linkedScenarioIds: string[];
  evidenceRole: 'supporting' | 'contradicting' | 'neutral' | 'pending' | string;
}

export interface Signal {
  id: string;
  title: string;
  category: string;
  signalStrength: number;
  urgency: number;
  novelty: number;
  sourceIds: string[];
  linkedQuestionIds: string[];
  summary: string;
  detectedAt: string;
}

export interface SignalCluster {
  id: string;
  title: string;
  category: string;
  sourceIds: string[];
  dominantEntities: string[];
  dominantKeywords: string[];
  signalStrength: number;
  corroborationScore: number;
  generatedQuestionIds: string[];
}

export interface Question {
  id: string;
  text: string;
  signalIds: string[];
  hypothesisIds: string[];
}

export interface Hypothesis {
  id: string;
  title: string;
  description: string;
  questionId: string;
  confidence: number;
  evidenceIds: string[];
  scenarioIds: string[];
  status: string;
}

export interface ScenarioBranch {
  id: string;
  hypothesisId: string;
  title: string;
  probability: number;
  impactScore?: number;
  timeFrame?: string;
  feasibility: string;
  triggerCondition: string;
  invalidationCondition: string;
  evidenceIds: string[];
  timeline?: string;
  expectedOutcome: string;
  nextIndicators: string[];
  status: string;
}

export interface Evidence {
  id: string;
  title: string;
  sourceId: string;
  caseId?: string;
  hypothesisId?: string;
  scenarioId?: string;
  evidenceType: 'supporting' | 'contradicting' | 'neutral' | 'pending' | string;
  reliability: number;
  evidenceWeight: number;
  impactScore: number;
  linkedHypothesisId: string;
  linkedScenarioBranchId: string;
  confidenceChange: number;
  probabilityChange: number;
  summary: string;
  role?: string;
  supportsThesis?: boolean;
  contradictsThesis?: boolean;
  confidence?: number;
  credibilityScore?: number;
  relevanceScore?: number;
  createdAt?: string;
}

export interface EvidenceLedgerSummary {
  caseId: string;
  total: number;
  supporting: number;
  opposing: number;
  neutral: number;
  averageConfidence?: number;
  averageCredibility?: number;
  directCaseLinked: number;
  inferredLinked: number;
  lastUpdatedAt?: string;
}

export interface EvidenceLedgerItem {
  evidence: Evidence;
  linkMode: "direct" | "inferred";
  linkedEntityType?: "case" | "source" | "hypothesis" | "scenario";
}


export interface AnalystCouncilPersona {
  role:
    | "Macro Strategist"
    | "Equity Analyst"
    | "Quant Analyst"
    | "Risk Officer"
    | "OSINT Analyst"
    | "Portfolio Manager"
    | "Devil's Advocate";
  stance: string;
  confidence: number;
  bubbleComment: string;
  keyEvidence: string[];
  keyRisk: string;
  viewChangeTrigger: string;
  provisional: boolean;
}

export interface OracleBriefing {
  id: string;
  caseId: string;
  length: "flash" | "field" | "analyst";
  mode: "executive" | "risk" | "quant" | "debate" | "watch_plan";
  title: string;
  summary: string[];
  stance: string;
  confidence?: number;
  keyEvidence: string[];
  opposingEvidence: string[];
  risks: string[];
  watchTriggers: string[];
  generatedAt: string;
  provisional: boolean;
}

export interface PredictionOutcome {
  id: string;
  scenarioId: string;
  statement: string;
  probability: number;
  trend?: 'up' | 'down' | 'stable';
  confidence: number;
  validationCondition: string;
  invalidationCondition: string;
  reviewDate: string;
  status: string;
}

export interface Report {
  id: string;
  type: string;
  title: string;
  date: string;
  topSignalId: string;
  newQuestionId?: string;
  updatedHypothesisId?: string;
  scenarioProbabilityChange?: string;
  keyEvidenceId?: string;
  watchNext?: string;
  content: string;
}

export type NodeType = "source" | "classification" | "bucket" | "scenario" | "risk";

export interface FlowNode {
  id: string;
  label: string;
  type: NodeType;
  level: number;
  description?: string;
  confidence?: number;
  impact?: number;
  recentActivity?: string;
}

export interface FlowEdge {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;
  isHighRisk?: boolean;
}

