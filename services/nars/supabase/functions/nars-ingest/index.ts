import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type SourceType = "rss" | "api" | "filing" | "government" | "research" | "newsletter" | "social" | "other";
type IngestPayload = {
  source: { key: string; name: string; type: SourceType; endpoint?: string; country?: string; language?: string; tier?: number; metadata?: Record<string, unknown> };
  document: { externalId?: string; publishedAt?: string; title: string; url: string; language?: string; isBreaking?: boolean; excerpt?: string; contentHash?: string; metadata?: Record<string, unknown> };
};

const VERSION = "4.5.1-diversity";
const SOURCE_TYPES = new Set<SourceType>(["rss", "api", "filing", "government", "research", "newsletter", "social", "other"]);
const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

function normalizeTitle(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/^\s*\[(속보|종합|단독|영상|알림)\]\s*/u, "").replace(/\s+/g, " ").trim();
}
function canonicalizeUrl(raw: string): string {
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) throw new Error("unsupported_url_protocol");
  url.hash = "";
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "traffic_source"]) url.searchParams.delete(key);
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function validate(payload: unknown): payload is IngestPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Partial<IngestPayload>;
  return Boolean(p.source && typeof p.source.key === "string" && p.source.key.trim() && typeof p.source.name === "string" && p.source.name.trim() && typeof p.source.type === "string" && SOURCE_TYPES.has(p.source.type as SourceType) && p.document && typeof p.document.title === "string" && p.document.title.trim() && typeof p.document.url === "string" && p.document.url.trim());
}

async function lookupDocument(
  supabaseUrl: string,
  headers: Record<string, string>,
  sourceId: string,
  externalId: string | undefined,
  dedupKey: string,
): Promise<string | null> {
  if (externalId) {
    const byExternal = await fetch(`${supabaseUrl}/rest/v1/nars_documents?source_id=eq.${encodeURIComponent(sourceId)}&external_id=eq.${encodeURIComponent(externalId)}&select=id&limit=1`, { headers });
    if (!byExternal.ok) throw new Error(`external_lookup_${byExternal.status}:${await byExternal.text()}`);
    const rows = await byExternal.json() as Array<{ id: string }>;
    if (rows[0]?.id) return rows[0].id;
  }
  const byDedup = await fetch(`${supabaseUrl}/rest/v1/nars_documents?dedup_key=eq.${encodeURIComponent(dedupKey)}&select=id&limit=1`, { headers });
  if (!byDedup.ok) throw new Error(`dedup_lookup_${byDedup.status}:${await byDedup.text()}`);
  const rows = await byDedup.json() as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { ok: false, error: "method_not_allowed" });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return reply(500, { ok: false, error: "server_not_configured" });
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (bearer !== serviceRole) return reply(403, { ok: false, error: "service_role_required" });

  let payload: unknown;
  try { payload = await req.json(); } catch { return reply(400, { ok: false, error: "invalid_json" }); }
  if (!validate(payload)) return reply(400, { ok: false, error: "invalid_payload" });

  const headers = { authorization: `Bearer ${serviceRole}`, apikey: serviceRole, "content-type": "application/json" };
  let sourceId: string | null = null;
  try {
    const seenAt = new Date().toISOString();
    const sourceRes = await fetch(`${supabaseUrl}/rest/v1/nars_sources?on_conflict=source_key`, {
      method: "POST",
      headers: { ...headers, prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ source_key: payload.source.key.trim(), name: payload.source.name.trim(), source_type: payload.source.type, endpoint: payload.source.endpoint ?? null, country: payload.source.country ?? null, language: payload.source.language ?? null, tier: Math.min(5, Math.max(0, payload.source.tier ?? 2)), enabled: true, metadata: payload.source.metadata ?? {}, updated_at: seenAt }),
    });
    if (!sourceRes.ok) throw new Error(`source_upsert_${sourceRes.status}:${await sourceRes.text()}`);
    const sourceRows = await sourceRes.json() as Array<{ id: string }>;
    sourceId = sourceRows[0]?.id ?? null;
    if (!sourceId) throw new Error("source_upsert_returned_no_id");

    const canonicalUrl = canonicalizeUrl(payload.document.url);
    const normalizedTitle = normalizeTitle(payload.document.title);
    const dedupKey = await sha256(`${canonicalUrl}\n${normalizedTitle}`);
    const externalId = payload.document.externalId?.trim() || undefined;

    let documentId = await lookupDocument(supabaseUrl, headers, sourceId, externalId, dedupKey);
    let inserted = false;

    if (!documentId) {
      const docRes = await fetch(`${supabaseUrl}/rest/v1/nars_documents?on_conflict=dedup_key`, {
        method: "POST",
        headers: { ...headers, prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({ source_id: sourceId, external_id: externalId ?? null, published_at: payload.document.publishedAt ?? null, retrieved_at: seenAt, title: payload.document.title.trim(), canonical_url: canonicalUrl, normalized_title: normalizedTitle, dedup_key: dedupKey, language: payload.document.language ?? payload.source.language ?? null, is_breaking: payload.document.isBreaking ?? false, excerpt: payload.document.excerpt ?? null, content_hash: payload.document.contentHash ?? null, raw_metadata: payload.document.metadata ?? {}, ingest_version: VERSION, ingest_origin: "collector" }),
      });
      if (docRes.ok) {
        const docs = await docRes.json() as Array<{ id: string }>;
        documentId = docs[0]?.id ?? null;
        inserted = Boolean(documentId);
      } else if (docRes.status !== 409) {
        throw new Error(`document_insert_${docRes.status}:${await docRes.text()}`);
      }
      if (!documentId) documentId = await lookupDocument(supabaseUrl, headers, sourceId, externalId, dedupKey);
    }

    if (!documentId) throw new Error("document_id_not_resolved");

    const sightingRes = await fetch(`${supabaseUrl}/rest/v1/rpc/nars_record_sighting`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_document_id: documentId, p_origin: "collector", p_seen_at: seenAt, p_legacy_ref: null, p_metadata: { ingest_version: VERSION, source_key: payload.source.key.trim() } }),
    });
    if (!sightingRes.ok) throw new Error(`sighting_record_${sightingRes.status}:${await sightingRes.text()}`);

    await fetch(`${supabaseUrl}/rest/v1/nars_sources?id=eq.${sourceId}`, {
      method: "PATCH", headers,
      body: JSON.stringify({ health_status: "up", last_success_at: seenAt, consecutive_failures: 0, updated_at: seenAt }),
    });

    return reply(200, { ok: true, version: VERSION, inserted, duplicate: !inserted, documentId, dedupKey, sourceId, sightingOrigin: "collector" });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2000) : "unknown_error";
    try {
      await fetch(`${supabaseUrl}/rest/v1/nars_errors`, {
        method: "POST", headers,
        body: JSON.stringify({ component: "edge:nars-ingest", error_code: "INGEST_FAILED", message, retryable: true, source_id: sourceId, context: { ingest_version: VERSION } }),
      });
    } catch {}
    return reply(500, { ok: false, error: "ingest_failed", version: VERSION });
  }
});
