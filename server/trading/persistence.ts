import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TradingEvidence } from '../../src/trading/evidence';
import type { ExperimentLedgerEvent } from '../../src/trading/experimentLedger';
import type { GradeSurveillanceCheckpoint } from '../../src/trading/gradeSurveillance';
import { normalizeQualificationWindow, type QualificationWindowCheckpoint } from '../../src/trading/qualificationWindow';
import type { TradeCaseRecord } from '../../src/trading/tradeCase';
import type { PaperLoopCheckpoint } from './paperLoop';
import type { PaperTradingSessionCheckpoint } from './paperSession';

export interface TradingRuntimeCheckpoint {
  schemaVersion: 1;
  savedAt: number;
  reason: string;
  session: PaperTradingSessionCheckpoint;
  evidence: TradingEvidence[];
  loop: PaperLoopCheckpoint;
  tradeCases?: TradeCaseRecord[];
  integrity?: unknown;
  gradeSurveillance?: GradeSurveillanceCheckpoint;
  experimentLedger?: ExperimentLedgerEvent[];
  qualificationWindow?: QualificationWindowCheckpoint;
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
}

export interface TradingCheckpointStore {
  status(): PersistenceStatus;
  save(checkpoint: TradingRuntimeCheckpoint): Promise<PersistenceStatus>;
  load(): Promise<TradingRuntimeCheckpoint | null>;
}

const defaultStatePath = () => process.env.TRADING_STATE_FILE
  ? path.resolve(process.env.TRADING_STATE_FILE)
  : path.resolve(process.cwd(), '.data', 'black-oracle-trading-state.json');

export const validateCheckpoint = (value: unknown): TradingRuntimeCheckpoint => {
  if (!value || typeof value !== 'object') throw new Error('Trading checkpoint must be an object.');
  const checkpoint = value as Partial<TradingRuntimeCheckpoint>;
  if (checkpoint.schemaVersion !== 1) throw new Error('Unsupported trading checkpoint schema.');
  if (!Number.isFinite(checkpoint.savedAt)) throw new Error('Trading checkpoint savedAt is invalid.');
  if (typeof checkpoint.reason !== 'string') throw new Error('Trading checkpoint reason is invalid.');
  if (!checkpoint.session || !checkpoint.loop || !Array.isArray(checkpoint.evidence)) {
    throw new Error('Trading checkpoint payload is incomplete.');
  }
  if (checkpoint.tradeCases !== undefined && !Array.isArray(checkpoint.tradeCases)) {
    throw new Error('Trading checkpoint tradeCases must be an array when present.');
  }
  if (checkpoint.gradeSurveillance !== undefined) {
    if (!checkpoint.gradeSurveillance || checkpoint.gradeSurveillance.schemaVersion !== 1 || !Array.isArray(checkpoint.gradeSurveillance.history)) {
      throw new Error('Trading checkpoint gradeSurveillance is invalid.');
    }
  }
  if (checkpoint.experimentLedger !== undefined && !Array.isArray(checkpoint.experimentLedger)) {
    throw new Error('Trading checkpoint experimentLedger must be an array when present.');
  }
  if (checkpoint.qualificationWindow !== undefined) {
    normalizeQualificationWindow(checkpoint.qualificationWindow);
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
    };
  }

  async save(checkpoint: TradingRuntimeCheckpoint) {
    const validated = validateCheckpoint(checkpoint);
    this.writeChain = this.writeChain.catch(() => undefined).then(async () => {
      const directory = path.dirname(this.filePath);
      await mkdir(directory, { recursive: true });
      const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      try {
        await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 });
        await rename(temporaryPath, this.filePath);
        this.lastSavedAt = validated.savedAt;
        this.lastError = null;
        this.writes += 1;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : 'Unknown checkpoint write error.';
        throw error;
      }
    });
    await this.writeChain;
    return this.status();
  }

  async load(): Promise<TradingRuntimeCheckpoint | null> {
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
    }
  }
}

interface SupabaseTradingCheckpointStoreOptions {
  url: string;
  serviceRoleKey: string;
  runtimeId?: string;
  table?: string;
  fetchImpl?: typeof fetch;
}

interface SupabaseCheckpointRow {
  checkpoint: unknown;
}

export class SupabaseTradingCheckpointStore implements TradingCheckpointStore {
  private readonly url: string;
  private readonly serviceRoleKey: string;
  private readonly runtimeId: string;
  private readonly table: string;
  private readonly fetchImpl: typeof fetch;
  private writeChain: Promise<void> = Promise.resolve();
  private lastSavedAt: number | null = null;
  private lastRestoredAt: number | null = null;
  private lastError: string | null = null;
  private writes = 0;
  private restores = 0;

  constructor(options: SupabaseTradingCheckpointStoreOptions) {
    if (!options.url.trim()) throw new Error('SUPABASE_URL is required for Supabase trading persistence.');
    if (!options.serviceRoleKey.trim()) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for Supabase trading persistence.');
    this.url = options.url.replace(/\/+$/, '');
    this.serviceRoleKey = options.serviceRoleKey;
    this.runtimeId = options.runtimeId?.trim() || 'black-oracle-paper';
    this.table = options.table?.trim() || 'black_oracle_trading_runtime';
    this.fetchImpl = options.fetchImpl ?? fetch;
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

  async save(checkpoint: TradingRuntimeCheckpoint) {
    const validated = validateCheckpoint(checkpoint);
    this.writeChain = this.writeChain.catch(() => undefined).then(async () => {
      try {
        const response = await this.fetchImpl(`${this.endpoint()}?on_conflict=runtime_id`, {
          method: 'POST',
          headers: this.headers({
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify({
            runtime_id: this.runtimeId,
            schema_version: validated.schemaVersion,
            saved_at: new Date(validated.savedAt).toISOString(),
            reason: validated.reason,
            checkpoint: validated,
          }),
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Supabase checkpoint write failed (${response.status}): ${body.slice(0, 300)}`);
        }
        this.lastSavedAt = validated.savedAt;
        this.lastError = null;
        this.writes += 1;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : 'Unknown Supabase checkpoint write error.';
        throw error;
      }
    });
    await this.writeChain;
    return this.status();
  }

  async load(): Promise<TradingRuntimeCheckpoint | null> {
    try {
      const url = new URL(this.endpoint());
      url.searchParams.set('runtime_id', `eq.${this.runtimeId}`);
      url.searchParams.set('select', 'checkpoint');
      url.searchParams.set('limit', '1');
      const response = await this.fetchImpl(url, {
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
    runtimeId: process.env.TRADING_RUNTIME_ID,
  });
};

export const tradingCheckpointStore = createTradingCheckpointStoreFromEnv();
