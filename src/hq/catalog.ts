import type { HqAgentDefinition, HqRoomDefinition, HqTeamDefinition } from './contracts';

export const HQ_ROOMS: HqRoomDefinition[] = [
  { id: 'exec-ceo', name: 'CEO Office', departmentId: 'executive' },
  { id: 'exec-cio', name: 'CIO Office', departmentId: 'executive', financialBridge: 'AUTOTRADE' },
  { id: 'exec-cro', name: 'CRO Office', departmentId: 'executive', financialBridge: 'RISK' },
  { id: 'exec-coo', name: 'COO Office', departmentId: 'executive' },
  { id: 'exec-investment-committee', name: 'Investment Committee', departmentId: 'executive', financialBridge: 'DECISION_REPLAY' },

  { id: 'intel-market-news', name: 'Market News Desk', departmentId: 'intelligence' },
  { id: 'intel-macro', name: 'Macro Intelligence', departmentId: 'intelligence' },
  { id: 'intel-filings', name: 'Filings & Official Data', departmentId: 'intelligence' },
  { id: 'intel-sentiment', name: 'Sentiment Desk', departmentId: 'intelligence' },
  { id: 'intel-data-watch', name: 'Data Watch', departmentId: 'intelligence' },
  { id: 'intel-alt-data', name: 'Alternative Data', departmentId: 'intelligence' },

  { id: 'research-synthesis', name: 'Research Synthesis', departmentId: 'research' },
  { id: 'research-evidence-ledger', name: 'Evidence Ledger', departmentId: 'research' },
  { id: 'research-library', name: 'Research Library', departmentId: 'research' },
  { id: 'research-knowledge-graph', name: 'Knowledge Graph', departmentId: 'research' },
  { id: 'research-report-production', name: 'Report Production', departmentId: 'research', financialBridge: 'REPORT' },
  { id: 'research-thesis', name: 'Thesis Desk', departmentId: 'research' },

  { id: 'specialist-macro', name: 'Macro Specialist', departmentId: 'specialist' },
  { id: 'specialist-fundamental', name: 'Fundamental Specialist', departmentId: 'specialist' },
  { id: 'specialist-quant', name: 'Quant Specialist', departmentId: 'specialist', financialBridge: 'LAB' },
  { id: 'specialist-technical', name: 'Technical Specialist', departmentId: 'specialist' },
  { id: 'specialist-sentiment', name: 'Sentiment Specialist', departmentId: 'specialist' },
  { id: 'specialist-sector', name: 'Sector Specialist', departmentId: 'specialist' },
  { id: 'specialist-portfolio', name: 'Portfolio Specialist', departmentId: 'specialist', financialBridge: 'AUTOTRADE' },
  { id: 'specialist-execution', name: 'Execution Specialist', departmentId: 'specialist', financialBridge: 'AUTOTRADE' },

  { id: 'pod-kr-equity', name: 'KR Equity Pod', departmentId: 'investment', financialBridge: 'AUTOTRADE' },
  { id: 'pod-us-equity', name: 'US Equity Pod', departmentId: 'investment', financialBridge: 'AUTOTRADE' },
  { id: 'pod-crypto', name: 'Crypto Pod', departmentId: 'investment', financialBridge: 'AUTOTRADE' },
  { id: 'pod-macro', name: 'Macro Pod', departmentId: 'investment', financialBridge: 'AUTOTRADE' },
  { id: 'pod-event-driven', name: 'Event Driven Pod', departmentId: 'investment', financialBridge: 'AUTOTRADE' },
  { id: 'pod-multi-asset', name: 'Multi-Asset Pod', departmentId: 'investment', financialBridge: 'AUTOTRADE' },
  { id: 'pod-incubator', name: 'Incubator Pod', departmentId: 'investment', financialBridge: 'LAB' },

  { id: 'control-red-team', name: 'Red Team War Room', departmentId: 'control', financialBridge: 'DECISION_REPLAY' },
  { id: 'control-risk', name: 'Risk Control', departmentId: 'control', financialBridge: 'RISK' },
  { id: 'control-audit', name: 'Audit & Evaluation', departmentId: 'control', financialBridge: 'DECISION_REPLAY' },
  { id: 'control-model-validation', name: 'Model Validation', departmentId: 'control', financialBridge: 'LAB' },
  { id: 'control-data-integrity', name: 'Data Integrity', departmentId: 'control' },
  { id: 'control-performance', name: 'Performance Attribution', departmentId: 'control', financialBridge: 'AUTOTRADE' },

  { id: 'trading-execution', name: 'Execution Desk', departmentId: 'trading', financialBridge: 'AUTOTRADE' },
  { id: 'trading-position-monitor', name: 'Position Monitor', departmentId: 'trading', financialBridge: 'POSITION' },
  { id: 'trading-order-queue', name: 'Order Queue', departmentId: 'trading', financialBridge: 'AUTOTRADE' },
  { id: 'trading-portfolio-wall', name: 'Portfolio Wall', departmentId: 'trading', financialBridge: 'AUTOTRADE' },
];

export const HQ_TEAMS: HqTeamDefinition[] = [
  { id: 'pod.kr-equity', name: 'KR Equity', mandate: 'Korean listed equities', defaultRoomId: 'pod-kr-equity', targetLifecycle: 'PAPER', currentRuntimeSupport: 'ACTIVE' },
  { id: 'pod.us-equity', name: 'US Equity', mandate: 'US listed equities', defaultRoomId: 'pod-us-equity', targetLifecycle: 'INCUBATION', currentRuntimeSupport: 'PLANNED' },
  { id: 'pod.crypto', name: 'Crypto', mandate: 'Supported crypto assets', defaultRoomId: 'pod-crypto', targetLifecycle: 'PAPER', currentRuntimeSupport: 'ACTIVE' },
  { id: 'pod.macro', name: 'Macro', mandate: 'Macro and cross-asset theses', defaultRoomId: 'pod-macro', targetLifecycle: 'SANDBOX', currentRuntimeSupport: 'PARTIAL' },
  { id: 'pod.event-driven', name: 'Event Driven', mandate: 'Event and catalyst strategies', defaultRoomId: 'pod-event-driven', targetLifecycle: 'SANDBOX', currentRuntimeSupport: 'PARTIAL' },
  { id: 'pod.multi-asset', name: 'Multi-Asset', mandate: 'Cross-asset portfolio construction', defaultRoomId: 'pod-multi-asset', targetLifecycle: 'INCUBATION', currentRuntimeSupport: 'PARTIAL' },
  { id: 'pod.incubator', name: 'Incubator', mandate: 'New strategy and team experiments', defaultRoomId: 'pod-incubator', targetLifecycle: 'INCUBATION', currentRuntimeSupport: 'ACTIVE' },
];

export const HQ_AGENTS: HqAgentDefinition[] = [
  { id: 'exec.ceo', name: 'CEO', role: 'Firm objective and organization authority', departmentId: 'executive', defaultRoomId: 'exec-ceo', mvpVisible: true },
  { id: 'exec.cio', name: 'CIO', role: 'Capital allocation and investment authority', departmentId: 'executive', defaultRoomId: 'exec-cio', mvpVisible: true },
  { id: 'exec.cro', name: 'CRO', role: 'Independent risk authority', departmentId: 'executive', defaultRoomId: 'exec-cro', mvpVisible: true },
  { id: 'exec.coo', name: 'COO', role: 'Runtime operations and workflow health', departmentId: 'executive', defaultRoomId: 'exec-coo' },

  { id: 'intel.market-news', name: 'Market News Agent', role: 'Market news collection', departmentId: 'intelligence', defaultRoomId: 'intel-market-news', mvpVisible: true },
  { id: 'intel.macro-news', name: 'Macro News Agent', role: 'Macro and policy intelligence', departmentId: 'intelligence', defaultRoomId: 'intel-macro' },
  { id: 'intel.filings', name: 'Filings Agent', role: 'Filings and official data collection', departmentId: 'intelligence', defaultRoomId: 'intel-filings', mvpVisible: true },
  { id: 'intel.sentiment', name: 'Sentiment Collector', role: 'Point-in-time sentiment collection', departmentId: 'intelligence', defaultRoomId: 'intel-sentiment' },
  { id: 'intel.data-watch', name: 'Data Watch Agent', role: 'Freshness and source monitoring', departmentId: 'intelligence', defaultRoomId: 'intel-data-watch', mvpVisible: true },
  { id: 'intel.alt-data', name: 'Alternative Data Agent', role: 'Alternative data collection', departmentId: 'intelligence', defaultRoomId: 'intel-alt-data' },

  { id: 'research.synth', name: 'Research Synthesizer', role: 'Evidence synthesis', departmentId: 'research', defaultRoomId: 'research-synthesis', mvpVisible: true },
  { id: 'research.evidence', name: 'Evidence Ledger Agent', role: 'Evidence provenance and contradiction tracking', departmentId: 'research', defaultRoomId: 'research-evidence-ledger', mvpVisible: true },
  { id: 'research.librarian', name: 'Research Librarian', role: 'Research memory and retrieval', departmentId: 'research', defaultRoomId: 'research-library' },
  { id: 'research.graph', name: 'Knowledge Graph Agent', role: 'Entity and relationship linking', departmentId: 'research', defaultRoomId: 'research-knowledge-graph' },
  { id: 'research.report', name: 'Report Editor', role: 'Versioned report production', departmentId: 'research', defaultRoomId: 'research-report-production', mvpVisible: true },
  { id: 'research.thesis', name: 'Thesis Writer', role: 'Investment thesis construction', departmentId: 'research', defaultRoomId: 'research-thesis' },

  { id: 'specialist.macro', name: 'Macro Specialist', role: 'Macro regime analysis', departmentId: 'specialist', defaultRoomId: 'specialist-macro' },
  { id: 'specialist.fundamental', name: 'Fundamental Specialist', role: 'Company and valuation analysis', departmentId: 'specialist', defaultRoomId: 'specialist-fundamental', mvpVisible: true },
  { id: 'specialist.quant', name: 'Quant Specialist', role: 'Quantitative signals and validation', departmentId: 'specialist', defaultRoomId: 'specialist-quant', mvpVisible: true },
  { id: 'specialist.technical', name: 'Technical Specialist', role: 'Technical and market-structure analysis', departmentId: 'specialist', defaultRoomId: 'specialist-technical' },
  { id: 'specialist.sentiment', name: 'Sentiment Specialist', role: 'Sentiment interpretation', departmentId: 'specialist', defaultRoomId: 'specialist-sentiment' },
  { id: 'specialist.sector', name: 'Sector Specialist', role: 'Sector-relative analysis', departmentId: 'specialist', defaultRoomId: 'specialist-sector' },
  { id: 'specialist.portfolio', name: 'Portfolio Specialist', role: 'Portfolio construction', departmentId: 'specialist', defaultRoomId: 'specialist-portfolio' },
  { id: 'specialist.execution', name: 'Execution Specialist', role: 'Execution quality and cost analysis', departmentId: 'specialist', defaultRoomId: 'specialist-execution' },

  { id: 'control.red-team', name: 'Director of Adversarial Research', role: 'Independent thesis challenge', departmentId: 'control', defaultRoomId: 'control-red-team', mvpVisible: true },
  { id: 'control.overfit', name: 'Overfitting Hunter', role: 'Research overfit and multiple-testing challenge', departmentId: 'control', defaultRoomId: 'control-model-validation' },
  { id: 'control.data-integrity', name: 'Data Integrity Challenger', role: 'Leakage and timestamp integrity', departmentId: 'control', defaultRoomId: 'control-data-integrity', mvpVisible: true },
  { id: 'control.scenario', name: 'Scenario Attack Agent', role: 'Adverse scenario challenge', departmentId: 'control', defaultRoomId: 'control-red-team' },
  { id: 'control.audit', name: 'Audit Agent', role: 'Decision and outcome audit', departmentId: 'control', defaultRoomId: 'control-audit' },
  { id: 'control.performance', name: 'Performance Judge', role: 'Team scorecard and attribution', departmentId: 'control', defaultRoomId: 'control-performance', mvpVisible: true },

  { id: 'trading.trader', name: 'Trader Agent', role: 'Paper order execution', departmentId: 'trading', defaultRoomId: 'trading-execution', mvpVisible: true },
  { id: 'trading.order-watch', name: 'Order Watch Agent', role: 'Order state monitoring', departmentId: 'trading', defaultRoomId: 'trading-order-queue' },
  { id: 'trading.position-watch', name: 'Position Monitor Agent', role: 'Position and protection monitoring', departmentId: 'trading', defaultRoomId: 'trading-position-monitor', mvpVisible: true },
  { id: 'trading.attribution', name: 'Trade Attribution Agent', role: 'Trade outcome attribution', departmentId: 'trading', defaultRoomId: 'trading-portfolio-wall' },

  { id: 'pm.kr-equity', name: 'KR Equity PM', role: 'KR Equity pod lead', departmentId: 'investment', defaultRoomId: 'pod-kr-equity', teamId: 'pod.kr-equity', mvpVisible: true },
  { id: 'pm.us-equity', name: 'US Equity PM', role: 'US Equity pod lead', departmentId: 'investment', defaultRoomId: 'pod-us-equity', teamId: 'pod.us-equity' },
  { id: 'pm.crypto', name: 'Crypto PM', role: 'Crypto pod lead', departmentId: 'investment', defaultRoomId: 'pod-crypto', teamId: 'pod.crypto', mvpVisible: true },
  { id: 'pm.macro', name: 'Macro PM', role: 'Macro pod lead', departmentId: 'investment', defaultRoomId: 'pod-macro', teamId: 'pod.macro' },
  { id: 'pm.event-driven', name: 'Event Driven PM', role: 'Event-driven pod lead', departmentId: 'investment', defaultRoomId: 'pod-event-driven', teamId: 'pod.event-driven' },
  { id: 'pm.multi-asset', name: 'Multi-Asset PM', role: 'Multi-asset pod lead', departmentId: 'investment', defaultRoomId: 'pod-multi-asset', teamId: 'pod.multi-asset' },
  { id: 'pm.incubator', name: 'Incubator PM', role: 'Experimental strategy pod lead', departmentId: 'investment', defaultRoomId: 'pod-incubator', teamId: 'pod.incubator' },
];
