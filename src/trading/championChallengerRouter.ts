import type { StrategyValidationBinding } from './strategyValidationBinding';

export const BOT_CHAMPION_CHALLENGER_ROUTER_SCHEMA = 'bot.champion-challenger-router.v1' as const;
export type ChampionChallengerRole = 'CHAMPION' | 'CHALLENGER';
export type ChampionChallengerAction = 'SELECT' | 'NO_TRADE';
export type ChampionChallengerReason = 'SELECTED_HIGHER_SCORE' | 'VALIDATION_INELIGIBLE' | 'STALE_OBSERVATION' | 'REGIME_FIT_MISSING' | 'REGIME_INCOMPATIBLE' | 'SCORE_TIE';

export interface ChampionChallengerCandidate {
  role: ChampionChallengerRole;
  binding: StrategyValidationBinding;
  comparisonScore: number;
  observedAt: string;
  maxAgeMs: number;
  regimeFit: boolean | null;
}

export interface ChampionChallengerRouterInput {
  champion: ChampionChallengerCandidate;
  challenger: ChampionChallengerCandidate;
  evaluatedAt: string;
  promotionAuthority?: boolean;
  executionAuthority?: boolean;
  capitalAuthority?: boolean;
  riskBypassAuthority?: boolean;
  liveAuthority?: boolean;
}

export interface ChampionChallengerRouterDecision {
  schema: typeof BOT_CHAMPION_CHALLENGER_ROUTER_SCHEMA;
  action: ChampionChallengerAction;
  reason: ChampionChallengerReason;
  selectedRole: ChampionChallengerRole | null;
  selectedStrategyId: string | null;
  selectedStrategyRevision: string | null;
  evaluatedAt: string;
  evidence: ReadonlyArray<Readonly<{ role: ChampionChallengerRole; strategyId: string; strategyRevision: string; experimentId: string; comparisonScore: number; observedAt: string; regimeFit: boolean | null; stageResultFingerprints: Readonly<Record<string, string>> }>>;
  promotionAuthority: false;
  executionAuthority: false;
  capitalAuthority: false;
  riskBypassAuthority: false;
  liveAuthority: false;
}

function finite(value: number, field: string): number { if (!Number.isFinite(value)) throw new Error(`${field} must be finite`); return value; }
function time(value: string, field: string): number { const parsed = Date.parse(value); if (!Number.isFinite(parsed)) throw new Error(`${field} must be a valid timestamp`); return parsed; }

export function routeChampionChallenger(input: ChampionChallengerRouterInput): Readonly<ChampionChallengerRouterDecision> {
  if (input.promotionAuthority || input.executionAuthority || input.capitalAuthority || input.riskBypassAuthority || input.liveAuthority) throw new Error('Champion-Challenger router cannot grant authority');
  if (input.champion.role !== 'CHAMPION' || input.challenger.role !== 'CHALLENGER') throw new Error('Champion-Challenger role mismatch');
  const evaluatedAtMs = time(input.evaluatedAt, 'evaluatedAt');
  const candidates = [input.champion, input.challenger] as const;
  for (const candidate of candidates) {
    finite(candidate.comparisonScore, `${candidate.role}.comparisonScore`);
    if (!Number.isFinite(candidate.maxAgeMs) || candidate.maxAgeMs < 0) throw new Error(`${candidate.role}.maxAgeMs must be finite and non-negative`);
    time(candidate.observedAt, `${candidate.role}.observedAt`);
    if (!candidate.binding.strategyId.trim() || !candidate.binding.strategyRevision.trim()) throw new Error(`${candidate.role} strategy identity is required`);
    if (candidate.binding.promotionAuthority || candidate.binding.executionAuthority || candidate.binding.capitalAuthority) throw new Error(`${candidate.role} validation binding authority must remain false`);
  }
  if (input.champion.binding.strategyId === input.challenger.binding.strategyId && input.champion.binding.strategyRevision === input.challenger.binding.strategyRevision) throw new Error('Champion and Challenger must be distinct strategy revisions');

  const evidence = Object.freeze(candidates.map((candidate) => Object.freeze({ role: candidate.role, strategyId: candidate.binding.strategyId, strategyRevision: candidate.binding.strategyRevision, experimentId: candidate.binding.experimentId, comparisonScore: candidate.comparisonScore, observedAt: candidate.observedAt, regimeFit: candidate.regimeFit, stageResultFingerprints: Object.freeze({ ...candidate.binding.stageResultFingerprints }) })));
  const finish = (action: ChampionChallengerAction, reason: ChampionChallengerReason, selected: ChampionChallengerCandidate | null = null): Readonly<ChampionChallengerRouterDecision> => Object.freeze({ schema: BOT_CHAMPION_CHALLENGER_ROUTER_SCHEMA, action, reason, selectedRole: selected?.role ?? null, selectedStrategyId: selected?.binding.strategyId ?? null, selectedStrategyRevision: selected?.binding.strategyRevision ?? null, evaluatedAt: input.evaluatedAt, evidence, promotionAuthority: false, executionAuthority: false, capitalAuthority: false, riskBypassAuthority: false, liveAuthority: false });

  if (candidates.some((candidate) => !candidate.binding.validationEligible || candidate.binding.validationStatus !== 'PASS')) return finish('NO_TRADE', 'VALIDATION_INELIGIBLE');
  if (candidates.some((candidate) => { const age = evaluatedAtMs - time(candidate.observedAt, `${candidate.role}.observedAt`); return age < 0 || age > candidate.maxAgeMs; })) return finish('NO_TRADE', 'STALE_OBSERVATION');
  if (candidates.some((candidate) => candidate.regimeFit === null)) return finish('NO_TRADE', 'REGIME_FIT_MISSING');
  if (candidates.some((candidate) => candidate.regimeFit !== true)) return finish('NO_TRADE', 'REGIME_INCOMPATIBLE');
  if (input.champion.comparisonScore === input.challenger.comparisonScore) return finish('NO_TRADE', 'SCORE_TIE');
  const selected = input.champion.comparisonScore > input.challenger.comparisonScore ? input.champion : input.challenger;
  return finish('SELECT', 'SELECTED_HIGHER_SCORE', selected);
}
