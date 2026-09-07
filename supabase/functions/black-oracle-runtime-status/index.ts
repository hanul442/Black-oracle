import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_RUNTIME_ID = "black-oracle-paper";
const RUNTIME_TABLE = "black_oracle_trading_runtime";
const SCHEDULER_TABLE = "black_oracle_trading_scheduler_config";
const STALE_AFTER_MS = 25 * 60 * 1000;

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization, apikey",
  },
});

const toMs = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "GET") return json({ success: false, error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, state: "UNKNOWN", error: "Runtime status backend is unavailable." }, 500);
  }

  const url = new URL(req.url);
  const runtimeId = (url.searchParams.get("runtime") || DEFAULT_RUNTIME_ID).trim();
  if (!/^black-oracle-[a-z0-9-]+$/.test(runtimeId)) {
    return json({ success: false, state: "UNKNOWN", error: "Invalid runtime id." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: runtime, error: runtimeError }, { data: scheduler, error: schedulerError }] = await Promise.all([
    admin.from(RUNTIME_TABLE).select("runtime_id,saved_at,reason,checkpoint").eq("runtime_id", runtimeId).maybeSingle(),
    runtimeId === DEFAULT_RUNTIME_ID
      ? admin.from(SCHEDULER_TABLE).select("runtime_id,enabled,last_invoked_at,last_http_status,last_ok,last_error,updated_at,target_base_url").eq("runtime_id", DEFAULT_RUNTIME_ID).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ]);

  if (runtimeError) return json({ success: false, state: "UNKNOWN", error: "Runtime checkpoint read failed." }, 500);
  if (schedulerError) return json({ success: false, state: "UNKNOWN", error: "Scheduler status read failed." }, 500);

  const checkpoint = runtime?.checkpoint && typeof runtime.checkpoint === "object" ? runtime.checkpoint as Record<string, any> : null;
  const loop = checkpoint?.loop && typeof checkpoint.loop === "object" ? checkpoint.loop : null;
  const lastCycle = loop?.lastCycle && typeof loop.lastCycle === "object" ? loop.lastCycle : null;
  const savedAt = toMs(runtime?.saved_at) ?? toMs(checkpoint?.savedAt);
  const lastInvokedAt = toMs(scheduler?.last_invoked_at);
  const lastActivityAt = Math.max(savedAt ?? 0, lastInvokedAt ?? 0) || null;
  const ageMs = lastActivityAt === null ? null : Math.max(0, Date.now() - lastActivityAt);
  const cycleErrors = Array.isArray(lastCycle?.errors) ? lastCycle.errors.length : 0;

  let state: "RUNNING" | "DEGRADED" | "STALLED" | "BLOCKED" | "UNKNOWN" = "UNKNOWN";
  let reason = "No persisted runtime activity is available yet.";
  if (runtimeId === DEFAULT_RUNTIME_ID && scheduler && scheduler.enabled === false) {
    state = "BLOCKED";
    reason = "Scheduled PAPER runtime is disabled.";
  } else if (ageMs !== null && ageMs > STALE_AFTER_MS) {
    state = "STALLED";
    reason = `No persisted PAPER activity within ${Math.round(STALE_AFTER_MS / 60000)} minutes.`;
  } else if (scheduler?.last_ok === false || cycleErrors > 0) {
    state = "DEGRADED";
    reason = scheduler?.last_ok === false ? "Latest scheduler invocation reported a failure." : "Latest PAPER cycle contains market errors.";
  } else if (savedAt !== null) {
    state = "RUNNING";
    reason = "Persisted PAPER runtime is updating within the expected cadence.";
  }

  const transport = runtimeId === DEFAULT_RUNTIME_ID
    ? (typeof scheduler?.target_base_url === "string" && scheduler.target_base_url.includes("vercel.app") ? "LEGACY_VERCEL_BRIDGE" : "UNKNOWN")
    : "SUPABASE_NATIVE_SHADOW";

  return json({
    success: true,
    version: "BO-RUNTIME-STATUS-v0.1",
    state,
    reason,
    runtimeId,
    transport,
    lastActivityAt,
    ageMs,
    cycleCount: Number.isFinite(loop?.cycleCount) ? Number(loop.cycleCount) : null,
    lastCycle: lastCycle ? {
      startedAt: Number.isFinite(lastCycle.startedAt) ? Number(lastCycle.startedAt) : null,
      finishedAt: Number.isFinite(lastCycle.finishedAt) ? Number(lastCycle.finishedAt) : null,
      scanned: Number.isFinite(lastCycle.scanned) ? Number(lastCycle.scanned) : 0,
      entered: Number.isFinite(lastCycle.entered) ? Number(lastCycle.entered) : 0,
      exited: Number.isFinite(lastCycle.exited) ? Number(lastCycle.exited) : 0,
      held: Number.isFinite(lastCycle.held) ? Number(lastCycle.held) : 0,
      noTrade: Number.isFinite(lastCycle.noTrade) ? Number(lastCycle.noTrade) : 0,
      errors: cycleErrors,
    } : null,
    scheduler: runtimeId === DEFAULT_RUNTIME_ID ? {
      enabled: scheduler?.enabled === true,
      lastOk: scheduler?.last_ok === true ? true : scheduler?.last_ok === false ? false : null,
      lastHttpStatus: Number.isFinite(scheduler?.last_http_status) ? Number(scheduler.last_http_status) : null,
    } : null,
    authority: { mode: "PAPER_ONLY", liveTrading: false, executionAuthority: false },
  });
});
