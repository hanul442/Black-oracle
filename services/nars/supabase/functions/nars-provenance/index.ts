import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const VERSION = "4.3.2-provenance";
const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

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

  const headers = {
    authorization: `Bearer ${serviceRole}`,
    apikey: serviceRole,
    "content-type": "application/json",
  };

  if (req.method === "GET") {
    const input = new URL(req.url);
    const mode = input.searchParams.get("mode")?.trim() || "event";

    if (mode === "review") {
      const limit = Math.min(200, Math.max(1, Number.parseInt(input.searchParams.get("limit") ?? "50", 10) || 50));
      const result = await restJson(
        supabaseUrl,
        headers,
        `nars_provenance_review_queue_v1?select=*&order=priority_score.desc,last_updated_at.desc&limit=${limit}`,
      );
      if (!result.ok) return reply(500, { ok: false, error: "review_query_failed", status: result.status, detail: result.detail });
      return reply(200, { ok: true, service: "nars-provenance", version: VERSION, mode, items: result.data });
    }

    if (mode === "sources") {
      const result = await restJson(
        supabaseUrl,
        headers,
        "nars_source_evidence_profiles?select=publisher_key,review_status,reliability_score,reliability_grade,methodology_version,source_role,sample_size,primary_citation_rate,correction_rate,transparency_score,syndication_dependence,last_calibrated_at,dimensions,provenance,notes,reviewed_at,updated_at&order=publisher_key.asc",
      );
      if (!result.ok) return reply(500, { ok: false, error: "source_profile_query_failed", status: result.status, detail: result.detail });
      return reply(200, { ok: true, service: "nars-provenance", version: VERSION, mode, items: result.data });
    }

    if (mode === "authorities") {
      const country = input.searchParams.get("country")?.trim().toUpperCase() || null;
      const params = new URLSearchParams();
      params.set("select", "authority_key,display_name,authority_type,country,official_domains,review_status,provenance,metadata,reviewed_at,updated_at");
      params.set("order", "country.asc,authority_type.asc,display_name.asc");
      if (country) params.set("country", `eq.${country}`);
      const result = await restJson(supabaseUrl, headers, `nars_authority_registry?${params.toString()}`);
      if (!result.ok) return reply(500, { ok: false, error: "authority_query_failed", status: result.status, detail: result.detail });
      return reply(200, { ok: true, service: "nars-provenance", version: VERSION, mode, filters: { country }, items: result.data });
    }

    const eventId = input.searchParams.get("event_id")?.trim() ?? null;
    if (!validUuid(eventId)) return reply(400, { ok: false, error: "valid_event_id_required" });

    const [eventResult, provenanceResult, scoreResult] = await Promise.all([
      restJson(supabaseUrl, headers, `nars_event_wire_v1?select=*&event_id=eq.${eventId}&limit=1`),
      restJson(supabaseUrl, headers, `nars_event_provenance_v1?select=*&event_id=eq.${eventId}&limit=1`),
      restJson(supabaseUrl, headers, `nars_event_score_ledger?select=score_version,raw_evidence_score,final_evidence_score,evidence_grade,priority_score,priority_band,dimensions,hard_gates,input_snapshot,evaluated_at&event_id=eq.${eventId}&order=evaluated_at.desc&limit=10`),
    ]);
    if (!eventResult.ok) return reply(500, { ok: false, error: "event_query_failed", status: eventResult.status, detail: eventResult.detail });
    if (!provenanceResult.ok) return reply(500, { ok: false, error: "provenance_query_failed", status: provenanceResult.status, detail: provenanceResult.detail });
    if (!scoreResult.ok) return reply(500, { ok: false, error: "score_query_failed", status: scoreResult.status, detail: scoreResult.detail });

    const eventRows = eventResult.data as Array<Record<string, unknown>>;
    const provenanceRows = provenanceResult.data as Array<Record<string, unknown>>;
    return reply(200, {
      ok: true,
      service: "nars-provenance",
      version: VERSION,
      mode: "event",
      event: eventRows[0] ?? null,
      provenance: provenanceRows[0] ?? null,
      scoreHistory: scoreResult.data,
    });
  }

  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json() as Record<string, unknown>;
    } catch {
      return reply(400, { ok: false, error: "invalid_json" });
    }

    const eventId = typeof body.event_id === "string" ? body.event_id : null;
    const artifactKey = typeof body.artifact_key === "string" ? body.artifact_key.trim() : "";
    const artifactRole = typeof body.artifact_role === "string" ? body.artifact_role.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!validUuid(eventId) || !artifactKey || !artifactRole || !title) {
      return reply(400, { ok: false, error: "event_id_artifact_key_artifact_role_title_required" });
    }

    const rpcPayload = {
      p_event_id: eventId,
      p_artifact_key: artifactKey,
      p_artifact_role: artifactRole,
      p_title: title,
      p_canonical_url: typeof body.canonical_url === "string" ? body.canonical_url : null,
      p_authority_key: typeof body.authority_key === "string" ? body.authority_key : null,
      p_publisher_key: typeof body.publisher_key === "string" ? body.publisher_key : null,
      p_document_id: typeof body.document_id === "string" ? body.document_id : null,
      p_published_at: typeof body.published_at === "string" ? body.published_at : null,
      p_verification_status: typeof body.verification_status === "string" ? body.verification_status : "unverified",
      p_content_hash: typeof body.content_hash === "string" ? body.content_hash : null,
      p_relation: typeof body.relation === "string" ? body.relation : "supports",
      p_confidence: typeof body.confidence === "number" ? body.confidence : 1.0,
      p_link_method: typeof body.link_method === "string" ? body.link_method : "api",
      p_metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
    };

    const attach = await restJson(supabaseUrl, headers, "rpc/nars_attach_event_evidence", {
      method: "POST",
      body: JSON.stringify(rpcPayload),
    });
    if (!attach.ok) return reply(400, { ok: false, error: "evidence_attach_failed", status: attach.status, detail: attach.detail });

    const score = await restJson(supabaseUrl, headers, "rpc/nars_score_events", {
      method: "POST",
      body: JSON.stringify({ p_limit: 500 }),
    });
    if (!score.ok) return reply(500, { ok: false, error: "rescore_failed", attached: attach.data, status: score.status, detail: score.detail });

    return reply(200, {
      ok: true,
      service: "nars-provenance",
      version: VERSION,
      attached: attach.data,
      scoring: score.data,
    });
  }

  return reply(405, { ok: false, error: "method_not_allowed" });
});
