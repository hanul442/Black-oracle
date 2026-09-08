import type { EvidenceCoverageRequest } from '../../src/trading/evidenceCoverage';

export interface StoredEvidenceCoverageRequest extends EvidenceCoverageRequest {
  runtimeId: string;
  lastAttemptAt: number | null;
  fulfilledAt: number | null;
  evidenceIds: string[];
}

const clone = (item: StoredEvidenceCoverageRequest): StoredEvidenceCoverageRequest => ({
  ...item,
  aliases: item.aliases.slice(),
  evidenceIds: item.evidenceIds.slice(),
});

export class EvidenceCoverageRequestStore {
  private readonly memory = new Map<string, StoredEvidenceCoverageRequest>();
  private readonly supabaseUrl = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  private readonly serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  private readonly runtimeId = String(process.env.TRADING_RUNTIME_ID ?? 'black-oracle-paper');

  private get configured() {
    return Boolean(this.supabaseUrl && this.serviceRoleKey);
  }

  private headers(extra: Record<string, string> = {}) {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      ...extra,
    };
  }

  async enqueue(request: EvidenceCoverageRequest): Promise<StoredEvidenceCoverageRequest> {
    const stored: StoredEvidenceCoverageRequest = {
      ...request,
      aliases: request.aliases.slice(),
      runtimeId: this.runtimeId,
      lastAttemptAt: null,
      fulfilledAt: null,
      evidenceIds: [],
    };
    this.memory.set(request.requestKey, stored);

    if (!this.configured) return clone(stored);

    const response = await fetch(`${this.supabaseUrl}/rest/v1/black_oracle_evidence_requests?on_conflict=request_key`, {
      method: 'POST',
      headers: this.headers({
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify({
        request_key: request.requestKey,
        runtime_id: this.runtimeId,
        market: request.market,
        asset_class: request.assetClass,
        aliases: request.aliases,
        status: request.status,
        trigger: request.trigger,
        reason: request.reason,
        decision_id: request.decisionId ?? null,
        strategy_id: request.strategyId ?? null,
        minimum_active_evidence: request.minimumActiveEvidence,
        requested_at: new Date(request.requestedAt).toISOString(),
        required_by: new Date(request.requiredBy).toISOString(),
        execution_authority: false,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Evidence coverage request write failed (${response.status}): ${body.slice(0, 300)}`);
    }
    return clone(stored);
  }

  async list(limit = 100): Promise<StoredEvidenceCoverageRequest[]> {
    if (!this.configured) {
      return Array.from(this.memory.values())
        .sort((a, b) => b.requestedAt - a.requestedAt)
        .slice(0, limit)
        .map(clone);
    }

    const url = new URL(`${this.supabaseUrl}/rest/v1/black_oracle_evidence_requests`);
    url.searchParams.set('select', '*');
    url.searchParams.set('order', 'requested_at.desc');
    url.searchParams.set('limit', String(Math.max(1, Math.min(500, limit))));
    const response = await fetch(url, { headers: this.headers({ Accept: 'application/json' }), cache: 'no-store' });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Evidence coverage request read failed (${response.status}): ${body.slice(0, 300)}`);
    }
    const rows = await response.json() as any[];
    return rows.map((row) => ({
      requestKey: String(row.request_key),
      runtimeId: String(row.runtime_id),
      market: String(row.market),
      assetClass: row.asset_class,
      aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : [],
      status: row.status,
      trigger: row.trigger,
      requestedAt: Date.parse(row.requested_at),
      requiredBy: Date.parse(row.required_by),
      reason: String(row.reason ?? ''),
      decisionId: row.decision_id ?? null,
      strategyId: row.strategy_id ?? null,
      minimumActiveEvidence: Number(row.minimum_active_evidence ?? 1),
      executionAuthority: false,
      lastAttemptAt: row.last_attempt_at ? Date.parse(row.last_attempt_at) : null,
      fulfilledAt: row.fulfilled_at ? Date.parse(row.fulfilled_at) : null,
      evidenceIds: Array.isArray(row.evidence_ids) ? row.evidence_ids.map(String) : [],
    }));
  }
}

export const evidenceCoverageRequestStore = new EvidenceCoverageRequestStore();
