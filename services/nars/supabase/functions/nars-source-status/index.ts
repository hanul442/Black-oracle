import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Payload = {
  source: { key: string; name: string; type: string; endpoint?: string; country?: string; language?: string; tier?: number; metadata?: Record<string, unknown> };
  ok: boolean;
  error?: string;
};

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { ok: false, error: "method_not_allowed" });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return reply(500, { ok: false, error: "server_not_configured" });
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (bearer !== serviceRole) return reply(403, { ok: false, error: "service_role_required" });

  let payload: Payload;
  try { payload = await req.json(); } catch { return reply(400, { ok: false, error: "invalid_json" }); }
  if (!payload?.source?.key || !payload?.source?.name || typeof payload.ok !== "boolean") return reply(400, { ok: false, error: "invalid_payload" });

  const headers = { authorization: `Bearer ${serviceRole}`, apikey: serviceRole, "content-type": "application/json" };
  const sourceRes = await fetch(`${supabaseUrl}/rest/v1/nars_sources?on_conflict=source_key`, {
    method: "POST",
    headers: { ...headers, prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      source_key: payload.source.key,
      name: payload.source.name,
      source_type: payload.source.type || "other",
      endpoint: payload.source.endpoint ?? null,
      country: payload.source.country ?? null,
      language: payload.source.language ?? null,
      tier: Math.min(5, Math.max(0, payload.source.tier ?? 2)),
      metadata: payload.source.metadata ?? {},
      updated_at: new Date().toISOString(),
    }),
  });
  if (!sourceRes.ok) return reply(500, { ok: false, error: "source_upsert_failed" });
  const rows = await sourceRes.json() as Array<{ id: string }>;
  const id = rows[0]?.id;
  if (!id) return reply(500, { ok: false, error: "source_not_returned" });

  const currentRes = await fetch(`${supabaseUrl}/rest/v1/nars_sources?id=eq.${id}&select=consecutive_failures`, { headers });
  const currentRows = currentRes.ok ? await currentRes.json() as Array<{ consecutive_failures: number }> : [];
  const failures = payload.ok ? 0 : (currentRows[0]?.consecutive_failures ?? 0) + 1;
  const health = payload.ok ? "up" : failures >= 3 ? "down" : "degraded";
  const patch = payload.ok
    ? { health_status: health, last_success_at: new Date().toISOString(), consecutive_failures: 0, updated_at: new Date().toISOString() }
    : { health_status: health, last_failure_at: new Date().toISOString(), consecutive_failures: failures, updated_at: new Date().toISOString() };

  const patchRes = await fetch(`${supabaseUrl}/rest/v1/nars_sources?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify(patch) });
  if (!patchRes.ok) return reply(500, { ok: false, error: "source_status_update_failed" });

  if (!payload.ok && payload.error) {
    await fetch(`${supabaseUrl}/rest/v1/nars_errors`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        component: "collector:source",
        error_code: "SOURCE_FETCH_FAILED",
        message: payload.error.slice(0, 2000),
        retryable: true,
        source_id: id,
        context: { source_key: payload.source.key },
      }),
    });
  }

  return reply(200, { ok: true, sourceId: id, health, consecutiveFailures: failures });
});
