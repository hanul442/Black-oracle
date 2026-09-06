import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const VERSION = "4.2.1-evidence";
const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

type RestFailure = { ok: false; status: number; detail: string };

function dbError(error: string, result: RestFailure): Response {
  return reply(500, { ok: false, error, status: result.status, detail: result.detail });
}

function asBoolean(value: string | null): boolean | null {
  if (value == null) return null;
  if (/^(1|true|y|yes)$/i.test(value)) return true;
  if (/^(0|false|n|no)$/i.test(value)) return false;
  return null;
}

function parseLimit(value: string | null): number {
  return Math.min(200, Math.max(1, Number.parseInt(value ?? "50", 10) || 50));
}

function validDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

async function restJson(
  supabaseUrl: string,
  headers: Record<string, string>,
  path: string,
): Promise<{ ok: true; rows: Array<Record<string, unknown>> } | RestFailure> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers });
  if (!response.ok) return { ok: false, status: response.status, detail: (await response.text()).slice(0, 800) };
  return { ok: true, rows: await response.json() as Array<Record<string, unknown>> };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return reply(405, { ok: false, error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return reply(500, { ok: false, error: "server_not_configured" });

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (bearer !== serviceRole) return reply(403, { ok: false, error: "service_role_required" });

  const input = new URL(req.url);
  const headers = { authorization: `Bearer ${serviceRole}`, apikey: serviceRole };
  const view = input.searchParams.get("view")?.trim() || "documents";
  const limit = parseLimit(input.searchParams.get("limit"));

  if (view === "metrics") {
    const [shadow, cluster] = await Promise.all([
      restJson(supabaseUrl, headers, "nars_shadow_metrics_v1?select=*"),
      restJson(supabaseUrl, headers, "nars_cluster_metrics_v1?select=*"),
    ]);
    if (!shadow.ok) return dbError("shadow_metrics_query_failed", shadow);
    if (!cluster.ok) return dbError("cluster_metrics_query_failed", cluster);
    return reply(200, {
      ok: true,
      service: "nars-live-wire",
      version: VERSION,
      view,
      generatedAt: new Date().toISOString(),
      metrics: { shadow: shadow.rows[0] ?? null, cluster: cluster.rows[0] ?? null },
    });
  }

  if (view === "review") {
    const reviewType = input.searchParams.get("type")?.trim() || null;
    if (reviewType && !["story_document", "event_story"].includes(reviewType)) {
      return reply(400, { ok: false, error: "invalid_review_type" });
    }
    const params = new URLSearchParams();
    params.set("select", "review_type,parent_id,child_id,similarity,method,parent_title,child_title,observed_at");
    params.set("order", "observed_at.desc");
    params.set("limit", String(limit));
    if (reviewType) params.set("review_type", `eq.${reviewType}`);
    const result = await restJson(supabaseUrl, headers, `nars_cluster_review_queue_v1?${params.toString()}`);
    if (!result.ok) return dbError("cluster_review_query_failed", result);
    return reply(200, {
      ok: true, service: "nars-live-wire", version: VERSION, view,
      generatedAt: new Date().toISOString(), count: result.rows.length,
      filters: { limit, reviewType }, items: result.rows,
    });
  }

  if (view === "scores") {
    const eventId = input.searchParams.get("event_id")?.trim() || null;
    const grade = input.searchParams.get("grade")?.trim() || null;
    const band = input.searchParams.get("band")?.trim().toUpperCase() || null;
    if (band && !["FLASH", "HIGH", "WATCH", "ROUTINE"].includes(band)) {
      return reply(400, { ok: false, error: "invalid_priority_band" });
    }
    const params = new URLSearchParams();
    params.set("select", "id,event_id,score_version,raw_evidence_score,final_evidence_score,evidence_grade,priority_score,priority_band,dimensions,hard_gates,input_snapshot,evaluated_at");
    params.set("order", "evaluated_at.desc");
    params.set("limit", String(limit));
    if (eventId) params.set("event_id", `eq.${eventId}`);
    if (grade) params.set("evidence_grade", `eq.${grade}`);
    if (band) params.set("priority_band", `eq.${band}`);
    const result = await restJson(supabaseUrl, headers, `nars_event_score_ledger?${params.toString()}`);
    if (!result.ok) return dbError("score_ledger_query_failed", result);
    return reply(200, {
      ok: true, service: "nars-live-wire", version: VERSION, view,
      generatedAt: new Date().toISOString(), count: result.rows.length,
      filters: { limit, eventId, grade, band }, items: result.rows,
    });
  }

  if (view === "stories") {
    const status = input.searchParams.get("status")?.trim() || null;
    const language = input.searchParams.get("language")?.trim() || null;
    const eventId = input.searchParams.get("event_id")?.trim() || null;
    const sinceRaw = input.searchParams.get("since")?.trim() || null;
    const since = validDate(sinceRaw);
    if (sinceRaw && !since) return reply(400, { ok: false, error: "invalid_since" });

    const params = new URLSearchParams();
    params.set("select", "story_id,story_key,display_title,canonical_title,language,status,first_seen_at,last_seen_at,document_count,source_count,breaking_count,event_id,event_status,priority_score,evidence_grade,event_similarity,sources");
    params.set("order", "last_seen_at.desc");
    params.set("limit", String(limit));
    if (status) params.set("status", `eq.${status}`);
    if (language) params.set("language", `eq.${language}`);
    if (eventId) params.set("event_id", `eq.${eventId}`);
    if (since) params.set("last_seen_at", `gte.${since}`);

    const result = await restJson(supabaseUrl, headers, `nars_story_wire_v1?${params.toString()}`);
    if (!result.ok) return dbError("story_wire_query_failed", result);
    return reply(200, {
      ok: true, service: "nars-live-wire", version: VERSION, view,
      generatedAt: new Date().toISOString(), count: result.rows.length,
      filters: { limit, status, language, eventId, since }, items: result.rows,
    });
  }

  if (view === "events") {
    const status = input.searchParams.get("status")?.trim() || null;
    const language = input.searchParams.get("language")?.trim() || null;
    const eventId = input.searchParams.get("event_id")?.trim() || null;
    const grade = input.searchParams.get("grade")?.trim() || null;
    const band = input.searchParams.get("band")?.trim().toUpperCase() || null;
    const sinceRaw = input.searchParams.get("since")?.trim() || null;
    const since = validDate(sinceRaw);
    const minSources = Math.max(0, Number.parseInt(input.searchParams.get("min_sources") ?? "0", 10) || 0);
    const minStories = Math.max(0, Number.parseInt(input.searchParams.get("min_stories") ?? "0", 10) || 0);
    if (sinceRaw && !since) return reply(400, { ok: false, error: "invalid_since" });
    if (band && !["FLASH", "HIGH", "WATCH", "ROUTINE"].includes(band)) {
      return reply(400, { ok: false, error: "invalid_priority_band" });
    }

    const params = new URLSearchParams();
    params.set("select", "event_id,event_key,title,status,priority_score,evidence_grade,first_detected_at,last_updated_at,story_count,document_count,source_count,breaking_count,cluster_method,language,evidence_score,priority_band,score_version,score_dimensions,score_hard_gates");
    params.set("order", "priority_score.desc,last_updated_at.desc");
    params.set("limit", String(limit));
    if (eventId) params.set("event_id", `eq.${eventId}`);
    if (status) params.set("status", `eq.${status}`);
    if (language) params.set("language", `eq.${language}`);
    if (grade) params.set("evidence_grade", `eq.${grade}`);
    if (band) params.set("priority_band", `eq.${band}`);
    if (since) params.set("last_updated_at", `gte.${since}`);
    if (minSources > 0) params.set("source_count", `gte.${minSources}`);
    if (minStories > 0) params.set("story_count", `gte.${minStories}`);

    const result = await restJson(supabaseUrl, headers, `nars_event_wire_v1?${params.toString()}`);
    if (!result.ok) return dbError("event_wire_query_failed", result);

    if (eventId && result.rows.length === 1) {
      const storyParams = new URLSearchParams();
      storyParams.set("select", "story_id,story_key,display_title,language,status,first_seen_at,last_seen_at,document_count,source_count,breaking_count,event_similarity,sources");
      storyParams.set("event_id", `eq.${eventId}`);
      storyParams.set("order", "first_seen_at.asc");
      const scoreParams = new URLSearchParams();
      scoreParams.set("select", "score_version,raw_evidence_score,final_evidence_score,evidence_grade,priority_score,priority_band,dimensions,hard_gates,input_snapshot,evaluated_at");
      scoreParams.set("event_id", `eq.${eventId}`);
      scoreParams.set("order", "evaluated_at.desc");
      scoreParams.set("limit", "10");
      const [stories, scores] = await Promise.all([
        restJson(supabaseUrl, headers, `nars_story_wire_v1?${storyParams.toString()}`),
        restJson(supabaseUrl, headers, `nars_event_score_ledger?${scoreParams.toString()}`),
      ]);
      return reply(200, {
        ok: true,
        service: "nars-live-wire",
        version: VERSION,
        view: "event_detail",
        event: result.rows[0],
        stories: stories.ok ? stories.rows : [],
        scoreHistory: scores.ok ? scores.rows : [],
        storyQueryError: stories.ok ? null : { status: stories.status, detail: stories.detail },
        scoreQueryError: scores.ok ? null : { status: scores.status, detail: scores.detail },
      });
    }

    return reply(200, {
      ok: true, service: "nars-live-wire", version: VERSION, view,
      generatedAt: new Date().toISOString(), count: result.rows.length,
      filters: { limit, status, language, eventId, grade, band, since, minSources, minStories }, items: result.rows,
    });
  }

  if (view !== "documents") return reply(400, { ok: false, error: "invalid_view" });

  const origin = input.searchParams.get("origin")?.trim() || null;
  const source = input.searchParams.get("source")?.trim() || null;
  const breaking = asBoolean(input.searchParams.get("breaking"));
  const sinceRaw = input.searchParams.get("since")?.trim() || null;
  const since = validDate(sinceRaw);
  const seenBy = input.searchParams.get("seen_by")?.trim() || null;
  if (sinceRaw && !since) return reply(400, { ok: false, error: "invalid_since" });
  if (seenBy && !["v3", "collector", "both", "v3_only", "collector_only"].includes(seenBy)) {
    return reply(400, { ok: false, error: "invalid_seen_by" });
  }

  const params = new URLSearchParams();
  params.set("select", "id,published_at,retrieved_at,title,canonical_url,language,is_breaking,ingest_origin,legacy_ref,source_key,source_name,source_type,source_tier,source_health,sighting_origins,v3_seen,collector_seen,first_seen_at,last_seen_at,v3_first_seen_at,collector_first_seen_at,collector_minus_v3_seconds,event_id,event_title,event_status,priority_score,evidence_grade");
  params.set("order", "last_seen_at.desc.nullslast,retrieved_at.desc");
  params.set("limit", String(limit));
  if (origin) params.set("ingest_origin", `eq.${origin}`);
  if (source) params.set("source_key", `eq.${source}`);
  if (breaking !== null) params.set("is_breaking", `eq.${breaking}`);
  if (seenBy === "v3") params.set("v3_seen", "eq.true");
  if (seenBy === "collector") params.set("collector_seen", "eq.true");
  if (seenBy === "both") { params.set("v3_seen", "eq.true"); params.set("collector_seen", "eq.true"); }
  if (seenBy === "v3_only") { params.set("v3_seen", "eq.true"); params.set("collector_seen", "eq.false"); }
  if (seenBy === "collector_only") { params.set("v3_seen", "eq.false"); params.set("collector_seen", "eq.true"); }
  if (since) params.set("last_seen_at", `gte.${since}`);

  const result = await restJson(supabaseUrl, headers, `nars_live_wire_v1?${params.toString()}`);
  if (!result.ok) return dbError("live_wire_query_failed", result);

  const rows = result.rows as Array<Record<string, unknown> & {
    retrieved_at?: string; last_seen_at?: string; source_key?: string; ingest_origin?: string;
    v3_seen?: boolean; collector_seen?: boolean; collector_minus_v3_seconds?: number | string | null;
  }>;
  const newestRaw = rows[0]?.last_seen_at ?? rows[0]?.retrieved_at;
  const newest = newestRaw ? new Date(String(newestRaw)) : null;
  const lagSeconds = newest && !Number.isNaN(newest.valueOf())
    ? Math.max(0, Math.round((Date.now() - newest.valueOf()) / 1000)) : null;

  const sourceCounts = new Map<string, number>();
  const originCounts = new Map<string, number>();
  let v3Only = 0; let collectorOnly = 0; let both = 0; let neither = 0;
  const deltas: number[] = [];

  for (const row of rows) {
    const sourceKey = String(row.source_key ?? "unknown");
    const ingestOrigin = String(row.ingest_origin ?? "unknown");
    sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) ?? 0) + 1);
    originCounts.set(ingestOrigin, (originCounts.get(ingestOrigin) ?? 0) + 1);
    const v3 = row.v3_seen === true;
    const collector = row.collector_seen === true;
    if (v3 && collector) both += 1; else if (v3) v3Only += 1; else if (collector) collectorOnly += 1; else neither += 1;
    const delta = Number(row.collector_minus_v3_seconds);
    if (Number.isFinite(delta)) deltas.push(delta);
  }

  const compared = v3Only + collectorOnly + both;
  const overlapRate = compared > 0 ? Number((both / compared).toFixed(4)) : null;
  const meanDeltaSeconds = deltas.length ? Number((deltas.reduce((sum, value) => sum + value, 0) / deltas.length).toFixed(1)) : null;

  return reply(200, {
    ok: true,
    service: "nars-live-wire",
    version: VERSION,
    view,
    generatedAt: new Date().toISOString(),
    count: rows.length,
    lagSeconds,
    filters: { limit, origin, source, breaking, since, seenBy },
    summary: {
      sources: Object.fromEntries(sourceCounts),
      origins: Object.fromEntries(originCounts),
      comparison: { v3Only, collectorOnly, both, neither, overlapRate, meanCollectorMinusV3Seconds: meanDeltaSeconds },
    },
    items: rows,
  });
});
