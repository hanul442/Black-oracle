import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildSchedulerPipelineOutcome,
  EVIDENCE_REFRESH_TIMEOUT_MS,
  isEvidenceRefreshHttpSuccess,
  isPaperCycleHttpSuccess,
  PAPER_CYCLE_TIMEOUT_MS,
  shouldRunPaperCycleAfterEvidenceRefresh,
  type SchedulerStageResult,
} from "../_shared/paperSchedulerPolicy.ts";

const RUNTIME_ID = "black-oracle-paper";
const CONFIG_TABLE = "black_oracle_trading_scheduler_config";
const PRODUCTION_TARGET = "https://black-oracle.vercel.app";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

type RequestMode = {
  action: "cycle" | "status";
  targetBaseUrl?: string;
};

type DownstreamCall = SchedulerStageResult & {
  body: unknown;
};

const readMode = async (req: Request): Promise<RequestMode> => {
  if (req.method !== "POST") return { action: "cycle" };
  try {
    const body = await req.json() as { action?: unknown; targetBaseUrl?: unknown };
    if (body?.action === "status") {
      return {
        action: "status",
        targetBaseUrl: typeof body.targetBaseUrl === "string" ? body.targetBaseUrl.trim() : undefined,
      };
    }
  } catch {
    // Default to the scheduler cycle path for malformed/non-JSON POST bodies.
  }
  return { action: "cycle" };
};

const parseBody = (bodyText: string) => {
  if (!bodyText) return null;
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText.slice(0, 2_000);
  }
};

const callDownstream = async (
  baseUrl: string,
  pathname: string,
  method: "GET" | "POST",
  headers: Record<string, string>,
  timeoutMs: number,
  successRule: (status: number | null, responseOk: boolean) => boolean,
): Promise<DownstreamCall> => {
  const target = new URL(baseUrl);
  target.pathname = pathname;
  target.search = "";
  target.hash = "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target.toString(), {
      method,
      headers,
      signal: controller.signal,
    });
    const bodyText = await response.text();
    const ok = successRule(response.status, response.ok);
    return {
      status: response.status,
      ok,
      error: ok ? null : (bodyText.slice(0, 1_000) || `Downstream returned HTTP ${response.status}.`),
      body: parseBody(bodyText),
    };
  } catch (error) {
    return {
      status: null,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown downstream request error.",
      body: null,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const stageSummary = (stage: DownstreamCall) => {
  const body = stage.body && typeof stage.body === "object" ? stage.body as Record<string, unknown> : null;
  return {
    status: stage.status,
    ok: stage.ok,
    error: stage.error,
    skipped: body?.skipped === true,
    accepted: typeof body?.accepted === "number" ? body.accepted : undefined,
    candidates: typeof body?.candidates === "number" ? body.candidates : undefined,
    warnings: Array.isArray(body?.warnings) ? body.warnings.slice(0, 8) : undefined,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ success: false, error: "Method not allowed." }, 405);
  }

  const mode = await readMode(req);
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

  if (mode.action === "cycle" && (!config.enabled || !config.target_base_url)) {
    return json({ success: true, skipped: true, reason: "Scheduler is disabled or target URL is unset." });
  }

  const baseUrl = mode.action === "status"
    ? (mode.targetBaseUrl || config.target_base_url)
    : config.target_base_url;

  if (!baseUrl) {
    return json({ success: false, error: "Target URL is unset." }, 500);
  }

  let validatedTarget: URL;
  try {
    validatedTarget = new URL(baseUrl);
  } catch {
    return json({ success: false, error: "Configured Vercel target URL is invalid." }, 500);
  }

  if (validatedTarget.protocol !== "https:" || !validatedTarget.hostname.endsWith(".vercel.app")) {
    return json({ success: false, error: "Configured target must be an HTTPS vercel.app deployment." }, 500);
  }

  const isPreviewCycle = mode.action === "cycle" && validatedTarget.hostname !== "black-oracle.vercel.app";
  const headers: Record<string, string> = { accept: "application/json" };
  if (vercelAutomationBypassSecret) {
    headers["x-vercel-protection-bypass"] = vercelAutomationBypassSecret;
  }

  if (mode.action === "status") {
    const status = await callDownstream(
      baseUrl,
      "/api/trading-status",
      "GET",
      headers,
      15_000,
      (_status, responseOk) => responseOk,
    );
    if (!status.ok) {
      return json({
        success: false,
        action: mode.action,
        downstreamStatus: status.status,
        error: status.error ?? "Trading status probe failed.",
      }, 502);
    }
    return json({ success: true, action: mode.action, downstreamStatus: status.status, data: status.body });
  }

  headers.authorization = `Bearer ${serviceRoleKey}`;

  // Evidence refresh owns and releases the runtime lease inside its endpoint. The Paper cycle
  // runs only after the HTTP call has completed, so the two stages never nest the same lease.
  const evidenceRefresh = await callDownstream(
    baseUrl,
    "/api/trading-evidence-refresh",
    "POST",
    headers,
    EVIDENCE_REFRESH_TIMEOUT_MS,
    isEvidenceRefreshHttpSuccess,
  );

  // Evidence failure must not suppress deterministic protective exits. Sprint 5 governance
  // sees missing/stale evidence and fail-closes new ENTER decisions inside the Paper cycle.
  let paperCycle: DownstreamCall;
  if (shouldRunPaperCycleAfterEvidenceRefresh(evidenceRefresh)) {
    paperCycle = await callDownstream(
      baseUrl,
      "/api/trading-paper-cycle",
      "GET",
      headers,
      PAPER_CYCLE_TIMEOUT_MS,
      isPaperCycleHttpSuccess,
    );
  } else {
    // Policy currently never returns false; keep an explicit fail-safe branch if it changes.
    paperCycle = {
      status: null,
      ok: false,
      error: "Paper cycle policy unexpectedly suppressed protective runtime execution.",
      body: null,
    };
  }

  const outcome = buildSchedulerPipelineOutcome(evidenceRefresh, paperCycle);
  const now = new Date().toISOString();
  const telemetryUpdate: Record<string, unknown> = {
    last_invoked_at: now,
    last_http_status: paperCycle.status ?? evidenceRefresh.status,
    last_ok: outcome.telemetryOk,
    last_error: outcome.telemetryError,
    updated_at: now,
  };

  if (isPreviewCycle) {
    telemetryUpdate.enabled = false;
    telemetryUpdate.target_base_url = PRODUCTION_TARGET;
  }

  const { error: updateError } = await admin
    .from(CONFIG_TABLE)
    .update(telemetryUpdate)
    .eq("runtime_id", RUNTIME_ID);

  if (updateError) {
    return json({
      success: false,
      pipelineOk: outcome.pipelineOk,
      degraded: outcome.degraded,
      evidenceRefresh: stageSummary(evidenceRefresh),
      paperCycle: stageSummary(paperCycle),
      error: `Scheduler telemetry update failed: ${updateError.message}`,
    }, 500);
  }

  if (!outcome.success) {
    return json({
      success: false,
      pipelineOk: outcome.pipelineOk,
      degraded: false,
      autoDisarmed: isPreviewCycle,
      evidenceRefresh: stageSummary(evidenceRefresh),
      paperCycle: stageSummary(paperCycle),
      error: outcome.telemetryError ?? "Scheduled Paper cycle failed.",
    }, 502);
  }

  return json({
    success: true,
    pipelineOk: outcome.pipelineOk,
    degraded: outcome.degraded,
    autoDisarmed: isPreviewCycle,
    evidenceRefresh: stageSummary(evidenceRefresh),
    paperCycle: stageSummary(paperCycle),
  });
});
