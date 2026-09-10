const dbConfig = () => {
  const base = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  return base && key ? { base, headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } } : null;
};

const boundedInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
};

const readRows = async (table: string, params: Record<string, string>) => {
  const db = dbConfig();
  if (!db) throw new Error('Supabase operational credentials are unavailable.');
  const url = new URL(`${db.base}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { ...db.headers, Prefer: 'count=exact' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${table} read failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const contentRange = response.headers.get('content-range') ?? '';
  const totalText = contentRange.split('/')[1];
  const total = totalText && totalText !== '*' ? Number(totalText) : null;
  return { rows: await response.json() as any[], total: Number.isFinite(total) ? total : null };
};

const strings = (value: unknown, max = 8) => Array.isArray(value) ? value.slice(0, max).map((item) => String(item).slice(0, 180)) : [];
const text = (value: unknown, max = 500) => typeof value === 'string' ? value.slice(0, max) : '';

const compactEvidence = (value: unknown) => Array.isArray(value) ? value.slice(0, 4).map((item: any) => ({
  title: text(item?.title ?? item?.document_title, 220) || null,
  publisher: text(item?.publisher_key ?? item?.publisher ?? item?.authority_key, 120) || null,
  authority: text(item?.authority_key, 120) || null,
  grade: text(item?.evidence_grade ?? item?.grade, 40) || null,
  score: Number.isFinite(Number(item?.evidence_score ?? item?.score)) ? Number(item?.evidence_score ?? item?.score) : null,
  sourceUrl: text(item?.source_url ?? item?.url ?? item?.canonical_url, 500) || null,
})) : [];

const compactEntities = (value: unknown) => Array.isArray(value) ? value.slice(0, 12).map((item: any) => {
  if (typeof item === 'string') return { name: text(item, 180), type: null, source: null, authority: null };
  return {
    name: text(item?.name ?? item?.label, 180) || null,
    type: text(item?.type, 80) || null,
    source: text(item?.source, 120) || null,
    authority: text(item?.authority_key, 120) || null,
  };
}).filter((item) => item.name) : [];

const compactClaims = (value: unknown) => Array.isArray(value) ? value.slice(0, 8).map((item: any) => ({
  text: typeof item === 'string' ? text(item, 400) : text(item?.text ?? item?.claim_text ?? item?.claim, 400),
  type: typeof item === 'object' && item ? text(item?.type ?? item?.claim_type, 80) || null : null,
  status: typeof item === 'object' && item ? text(item?.status, 80) || null : null,
})).filter((item) => item.text) : [];

const compactAnalysis = (value: unknown) => {
  const item = value && typeof value === 'object' ? value as any : null;
  if (!item) return null;
  return {
    version: text(item?.version, 120) || null,
    method: text(item?.method, 120) || null,
    claimCount: Number.isFinite(Number(item?.claim_count)) ? Number(item.claim_count) : null,
    entityCount: Number.isFinite(Number(item?.entity_count)) ? Number(item.entity_count) : null,
    marketDirectionAnalyzed: item?.market_direction_analyzed === true,
    executionAuthority: item?.execution_authority === true,
    fingerprint: text(item?.fingerprint, 160) || null,
  };
};

const compactInbox = (row: any) => {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
  const claims = compactClaims(payload?.claims);
  const entities = compactEntities(payload?.entities);
  return {
    outboxId: String(row?.outbox_id ?? ''),
    eventId: row?.event_id == null ? null : String(row.event_id),
    packetType: String(row?.packet_type ?? ''),
    packetSchemaVersion: text(payload?.schema_version, 40) || null,
    producer: String(row?.producer ?? ''),
    authority: String(row?.authority ?? 'evidence_only'),
    executionAuthority: Boolean(row?.execution_authority),
    status: String(row?.status ?? ''),
    mappedMarkets: strings(row?.mapped_markets, 12),
    receivedAt: row?.received_at ?? null,
    analyzedAt: row?.analyzed_at ?? null,
    updatedAt: row?.updated_at ?? null,
    lastError: text(row?.last_error, 500) || null,
    eventTitle: text(payload?.event_title ?? payload?.title, 300) || null,
    eventSummary: text(payload?.event_summary ?? payload?.summary, 800) || null,
    eventStatus: text(payload?.event_status, 80) || null,
    evidenceGrade: text(payload?.evidence_grade, 40) || null,
    evidenceScore: Number.isFinite(Number(payload?.evidence_score)) ? Number(payload.evidence_score) : null,
    riskTags: strings(payload?.risk_tags, 12),
    marketTags: strings(payload?.market_tags, 12),
    entities,
    entityCount: entities.length,
    claims,
    claimsCount: claims.length,
    analysis: compactAnalysis(payload?.analysis),
    evidence: compactEvidence(payload?.evidence),
  };
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ success: false, error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const limit = boundedInt(request.query?.limit, 50, 10, 200);
    const nowIso = new Date().toISOString();
    const [inboxResult, activeEvidenceResult, sourcesResult] = await Promise.all([
      readRows('black_oracle_nars_inbox', {
        select: 'outbox_id,event_id,packet_type,producer,authority,execution_authority,mapped_markets,status,payload,received_at,analyzed_at,updated_at,last_error',
        order: 'received_at.desc',
        limit: '500',
      }),
      readRows('black_oracle_external_evidence', {
        select: 'id,event_id,market,title,direction,strength,reliability,source_type,source,observed_at,expires_at,rationale,materiality,impact_confidence,evidence_grade,evidence_score,citations,eligible_for_new_risk,analysis_model,analysis_version',
        expires_at: `gt.${nowIso}`,
        order: 'observed_at.desc',
        limit: '200',
      }),
      readRows('nars_sources', {
        select: 'source_key,name,source_type,country,language,tier,enabled,health_status,last_success_at,last_failure_at,consecutive_failures',
        enabled: 'eq.true',
        order: 'tier.asc,source_key.asc',
        limit: '200',
      }),
    ]);

    const inbox = inboxResult.rows.map(compactInbox);
    const statusCounts = inbox.reduce<Record<string, number>>((acc, item) => {
      const status = item.status || 'UNKNOWN';
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
    const mapped = inbox.filter((item) => item.mappedMarkets.length > 0).length;
    const analyzed = statusCounts.ANALYZED ?? 0;
    const narsAnalyzed = inbox.filter((item) => item.analysis?.method === 'deterministic_source_bound').length;
    const packetsWithEntities = inbox.filter((item) => item.entityCount > 0).length;
    const packetsWithClaims = inbox.filter((item) => item.claimsCount > 0).length;
    const unmapped = statusCounts.UNMAPPED ?? 0;
    const errors = statusCounts.ERROR ?? 0;
    const totalObserved = inboxResult.total ?? inbox.length;
    const sampleSize = inbox.length;
    const mappingRate = sampleSize > 0 ? mapped / sampleSize : null;
    const analysisRate = sampleSize > 0 ? analyzed / sampleSize : null;
    const narsAnalyzeCoverage = sampleSize > 0 ? narsAnalyzed / sampleSize : null;
    const degradedSources = sourcesResult.rows.filter((source) => String(source?.health_status ?? '').toLowerCase() !== 'up');

    const warnings: string[] = [];
    if (sampleSize && unmapped / sampleSize >= 0.5) warnings.push(`NARS last-mile mapping is degraded: ${unmapped}/${sampleSize} sampled inbox packets are UNMAPPED.`);
    if (activeEvidenceResult.rows.length === 0) warnings.push('No active Black Oracle external Evidence is currently available from the NARS bridge.');
    if (errors > 0) warnings.push(`${errors} NARS bridge packet(s) are in ERROR in the sampled inbox.`);
    if (degradedSources.length > 0) warnings.push(`${degradedSources.length} enabled NARS source(s) are not reporting health=up.`);

    return response.status(200).json({
      success: true,
      authority: { producer: 'NARS', role: 'evidence_only', executionAuthority: false },
      generatedAt: Date.now(),
      stats: {
        totalInbox: totalObserved,
        sampledInbox: sampleSize,
        mapped,
        unmapped,
        analyzed,
        errors,
        mappingRate,
        analysisRate,
        narsAnalyzed,
        narsAnalyzeCoverage,
        packetsWithEntities,
        packetsWithClaims,
        activeExternalEvidence: activeEvidenceResult.total ?? activeEvidenceResult.rows.length,
        enabledSources: sourcesResult.total ?? sourcesResult.rows.length,
        degradedSources: degradedSources.length,
      },
      warnings,
      recentPackets: inbox.slice(0, limit),
      activeEvidence: activeEvidenceResult.rows.slice(0, limit),
      sources: sourcesResult.rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown NARS status error.';
    console.error('Black Oracle NARS status failed:', error);
    return response.status(500).json({ success: false, error: message, recentPackets: [], activeEvidence: [], sources: [] });
  }
}
