import type { TradingEvidence } from '../../src/trading/evidence';
import { tradingEvidenceStore } from './evidenceStore';

const sourceType = (value: unknown): TradingEvidence['sourceType'] => {
  const normalized = String(value ?? '').toUpperCase();
  if (normalized === 'PRIMARY' || normalized === 'NEWS' || normalized === 'MACRO' || normalized === 'ONCHAIN' || normalized === 'MARKET' || normalized === 'ANALYST' || normalized === 'SYSTEM') return normalized;
  return 'SYSTEM';
};

export const loadActiveExternalEvidence = async (limit = 500): Promise<TradingEvidence[]> => {
  const supabaseUrl = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  if (!supabaseUrl || !serviceRoleKey) return [];
  const now = new Date().toISOString();
  const url = new URL(`${supabaseUrl}/rest/v1/black_oracle_external_evidence`);
  url.searchParams.set('expires_at', `gt.${now}`);
  url.searchParams.set('select', 'id,market,title,direction,strength,reliability,source_type,source,observed_at,expires_at,contradiction_of,tags');
  url.searchParams.set('order', 'observed_at.desc');
  url.searchParams.set('limit', String(Math.max(1, Math.min(2_000, limit))));
  const response = await fetch(url, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`External evidence read failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  const rows = await response.json() as any[];
  return rows.map((row) => ({
    id: String(row.id),
    market: String(row.market).toUpperCase(),
    title: String(row.title),
    direction: row.direction === 'BULLISH' || row.direction === 'BEARISH' ? row.direction : 'NEUTRAL',
    strength: Number(row.strength),
    reliability: Number(row.reliability),
    sourceType: sourceType(row.source_type),
    source: row.source ? String(row.source) : undefined,
    observedAt: Date.parse(row.observed_at),
    expiresAt: Date.parse(row.expires_at),
    contradictionOf: row.contradiction_of ? String(row.contradiction_of) : undefined,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  })).filter((item) => Number.isFinite(item.observedAt) && Number.isFinite(item.expiresAt));
};

export const syncAnalyzedNarsEvidence = async () => {
  const external = await loadActiveExternalEvidence();
  if (!external.length) return { imported: 0, total: tradingEvidenceStore.list().length };
  const merged = new Map<string, TradingEvidence>(
    tradingEvidenceStore.list(undefined, true).map((item) => [item.id, item] as [string, TradingEvidence]),
  );
  for (const item of external) merged.set(item.id, item);
  tradingEvidenceStore.replaceAll(Array.from(merged.values()));
  return { imported: external.length, total: tradingEvidenceStore.list().length };
};
