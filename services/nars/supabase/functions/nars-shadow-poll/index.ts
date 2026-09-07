import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type ConnectorRow = {
  connector_key: string;
  display_name: string;
  source_class: string;
  publisher_key: string | null;
  authority_key: string | null;
  adapter_kind: "rss" | "atom";
  endpoint: string;
  auth_mode: string;
  runtime_status: string;
  poll_interval_minutes: number | null;
  country: string | null;
  language: string | null;
  priority: number;
  config: Record<string, unknown> | null;
};

type Source = {
  connectorKey: string;
  key: string;
  name: string;
  endpoint: string;
  language: string;
  country: string;
  tier: number;
  sourceClass: string;
  authorityKey?: string;
  tierUnreviewed: boolean;
  maxItems: number;
};

type FeedItem = {
  externalId?: string;
  publishedAt?: string;
  title: string;
  url: string;
  excerpt?: string;
  isBreaking: boolean;
};

type FetchResult = { source: Source; items: FeedItem[]; error?: string };
type BatchResult = {
  sourceKey: string;
  ok: boolean;
  status: number;
  inserted: number;
  duplicates: number;
  failed: number;
  detail?: string;
  failures?: unknown[];
};

const VERSION = "4.6.0-dynamic-connectors";
const MAX_DYNAMIC_SOURCES = 30;
const DEFAULT_MAX_ITEMS = 8;
const USER_AGENT = `NARS-v4-shadow/${VERSION} (+https://github.com/hanul442/Black-oracle)`;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

function configString(config: Record<string, unknown> | null, key: string): string | null {
  const value = config?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function configNumber(config: Record<string, unknown> | null, key: string, fallback: number): number {
  const value = Number(config?.[key]);
  return Number.isFinite(value) ? value : fallback;
}
function configBoolean(config: Record<string, unknown> | null, key: string, fallback: boolean): boolean {
  const value = config?.[key];
  return typeof value === "boolean" ? value : fallback;
}
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&");
}
function cleanText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = decodeXml(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || undefined;
}
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function tag(block: string, names: string[]): string | undefined {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    const value = cleanText(match?.[1]);
    if (value) return value;
  }
  return undefined;
}
function itemLink(block: string): string | undefined {
  const atomHref = block.match(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?\s*>/i)?.[1];
  const rdfAbout = block.match(/\brdf:about\s*=\s*["']([^"']+)["']/i)?.[1];
  const candidate = cleanText(atomHref ?? rdfAbout) ?? tag(block, ["link", "guid", "id"]);
  return candidate && /^https?:\/\//i.test(candidate) ? candidate : undefined;
}
function blocks(xml: string, element: "item" | "entry"): string[] {
  const output: string[] = [];
  const regex = new RegExp(`<${element}\\b([^>]*)>([\\s\\S]*?)<\\/${element}>`, "gi");
  for (const match of xml.matchAll(regex)) output.push(`${match[1] ?? ""}>${match[2] ?? ""}`);
  return output;
}
function toIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}
function parseFeed(xml: string, maxItems: number): FeedItem[] {
  const rss = blocks(xml, "item");
  const entries = rss.length ? rss : blocks(xml, "entry");
  const output: FeedItem[] = [];
  for (const item of entries) {
    const title = tag(item, ["title", "dc:title"]);
    const url = itemLink(item);
    if (!title || !url) continue;
    output.push({
      externalId: tag(item, ["guid", "id"]) ?? url,
      publishedAt: toIso(tag(item, ["pubDate", "published", "updated", "dc:date", "date"])),
      title,
      url,
      excerpt: tag(item, ["description", "summary", "content", "content:encoded"])?.slice(0, 1200),
      isBreaking: /^\s*\[(속보|단독)\]/u.test(title) || /\bbreaking\b/i.test(title),
    });
    if (output.length >= maxItems) break;
  }
  return output;
}

async function fetchTimeout(url: string, timeoutMs: number, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function expectedTokenHash(base: string, serviceRole: string): Promise<string | null> {
  const response = await fetchTimeout(
    `${base}/rest/v1/nars_system_meta?key=eq.shadow_poller_token_hash&select=value&limit=1`,
    4_000,
    { headers: { authorization: `Bearer ${serviceRole}`, apikey: serviceRole } },
  );
  if (!response.ok) return null;
  const rows = await response.json() as Array<{ value?: { sha256?: string } }>;
  return rows[0]?.value?.sha256 ?? null;
}

async function loadSources(base: string, serviceRole: string): Promise<Source[]> {
  const query = new URLSearchParams();
  query.set("select", "connector_key,display_name,source_class,publisher_key,authority_key,adapter_kind,endpoint,auth_mode,runtime_status,poll_interval_minutes,country,language,priority,config");
  query.set("runtime_status", "eq.shadow");
  query.set("adapter_kind", "in.(rss,atom)");
  query.set("order", "priority.desc,connector_key.asc");
  query.set("limit", String(MAX_DYNAMIC_SOURCES));

  const response = await fetchTimeout(`${base}/rest/v1/nars_source_connectors?${query.toString()}`, 5_000, {
    headers: { authorization: `Bearer ${serviceRole}`, apikey: serviceRole },
  });
  if (!response.ok) throw new Error(`connector_registry_${response.status}:${(await response.text()).slice(0, 500)}`);
  const rows = await response.json() as ConnectorRow[];
  const sources = rows
    .filter((row) => row.auth_mode === "none" || row.auth_mode === "user_agent")
    .map((row): Source => ({
      connectorKey: row.connector_key,
      key: configString(row.config, "source_key") ?? row.connector_key,
      name: row.display_name,
      endpoint: row.endpoint,
      language: row.language ?? "und",
      country: row.country ?? "ZZ",
      tier: clamp(configNumber(row.config, "tier", row.authority_key ? 1 : 2), 0, 5),
      sourceClass: row.source_class,
      authorityKey: row.authority_key ?? undefined,
      tierUnreviewed: configBoolean(row.config, "tier_unreviewed", !row.authority_key),
      maxItems: clamp(configNumber(row.config, "max_items", DEFAULT_MAX_ITEMS), 1, 25),
    }));
  if (!sources.length) throw new Error("connector_registry_empty");
  return sources;
}

function sourcePayload(source: Source) {
  return {
    key: source.key,
    name: source.name,
    type: "rss",
    endpoint: source.endpoint,
    country: source.country,
    language: source.language,
    tier: source.tier,
    metadata: {
      connector_key: source.connectorKey,
      dynamic_registry: true,
      shadow_direct: true,
      temporary_runner: "supabase",
      tier_unreviewed: source.tierUnreviewed,
      source_class: source.sourceClass,
      authority_key: source.authorityKey ?? null,
      diversified_feed: true,
    },
  };
}

async function reportFailure(base: string, serviceRole: string, source: Source, error: string): Promise<void> {
  try {
    await fetchTimeout(`${base}/functions/v1/nars-source-status`, 4_000, {
      method: "POST",
      headers: { authorization: `Bearer ${serviceRole}`, "content-type": "application/json" },
      body: JSON.stringify({ source: sourcePayload(source), ok: false, error: error.slice(0, 1000) }),
    });
  } catch {}
}

async function fetchSource(source: Source): Promise<FetchResult> {
  try {
    const response = await fetchTimeout(source.endpoint, 10_000, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/rss+xml, application/atom+xml, application/rdf+xml, application/xml, text/xml;q=0.9, */*;q=0.1",
      },
    });
    if (!response.ok) return { source, items: [], error: `source_http_${response.status}` };
    const items = parseFeed(await response.text(), source.maxItems);
    if (!items.length) return { source, items: [], error: "source_parsed_zero_items" };
    return { source, items };
  } catch (error) {
    return { source, items: [], error: error instanceof Error ? error.message : "source_fetch_unknown" };
  }
}

async function ingestBatch(base: string, serviceRole: string, result: FetchResult): Promise<BatchResult> {
  if (result.error) return { sourceKey: result.source.key, ok: false, status: 0, inserted: 0, duplicates: 0, failed: 0, detail: result.error };
  const body = JSON.stringify({
    source: sourcePayload(result.source),
    documents: result.items.map((item) => ({
      externalId: item.externalId,
      publishedAt: item.publishedAt,
      title: item.title,
      url: item.url,
      language: result.source.language,
      isBreaking: item.isBreaking,
      excerpt: item.excerpt,
      metadata: {
        connector_key: result.source.connectorKey,
        feed: result.source.key,
        dynamic_registry: true,
        shadow_direct: true,
        source_class: result.source.sourceClass,
        authority_key: result.source.authorityKey ?? null,
      },
    })),
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchTimeout(`${base}/functions/v1/nars-ingest-batch`, 12_000, {
        method: "POST",
        headers: { authorization: `Bearer ${serviceRole}`, "content-type": "application/json" },
        body,
      });
      const text = await response.text();
      let data: Record<string, unknown> = {};
      try { data = text ? JSON.parse(text) : {}; } catch {}
      if (response.ok || (response.status === 500 && typeof data.failed === "number")) {
        return {
          sourceKey: result.source.key,
          ok: response.ok,
          status: response.status,
          inserted: Number(data.inserted ?? 0),
          duplicates: Number(data.duplicates ?? 0),
          failed: Number(data.failed ?? result.items.length),
          detail: typeof data.detail === "string" ? data.detail : undefined,
          failures: Array.isArray(data.failures) ? data.failures : undefined,
        };
      }
      if (!(response.status === 429 || response.status >= 500) || attempt === 1) {
        return { sourceKey: result.source.key, ok: false, status: response.status, inserted: 0, duplicates: 0, failed: result.items.length, detail: text.slice(0, 500) };
      }
    } catch (error) {
      if (attempt === 1) {
        return { sourceKey: result.source.key, ok: false, status: 598, inserted: 0, duplicates: 0, failed: result.items.length, detail: error instanceof Error ? error.message : "batch_timeout" };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return { sourceKey: result.source.key, ok: false, status: 599, inserted: 0, duplicates: 0, failed: result.items.length, detail: "retry_loop_exhausted" };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { ok: false, error: "method_not_allowed" });
  const base = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !serviceRole) return reply(500, { ok: false, error: "server_not_configured" });

  let expected: string | null = null;
  try { expected = await expectedTokenHash(base, serviceRole); } catch {}
  const supplied = req.headers.get("x-nars-cron-token") ?? "";
  if (!supplied || !expected || await sha256(supplied) !== expected) return reply(403, { ok: false, error: "cron_token_required" });

  let sources: Source[];
  try {
    sources = await loadSources(base, serviceRole);
  } catch (error) {
    return reply(503, { ok: false, error: "connector_registry_unavailable", detail: error instanceof Error ? error.message : "unknown" });
  }

  const headers = { authorization: `Bearer ${serviceRole}`, apikey: serviceRole, "content-type": "application/json" };
  const startedAt = new Date().toISOString();
  let jobId: string | null = null;
  try {
    const jobResponse = await fetchTimeout(`${base}/rest/v1/nars_job_runs`, 4_000, {
      method: "POST",
      headers: { ...headers, prefer: "return=representation" },
      body: JSON.stringify({
        job_type: "shadow_direct_poll",
        job_key: `shadow-poll:${startedAt}`,
        status: "running",
        started_at: startedAt,
        attempt: 1,
        items_in: 0,
        metadata: { runner: "supabase_fallback", source_count: sources.length, dynamic_registry: true, version: VERSION, batch_ingest: true },
      }),
    });
    if (jobResponse.ok) {
      const jobs = await jobResponse.json() as Array<{ id: string }>;
      jobId = jobs[0]?.id ?? null;
    }
  } catch {}

  const fetched = await Promise.all(sources.map(fetchSource));
  await Promise.allSettled(fetched.filter((entry) => entry.error).map((entry) => reportFailure(base, serviceRole, entry.source, entry.error!)));
  const batches = await Promise.all(fetched.map((entry) => ingestBatch(base, serviceRole, entry)));

  const sourceResults = fetched.map((entry) => {
    const batch = batches.find((candidate) => candidate.sourceKey === entry.source.key)!;
    return {
      connector: entry.source.connectorKey,
      source: entry.source.key,
      class: entry.source.sourceClass,
      authority: entry.source.authorityKey ?? null,
      fetchOk: !entry.error,
      fetchError: entry.error ?? null,
      items: entry.items.length,
      batchStatus: batch.status,
      inserted: batch.inserted,
      duplicates: batch.duplicates,
      ingestFailures: batch.failed,
      firstIngestError: batch.detail ?? (batch.failures?.[0] ?? null),
    };
  });

  const fetchedItems = fetched.reduce((sum, entry) => sum + entry.items.length, 0);
  const ingestSuccess = batches.reduce((sum, batch) => sum + batch.inserted + batch.duplicates, 0);
  const ingestFailure = batches.reduce((sum, batch) => sum + batch.failed, 0);
  const sourceFailures = fetched.filter((entry) => entry.error).length;
  const finishedAt = new Date().toISOString();

  if (jobId) {
    try {
      await fetchTimeout(`${base}/rest/v1/nars_job_runs?id=eq.${jobId}`, 4_000, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status: sourceFailures === sources.length ? "failed" : "succeeded",
          finished_at: finishedAt,
          items_in: fetchedItems,
          items_out: ingestSuccess,
          error_count: ingestFailure + sourceFailures,
          metadata: {
            runner: "supabase_fallback",
            version: VERSION,
            dynamic_registry: true,
            source_count: sources.length,
            batch_ingest: true,
            fetched_items: fetchedItems,
            ingest_success: ingestSuccess,
            ingest_failure: ingestFailure,
            source_failures: sourceFailures,
            sources: sourceResults,
          },
        }),
      });
    } catch {}
  }

  return reply(sourceFailures === sources.length ? 503 : 200, {
    ok: sourceFailures < sources.length,
    runner: "supabase_fallback",
    version: VERSION,
    dynamicRegistry: true,
    startedAt,
    finishedAt,
    sourceCount: sources.length,
    fetchedItems,
    ingestSuccess,
    ingestFailure,
    sourceFailures,
    sources: sourceResults,
  });
});
