import type { ChampionChallengerRouterDecision } from './championChallengerRouter';

export const BOT_GOVERNANCE_DECISION_SCHEMA = 'bot.governance-decision.v1' as const;
export type GovernanceAction = 'APPROVE' | 'NO_TRADE';
export type CouncilVerdict = 'APPROVE' | 'REJECT';
export type RedTeamVerdict = 'CLEAR' | 'VETO';
export type GovernanceReason =
  | 'GOVERNANCE_APPROVED'
  | 'ROUTER_NO_TRADE'
  | 'GOVERNANCE_EVIDENCE_MISSING'
  | 'GOVERNANCE_EVIDENCE_STALE'
  | 'GOVERNANCE_IDENTITY_MISMATCH'
  | 'COUNCIL_REJECTED'
  | 'RED_TEAM_VETO';

export interface GovernanceFinding<TVerdict extends string> {
  sourceId: string;
  strategyId: string;
  strategyRevision: string;
  observedAt: string;
  maxAgeMs: number;
  verdict: TVerdict;
  evidenceFingerprints: ReadonlyArray<string>;
}

export interface GovernanceArbiterInput {
  routerDecision: ChampionChallengerRouterDecision;
  council: GovernanceFinding<CouncilVerdict> | null;
  redTeam: GovernanceFinding<RedTeamVerdict> | null;
  evaluatedAt: string;
  promotionAuthority?: boolean;
  executionAuthority?: boolean;
  capitalAuthority?: boolean;
  riskBypassAuthority?: boolean;
  liveAuthority?: boolean;
}

export interface GovernanceDecision {
  schema: typeof BOT_GOVERNANCE_DECISION_SCHEMA;
  action: GovernanceAction;
  reason: GovernanceReason;
  strategyId: string | null;
  strategyRevision: string | null;
  evaluatedAt: string;
  routerReason: string;
  governanceEvidence: ReadonlyArray<Readonly<{ actor: 'COUNCIL' | 'RED_TEAM'; sourceId: string; observedAt: string; verdict: string; evidenceFingerprints: ReadonlyArray<string> }>>;
  promotionAuthority: false;
  executionAuthority: false;
  capitalAuthority: false;
  riskBypassAuthority: false;
  liveAuthority: false;
}

function parseTime(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be a valid timestamp`);
  return parsed;
}

function validateFinding<T extends string>(finding: GovernanceFinding<T>, actor: string): void {
  if (!finding.sourceId.trim()) throw new Error(`${actor}.sourceId is required`);
  if (!finding.strategyId.trim() || !finding.strategyRevision.trim()) throw new Error(`${actor} strategy identity is required`);
  parseTime(finding.observedAt, `${actor}.observedAt`);
  if (!Number.isFinite(finding.maxAgeMs) || finding.maxAgeMs < 0) throw new Error(`${actor}.maxAgeMs must be finite and non-negative`);
  if (!finding.evidenceFingerprints.length || finding.evidenceFingerprints.some((x) => !x.trim())) throw new Error(`${actor}.evidenceFingerprints are required`);
}

export function arbitrateGovernance(input: GovernanceArbiterInput): Readonly<GovernanceDecision> {
  if (input.promotionAuthority || input.executionAuthority || input.capitalAuthority || input.riskBypassAuthority || input.liveAuthority) throw new Error('Governance Arbiter cannot grant authority');
  const evaluatedAtMs = parseTime(input.evaluatedAt, 'evaluatedAt');
  const router = input.routerDecision;
  if (router.promotionAuthority || router.executionAuthority || router.capitalAuthority || router.riskBypassAuthority || router.liveAuthority) throw new Error('Router authority must remain false');

  const evidence = (): GovernanceDecision['governanceEvidence'] => Object.freeze([
    ...(input.council ? [Object.freeze({ actor: 'COUNCIL' as const, sourceId: input.council.sourceId, observedAt: input.council.observedAt, verdict: input.council.verdict, evidenceFingerprints: Object.freeze([...input.council.evidenceFingerprints]) })] : []),
    ...(input.redTeam ? [Object.freeze({ actor: 'RED_TEAM' as const, sourceId: input.redTeam.sourceId, observedAt: input.redTeam.observedAt, verdict: input.redTeam.verdict, evidenceFingerprints: Object.freeze([...input.redTeam.evidenceFingerprints]) })] : []),
  ]);
  const finish = (action: GovernanceAction, reason: GovernanceReason): Readonly<GovernanceDecision> => Object.freeze({ schema: BOT_GOVERNANCE_DECISION_SCHEMA, action, reason, strategyId: router.action === 'SELECT' ? router.selectedStrategyId : null, strategyRevision: router.action === 'SELECT' ? router.selectedStrategyRevision : null, evaluatedAt: input.evaluatedAt, routerReason: router.reason, governanceEvidence: evidence(), promotionAuthority: false, executionAuthority: false, capitalAuthority: false, riskBypassAuthority: false, liveAuthority: false });

  if (router.action === 'NO_TRADE') return finish('NO_TRADE', 'ROUTER_NO_TRADE');
  if (!router.selectedStrategyId || !router.selectedStrategyRevision || !router.selectedRole) throw new Error('SELECT router decision requires selected strategy identity');
  if (!input.council || !input.redTeam) return finish('NO_TRADE', 'GOVERNANCE_EVIDENCE_MISSING');

  validateFinding(input.council, 'council');
  validateFinding(input.redTeam, 'redTeam');
  const findings = [input.council, input.redTeam] as const;
  if (findings.some((f) => f.strategyId !== router.selectedStrategyId || f.strategyRevision !== router.selectedStrategyRevision)) return finish('NO_TRADE', 'GOVERNANCE_IDENTITY_MISMATCH');
  if (findings.some((f) => { const age = evaluatedAtMs - parseTime(f.observedAt, 'governance.observedAt'); return age < 0 || age > f.maxAgeMs; })) return finish('NO_TRADE', 'GOVERNANCE_EVIDENCE_STALE');
  if (input.redTeam.verdict === 'VETO') return finish('NO_TRADE', 'RED_TEAM_VETO');
  if (input.council.verdict !== 'APPROVE') return finish('NO_TRADE', 'COUNCIL_REJECTED');
  return finish('APPROVE', 'GOVERNANCE_APPROVED');
}
