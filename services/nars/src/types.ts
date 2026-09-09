export type SourceType = 'rss' | 'api' | 'filing' | 'government' | 'research' | 'newsletter' | 'social' | 'other';

export type SourceRecord = {
  key: string;
  name: string;
  type: SourceType;
  endpoint: string;
  country?: string;
  language?: string;
  tier?: number;
  metadata?: Record<string, unknown>;
};

export type IngestDocument = {
  externalId?: string;
  publishedAt?: string;
  title: string;
  url: string;
  language?: string;
  isBreaking?: boolean;
  excerpt?: string;
  contentHash?: string;
  metadata?: Record<string, unknown>;
};

export type IngestEnvelope = {
  source: Omit<SourceRecord, 'endpoint'> & { endpoint?: string };
  document: IngestDocument;
};

export type QueueMessage = IngestEnvelope & {
  fetchedAt: string;
  attempt?: number;
};

export interface Env {
  NARS_INGEST_QUEUE: Queue<QueueMessage>;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  NARS_SOURCE_CONFIG_JSON?: string;
}
