import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DEFAULT_RUNTIME_ID = "black-oracle-paper";
const CONFIG_TABLE = "black_oracle_trading_scheduler_config";
const AUTH_TABLE = "black_oracle_scheduler_auth";
const STATUS_TIMEOUT_MS = 15_000;
const CYCLE_TIMEOUT_MS = 120_000;
const CONTROL_PLANE_TIMEOUT_MS = 12_000;
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
const retryableStatus = (status: number) => status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

const readBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
};

type ControlPlaneResult = {
  ok: boolean;
  status: number | null;
  data: unknown;
  error: string | null;
  attempts: number;
};

const controlPlaneRequest = async (
  operation: string,
  url: string,
  init: RequestInit,
): Promise<ControlPlaneResult> => {
  const maxAttempts = CONTROL_PLANE_RETRY_DELAYS_MS.length + 1;
  let lastStatus: number | null = null;
  let lastData: unknown = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONTROL_PLANE_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      lastStatus = response.status;
      lastData = await readBody(response);
      if (response.ok) {
        return { ok: true, status: response.status, data: lastData, error: null, attempts: attempt + 1 };
      }
      lastError = typeof lastData === "string" ? lastData : JSON.stringify(lastData ?? {});
      if (!retryableStatus(response.status) || attempt === maxAttempts - 1) {
        return { ok: false, status: response.status, data: lastData, error: lastError, attempts: attempt + 1 };
      }
    } catch (error) {
      lastStatus = null;
      lastData = null;
      lastError = error instanceof Error ? error.message : "Unknown control-plane request error.";
      if (attempt === maxAttempts - 1) {
        return { ok: false, status: null, data: null, error: lastError, attempts: attempt + 1 };
      }
    } finally {
      clearTimeout(timeout);
    }

    console.warn("Black Oracle scheduler transient control-plane failure", JSON.stringify({
      operation,
      attempt: attempt + 1,
      maxAttempts,
      status: lastStatus,
      error: lastError?.slice(0, 300) ?? null,
    }));
    await sleep(CONTROL_PLANE_RETRY_DELAYS_MS[attempt] ?? 0);
  }

  return { ok: false, status: lastStatus, data: lastData, error: lastError, attempts: maxAttempts };
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ success: false, runtimeId, error: "Supabase server credentials are unavailable." }, 500);

  const controlHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: "application/json",
  };
  const runtimeFilter = encodeURIComponent(`eq.${runtimeId}`);
  const configUrl = `${supabaseUrl}/rest/v1/${CONFIG_TABLE}?runtime_id=${runtimeFilter}&select=runtime_id,enabled,target_base_url&limit=1`;
  const configRead = await controlPlaneRequest("scheduler_config_read", configUrl, { method: "GET", headers: controlHeaders });
  const configRows = Array.isArray(configRead.data) ? configRead.data as Array<Record<string, unknown>> : [];
  const config = configRows[0] ?? null;
  if (!configRead.ok || !config) {
    return json({
      success: false,
      runtimeId,
      controlPlaneAttempts: { config: configRead.attempts },
      error: `Scheduler config read failed${configRead.error ? `: ${configRead.error.slice(0, 500)}` : "."}`,
    }, 500);
  }

  const enabled = config.enabled === true;
  const configuredTarget = typeof config.target_base_url === "string" ? config.target_base_url : "";
  if (mode.action === "cycle" && (!enabled || !configuredTarget)) {
    return json({ success: true, runtimeId, skipped: true, reason: "Scheduler is disabled or target URL is unset." });
  }

  const baseUrl = mode.action === "status" ? (mode.targetBaseUrl || configuredTarget) : configuredTarget;
  if (!baseUrl) return json({ success: false, runtimeId, error: "Target URL is unset." }, 500);

  let target: URL;
  try { target = new URL(baseUrl); } catch { return json({ success: false, runtimeId, error: "Configured Railway target URL is invalid." }, 500); }
  const normalizedBase = `${target.protocol}//${target.host}`;
  if (target.protocol !== "https:" || normalizedBase !== approvedTarget) {
    return json({ success: false, runtimeId, error: "Configured target does not match the approved Railway deployment for this runtime." }, 500);
  }

  const authUrl = `${supabaseUrl}/rest/v1/${AUTH_TABLE}?runtime_id=${runtimeFilter}&select=scheduler_token&limit=1`;
  const authRead = await controlPlaneRequest("scheduler_auth_read", authUrl, { method: "GET", headers: controlHeaders });
  const authRows = Array.isArray(authRead.data) ? authRead.data as Array<Record<string, unknown>> : [];
  const schedulerToken = typeof authRows[0]?.scheduler_token === "string" ? authRows[0].scheduler_token : "";
  if (!authRead.ok || !schedulerToken) {
    return json({
      success: false,
      runtimeId,
      controlPlaneAttempts: { config: configRead.attempts, auth: authRead.attempts },
      error: `Railway scheduler auth token is unavailable${authRead.error ? `: ${authRead.error.slice(0, 500)}` : "."}`,
    }, 500);
  }

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
      const response = await fetch(target.toString(), {
        method: "GET",
        headers: { accept: "application/json", authorization: `Bearer ${schedulerToken}` },
        signal: controller.signal,
      });
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
  const telemetryUrl = `${supabaseUrl}/rest/v1/${CONFIG_TABLE}?runtime_id=${runtimeFilter}`;
  const telemetryWrite = await controlPlaneRequest("scheduler_telemetry_write", telemetryUrl, {
    method: "PATCH",
    headers: { ...controlHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      last_invoked_at: now,
      last_http_status: downstreamStatus,
      last_ok: downstreamOk,
      last_error: downstreamError,
      updated_at: now,
    }),
  });
  const telemetryPersisted = telemetryWrite.ok;
  if (!telemetryPersisted) {
    console.error("Black Oracle scheduler telemetry persistence failed after downstream result", JSON.stringify({
      runtimeId,
      downstreamOk,
      downstreamStatus,
      telemetryAttempts: telemetryWrite.attempts,
      status: telemetryWrite.status,
      error: telemetryWrite.error?.slice(0, 300) ?? null,
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
