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

