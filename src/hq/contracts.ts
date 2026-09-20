export type HqAgentStatus =
  | 'IDLE'
  | 'COLLECTING'
  | 'RESEARCHING'
  | 'WRITING_REPORT'
  | 'ESCALATING'
  | 'IN_COMMITTEE'
  | 'RED_TEAM_REVIEW'
  | 'RISK_REVIEW'
  | 'WAITING_APPROVAL'
  | 'EXECUTING'
  | 'MONITORING_POSITION'
  | 'AUDITING'
  | 'BLOCKED'
  | 'ERROR';

export type HqTeamLifecycle =
  | 'INCUBATION'
  | 'SANDBOX'
  | 'PAPER'
  | 'CHALLENGER'
  | 'CHAMPION'
  | 'PROBATION'
  | 'RESTRUCTURE'
  | 'MERGE'
  | 'RETIRE';

export type HqDepartmentId =
  | 'executive'
  | 'intelligence'
  | 'research'
  | 'specialist'
  | 'investment'
  | 'control'
  | 'trading';

export type HqRoomId =
  | 'exec-ceo'
  | 'exec-cio'
  | 'exec-cro'
  | 'exec-coo'
  | 'exec-investment-committee'
  | 'intel-market-news'
  | 'intel-macro'
  | 'intel-filings'
  | 'intel-sentiment'
  | 'intel-data-watch'
  | 'intel-alt-data'
  | 'research-synthesis'
  | 'research-evidence-ledger'
  | 'research-library'
  | 'research-knowledge-graph'
  | 'research-report-production'
  | 'research-thesis'
  | 'specialist-macro'
  | 'specialist-fundamental'
  | 'specialist-quant'
  | 'specialist-technical'
  | 'specialist-sentiment'
  | 'specialist-sector'
  | 'specialist-portfolio'
  | 'specialist-execution'
  | 'pod-kr-equity'
  | 'pod-us-equity'
  | 'pod-crypto'
  | 'pod-macro'
  | 'pod-event-driven'
  | 'pod-multi-asset'
  | 'pod-incubator'
  | 'control-red-team'
  | 'control-risk'
  | 'control-audit'
  | 'control-model-validation'
  | 'control-data-integrity'
  | 'control-performance'
  | 'trading-execution'
  | 'trading-position-monitor'
  | 'trading-order-queue'
  | 'trading-portfolio-wall';

export type HqSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export type HqNavigationTarget =
  | { kind: 'CURRENT_VIEW'; view: 'command' | 'markets' | 'oracle' | 'trade' | 'lab' | 'system' }
  | { kind: 'INSTRUMENT'; market: string }
  | { kind: 'DECISION_REPLAY'; traceId: string; runtimeId?: string | null }
  | { kind: 'TRADE'; tradeId?: string | null; market?: string | null }
  | { kind: 'REPORT'; reportId?: string | null; status: 'PLANNED' | 'AVAILABLE' }
  | { kind: 'EVENT'; eventId: string };

export type HqProjectedEvent = {
  id: string;
  occurredAt: number;
  sourceEventId: string;
  sourceEventType: string;
  sourceEventName: string;
  severity: HqSeverity;
  agentStatus: HqAgentStatus;
  departmentId: HqDepartmentId;
  roomId: HqRoomId;
  market: string | null;
  traceId: string | null;
  summary: string;
  navigation: HqNavigationTarget;
};

export type HqAgentDefinition = {
  id: string;
  name: string;
  role: string;
  departmentId: HqDepartmentId;
  defaultRoomId: HqRoomId;
  teamId?: string | null;
  mvpVisible?: boolean;
};

export type HqTeamDefinition = {
  id: string;
  name: string;
  mandate: string;
  defaultRoomId: HqRoomId;
  targetLifecycle: HqTeamLifecycle;
  currentRuntimeSupport: 'ACTIVE' | 'PARTIAL' | 'PLANNED';
};

export type HqRoomDefinition = {
  id: HqRoomId;
  name: string;
  departmentId: HqDepartmentId;
  financialBridge?: 'REPORT' | 'AUTOTRADE' | 'POSITION' | 'DECISION_REPLAY' | 'RISK' | 'LAB' | null;
};

export type CanonicalHqEventLike = {
  id: string;
  occurredAt: number;
  runtimeId?: string | null;
  eventType: string;
  eventName: string;
  market?: string | null;
  summary?: string | null;
  reason?: string | null;
  severity?: string | null;
  trace?: Record<string, unknown> | null;
  links?: Record<string, unknown> | null;
};
