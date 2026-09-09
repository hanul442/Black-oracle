import type { CanonicalEventInput } from './eventLedger';

export type InboxRow = {
  outbox_id: string;
  event_id?: string | null;
  status: string;
  mapped_markets?: string[] | null;
  received_at?: string | null;
  updated_at?: string | null;
  analyzed_at?: string | null;
  last_error?: string | null;
};

export type ExternalEvidenceRow = {
  id: string;
  packet_outbox_id?: string | null;
  event_id?: string | null;
  market: string;
  title?: string | null;
  direction?: string | null;
  materiality?: number | null;
  impact_confidence?: number | null;
  evidence_grade?: string | null;
  evidence_score?: number | null;
  eligible_for_new_risk?: boolean | null;
  analysis_model?: string | null;
  analysis_version?: string | null;
  updated_at?: string | null;
  execution_authority?: boolean | null;
};

const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  return base && key ? {
    base,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  } : null;
};

const boundedWindow = (startedAt: unknown, finishedAt: unknown) => {
  const start = Number(startedAt);
  const finish = Number(finishedAt);
  const now = Date.now();
  const from = Number.isFinite(start) && start > 0 ? start - 5_000 : now - 120_000;
  const to = Number.isFinite(finish) && finish >= from ? finish + 15_000 : now + 15_000;
  return { from, to };
};

const severityForStatus = (status: string): CanonicalEventInput['severity'] => {
  if (status === 'ERROR' || status === 'REJECTED') return 'WARN';
  return 'INFO';
};

const readRows = async <T>(table: string, select: string, timeColumn: string, from: number, to: number, limit = 80): Promise<T[]> => {
  const db = dbConfig();
  if (!db) return [];
  const url = new URL(`${db.base}/rest/v1/${table}`);
  url.searchParams.set('select', select);
  url.searchParams.set(timeColumn, `gte.${new Date(from).toISOString()}`);
  url.searchParams.append(timeColumn, `lte.${new Date(to).toISOString()}`);
  url.searchParams.set('order', `${timeColumn}.asc`);
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url, { headers: db.headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${table} canonical audit read failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return await response.json() as T[];
};

export const projectNarsRowsToCanonicalEvents = (
  inboxRows: InboxRow[],
  externalRows: ExternalEvidenceRow[],
  runtimeId: string,
  fallbackOccurredAt: number | string,
): CanonicalEventInput[] => {
  const fallback = typeof fallbackOccurredAt === 'number'
    ? new Date(fallbackOccurredAt).toISOString()
    : String(fallbackOccurredAt);
  const events: CanonicalEventInput[] = [];

  for (const row of inboxRows) {
    const status = String(row.status || 'UNKNOWN').toUpperCase();
    const occurredAt = row.updated_at || row.analyzed_at || row.received_at || fallback;
    const markets = Array.isArray(row.mapped_markets) ? row.mapped_markets.map(String) : [];
    events.push({
      eventKey: `nars-outbox:${row.outbox_id}:${status}:${occurredAt}`,
      occurredAt,
      runtimeId,
      eventType: 'EVIDENCE',
      eventName: `NARS_PACKET_${status}`,
      market: markets.length === 1 ? markets[0] : null,
      action: status,
      summary: `NARS EvidencePacket ${status}${markets.length ? ` for ${markets.join(', ')}` : ' without a deterministic market mapping'}.`,
      reason: row.last_error || (status === 'UNMAPPED'
        ? 'Packet was delivered to Black Oracle but no supported market alias matched yet.'
        : status === 'MAPPED'
          ? 'Packet mapped to a market but demand-gated impact analysis was not required in this cycle.'
          : status === 'ANALYZED'
            ? 'Packet mapped and market-impact analysis completed; evidence remains advisory and execution authority is false.'
            : 'NARS bridge status recorded.'),
      severity: severityForStatus(status),
      authority: 'evidence_only',
      executionAuthority: false,
      source: 'nars_bridge',
      trace: {
        status,
        mappedMarkets: markets,
        receivedAt: row.received_at ?? null,
        updatedAt: row.updated_at ?? null,
        analyzedAt: row.analyzed_at ?? null,
        lastError: row.last_error ?? null,
      },
      links: { outboxId: row.outbox_id, eventId: row.event_id ?? null },
    });
  }

  for (const row of externalRows) {
    const occurredAt = row.updated_at || fallback;
    events.push({
      eventKey: `external-evidence:${row.id}:${occurredAt}`,
      occurredAt,
      runtimeId,
      eventType: 'EVIDENCE',
      eventName: 'EXTERNAL_EVIDENCE_ANALYZED',
      market: row.market,
      action: String(row.direction || 'NEUTRAL'),
      summary: `${row.market} external Evidence analyzed: ${String(row.direction || 'NEUTRAL')} · materiality ${Number(row.materiality ?? 0).toFixed(2)} · confidence ${Number(row.impact_confidence ?? 0).toFixed(2)}.`,
      reason: row.eligible_for_new_risk
        ? 'Evidence passed the bounded new-risk eligibility threshold, but it still cannot execute or promote a trade by itself.'
        : 'Evidence did not qualify for new-risk eligibility or is neutral; no execution authority was granted.',
      severity: 'INFO',
      authority: 'evidence_only',
      executionAuthority: false,
      source: 'nars_impact_analysis',
      trace: {
        title: row.title ?? null,
        direction: row.direction ?? null,
        materiality: row.materiality ?? null,
        confidence: row.impact_confidence ?? null,
        evidenceGrade: row.evidence_grade ?? null,
        evidenceScore: row.evidence_score ?? null,
        eligibleForNewRisk: Boolean(row.eligible_for_new_risk),
        analysisModel: row.analysis_model ?? null,
        analysisVersion: row.analysis_version ?? null,
        sourceExecutionAuthority: Boolean(row.execution_authority),
      },
      links: {
        evidenceId: row.id,
        outboxId: row.packet_outbox_id ?? null,
        eventId: row.event_id ?? null,
      },
    });
  }

  return events;
};

export const buildNarsCanonicalAuditEvents = async (cycle: any, runtimeId: string): Promise<CanonicalEventInput[]> => {
  const db = dbConfig();
  if (!db) return [];
  const { from, to } = boundedWindow(cycle?.startedAt, cycle?.finishedAt);
  const [inboxRows, externalRows] = await Promise.all([
    readRows<InboxRow>(
      'black_oracle_nars_inbox',
      'outbox_id,event_id,status,mapped_markets,received_at,updated_at,analyzed_at,last_error',
      'updated_at',
      from,
      to,
      100,
    ),
    readRows<ExternalEvidenceRow>(
      'black_oracle_external_evidence',
      'id,packet_outbox_id,event_id,market,title,direction,materiality,impact_confidence,evidence_grade,evidence_score,eligible_for_new_risk,analysis_model,analysis_version,updated_at,execution_authority',
      'updated_at',
      from,
      to,
      100,
    ),
  ]);
  return projectNarsRowsToCanonicalEvents(inboxRows, externalRows, runtimeId, to);
};
