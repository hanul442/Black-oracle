import { createHash } from 'node:crypto';
import { DEFAULT_RISK_LIMITS, TRADING_STRATEGY_VERSION, UNIFIED_PAPER_INITIAL_EQUITY_KRW } from '../../src/trading/config';

export const LEGACY_PAPER_RUNTIME_ID = 'black-oracle-paper';
export const VNEXT_PAPER_RUNTIME_ID = 'black-oracle-paper-vnext';
export const VNEXT_QUALIFICATION_INITIAL_EQUITY_KRW = 100_000_000;

export interface TradingRuntimeProfile {
  runtimeId: string;
  initialEquityKrw: number;
  qualificationId: string | null;
  qualificationArmedAt: string | null;
  systemRevision: string;
  strategyVersion: string;
  riskConfigHash: string;
  qualificationMode: boolean;
}

export interface TradingCheckpointIdentity {
  runtimeId: string;
  initialEquityKrw: number;
  qualificationId: string | null;
  qualificationArmedAt: string | null;
  systemRevision: string;
  strategyVersion: string;
  riskConfigHash: string;
}

export interface RuntimeCompatibilityAssessment {
  status: 'MATCH' | 'LEGACY_DRIFT' | 'BLOCKED';
  compatible: boolean;
  strict: boolean;
  reasons: string[];
  expected: TradingCheckpointIdentity;
  observed: TradingCheckpointIdentity | null;
  observedInitialEquityKrw: number;
}

type EnvLike = Record<string, string | undefined>;

const RUNTIME_ID = /^[a-z0-9][a-z0-9._-]{2,79}$/i;
const QUALIFICATION_ID = /^[a-z0-9][a-z0-9._:-]{2,119}$/i;

const normalizeOptional = (value: string | undefined) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

const parseInitialEquity = (value: string | undefined) => {
  const normalized = normalizeOptional(value);
  if (!normalized) return UNIFIED_PAPER_INITIAL_EQUITY_KRW;
  const parsed = Number(normalized.replaceAll(',', '').replaceAll('_', ''));
  if (!Number.isFinite(parsed) || parsed < 100_000 || parsed > 1_000_000_000_000) {
    throw new Error('TRADING_INITIAL_EQUITY_KRW must be a finite KRW amount between 100,000 and 1,000,000,000,000.');
  }
  return Math.round(parsed);
};

const parseIsoTimestamp = (value: string | undefined, label: string) => {
  const normalized = normalizeOptional(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be an ISO-compatible timestamp.`);
  return new Date(parsed).toISOString();
};

export const isVNextQualificationRuntimeId = (runtimeId: string) =>
  runtimeId === VNEXT_PAPER_RUNTIME_ID || runtimeId.startsWith(`${VNEXT_PAPER_RUNTIME_ID}-`);

export const buildRiskConfigHash = () => createHash('sha256')
  .update(JSON.stringify({ strategyVersion: TRADING_STRATEGY_VERSION, riskLimits: DEFAULT_RISK_LIMITS }))
  .digest('hex')
  .slice(0, 16);

export const readTradingRuntimeProfile = (env: EnvLike = process.env): TradingRuntimeProfile => {
  const runtimeId = normalizeOptional(env.TRADING_RUNTIME_ID) ?? LEGACY_PAPER_RUNTIME_ID;
  if (!RUNTIME_ID.test(runtimeId)) throw new Error('TRADING_RUNTIME_ID contains unsupported characters.');

  const qualificationId = normalizeOptional(env.PAPER_QUALIFICATION_ID);
  if (qualificationId && !QUALIFICATION_ID.test(qualificationId)) {
    throw new Error('PAPER_QUALIFICATION_ID contains unsupported characters.');
  }

  const qualificationArmedAt = parseIsoTimestamp(env.PAPER_QUALIFICATION_ARMED_AT, 'PAPER_QUALIFICATION_ARMED_AT');
  if (qualificationArmedAt && !qualificationId) {
    throw new Error('PAPER_QUALIFICATION_ARMED_AT requires PAPER_QUALIFICATION_ID.');
  }

  const initialEquityKrw = parseInitialEquity(env.TRADING_INITIAL_EQUITY_KRW);
  const systemRevision = normalizeOptional(env.PAPER_SYSTEM_REVISION)
    ?? normalizeOptional(env.RAILWAY_GIT_COMMIT_SHA)
    ?? normalizeOptional(env.APP_REV)
    ?? 'unversioned';

  if (isVNextQualificationRuntimeId(runtimeId)) {
    if (!qualificationId) throw new Error('vNext qualification runtime requires PAPER_QUALIFICATION_ID.');
    if (!qualificationArmedAt) throw new Error('vNext qualification runtime requires PAPER_QUALIFICATION_ARMED_AT.');
    if (initialEquityKrw !== VNEXT_QUALIFICATION_INITIAL_EQUITY_KRW) {
      throw new Error('vNext qualification runtime requires TRADING_INITIAL_EQUITY_KRW=100000000.');
    }
    if (systemRevision === 'unversioned') {
      throw new Error('vNext qualification runtime requires a pinned PAPER_SYSTEM_REVISION or deployment revision.');
    }
  }

  return {
    runtimeId,
    initialEquityKrw,
    qualificationId,
    qualificationArmedAt,
    systemRevision,
    strategyVersion: TRADING_STRATEGY_VERSION,
    riskConfigHash: buildRiskConfigHash(),
    qualificationMode: Boolean(qualificationId),
  };
};

export const checkpointIdentityFromProfile = (profile: TradingRuntimeProfile): TradingCheckpointIdentity => ({
  runtimeId: profile.runtimeId,
  initialEquityKrw: profile.initialEquityKrw,
  qualificationId: profile.qualificationId,
  qualificationArmedAt: profile.qualificationArmedAt,
  systemRevision: profile.systemRevision,
  strategyVersion: profile.strategyVersion,
  riskConfigHash: profile.riskConfigHash,
});

const identityFromUnknown = (value: unknown): TradingCheckpointIdentity | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<TradingCheckpointIdentity>;
  if (
    typeof row.runtimeId !== 'string'
    || !Number.isFinite(row.initialEquityKrw)
    || typeof row.systemRevision !== 'string'
    || typeof row.strategyVersion !== 'string'
    || typeof row.riskConfigHash !== 'string'
  ) return null;
  return {
    runtimeId: row.runtimeId,
    initialEquityKrw: Number(row.initialEquityKrw),
    qualificationId: typeof row.qualificationId === 'string' ? row.qualificationId : null,
    qualificationArmedAt: typeof row.qualificationArmedAt === 'string' ? row.qualificationArmedAt : null,
    systemRevision: row.systemRevision,
    strategyVersion: row.strategyVersion,
    riskConfigHash: row.riskConfigHash,
  };
};

export const assessRuntimeCheckpointCompatibility = (
  profile: TradingRuntimeProfile,
  checkpointIdentity: unknown,
  observedInitialEquityKrw: number,
): RuntimeCompatibilityAssessment => {
  const expected = checkpointIdentityFromProfile(profile);
  const observed = identityFromUnknown(checkpointIdentity);
  const reasons: string[] = [];
  let blocked = false;
  let legacyDrift = false;

  if (!Number.isFinite(observedInitialEquityKrw) || observedInitialEquityKrw <= 0) {
    blocked = true;
    reasons.push('Checkpoint portfolio initialEquity is invalid.');
  }

  if (Math.abs(observedInitialEquityKrw - profile.initialEquityKrw) > 0.5) {
    const reason = `Configured initial equity ${profile.initialEquityKrw} KRW differs from checkpoint ${observedInitialEquityKrw} KRW.`;
    if (profile.qualificationMode) blocked = true;
    else legacyDrift = true;
    reasons.push(reason);
  }

  if (!observed) {
    if (profile.qualificationMode) {
      blocked = true;
      reasons.push('Qualification checkpoint is missing runtime identity metadata.');
    } else {
      legacyDrift = true;
      reasons.push('Legacy checkpoint predates runtime identity metadata.');
    }
  } else {
    if (observed.runtimeId !== profile.runtimeId) {
      blocked = true;
      reasons.push(`Checkpoint runtimeId ${observed.runtimeId} does not match configured runtimeId ${profile.runtimeId}.`);
    }
    if (profile.qualificationMode) {
      if (observed.qualificationId !== profile.qualificationId) {
        blocked = true;
        reasons.push('Qualification ID does not match the pinned checkpoint identity.');
      }
      if (observed.systemRevision !== profile.systemRevision) {
        blocked = true;
        reasons.push('System revision changed inside a pinned qualification runtime.');
      }
      if (observed.strategyVersion !== profile.strategyVersion) {
        blocked = true;
        reasons.push('Strategy version changed inside a pinned qualification runtime.');
      }
      if (observed.riskConfigHash !== profile.riskConfigHash) {
        blocked = true;
        reasons.push('Risk configuration changed inside a pinned qualification runtime.');
      }
      if (observed.initialEquityKrw !== profile.initialEquityKrw) {
        blocked = true;
        reasons.push('Checkpoint identity initial equity does not match the qualification profile.');
      }
      if ((observed.qualificationArmedAt ?? null) !== (profile.qualificationArmedAt ?? null)) {
        blocked = true;
        reasons.push('Qualification armed timestamp does not match the pinned checkpoint identity.');
      }
    }
  }

  if (blocked) return {
    status: 'BLOCKED',
    compatible: false,
    strict: profile.qualificationMode,
    reasons,
    expected,
    observed,
    observedInitialEquityKrw,
  };
  if (legacyDrift) return {
    status: 'LEGACY_DRIFT',
    compatible: true,
    strict: false,
    reasons,
    expected,
    observed,
    observedInitialEquityKrw,
  };
  return {
    status: 'MATCH',
    compatible: true,
    strict: profile.qualificationMode,
    reasons: [],
    expected,
    observed,
    observedInitialEquityKrw,
  };
};

export const tradingRuntimeProfile = readTradingRuntimeProfile();
