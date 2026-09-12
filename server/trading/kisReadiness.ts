export type KisMarketDataEnvironment = 'demo' | 'real';
export type KisPaperReadinessStatus = 'READY' | 'BLOCKED';

export interface KisPaperReadiness {
  status: KisPaperReadinessStatus;
  ready: boolean;
  paperOnly: true;
  brokerageExecutionAuthority: false;
  marketDataEnvironment: KisMarketDataEnvironment | null;
  runtimeId: string;
  credentials: {
    appKeyPresent: boolean;
    appSecretPresent: boolean;
  };
  reasons: string[];
}

type EnvLike = Record<string, string | undefined>;

const value = (env: EnvLike, key: string) => String(env[key] ?? '').trim();

export const readKisPaperReadiness = (env: EnvLike = process.env): KisPaperReadiness => {
  const appKeyPresent = Boolean(value(env, 'KIS_APP_KEY'));
  const appSecretPresent = Boolean(value(env, 'KIS_APP_SECRET'));
  const rawEnvironment = value(env, 'KIS_ENV').toLowerCase() || 'demo';
  const marketDataEnvironment: KisMarketDataEnvironment | null = rawEnvironment === 'demo' || rawEnvironment === 'real'
    ? rawEnvironment
    : null;
  const runtimeId = value(env, 'TRADING_RUNTIME_ID') || 'black-oracle-paper';
  const reasons: string[] = [];

  if (!appKeyPresent) reasons.push('KIS_APP_KEY is not configured.');
  if (!appSecretPresent) reasons.push('KIS_APP_SECRET is not configured.');
  if (!marketDataEnvironment) reasons.push('KIS_ENV must be demo or real.');

  const ready = reasons.length === 0;
  return {
    status: ready ? 'READY' : 'BLOCKED',
    ready,
    paperOnly: true,
    brokerageExecutionAuthority: false,
    marketDataEnvironment,
    runtimeId,
    credentials: { appKeyPresent, appSecretPresent },
    reasons,
  };
};
