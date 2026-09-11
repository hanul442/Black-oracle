import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TradingEvidence } from '../../src/trading/evidence';
import type { PaperLoopCheckpoint } from './paperLoop';
import type { PaperTradingSessionCheckpoint } from './paperSession';
import { tradingRuntimeProfile, type TradingCheckpointIdentity } from './runtimeProfile';

export interface TradingRuntimeCheckpoint {
  schemaVersion: 1;
  savedAt: number;
  reason: string;
  runtime?: TradingCheckpointIdentity;
  session: PaperTradingSessionCheckpoint;
  evidence: TradingEvidence[];
  loop: PaperLoopCheckpoint;
}

export type PersistenceBackend = 'json' | 'supabase';

export interface PersistenceStatus {
  backend: PersistenceBackend;
  location: string;
  configured: boolean;
  filePath?: string;
  runtimeId?: string;
  lastSavedAt: number | null;
  lastRestoredAt: number | null;
  lastError: string | null;
  writes: number;
  restores: number;
  lastReadDurationMs: number | null;
  lastWriteDurationMs: number | null;
  lastPayloadBytes: number | null;
  lastRequestAttempts: number | null;
  totalRetries: number;
  lastHttpStatus: number | null;
}

export interface TradingCheckpointStore {
  status(): PersistenceStatus;
  save(checkpoint: TradingRuntimeCheckpoint): Promise<PersistenceStatus>;
  load(): Promise<TradingRuntimeCheckpoint | null>;
}

const defaultStatePath = () => process.env.TRADING_STATE_FILE
  ? path.resolve(process.env.TRADING_STATE_FILE)
  : path.resolve(process.cwd(), '.data', 'black-oracle-trading-state.json');

const validRuntimeIdentity = (value: unknown) => {
  if (!value || typeof value !== 'object') return false;
  const identity = value as Partial<TradingCheckpointIdentity>;
  return typeof identity.runtimeId === 'string'
    && Number.isFinite(identity.initialEquityKrw)
    && typeof identity.systemRevision === 'string'
    && typeof identity.strategyVersion === 'string'
    && typeof identity.riskConfigHash === 'string'
    && (identity.qualificationId == null || typeof identity.qualificationId === 'string')
    && (identity.qualificationArmedAt == null || typeof identity.qualificationArmedAt === 'string');
};

export const validateCheckpoint = (value: unknown): TradingRuntimeCheckpoint => {
  if (!value || typeof value !== 'object') throw new Error('Trading checkpoint must be an object.');
  const checkpoint = value as Partial<TradingRuntimeCheckpoint>;
  if (checkpoint.schemaVersion !== 1) throw new Error('Unsupported trading checkpoint schema.');
  if (!Number.isFinite(checkpoint.savedAt)) throw new Error('Trading checkpoint savedAt is invalid.');
  if (typeof checkpoint.reason !== 'string') throw new Error('Trading checkpoint reason is invalid.');
  if (checkpoint.runtime != null && !validRuntimeIdentity(checkpoint.runtime)) {
    throw new Error('Trading checkpoint runtime identity is invalid.');
  }
  if (!checkpoint.session || !checkpoint.loop || !Array.isArray(checkpoint.evidence)) {
    throw new Error('Trading checkpoint payload is incomplete.');
  }
  return checkpoint as TradingRuntimeCheckpoint;
};

export class JsonTradingCheckpointStore implements TradingCheckpointStore {
  private readonly filePath: string;
  private writeChain: Promise<void> = Promise.resolve();
  private lastSavedAt: number | null = null;
  private lastRestoredAt: number | null = null;
  private lastError: string | null = null;
  private writes = 0;
  private restores = 0;
  private lastReadDurationMs: number | null = null;
  private lastWriteDurationMs: number | null = null;
  private lastPayloadBytes: number | null = null;

  constructor(filePath = defaultStatePath()) {
    this.filePath = filePath;
  }

  status(): PersistenceStatus {
    return {
      backend: 'json',
      location: this.filePath,
      configured: true,
      filePath: this.filePath,
      lastSavedAt: this.lastSavedAt,
      lastRestoredAt: this.lastRestoredAt,
      lastError: this.lastError,
      writes: this.writes,
      restores: this.restores,
      lastReadDurationMs: this.lastReadDurationMs,
      lastWriteDurationMs: this.lastWriteDurationMs,
      lastPayloadBytes: this.lastPayloadBytes,
      lastRequestAttempts: null,
      totalRetries: 0,
      lastHttpStatus: null,
    };
  }

  async save(checkpoint: TradingRuntimeCheckpoint) {
    const validated = validateCheckpoint(checkpoint);
    this.writeChain = this.writeChain.catch(() => undefined).then(async () => {
      const directory = path.dirname(this.filePath);
      await mkdir(directory, { recursive: true });
      const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      const payload = `${JSON.stringify(validated, null, 2)}\n`;
      const startedAt = Date.now();
      this.lastPayloadBytes = Buffer.byteLength(payload, 'utf-8');
      try {
        await writeFile(temporaryPath, payload, { encoding: 'utf-8', mode: 0o600 });
        await rename(temporaryPath, this.filePath);
        this.lastSavedAt = validated.savedAt;
        this.lastError = null;
        this.writes += 1;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : 'Unknown checkpoint write error.';
        throw error;
      } finally {
        this.lastWriteDurationMs = Date.now() - startedAt;
      }
    });
    await this.writeChain;
    return this.status();
  }

  async load(): Promise<TradingRuntimeCheckpoint | null> {
    const startedAt = Date.now();
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = validateCheckpoint(JSON.parse(raw));
      this.lastRestoredAt = Date.now();
      this.lastSavedAt = parsed.savedAt;
      this.lastError = null;
      this.restores += 1;
      return parsed;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === 'ENOENT') {
        this.lastError = null;
        return null;
      }
      this.lastError = error instanceof Error ? error.message : 'Unknown checkpoint read error.';
      throw error;
    } finally {
      this.lastReadDurationMs = Date.now() - startedAt;
    }
  }
}

interface SupabaseTradingCheckpointStoreOptions {
  url: string;
  serviceRoleKey: string;
  runtimeId?: string;
  table?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  retryDelaysMs?: number[];
}

interface SupabaseCheckpointRow {
  checkpoint: unknown;
}

const DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_SUPABASE_RETRY_DELAYS_MS = [500, 1_500];

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

const transientFetchError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    name?: string;
    code?: string;
    cause?: { code?: string; name?: string };
  };
  const codes = [candidate.code, candidate.cause?.code].filter(Boolean);
  return candidate.name === 'AbortError'
    || candidate.name === 'TimeoutError'
    || candidate.cause?.name === 'TimeoutError'
    || codes.some((code) => [
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_CONNECT_TIMEOUT',
      'ECONNRESET',
      'ETIMEDOUT',
    ].includes(String(code)));
};

const transientSupabaseResponse = (status: number, body: string) => {
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  if (status >= 500) return true;
  return status === 401
    && body.includes('PGRST303')
    && /future|time|clock/i.test(body);
};

export class SupabaseTradingCheckpointStore implements TradingCheckpointStore {
  private readonly url: string;
  private readonly serviceRoleKey: string;
  private readonly runtimeId: string;
  private readonly table: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly retryDelaysMs: number[];
  private writeChain: Promise<void> = Promise.resolve();
  private lastSavedAt: number | null = null;
  private lastRestoredAt: number | null = null;
  private lastError: string | null = null;
  private writes = 0;
  private restores = 0;
  private lastReadDurationMs: number | null = null;
  private lastWriteDurationMs: number | null = null;
  private lastPayloadBytes: number | null = null;
  private lastRequestAttempts: number | null = null;
  private totalRetries = 0;
  private lastHttpStatus: number | null = null;

  constructor(options: SupabaseTradingCheckpointStoreOptions) {
    if (!options.url.trim()) throw new Error('SUPABASE_URL is required for Supabase trading persistence.');
    if (!options.serviceRoleKey.trim()) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for Supabase trading persistence.');
    this.url = options.url.replace(/\/+$/, '');
    this.serviceRoleKey = options.serviceRoleKey;
    this.runtimeId = options.runtimeId?.trim() || 'black-oracle-paper';
    this.table = options.table?.trim() || 'black_oracle_trading_runtime';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestTimeoutMs = Number.isFinite(options.requestTimeoutMs) && Number(options.requestTimeoutMs) > 0
      ? Number(options.requestTimeoutMs)
      : DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS;
    this.retryDelaysMs = (options.retryDelaysMs ?? DEFAULT_SUPABASE_RETRY_DELAYS_MS)
      .filter((value) => Number.isFinite(value) && value >= 0)
      .map(Number);
  }

  status(): PersistenceStatus {
    return {
      backend: 'supabase',
      location: `${this.url}/rest/v1/${this.table}`,
      configured: true,
      runtimeId: this.runtimeId,
      lastSavedAt: this.lastSavedAt,
      lastRestoredAt: this.lastRestoredAt,
      lastError: this.lastError,
      writes: this.writes,
      restores: this.restores,
      lastReadDurationMs: this.lastReadDurationMs,
      lastWriteDurationMs: this.lastWriteDurationMs,
      lastPayloadBytes: this.lastPayloadBytes,
      lastRequestAttempts: this.lastRequestAttempts,
      totalRetries: this.totalRetries,
      lastHttpStatus: this.lastHttpStatus,
    };
  }

  private headers(extra: Record<string, string> = {}) {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      ...extra,
    };
  }

  private endpoint() {
    return `${this.url}/rest/v1/${this.table}`;
  }

  private async fetchAttempt(input: URL | string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      return await this.fetchImpl(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async request(input: URL | string, init: RequestInit) {
    const maxAttempts = this.retryDelaysMs.length + 1;
    this.lastRequestAttempts = 0;
    this.lastHttpStatus = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      this.lastRequestAttempts = attempt + 1;
      try {
        const response = await this.fetchAttempt(input, init);
        this.lastHttpStatus = response.status;
        if (response.ok || attempt === maxAttempts - 1) return response;
        const body = await response.clone().text();
        if (!transientSupabaseResponse(response.status, body)) return response;
      } catch (error) {
        this.lastHttpStatus = null;
        if (attempt === maxAttempts - 1 || !transientFetchError(error)) throw error;
      }
      this.totalRetries += 1;
      await delay(this.retryDelaysMs[attempt] ?? 0);
    }
    throw new Error('Supabase checkpoint request exhausted retry attempts.');
  }

  async save(checkpoint: TradingRuntimeCheckpoint) {
    const validated = validateCheckpoint(checkpoint);
    this.writeChain = this.writeChain.catch(() => undefined).then(async () => {
      const body = JSON.stringify({
        runtime_id: this.runtimeId,
        schema_version: validated.schemaVersion,
        saved_at: new Date(validated.savedAt).toISOString(),
        reason: validated.reason,
        checkpoint: validated,
      });
      const startedAt = Date.now();
      this.lastPayloadBytes = Buffer.byteLength(body, 'utf-8');
      try {
        const response = await this.request(`${this.endpoint()}?on_conflict=runtime_id`, {
          method: 'POST',
          headers: this.headers({
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body,
        });
        if (!response.ok) {
          const responseBody = await response.text();
          throw new Error(`Supabase checkpoint write failed (${response.status}): ${responseBody.slice(0, 300)}`);
        }
        this.lastSavedAt = validated.savedAt;
        this.lastError = null;
        this.writes += 1;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : 'Unknown Supabase checkpoint write error.';
        throw error;
      } finally {
        this.lastWriteDurationMs = Date.now() - startedAt;
      }
    });
    await this.writeChain;
    return this.status();
  }

  async load(): Promise<TradingRuntimeCheckpoint | null> {
    const startedAt = Date.now();
    try {
      const url = new URL(this.endpoint());
      url.searchParams.set('runtime_id', `eq.${this.runtimeId}`);
      url.searchParams.set('select', 'checkpoint');
      url.searchParams.set('limit', '1');
      const response = await this.request(url, {
        method: 'GET',
        headers: this.headers({ Accept: 'application/json' }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Supabase checkpoint read failed (${response.status}): ${body.slice(0, 300)}`);
      }
      const rows = await response.json() as SupabaseCheckpointRow[];
      if (rows.length === 0) {
        this.lastError = null;
        return null;
      }
      const parsed = validateCheckpoint(rows[0].checkpoint);
      this.lastRestoredAt = Date.now();
      this.lastSavedAt = parsed.savedAt;
      this.lastError = null;
      this.restores += 1;
      return parsed;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown Supabase checkpoint read error.';
      throw error;
    } finally {
      this.lastReadDurationMs = Date.now() - startedAt;
    }
  }
}

export const createTradingCheckpointStoreFromEnv = (): TradingCheckpointStore => {
  const backend = String(process.env.TRADING_PERSISTENCE_BACKEND ?? 'json').trim().toLowerCase();
  if (backend === 'json') return new JsonTradingCheckpointStore();
  if (backend !== 'supabase') {
    throw new Error('TRADING_PERSISTENCE_BACKEND must be either json or supabase.');
  }

  return new SupabaseTradingCheckpointStore({
    url: process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    runtimeId: tradingRuntimeProfile.runtimeId,
  });
};

export const tradingCheckpointStore = createTradingCheckpointStoreFromEnv();
