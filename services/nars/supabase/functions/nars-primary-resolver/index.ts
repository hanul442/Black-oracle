import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const VERSION = "4.4.1-primary-resolver";
const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });
type RestFailure = { ok: false; status: number; detail: string };

async function restJson(
  supabaseUrl: string,
  headers: Record<string, string>,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: unknown } | RestFailure> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, status: response.status, detail: text.slice(0, 1200) };
  return { ok: true, data: text ? JSON.parse(text) : null };
}

function validUuid(value: string | null): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return reply(500, { ok: false, error: "server_not_configured" });

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (bearer !== serviceRole) return reply(403, { ok: false, error: "service_role_required" });

  const headers = { authorization: `Bearer ${serviceRole}`, apikey: serviceRole, "content-type": "application/json" };

  if (req.method === "GET") {
    const input = new URL(req.url);
    const mode = input.searchParams.get("mode")?.trim() || "queue";

    if (mode === "match") {
      const url = input.searchParams.get("url")?.trim() || "";
      if (!url) return reply(400, { ok: false, error: "url_required" });
      const result = await restJson(supabaseUrl, headers, "rpc/nars_match_authority_url", {
        method: "POST",
        body: JSON.stringify({ p_url: url }),
      });
      if (!result.ok) return reply(400, { ok: false, error: "authority_match_failed", status: result.status, detail: result.detail });
      return reply(200, { ok: true, service: "nars-primary-resolver", version: VERSION, mode, match: result.data });
    }

    if (mode === "candidates") {
      const eventId = input.searchParams.get("event_id")?.trim() ?? null;
      if (!validUuid(eventId)) return reply(400, { ok: false, error: "valid_event_id_required" });
      const result = await restJson(
        supabaseUrl,
        headers,
        `nars_primary_source_candidates?select=id,event_id,candidate_url,normalized_host,authority_key,artifact_id,resolution_status,detected_by,rejection_reason,metadata,created_at,updated_at&event_id=eq.${eventId}&order=updated_at.desc`,
      );
      if (!result.ok) return reply(500, { ok: false, error: "candidate_query_failed", status: result.status, detail: result.detail });
      return reply(200, { ok: true, service: "nars-primary-resolver", version: VERSION, mode, eventId, items: result.data });
    }

    if (mode !== "queue") return reply(400, { ok: false, error: "invalid_mode" });
    const limit = Math.min(200, Math.max(1, Number.parseInt(input.searchParams.get("limit") ?? "50", 10) || 50));
    const result = await restJson(
      supabaseUrl,
      headers,
      `nars_primary_resolver_queue_v1?select=*&order=priority_score.desc,last_updated_at.desc&limit=${limit}`,
    );
    if (!result.ok) return reply(500, { ok: false, error: "resolver_queue_query_failed", status: result.status, detail: result.detail });
    return reply(200, { ok: true, service: "nars-primary-resolver", version: VERSION, mode, items: result.data });
  }

  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try { body = await req.json() as Record<string, unknown>; } catch { return reply(400, { ok: false, error: "invalid_json" }); }

    const action = typeof body.action === "string" ? body.action : "resolve";
    const eventId = typeof body.event_id === "string" ? body.event_id : null;
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!validUuid(eventId) || !url) return reply(400, { ok: false, error: "valid_event_id_and_url_required" });

    if (action === "reject") {
      const reason = typeof body.reason === "string" ? body.reason : "rejected_by_operator";
      const result = await restJson(supabaseUrl, headers, "rpc/nars_reject_primary_candidate", {
        method: "POST",
        body: JSON.stringify({ p_event_id: eventId, p_url: url, p_reason: reason, p_detected_by: "api" }),
      });
      if (!result.ok) return reply(400, { ok: false, error: "candidate_reject_failed", status: result.status, detail: result.detail });
      return reply(200, { ok: true, service: "nars-primary-resolver", version: VERSION, action, result: result.data });
    }

    if (action !== "resolve") return reply(400, { ok: false, error: "invalid_action" });
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return reply(400, { ok: false, error: "title_required" });

    const contentVerified = body.content_verified === true;
    const contentHash = typeof body.content_hash === "string" ? body.content_hash.trim() : null;
    if (contentVerified && !contentHash) return reply(400, { ok: false, error: "content_hash_required_for_content_verified" });

    const relation = typeof body.relation === "string"
      ? body.relation
      : (contentVerified ? "supports" : "context");
    const confidence = typeof body.confidence === "number" ? body.confidence : 1.0;
    const resolution = await restJson(supabaseUrl, headers, "rpc/nars_resolve_primary_url", {
      method: "POST",
      body: JSON.stringify({
        p_event_id: eventId,
        p_url: url,
        p_title: title,
        p_content_hash: contentHash,
        p_content_verified: contentVerified,
        p_relation: relation,
        p_confidence: confidence,
        p_detected_by: "api",
        p_metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
      }),
    });
    if (!resolution.ok) return reply(400, { ok: false, error: "primary_resolution_failed", status: resolution.status, detail: resolution.detail });

    const resolutionData = resolution.data as Record<string, unknown>;
    let scoring: unknown = null;
    if (resolutionData?.score_eligible === true) {
      const scoreResult = await restJson(supabaseUrl, headers, "rpc/nars_score_events", {
        method: "POST",
        body: JSON.stringify({ p_limit: 500 }),
      });
      if (!scoreResult.ok) return reply(500, { ok: false, error: "rescore_failed", resolution: resolution.data, status: scoreResult.status, detail: scoreResult.detail });
      scoring = scoreResult.data;
    }

    return reply(200, {
      ok: true,
      service: "nars-primary-resolver",
      version: VERSION,
      action,
      resolution: resolution.data,
      scoring,
    });
  }

  return reply(405, { ok: false, error: "method_not_allowed" });
});
