import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_RUNTIME_ID = "black-oracle-paper";
const CONFIG_TABLE = "black_oracle_trading_scheduler_config";
const AUTH_TABLE = "black_oracle_scheduler_auth";
const STATUS_TIMEOUT_MS = 15_000;
const CYCLE_TIMEOUT_MS = 120_000;
const CONTROL_PLANE_RETRY_DELAYS_MS = [300, 900];
const DOWNSTREAM_STARTUP_RETRY_DELAY_MS = 600;
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

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const transientControlPlaneError = (error: unknown) => {
  const candidate = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown } | null;
  const text = [candidate?.message, candidate?.code, candidate?.details, candidate?.hint]
    .filter((value) => value != null)
    .map(String)
    .join(" ")
    .toLowerCase();
  return /gateway timeout|timed? out|timeout|fetch failed|connection|econnreset|etimedout|502|503|504|pgrst/.test(text);
};

type ControlPlaneResponse = { data: any; error: any };

const withControlPlaneRetry = async (
  operation: string,
  call: () => any,
): Promise<{ data: any; error: any; attempts: number }> => {
  let last: ControlPlaneResponse = { data: null, error: new Error(`${operation} was not attempted.`) };
  const maxAttempts = CONTROL_PLANE_RETRY_DELAYS_MS.length + 1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    last = await call();
    if (!last.error) return { data: last.data ?? null, error: null, attempts: attempt + 1 };
    if (!transientControlPlaneError(last.error) || attempt === maxAttempts - 1) {
      return { data: last.data ?? null, error: last.error, attempts: attempt + 1 };
    }
    console.warn("Black Oracle scheduler transient control-plane error", JSON.stringify({
      operation,
      attempt: attempt + 1,
      maxAttempts,
      error: String(last.error?.message ?? last.error).slice(0, 300),
    }));
    await sleep(CONTROL_PLANE_RETRY_DELAYS_MS[attempt] ?? 0);
  }
  return { data: last.data ?? null, error: last.error ?? new Error(`${operation} failed.`), attempts: maxAttempts };
};

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

const safeStartupTransientFailure = (status: number | null, body: unknown) => {
  if (status !== 500 || !body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  const phase = String(record.phase ?? "").toLowerCase();
  const error = String(record.error ?? "").toLowerCase();
  return phase === "startup"
    && /gateway timeout|timeout|timed out|502|503|504|fetch failed|connection/.test(error);
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
  const configRead = await withControlPlaneRetry("scheduler_config_read", () => admin.from(CONFIG_TABLE)
    .select("runtime_id, enabled, target_base_url").eq("runtime_id", runtimeId).single());
  const config = configRead.data;
  if (configRead.error || !config) {
    return json({
      success: false,
      runtimeId,
      controlPlaneAttempts: { config: configRead.attempts },
      error: `Scheduler config read failed: ${String(configRead.error?.message ?? "row unavailable")}`,
    }, 500);
  }
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

  const authRead = await withControlPlaneRetry("scheduler_auth_read", () => admin.from(AUTH_TABLE)
    .select("scheduler_token").eq("runtime_id", runtimeId).single());
  const auth = authRead.data;
  if (authRead.error || !auth?.scheduler_token) {
    return json({
      success: false,
      runtimeId,
      controlPlaneAttempts: { config: configRead.attempts, auth: authRead.attempts },
      error: `Railway scheduler auth token is unavailable${authRead.error?.message ? `: ${String(authRead.error.message)}` : "."}`,
    }, 500);
  }
  const bearer = String(auth.scheduler_token);

  target.pathname = mode.action === "status" ? "/api/trading-status" : "/api/trading-paper-cycle";
  target.search = "";
  target.hash = "";

  const timeoutBudgetMs = mode.action === "status" ? STATUS_TIMEOUT_MS : CYCLE_TIMEOUT_MS;
  const downstreamStartedAt = Date.now();
  let downstreamStatus: number | null = null;
  let downstreamOk = false;
  let downstreamError: string | null = null;
  let downstreamBody: unknown = null;
  let downstreamAttempts = 0;

  const callDownstream = async () => {
    downstreamAttempts += 1;
    const elapsed = Date.now() - downstreamStartedAt;
    const remainingBudgetMs = Math.max(1_000, timeoutBudgetMs - elapsed);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingBudgetMs);
    try {
      const headers: Record<string, string> = { accept: "application/json", authorization: `Bearer ${bearer}` };
      const response = await fetch(target.toString(), { method: "GET", headers, signal: controller.signal });
      downstreamStatus = response.status;
      const bodyText = await response.text();
      downstreamOk = mode.action === "cycle" ? response.ok || response.status === 409 : response.ok;
      try { downstreamBody = bodyText ? JSON.parse(bodyText) : null; } catch { downstreamBody = bodyText.slice(0, 2000); }
      downstreamError = downstreamOk ? null : bodyText.slice(0, 1000) || `Downstream returned HTTP ${response.status}.`;
    } catch (error) {
      downstreamStatus = null;
      downstreamOk = false;
      downstreamError = error instanceof Error ? error.message : "Unknown downstream request error.";
      downstreamBody = null;
    } finally {
      clearTimeout(timeout);
    }
  };

  await callDownstream();
  if (mode.action === "cycle" && safeStartupTransientFailure(downstreamStatus, downstreamBody)) {
    console.warn("Black Oracle scheduler retrying explicit startup-phase transient failure", JSON.stringify({
      runtimeId,
      downstreamStatus,
      downstreamAttempts,
      error: downstreamError?.slice(0, 300) ?? null,
    }));
    await sleep(DOWNSTREAM_STARTUP_RETRY_DELAY_MS);
    await callDownstream();
  }

  const downstreamDurationMs = Date.now() - downstreamStartedAt;
  console.info("Black Oracle Paper scheduler downstream result", JSON.stringify({
    runtimeId,
    action: mode.action,
    downstreamStatus,
    downstreamOk,
    downstreamAttempts,
    downstreamDurationMs,
    timeoutBudgetMs,
    controlPlaneAttempts: { config: configRead.attempts, auth: authRead.attempts },
    downstreamTimings: downstreamBody && typeof downstreamBody === "object" && "timings" in downstreamBody
      ? (downstreamBody as Record<string, unknown>).timings
      : null,
  }));

  if (mode.action === "status") {
    if (!downstreamOk) return json({ success: false, action: mode.action, runtimeId, target: normalizedBase, downstreamStatus, downstreamAttempts, downstreamDurationMs, error: downstreamError ?? "Trading status probe failed." }, 502);
    return json({ success: true, action: mode.action, runtimeId, target: normalizedBase, downstreamStatus, downstreamAttempts, downstreamDurationMs, data: downstreamBody });
  }

  const now = new Date().toISOString();
  const telemetryWrite = await withControlPlaneRetry("scheduler_telemetry_write", () => admin.from(CONFIG_TABLE).update({
    last_invoked_at: now,
    last_http_status: downstreamStatus,
    last_ok: downstreamOk,
    last_error: downstreamError,
    updated_at: now,
  }).eq("runtime_id", runtimeId));
  const telemetryPersisted = !telemetryWrite.error;
  if (!telemetryPersisted) {
    console.error("Black Oracle scheduler telemetry persistence failed after downstream result", JSON.stringify({
      runtimeId,
      downstreamOk,
      downstreamStatus,
      telemetryAttempts: telemetryWrite.attempts,
      error: String(telemetryWrite.error?.message ?? telemetryWrite.error).slice(0, 300),
    }));
  }

  if (!downstreamOk) {
    return json({
      success: false,
      runtimeId,
      target: normalizedBase,
      downstreamStatus,
      downstreamAttempts,
      downstreamDurationMs,
      telemetryPersisted,
      telemetryAttempts: telemetryWrite.attempts,
      error: downstreamError ?? "Scheduled Black Oracle Paper cycle failed.",
    }, 502);
  }

  return json({
    success: true,
    runtimeId,
    target: normalizedBase,
    downstreamStatus,
    downstreamAttempts,
    downstreamDurationMs,
    telemetryPersisted,
    telemetryAttempts: telemetryWrite.attempts,
    warning: telemetryPersisted ? null : "Paper cycle completed, but scheduler telemetry could not be persisted after bounded retries.",
    downstreamTimings: downstreamBody && typeof downstreamBody === "object" && "timings" in downstreamBody
      ? (downstreamBody as Record<string, unknown>).timings
      : null,
  });
});
