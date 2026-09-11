import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_RUNTIME_ID = "black-oracle-paper";
const CONFIG_TABLE = "black_oracle_trading_scheduler_config";
const AUTH_TABLE = "black_oracle_scheduler_auth";
const STATUS_TIMEOUT_MS = 15_000;
const CYCLE_TIMEOUT_MS = 120_000;
const APPROVED_TARGETS: Record<string, string> = {
  "black-oracle-paper": "https://black-oracle-web-production.up.railway.app",
  "black-oracle-paper-vnext": "https://black-oracle-paper-vnext-production.up.railway.app",
  "black-oracle-paper-vnext-s1r2": "https://black-oracle-paper-vnext-production.up.railway.app",
  "black-oracle-paper-s2-shadow": "https://black-oracle-paper-s2-shadow-production.up.railway.app",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
});

type RequestMode = { action: "cycle" | "status"; runtimeId: string; targetBaseUrl?: string };

const readMode = async (req: Request): Promise<RequestMode> => {
  const url = new URL(req.url);
  const queryRuntime = url.searchParams.get("runtime")?.trim() || "";
  if (req.method !== "POST") return {
    action: "cycle",
    runtimeId: queryRuntime || DEFAULT_RUNTIME_ID,
  };
  try {
    const body = await req.json() as { action?: unknown; runtimeId?: unknown; targetBaseUrl?: unknown };
    return {
      action: body?.action === "status" ? "status" : "cycle",
      runtimeId: typeof body?.runtimeId === "string" && body.runtimeId.trim()
        ? body.runtimeId.trim()
        : queryRuntime || DEFAULT_RUNTIME_ID,
      targetBaseUrl: typeof body?.targetBaseUrl === "string" ? body.targetBaseUrl.trim() : undefined,
    };
  } catch {
    return { action: "cycle", runtimeId: queryRuntime || DEFAULT_RUNTIME_ID };
  }
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") return json({ success: false, error: "Method not allowed." }, 405);

  const mode = await readMode(req);
  const runtimeId = mode.runtimeId;
  const approvedTarget = APPROVED_TARGETS[runtimeId];
  if (!approvedTarget) return json({ success: false, runtimeId, error: "Unsupported Black Oracle Paper runtime." }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ success: false, runtimeId, error: "Supabase server credentials are unavailable." }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: config, error: configError } = await admin.from(CONFIG_TABLE)
    .select("runtime_id, enabled, target_base_url").eq("runtime_id", runtimeId).single();
  if (configError) return json({ success: false, runtimeId, error: `Scheduler config read failed: ${configError.message}` }, 500);
  if (mode.action === "cycle" && (!config.enabled || !config.target_base_url)) {
    return json({ success: true, runtimeId, skipped: true, reason: "Scheduler is disabled or target URL is unset." });
  }

  const baseUrl = mode.action === "status" ? (mode.targetBaseUrl || config.target_base_url) : config.target_base_url;
  if (!baseUrl) return json({ success: false, runtimeId, error: "Target URL is unset." }, 500);

  let target: URL;
  try { target = new URL(baseUrl); } catch { return json({ success: false, runtimeId, error: "Configured Railway target URL is invalid." }, 500); }
  const normalizedBase = `${target.protocol}//${target.host}`;
  if (target.protocol !== "https:" || normalizedBase !== approvedTarget) {
    return json({ success: false, runtimeId, error: "Configured target does not match the approved Railway deployment for this runtime." }, 500);
  }

  const { data: auth, error: authError } = await admin.from(AUTH_TABLE)
    .select("scheduler_token").eq("runtime_id", runtimeId).single();
  if (authError || !auth?.scheduler_token) return json({ success: false, runtimeId, error: "Railway scheduler auth token is unavailable." }, 500);
  const bearer = String(auth.scheduler_token);

  target.pathname = mode.action === "status" ? "/api/trading-status" : "/api/trading-paper-cycle";
  target.search = "";
  target.hash = "";

  const controller = new AbortController();
  const timeoutBudgetMs = mode.action === "status" ? STATUS_TIMEOUT_MS : CYCLE_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutBudgetMs);
  const downstreamStartedAt = Date.now();
  let downstreamStatus: number | null = null;
  let downstreamOk = false;
  let downstreamError: string | null = null;
  let downstreamBody: unknown = null;

  try {
    const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${bearer}` };
    const response = await fetch(target.toString(), { method: "GET", headers, signal: controller.signal });
    downstreamStatus = response.status;
    const bodyText = await response.text();
    downstreamOk = mode.action === "cycle" ? response.ok || response.status === 409 : response.ok;
    try { downstreamBody = bodyText ? JSON.parse(bodyText) : null; } catch { downstreamBody = bodyText.slice(0, 2000); }
    if (!downstreamOk) downstreamError = bodyText.slice(0, 1000) || `Downstream returned HTTP ${response.status}.`;
  } catch (error) {
    downstreamError = error instanceof Error ? error.message : "Unknown downstream request error.";
  } finally { clearTimeout(timeout); }

  const downstreamDurationMs = Date.now() - downstreamStartedAt;
  console.info("Black Oracle Paper scheduler downstream result", JSON.stringify({
    runtimeId,
    action: mode.action,
    downstreamStatus,
    downstreamOk,
    downstreamDurationMs,
    timeoutBudgetMs,
    downstreamTimings: downstreamBody && typeof downstreamBody === "object" && "timings" in downstreamBody
      ? (downstreamBody as Record<string, unknown>).timings
      : null,
  }));

  if (mode.action === "status") {
    if (!downstreamOk) return json({ success: false, action: mode.action, runtimeId, target: normalizedBase, downstreamStatus, downstreamDurationMs, error: downstreamError ?? "Trading status probe failed." }, 502);
    return json({ success: true, action: mode.action, runtimeId, target: normalizedBase, downstreamStatus, downstreamDurationMs, data: downstreamBody });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin.from(CONFIG_TABLE).update({
    last_invoked_at: now,
    last_http_status: downstreamStatus,
    last_ok: downstreamOk,
    last_error: downstreamError,
    updated_at: now,
  }).eq("runtime_id", runtimeId);
  if (updateError) return json({ success: false, runtimeId, downstreamOk, downstreamStatus, downstreamDurationMs, error: `Scheduler telemetry update failed: ${updateError.message}` }, 500);
  if (!downstreamOk) return json({ success: false, runtimeId, target: normalizedBase, downstreamStatus, downstreamDurationMs, error: downstreamError ?? "Scheduled Black Oracle Paper cycle failed." }, 502);
  return json({
    success: true,
    runtimeId,
    target: normalizedBase,
    downstreamStatus,
    downstreamDurationMs,
    downstreamTimings: downstreamBody && typeof downstreamBody === "object" && "timings" in downstreamBody
      ? (downstreamBody as Record<string, unknown>).timings
      : null,
  });
});