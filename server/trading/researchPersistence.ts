import type {
  ResearchFeatureObservation,
  ResearchFeatureOutcome,
} from '../../src/trading/research/featureOutcome';
import type { ResearchPersistenceBatch } from './researchStore';

export interface ResearchPersistenceStatus {
  backend: 'disabled' | 'supabase';
  configured: boolean;
  lastPersistedAt: number | null;
  lastError: string | null;
  writeBatches: number;
  deliveredObservations: number;
  deliveredOutcomes: number;
}

interface SupabaseResearchPersistenceOptions {
  url: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
}

const chunk = <T>(items: T[], size: number) => {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
};

const observationRow = (item: ResearchFeatureObservation) => ({
  id: item.id,
  cycle_id: item.cycleId,
  observed_at: new Date(item.timestamp).toISOString(),
  market: item.market,
  timeframe: item.timeframe,
  feature_family: item.featureFamily,
  feature_name: item.featureName,
  feature_version: item.featureVersion,
  raw_value: item.rawValue,
  normalized_value: item.normalizedValue,
  direction: item.direction,
  confidence: item.confidence,
  status: item.status,
  strategy_version: item.strategyVersion,
  code_commit: item.codeCommit,
  config_version: item.configVersion,
  provenance: item.provenance,
  reference_price: item.referencePrice,
  execution_decision: item.executionDecision,
  evidence_score: item.evidenceScore,
  evidence_confidence: item.evidenceConfidence,
  oracle_trade_score: item.oracleTradeScore,
  metadata: item.metadata,
});

const outcomeRow = (item: ResearchFeatureOutcome) => ({
  observation_id: item.observationId,
  horizon: item.horizon,
  future_return: item.futureReturn,
  mfe: item.mfe,
  mae: item.mae,
  resolved_at: new Date(item.resolvedAt).toISOString(),
});

export class SupabaseResearchPersistence {
  private readonly url: string;
  private readonly serviceRoleKey: string;
  private readonly fetchImpl: typeof fetch;
  private lastPersistedAt: number | null = null;
  private lastError: string | null = null;
  private writeBatches = 0;
  private deliveredObservations = 0;
  private deliveredOutcomes = 0;

  constructor(options: SupabaseResearchPersistenceOptions) {
    if (!options.url.trim()) throw new Error('SUPABASE_URL is required for normalized research persistence.');
    if (!options.serviceRoleKey.trim()) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for normalized research persistence.');
    this.url = options.url.replace(/\/+$/, '');
    this.serviceRoleKey = options.serviceRoleKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  status(): ResearchPersistenceStatus {
    return {
      backend: 'supabase',
      configured: true,
      lastPersistedAt: this.lastPersistedAt,
      lastError: this.lastError,
      writeBatches: this.writeBatches,
      deliveredObservations: this.deliveredObservations,
      deliveredOutcomes: this.deliveredOutcomes,
    };
  }

  private headers() {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    };
  }

  private async postRows(table: string, onConflict: string, rows: Record<string, unknown>[]) {
    if (rows.length === 0) return;
    const endpoint = new URL(`${this.url}/rest/v1/${table}`);
    endpoint.searchParams.set('on_conflict', onConflict);
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(rows),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase research write failed for ${table} (${response.status}): ${body.slice(0, 300)}`);
    }
  }

  async persist(batch: ResearchPersistenceBatch) {
    try {
      // Observations must land before outcomes because the outcome table has a
      // restrictive foreign key to the canonical observation row.
      for (const rows of chunk(batch.observations.map(observationRow), 500)) {
        await this.postRows('research_feature_observations', 'id', rows);
      }
      for (const rows of chunk(batch.outcomes.map(outcomeRow), 1_000)) {
        await this.postRows('research_feature_outcomes', 'observation_id,horizon', rows);
      }
      this.lastPersistedAt = Date.now();
      this.lastError = null;
      this.writeBatches += 1;
      this.deliveredObservations += batch.observations.length;
      this.deliveredOutcomes += batch.outcomes.length;
      return { persisted: true as const, status: this.status() };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown normalized research persistence error.';
      throw error;
    }
  }
}

class DisabledResearchPersistence {
  status(): ResearchPersistenceStatus {
    return {
      backend: 'disabled',
      configured: false,
      lastPersistedAt: null,
      lastError: null,
      writeBatches: 0,
      deliveredObservations: 0,
      deliveredOutcomes: 0,
    };
  }

  async persist(_batch: ResearchPersistenceBatch) {
    return { persisted: false as const, status: this.status() };
  }
}

export type ResearchPersistence = SupabaseResearchPersistence | DisabledResearchPersistence;

export const createResearchPersistenceFromEnv = (): ResearchPersistence => {
  const url = String(process.env.SUPABASE_URL ?? '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !serviceRoleKey) return new DisabledResearchPersistence();
  return new SupabaseResearchPersistence({ url, serviceRoleKey });
};

export const researchPersistence = createResearchPersistenceFromEnv();
