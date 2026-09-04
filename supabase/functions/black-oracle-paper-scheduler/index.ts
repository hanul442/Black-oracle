import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RUNTIME_ID = "black-oracle-paper";
const CONFIG_TABLE = "black_oracle_trading_scheduler_config";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const readAction = async (req: Request) => {
  if (req.method !== "POST") return "cycle" as const;
  try {
    const body = await req.json() as { action?: unknown };
    return body?.action === "status" ? "status" as const : "cycle" as const;
  } catch {
    return "cycle" as const;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ success: false, error: "Method not allowed." }, 405);
  }

  const action = await readAction(req);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vercelAutomationBypassSecret = Deno.env.get("VERCEL_AUTOMATION_BYPASS_SECRET");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: "Supabase server credentials are unavailable." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: config, error: configError } = await admin
    .from(CONFIG_TABLE)
    .select("runtime_id, enabled, target_base_url")
    .eq("runtime_id", RUNTIME_ID)
    .single();

  if (configError) {
    return json({ success: false, error: `Scheduler config read failed: ${configError.message}` }, 500);
  }

  if (!config.target_base_url) {
    return json({ success: true, skipped: true, reason: "Target URL is unset." });
  }

  if (action === "cycle" && !config.enabled) {
    return json({ success: true, skipped: true, reason: "Scheduler is disabled or target URL is unset." });
  }

  let target: URL;
  try {
    target = new URL(config.target_base_url);
  } catch {
    return json({ success: false, error: "Configured Vercel target URL is invalid." }, 500);
  }

  if (target.protocol !== "https:" || !target.hostname.endsWith(".vercel.app")) {
    return json({ success: false, error: "Configured target must be an HTTPS vercel.app deployment." }, 500);
  }

  target.pathname = action === "status" ? "/api/trading-status" : "/api/trading-paper-cycle";
  target.search = "";
  target.hash = "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), action === "status" ? 15_000 : 55_000);

  let downstreamStatus: number | null = null;
  let downstreamOk = false;
  let downstreamError: string | null = null;
  let downstreamBody: unknown = null;

  try {
    const headers: Record<string, string> = {
      accept: "application/json",
    };

    if (action === "cycle") {
      headers.authorization = `Bearer ${serviceRoleKey}`;
    }

    if (vercelAutomationBypassSecret) {
      headers["x-vercel-protection-bypass"] = vercelAutomationBypassSecret;
    }

    const response = await fetch(target.toString(), {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    downstreamStatus = response.status;
    const bodyText = await response.text();
    downstreamOk = action === "cycle"
      ? response.ok || response.status === 409
      : response.ok;

    if (action === "status") {
      try {
        downstreamBody = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        downstreamBody = bodyText.slice(0, 2000);
      }
    }

    if (!downstreamOk) {
      downstreamError = bodyText.slice(0, 1000) || `Downstream returned HTTP ${response.status}.`;
    }
  } catch (error) {
    downstreamError = error instanceof Error ? error.message : "Unknown downstream request error.";
  } finally {
    clearTimeout(timeout);
  }

  if (action === "status") {
    if (!downstreamOk) {
      return json({
        success: false,
        action,
        downstreamStatus,
        error: downstreamError ?? "Trading status probe failed.",
      }, 502);
    }
    return json({ success: true, action, downstreamStatus, data: downstreamBody });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from(CONFIG_TABLE)
    .update({
      last_invoked_at: now,
      last_http_status: downstreamStatus,
      last_ok: downstreamOk,
      last_error: downstreamError,
      updated_at: now,
    })
    .eq("runtime_id", RUNTIME_ID);

  if (updateError) {
    return json({
      success: false,
      downstreamOk,
      downstreamStatus,
      error: `Scheduler telemetry update failed: ${updateError.message}`,
    }, 500);
  }

  if (!downstreamOk) {
    return json({
      success: false,
      downstreamStatus,
      error: downstreamError ?? "Scheduled Vercel cycle failed.",
    }, 502);
  }

  return json({ success: true, downstreamStatus });
});
