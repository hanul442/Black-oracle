import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), { status: 405, headers: jsonHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return new Response(JSON.stringify({ ok: false, error: "server_not_configured" }), { status: 500, headers: jsonHeaders });
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (bearer !== serviceRole) return new Response(JSON.stringify({ ok: false, error: "service_role_required" }), { status: 403, headers: jsonHeaders });
  const headers = { authorization: `Bearer ${serviceRole}`, apikey: serviceRole };

  const count = async (table: string, filter = "") => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id${filter}`, { method: "HEAD", headers: { ...headers, prefer: "count=exact" } });
    if (!res.ok) throw new Error(`${table}_${res.status}`);
    const range = res.headers.get("content-range") ?? "*/0";
    return Number(range.split("/")[1] ?? 0);
  };

  try {
    const [sources, documents, events, pendingOutbox, errors] = await Promise.all([
      count("nars_sources"),
      count("nars_documents"),
      count("nars_events"),
      count("nars_intel_outbox", "&status=eq.pending"),
      count("nars_errors"),
    ]);
    const sourceHealthRes = await fetch(`${supabaseUrl}/rest/v1/nars_sources?select=health_status`, { headers });
    if (!sourceHealthRes.ok) throw new Error(`source_health_${sourceHealthRes.status}`);
    const sourceRows = await sourceHealthRes.json() as Array<{ health_status: string }>;
    const sourceHealth = sourceRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.health_status] = (acc[row.health_status] ?? 0) + 1;
      return acc;
    }, {});
    return new Response(JSON.stringify({
      ok: true,
      version: "4.0.0-foundation",
      sprint: "N4-01",
      now: new Date().toISOString(),
      counts: { sources, documents, events, pendingOutbox, errors },
      sourceHealth,
    }), { status: 200, headers: jsonHeaders });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "health_query_failed" }), { status: 500, headers: jsonHeaders });
  }
});
