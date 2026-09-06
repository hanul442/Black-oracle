import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

function asBoolean(value: string | null): boolean | null {
  if (value == null) return null;
  if (/^(1|true|y|yes)$/i.test(value)) return true;
  if (/^(0|false|n|no)$/i.test(value)) return false;
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return reply(405, { ok: false, error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return reply(500, { ok: false, error: "server_not_configured" });

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (bearer !== serviceRole) return reply(403, { ok: false, error: "service_role_required" });

  const input = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number.parseInt(input.searchParams.get("limit") ?? "50", 10) || 50));
  const origin = input.searchParams.get("origin")?.trim() || null;
  const source = input.searchParams.get("source")?.trim() || null;
  const breaking = asBoolean(input.searchParams.get("breaking"));
  const since = input.searchParams.get("since")?.trim() || null;

  const params = new URLSearchParams();
  params.set("select", "id,published_at,retrieved_at,title,canonical_url,language,is_breaking,ingest_origin,legacy_ref,source_key,source_name,source_type,source_tier,source_health,event_id,event_title,event_status,priority_score,evidence_grade");
  params.set("order", "retrieved_at.desc");
  params.set("limit", String(limit));
  if (origin) params.set("ingest_origin", `eq.${origin}`);
  if (source) params.set("source_key", `eq.${source}`);
  if (breaking !== null) params.set("is_breaking", `eq.${breaking}`);
  if (since) {
    const date = new Date(since);
    if (Number.isNaN(date.valueOf())) return reply(400, { ok: false, error: "invalid_since" });
    params.set("retrieved_at", `gte.${date.toISOString()}`);
  }

  const headers = { authorization: `Bearer ${serviceRole}`, apikey: serviceRole };
  const response = await fetch(`${supabaseUrl}/rest/v1/nars_live_wire_v1?${params.toString()}`, { headers });
  if (!response.ok) {
    return reply(500, {
      ok: false,
      error: "live_wire_query_failed",
      status: response.status,
      detail: (await response.text()).slice(0, 800),
    });
  }

  const rows = await response.json() as Array<Record<string, unknown> & { retrieved_at?: string; source_key?: string; ingest_origin?: string }>;
  const newest = rows[0]?.retrieved_at ? new Date(String(rows[0].retrieved_at)) : null;
  const lagSeconds = newest && !Number.isNaN(newest.valueOf())
    ? Math.max(0, Math.round((Date.now() - newest.valueOf()) / 1000))
    : null;

  const sourceCounts = new Map<string, number>();
  const originCounts = new Map<string, number>();
  for (const row of rows) {
    const sourceKey = String(row.source_key ?? "unknown");
    const ingestOrigin = String(row.ingest_origin ?? "unknown");
    sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) ?? 0) + 1);
    originCounts.set(ingestOrigin, (originCounts.get(ingestOrigin) ?? 0) + 1);
  }

  return reply(200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    count: rows.length,
    lagSeconds,
    filters: { limit, origin, source, breaking, since },
    summary: {
      sources: Object.fromEntries(sourceCounts),
      origins: Object.fromEntries(originCounts),
    },
    items: rows,
  });
});
