export type AuthorityMode = 'SHADOW' | 'PAPER' | 'LIVE_SHADOW' | 'LIVE_CANARY' | 'LIVE';

export interface AuthorityCapabilities {
  canAnalyzeMarket: boolean;
  canPaperExecute: boolean;
  canReadBroker: boolean;
  canBrokerDryRun: boolean;
  canSubmitBrokerOrders: boolean;
  usesLiveCapital: boolean;
}

export interface BotAuthorityProfile {
  mode: AuthorityMode;
  alphaAllowed: boolean;
  hardBlocked: boolean;
  requiresQualification: boolean;
  capabilities: AuthorityCapabilities;
  reasons: string[];
}

const AUTHORITY_MODES: readonly AuthorityMode[] = [
  'SHADOW',
  'PAPER',
  'LIVE_SHADOW',
  'LIVE_CANARY',
  'LIVE',
] as const;

export const parseAuthorityMode = (value: unknown): AuthorityMode => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return 'PAPER';
  if ((AUTHORITY_MODES as readonly string[]).includes(normalized)) return normalized as AuthorityMode;
  throw new Error(
    `Unsupported BOT_AUTHORITY_MODE "${normalized}". Allowed: ${AUTHORITY_MODES.join(', ')}. Legacy live modes are intentionally not accepted.`,
  );
};

export const buildBotAuthorityProfile = (mode: AuthorityMode): BotAuthorityProfile => {
  switch (mode) {
    case 'SHADOW':
      return {
        mode,
        alphaAllowed: true,
        hardBlocked: false,
        requiresQualification: false,
        capabilities: {
          canAnalyzeMarket: true,
          canPaperExecute: false,
          canReadBroker: false,
          canBrokerDryRun: false,
          canSubmitBrokerOrders: false,
          usesLiveCapital: false,
        },
        reasons: ['Decision/research shadowing only; execution is disabled.'],
      };
    case 'PAPER':
      return {
        mode,
        alphaAllowed: true,
        hardBlocked: false,
        requiresQualification: false,
        capabilities: {
          canAnalyzeMarket: true,
          canPaperExecute: true,
          canReadBroker: false,
          canBrokerDryRun: false,
          canSubmitBrokerOrders: false,
          usesLiveCapital: false,
        },
        reasons: ['Paper execution is enabled; broker access and live capital are disabled.'],
      };
    case 'LIVE_SHADOW':
      return {
        mode,
        alphaAllowed: true,
        hardBlocked: false,
        requiresQualification: false,
        capabilities: {
          canAnalyzeMarket: true,
          canPaperExecute: true,
          canReadBroker: true,
          canBrokerDryRun: true,
          canSubmitBrokerOrders: false,
          usesLiveCapital: false,
        },
        reasons: ['Broker state/dry-run readiness may be observed, but real broker orders are disabled.'],
      };
    case 'LIVE_CANARY':
      return {
        mode,
        alphaAllowed: true,
        hardBlocked: false,
        requiresQualification: true,
        capabilities: {
          canAnalyzeMarket: true,
          canPaperExecute: true,
          canReadBroker: true,
          canBrokerDryRun: true,
          canSubmitBrokerOrders: false,
          usesLiveCapital: false,
        },
        reasons: [
          'LIVE_CANARY is readiness-only in BOT Alpha.',
          'Broker order submission stays disabled until a later dedicated qualification/risk/execution PR.',
        ],
      };
    case 'LIVE':
      return {
        mode,
        alphaAllowed: false,
        hardBlocked: true,
        requiresQualification: true,
        capabilities: {
          canAnalyzeMarket: true,
          canPaperExecute: false,
          canReadBroker: false,
          canBrokerDryRun: false,
          canSubmitBrokerOrders: false,
          usesLiveCapital: false,
        },
        reasons: ['Unrestricted LIVE authority is hard-blocked for BOT Alpha v0.1.'],
      };
  }
};

export const readBotAuthorityProfile = (
  env: Record<string, string | undefined> = process.env,
): BotAuthorityProfile => buildBotAuthorityProfile(parseAuthorityMode(env.BOT_AUTHORITY_MODE));

export const assertAlphaAuthoritySafe = (profile: BotAuthorityProfile) => {
  if (profile.hardBlocked || !profile.alphaAllowed || profile.mode === 'LIVE') {
    throw new Error(
      `BOT authority ${profile.mode} is blocked for Alpha v0.1. Use SHADOW, PAPER, LIVE_SHADOW, or readiness-only LIVE_CANARY.`,
    );
  }
  if (profile.capabilities.canSubmitBrokerOrders || profile.capabilities.usesLiveCapital) {
    throw new Error(`BOT authority ${profile.mode} violates the Alpha live-capital block.`);
  }
  return profile;
};

export const assertPaperExecutionAllowed = (profile: BotAuthorityProfile) => {
  assertAlphaAuthoritySafe(profile);
  if (!profile.capabilities.canPaperExecute) {
    throw new Error(`BOT authority ${profile.mode} does not allow Paper execution.`);
  }
  return profile;
};

export const assertBrokerOrderSubmissionAllowed = (profile: BotAuthorityProfile): never => {
  throw new Error(
    `Broker order submission is disabled in BOT Alpha v0.1 (authority=${profile.mode}). LIVE_CANARY is readiness-only and LIVE is hard-blocked.`,
  );
};
