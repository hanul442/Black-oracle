import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Source = {
  key: string;
  name: string;
  endpoint: string;
  language: string;
  country: string;
  tier: number;
  sourceClass: string;
  authorityKey?: string;
  tierUnreviewed: boolean;
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
type IngestResult = { sourceKey: string; ok: boolean; status: number; detail?: string };

const SOURCES: Source[] = [
  { key: "direct:khan:all", name: "경향신문", endpoint: "https://www.khan.co.kr/rss/rssdata/total_news.xml", language: "ko", country: "KR", tier: 2, sourceClass: "general_news", tierUnreviewed: true },
  { key: "direct:mk:all", name: "매일경제", endpoint: "https://www.mk.co.kr/rss/40300001/", language: "ko", country: "KR", tier: 2, sourceClass: "financial_media", tierUnreviewed: true },
  { key: "direct:donga:all", name: "동아일보", endpoint: "https://rss.donga.com/total.xml", language: "ko", country: "KR", tier: 2, sourceClass: "general_news", tierUnreviewed: true },
  { key: "official:fed:press", name: "Federal Reserve Board", endpoint: "https://www.federalreserve.gov/feeds/press_all.xml", language: "en", country: "US", tier: 1, sourceClass: "primary_official", authorityKey: "us:federal-reserve", tierUnreviewed: false },
  { key: "official:ecb:press", name: "European Central Bank", endpoint: "https://www.ecb.europa.eu/rss/press.html", language: "en", country: "EU", tier: 1, sourceClass: "primary_official", authorityKey: "eu:ecb", tierUnreviewed: false },
  { key: "official:bis:press", name: "Bank for International Settlements", endpoint: "https://www.bis.org/doclist/all_pressrels.rss", language: "en", country: "INT", tier: 1, sourceClass: "research_institution", authorityKey: "int:bis", tierUnreviewed: false },
];

const VERSION = "4.5.2-source-diversification";
const MAX_ITEMS_PER_SOURCE = 8;
const INGEST_CONCURRENCY = 4;
const USER_AGENT = `NARS-v4-shadow/${VERSION} (+https://github.com/hanul442/Black-oracle)`;
const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

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
  const cleaned = decodeXml(value).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
  const result: string[] = [];
  const regex = new RegExp(`<${element}\\b([^>]*)>([\\s\\S]*?)<\\/${element}>`, "gi");
  for (const match of xml.matchAll(regex)) result.push(`${match[1] ?? ""}>${match[2] ?? ""}`);
  return result;
}

function looksBreaking(title: string): boolean {
  return /^\s*\[(속보|단독)\]/u.test(title) || /\bbreaking\b/i.test(title);
}

function toIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function parseFeed(xml: string): FeedItem[] {
  const rss = blocks(xml, "item");
  const items = rss.length ? rss : blocks(xml, "entry");
  const result: FeedItem[] = [];
  for (const item of items) {
    const title = tag(item, ["title", "dc:title"]);
    const url = itemLink(item);
    if (!title || !url) continue;
    result.push({
      externalId: tag(item, ["guid", "id"]) ?? url,
      publishedAt: toIso(tag(item, ["pubDate", "published", "updated", "dc:date", "date"])),
      title,
      url,
      excerpt: tag(item, ["description", "summary", "content", "content:encoded"])?.slice(0, 1200),
      isBreaking: looksBreaking(title),
    });
    if (result.length >= MAX_ITEMS_PER_SOURCE) break;
  }
  return result;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/atom+xml, application/rdf+xml, application/xml, text/xml;q=0.9, */*;q=0.1" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
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
      shadow_direct: true,
      temporary_runner: "supabase",
      tier_unreviewed: source.tierUnreviewed,
      source_class: source.sourceClass,
      authority_key: source.authorityKey ?? null,
      diversified_feed: true,
    },
  };
}

async function getExpectedTokenHash(supabaseUrl: string, serviceRole: string): Promise<string | null> {
  const response = await fetch(`${supabaseUrl}/rest/v1/nars_system_meta?key=eq.shadow_poller_token_hash&select=value&limit=1`, {
    headers: { authorization: `Bearer ${serviceRole}`, apikey: serviceRole },
  });
  if (!response.ok) return null;
  const rows = await response.json() as Array<{ value?: { sha256?: string } }>;
  return rows[0]?.value?.sha256 ?? null;
}

async function reportSourceStatus(supabaseUrl: string, serviceRole: string, source: Source, ok: boolean, error?: string): Promise<void> {
  await fetch(`${supabaseUrl}/functions/v1/nars-source-status`, {
    method: "POST",
    headers: { authorization: `Bearer ${serviceRole}`, "content-type": "application/json" },
    body: JSON.stringify({ source: sourcePayload(source), ok, error: error?.slice(0, 1000) }),
  });
}

async function fetchSource(source: Source): Promise<FetchResult> {
  try {
    const response = await fetchWithTimeout(source.endpoint, 10_000);
    if (!response.ok) return { source, items: [], error: `source_http_${response.status}` };
    return { source, items: parseFeed(await response.text()) };
  } catch (error) {
    return { source, items: [], error: error instanceof Error ? error.message : "source_fetch_unknown" };
  }
}

async function ingestOne(supabaseUrl: string, serviceRole: string, source: Source, item: FeedItem): Promise<IngestResult> {
  const body = JSON.stringify({
    source: sourcePayload(source),
    document: {
      externalId: item.externalId,
      publishedAt: item.publishedAt,
      title: item.title,
      url: item.url,
      language: source.language,
      isBreaking: item.isBreaking,
      excerpt: item.excerpt,
      metadata: { feed: source.key, shadow_direct: true, source_class: source.sourceClass, authority_key: source.authorityKey ?? null },
    },
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${supabaseUrl}/functions/v1/nars-ingest`, {
      method: "POST",
      headers: { authorization: `Bearer ${serviceRole}`, "content-type": "application/json" },
      body,
    });
    if (response.ok) return { sourceKey: source.key, ok: true, status: response.status };
    const detail = (await response.text()).slice(0, 500);
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 1) return { sourceKey: source.key, ok: false, status: response.status, detail };
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return { sourceKey: source.key, ok: false, status: 599, detail: "retry_loop_exhausted" };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { ok: false, error: "method_not_allowed" });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return reply(500, { ok: false, error: "server_not_configured" });

  const suppliedToken = req.headers.get("x-nars-cron-token") ?? "";
  const expectedHash = await getExpectedTokenHash(supabaseUrl, serviceRole);
  if (!suppliedToken || !expectedHash || await sha256(suppliedToken) !== expectedHash) {
    return reply(403, { ok: false, error: "cron_token_required" });
  }

  const headers = { authorization: `Bearer ${serviceRole}`, apikey: serviceRole, "content-type": "application/json" };
  const startedAt = new Date().toISOString();
  let jobId: string | null = null;
  try {
    const jobRes = await fetch(`${supabaseUrl}/rest/v1/nars_job_runs`, {
      method: "POST",
      headers: { ...headers, prefer: "return=representation" },
      body: JSON.stringify({ job_type: "shadow_direct_poll", job_key: `shadow-poll:${startedAt}`, status: "running", started_at: startedAt, attempt: 1, items_in: 0, metadata: { runner: "supabase_fallback", source_count: SOURCES.length, diversified: true, version: VERSION } }),
    });
    if (jobRes.ok) {
      const jobs = await jobRes.json() as Array<{ id: string }>;
      jobId = jobs[0]?.id ?? null;
    }
  } catch {}

  const fetched = await Promise.all(SOURCES.map(fetchSource));
  await Promise.all(fetched.map((result) => reportSourceStatus(supabaseUrl, serviceRole, result.source, !result.error, result.error)));

  const tasks = fetched.flatMap((result) => result.error ? [] : result.items.map((item) => ({ source: result.source, item })));
  const ingested = await mapLimit(tasks, INGEST_CONCURRENCY, (task) => ingestOne(supabaseUrl, serviceRole, task.source, task.item));

  const sourceResults = fetched.map((result) => {
    const sourceIngest = ingested.filter((item) => item.sourceKey === result.source.key);
    const failures = sourceIngest.filter((item) => !item.ok);
    return {
      source: result.source.key,
      class: result.source.sourceClass,
      authority: result.source.authorityKey ?? null,
      ok: !result.error,
      fetchError: result.error ?? null,
      items: result.items.length,
      ingestSuccess: sourceIngest.filter((item) => item.ok).length,
      ingestFailures: failures.length,
      firstIngestError: failures[0] ? { status: failures[0].status, detail: failures[0].detail } : null,
    };
  });

  const fetchedItems = tasks.length;
  const ingestSuccess = ingested.filter((item) => item.ok).length;
  const ingestFailure = ingested.length - ingestSuccess;
  const sourceFailures = fetched.filter((item) => item.error).length;

  if (jobId) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/nars_job_runs?id=eq.${jobId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status: sourceFailures === SOURCES.length ? "failed" : "succeeded",
          finished_at: new Date().toISOString(),
          items_in: fetchedItems,
          items_out: ingestSuccess,
          error_count: ingestFailure + sourceFailures,
          metadata: { runner: "supabase_fallback", version: VERSION, diversified: true, fetch_parallel: true, ingest_concurrency: INGEST_CONCURRENCY, fetched_items: fetchedItems, ingest_success: ingestSuccess, ingest_failure: ingestFailure, source_failures: sourceFailures, sources: sourceResults },
        }),
      });
    } catch {}
  }

  return reply(sourceFailures === SOURCES.length ? 503 : 200, {
    ok: sourceFailures < SOURCES.length,
    runner: "supabase_fallback",
    version: VERSION,
    startedAt,
    finishedAt: new Date().toISOString(),
    fetchedItems,
    ingestSuccess,
    ingestFailure,
    sourceFailures,
    sources: sourceResults,
  });
});
