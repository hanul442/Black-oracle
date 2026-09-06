import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type LegacyRow = {
  rowNumber?: number;
  datetime: string;
  source: string;
  lang?: string;
  title: string;
  link: string;
  is_breaking?: string | boolean;
  norm_title?: string;
  norm_link?: string;
};

type BatchPayload = {
  batchId?: string;
  rows: LegacyRow[];
};

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

function sourceKey(name: string): string {
  const slug = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `v3:${slug || "unknown"}`;
}

function normalizeTitle(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^\s*\[(속보|종합|단독|영상|알림)\]\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeUrl(raw: string): string {
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) throw new Error("unsupported_url_protocol");
  url.hash = "";
  for (const key of [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "traffic_source",
  ]) url.searchParams.delete(key);
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function parseLegacyTime(value: string): string | null {
  const trimmed = value.trim();
  const kst = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  if (kst) return `${kst[1]}T${kst[2]}+09:00`;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function parseBreaking(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return value;
  return /^(y|yes|true|1)$/i.test(value?.trim() ?? "");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function validRow(value: unknown): value is LegacyRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<LegacyRow>;
  return Boolean(
    typeof row.datetime === "string" && row.datetime.trim() &&
    typeof row.source === "string" && row.source.trim() &&
    typeof row.title === "string" && row.title.trim() &&
    typeof row.link === "string" && row.link.trim()
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { ok: false, error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return reply(500, { ok: false, error: "server_not_configured" });

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (bearer !== serviceRole) return reply(403, { ok: false, error: "service_role_required" });

  let payload: BatchPayload;
  try {
    payload = await req.json() as BatchPayload;
  } catch {
    return reply(400, { ok: false, error: "invalid_json" });
  }

  if (!Array.isArray(payload?.rows) || payload.rows.length < 1 || payload.rows.length > 200) {
    return reply(400, { ok: false, error: "rows_must_contain_1_to_200_items" });
  }
  if (!payload.rows.every(validRow)) return reply(400, { ok: false, error: "invalid_row" });

  const now = new Date().toISOString();
  const batchId = payload.batchId?.trim() || crypto.randomUUID();
  const headers = {
    authorization: `Bearer ${serviceRole}`,
    apikey: serviceRole,
    "content-type": "application/json",
  };

  let jobId: string | null = null;
  try {
    const jobRes = await fetch(`${supabaseUrl}/rest/v1/nars_job_runs`, {
      method: "POST",
      headers: { ...headers, prefer: "return=representation" },
      body: JSON.stringify({
        job_type: "v3_shadow_import",
        job_key: batchId,
        status: "running",
        started_at: now,
        attempt: 1,
        items_in: payload.rows.length,
        metadata: { origin: "nars_v3_sheet", batch_id: batchId },
      }),
    });
    if (jobRes.ok) {
      const jobs = await jobRes.json() as Array<{ id: string }>;
      jobId = jobs[0]?.id ?? null;
    }

    const uniqueSources = new Map<string, LegacyRow>();
    for (const row of payload.rows) uniqueSources.set(sourceKey(row.source), row);

    const sourceIds = new Map<string, string>();
    for (const [key, row] of uniqueSources) {
      const sourceRes = await fetch(`${supabaseUrl}/rest/v1/nars_sources?on_conflict=source_key`, {
        method: "POST",
        headers: { ...headers, prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          source_key: key,
          name: row.source.trim(),
          source_type: "rss",
          endpoint: null,
          country: null,
          language: row.lang?.trim() || null,
          tier: 2,
          enabled: true,
          metadata: {
            shadow_bridge: true,
            legacy_system: "NARS v3.0.1",
            tier_unreviewed: true,
          },
          updated_at: now,
        }),
      });
      if (!sourceRes.ok) throw new Error(`source_upsert_${sourceRes.status}:${(await sourceRes.text()).slice(0, 500)}`);
      const rows = await sourceRes.json() as Array<{ id: string }>;
      const id = rows[0]?.id;
      if (!id) throw new Error(`source_upsert_no_id:${key}`);
      sourceIds.set(key, id);
    }

    const documents = [] as Array<Record<string, unknown>>;
    let invalidTimeCount = 0;
    for (const row of payload.rows) {
      const canonicalUrl = canonicalizeUrl(row.link);
      const normalizedTitle = normalizeTitle(row.title);
      const dedupKey = await sha256(`${canonicalUrl}\n${normalizedTitle}`);
      const legacyTime = parseLegacyTime(row.datetime);
      if (!legacyTime) invalidTimeCount += 1;
      const key = sourceKey(row.source);
      const sourceId = sourceIds.get(key);
      if (!sourceId) throw new Error(`missing_source_id:${key}`);

      documents.push({
        source_id: sourceId,
        external_id: null,
        published_at: null,
        retrieved_at: legacyTime ?? now,
        title: row.title.trim(),
        canonical_url: canonicalUrl,
        normalized_title: normalizedTitle,
        dedup_key: dedupKey,
        language: row.lang?.trim() || null,
        is_breaking: parseBreaking(row.is_breaking),
        excerpt: null,
        content_hash: null,
        raw_metadata: {
          legacy_system: "NARS v3.0.1",
          legacy_sheet: "NEWS",
          legacy_datetime: row.datetime,
          legacy_datetime_semantics: "retrieval_or_feed_time_unverified",
          legacy_norm_title: row.norm_title ?? null,
          legacy_norm_link: row.norm_link ?? null,
          shadow_batch_id: batchId,
        },
        ingest_version: "4.0.0-shadow",
        ingest_origin: "v3_shadow",
        legacy_ref: Number.isInteger(row.rowNumber) ? `NARS_v3:NEWS:${row.rowNumber}` : null,
      });
    }

    const docRes = await fetch(`${supabaseUrl}/rest/v1/nars_documents?on_conflict=dedup_key&select=id,dedup_key`, {
      method: "POST",
      headers: { ...headers, prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(documents),
    });
    if (!docRes.ok) throw new Error(`document_batch_${docRes.status}:${(await docRes.text()).slice(0, 1000)}`);
    const inserted = await docRes.json() as Array<{ id: string; dedup_key: string }>;
    const insertedCount = inserted.length;
    const duplicateCount = payload.rows.length - insertedCount;

    if (jobId) {
      await fetch(`${supabaseUrl}/rest/v1/nars_job_runs?id=eq.${jobId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status: "succeeded",
          finished_at: new Date().toISOString(),
          items_out: insertedCount,
          error_count: 0,
          metadata: {
            origin: "nars_v3_sheet",
            batch_id: batchId,
            inserted: insertedCount,
            duplicates: duplicateCount,
            source_count: uniqueSources.size,
            invalid_time_count: invalidTimeCount,
          },
        }),
      });
    }

    return reply(200, {
      ok: true,
      batchId,
      rows: payload.rows.length,
      sources: uniqueSources.size,
      inserted: insertedCount,
      duplicates: duplicateCount,
      invalidTimeCount,
      jobId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2000) : "unknown_error";
    if (jobId) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/nars_job_runs?id=eq.${jobId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            status: "failed",
            finished_at: new Date().toISOString(),
            error_count: 1,
            metadata: { origin: "nars_v3_sheet", batch_id: batchId, error: message },
          }),
        });
      } catch {}
    }
    try {
      await fetch(`${supabaseUrl}/rest/v1/nars_errors`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          component: "edge:nars-shadow-batch",
          error_code: "SHADOW_BATCH_FAILED",
          message,
          retryable: true,
          job_run_id: jobId,
          context: { batch_id: batchId, items_in: payload.rows.length },
        }),
      });
    } catch {}
    return reply(500, { ok: false, error: "shadow_batch_failed", batchId });
  }
});
