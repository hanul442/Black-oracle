import { NodeType, FlowNode, FlowEdge } from '../types';

export const mockNodes: FlowNode[] = [
  // Level 0: Sources
  { id: 'src-1', label: 'DARK WEB CRAWLER', type: 'source', level: 0 },
  { id: 'src-2', label: 'GEO-SATELLITE INTERCEPT', type: 'source', level: 0 },
  { id: 'src-3', label: 'GLOBAL FINANCIAL TX', type: 'source', level: 0 },
  { id: 'src-4', label: 'SOCIAL OSINT', type: 'source', level: 0 },
  { id: 'src-5', label: 'COMMERCIAL DB', type: 'source', level: 0 },
  { id: 'src-6', label: 'DEEP PACKET INSPECT', type: 'source', level: 0 },

  // Level 1: Classification
  { id: 'cls-1', label: 'THREAT INTEL', type: 'classification', level: 1 },
  { id: 'cls-2', label: 'ANOMALOUS COMMS', type: 'classification', level: 1 },
  { id: 'cls-3', label: 'RESOURCE MOVEMENT', type: 'classification', level: 1 },
  { id: 'cls-4', label: 'SENTIMENT SHIFT', type: 'classification', level: 1 },

  // Level 2: Analytical Buckets
  { id: 'bkt-1', label: 'STATE-SPONSORED ACTOR', type: 'bucket', level: 2 },
  { id: 'bkt-2', label: 'FINANCIAL SYNDICATE', type: 'bucket', level: 2 },
  { id: 'bkt-3', label: 'HACKTIVIST CELL', type: 'bucket', level: 2 },

  // Level 3: Scenarios
  { id: 'scn-1', label: 'CRITICAL INFRASTRUCTURE SABOTAGE', type: 'scenario', level: 3, confidence: 85, impact: 92, recentActivity: 'Detected unusual spike in payload probing.' },
  { id: 'scn-2', label: 'LARGE-SCALE DATA EXFILTRATION', type: 'scenario', level: 3, confidence: 60, impact: 75, recentActivity: 'Multiple lateral movement attempts stymied.' },
  { id: 'scn-3', label: 'MARKET MANIPULATION CAMPAIGN', type: 'scenario', level: 3, confidence: 91, impact: 68, recentActivity: 'Coordinated social media astroturfing observed.' },
  { id: 'scn-4', label: 'SUPPLY CHAIN COMPROMISE', type: 'scenario', level: 3, confidence: 45, impact: 88, recentActivity: 'Vendor API endpoint anomalies.' },

  // Level 4: Risk / Watch
  { id: 'rsk-1', label: 'CRITICAL: IMMEDIATE ACTION', type: 'risk', level: 4 },
  { id: 'rsk-2', label: 'WATCH: ELEVATED THREAT', type: 'risk', level: 4 },
  { id: 'rsk-3', label: 'MONITOR: BASELINE', type: 'risk', level: 4 },
];

export const mockEdges: FlowEdge[] = [
  // Sources -> Classification
  { id: 'e1', sourceId: 'src-1', targetId: 'cls-1', weight: 4 },
  { id: 'e2', sourceId: 'src-1', targetId: 'cls-2', weight: 2 },
  { id: 'e3', sourceId: 'src-2', targetId: 'cls-3', weight: 3 },
  { id: 'e4', sourceId: 'src-3', targetId: 'cls-3', weight: 5 },
  { id: 'e5', sourceId: 'src-4', targetId: 'cls-4', weight: 4 },
  { id: 'e6', sourceId: 'src-5', targetId: 'cls-3', weight: 2 },
  { id: 'e7', sourceId: 'src-6', targetId: 'cls-1', weight: 5 },
  { id: 'e8', sourceId: 'src-6', targetId: 'cls-2', weight: 4 },

  // Classification -> Buckets
  { id: 'e9', sourceId: 'cls-1', targetId: 'bkt-1', weight: 6, isHighRisk: true },
  { id: 'e10', sourceId: 'cls-1', targetId: 'bkt-2', weight: 2 },
  { id: 'e11', sourceId: 'cls-2', targetId: 'bkt-1', weight: 3 },
  { id: 'e12', sourceId: 'cls-2', targetId: 'bkt-3', weight: 4 },
  { id: 'e13', sourceId: 'cls-3', targetId: 'bkt-2', weight: 5 },
  { id: 'e14', sourceId: 'cls-3', targetId: 'bkt-1', weight: 2 },
  { id: 'e15', sourceId: 'cls-4', targetId: 'bkt-3', weight: 3 },
  { id: 'e16', sourceId: 'cls-4', targetId: 'bkt-2', weight: 1 },

  // Buckets -> Scenarios
  { id: 'e17', sourceId: 'bkt-1', targetId: 'scn-1', weight: 7, isHighRisk: true },
  { id: 'e18', sourceId: 'bkt-1', targetId: 'scn-4', weight: 4 },
  { id: 'e19', sourceId: 'bkt-2', targetId: 'scn-3', weight: 6 },
  { id: 'e20', sourceId: 'bkt-2', targetId: 'scn-2', weight: 3 },
  { id: 'e21', sourceId: 'bkt-3', targetId: 'scn-2', weight: 5 },
  { id: 'e22', sourceId: 'bkt-3', targetId: 'scn-1', weight: 2 },

  // Scenarios -> Risk
  { id: 'e23', sourceId: 'scn-1', targetId: 'rsk-1', weight: 8, isHighRisk: true },
  { id: 'e24', sourceId: 'scn-2', targetId: 'rsk-2', weight: 4 },
  { id: 'e25', sourceId: 'scn-3', targetId: 'rsk-2', weight: 5 },
  { id: 'e26', sourceId: 'scn-4', targetId: 'rsk-3', weight: 2 },
];
