import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TradingEvidence } from '../../src/trading/evidence';
import type { PaperLoopCheckpoint } from './paperLoop';
import type { PaperTradingSessionCheckpoint } from './paperSession';

export interface TradingRuntimeCheckpoint {
  schemaVersion: 1;
  savedAt: number;
  reason: string;
  session: PaperTradingSessionCheckpoint;
  evidence: TradingEvidence[];
  loop: PaperLoopCheckpoint;
}

export interface PersistenceStatus {
  filePath: string;
  lastSavedAt: number | null;
  lastRestoredAt: number | null;
  lastError: string | null;
  writes: number;
  restores: number;
}

const defaultStatePath = () => process.env.TRADING_STATE_FILE
  ? path.resolve(process.env.TRADING_STATE_FILE)
  : path.resolve(process.cwd(), '.data', 'black-oracle-trading-state.json');

const validateCheckpoint = (value: unknown): TradingRuntimeCheckpoint => {
  if (!value || typeof value !== 'object') throw new Error('Trading checkpoint must be an object.');
  const checkpoint = value as Partial<TradingRuntimeCheckpoint>;
  if (checkpoint.schemaVersion !== 1) throw new Error('Unsupported trading checkpoint schema.');
  if (!Number.isFinite(checkpoint.savedAt)) throw new Error('Trading checkpoint savedAt is invalid.');
  if (typeof checkpoint.reason !== 'string') throw new Error('Trading checkpoint reason is invalid.');
  if (!checkpoint.session || !checkpoint.loop || !Array.isArray(checkpoint.evidence)) {
    throw new Error('Trading checkpoint payload is incomplete.');
  }
  return checkpoint as TradingRuntimeCheckpoint;
};

export class JsonTradingCheckpointStore {
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

export const tradingCheckpointStore = new JsonTradingCheckpointStore();
