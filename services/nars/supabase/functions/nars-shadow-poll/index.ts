import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Source = {
  key: string;
  name: string;
  endpoint: string;
  language: string;
  country: string;
};

type FeedItem = {
  externalId?: string;
  publishedAt?: string;
  title: string;
  url: string;
  excerpt?: string;
  isBreaking: boolean;
};

const SOURCES: Source[] = [
  { key: "direct:khan:all", name: "경향신문", endpoint: "https://www.khan.co.kr/rss/rssdata/total_news.xml", language: "ko", country: "KR" },
  { key: "direct:mk:all", name: "매일경제", endpoint: "https://www.mk.co.kr/rss/40300001/", language: "ko", country: "KR" },
  { key: "direct:donga:all", name: "동아일보", endpoint: "https://rss.donga.com/total.xml", language: "ko", country: "KR" },
  { key: "direct:hankyung:all", name: "한국경제", endpoint: "https://www.hankyung.com/feed/all-news", language: "ko", country: "KR" },
];

const MAX_ITEMS_PER_SOURCE = 8;
const USER_AGENT = "NARS-v4-shadow/4.0.1 (+https://github.com/hanul442/Black-oracle)";
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
  const candidate = cleanText(atomHref) ?? tag(block, ["link", "guid", "id"]);
  return candidate && /^https?:\/\//i.test(candidate) ? candidate : undefined;
}

function blocks(xml: string, element: "item" | "entry"): string[] {
  const result: string[] = [];
  const regex = new RegExp(`<${element}\\b[^>]*>([\\s\\S]*?)<\\/${element}>`, "gi");
  for (const match of xml.matchAll(regex)) result.push(match[1]);
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
    const title = tag(item, ["title"]);
    const url = itemLink(item);
    if (!title || !url) continue;
    result.push({
      externalId: tag(item, ["guid", "id"]),
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
      headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
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
    body: JSON.stringify({
      source: { key: source.key, name: source.name, type: "rss", endpoint: source.endpoint, country: source.country, language: source.language, tier: 2, metadata: { shadow_direct: true, temporary_runner: "supabase", tier_unreviewed: true } },
      ok,
      error: error?.slice(0, 1000),
    }),
  });
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
      body: JSON.stringify({ job_type: "shadow_direct_poll", job_key: `shadow-poll:${startedAt}`, status: "running", started_at: startedAt, attempt: 1, items_in: 0, metadata: { runner: "supabase_fallback", source_count: SOURCES.length } }),
    });
    if (jobRes.ok) {
      const jobs = await jobRes.json() as Array<{ id: string }>;
      jobId = jobs[0]?.id ?? null;
    }
  } catch {}

  let fetchedItems = 0;
  let ingestSuccess = 0;
  let ingestFailure = 0;
  const sourceResults: Array<Record<string, unknown>> = [];

  for (const source of SOURCES) {
    try {
      const response = await fetchWithTimeout(source.endpoint, 12_000);
      if (!response.ok) throw new Error(`source_http_${response.status}`);
      const xml = await response.text();
      const items = parseFeed(xml);
      fetchedItems += items.length;
      let sourceIngestFailures = 0;
      for (const item of items) {
        const ingestRes = await fetch(`${supabaseUrl}/functions/v1/nars-ingest`, {
          method: "POST",
          headers: { authorization: `Bearer ${serviceRole}`, "content-type": "application/json" },
          body: JSON.stringify({
            source: { key: source.key, name: source.name, type: "rss", endpoint: source.endpoint, country: source.country, language: source.language, tier: 2, metadata: { shadow_direct: true, temporary_runner: "supabase", tier_unreviewed: true } },
            document: { externalId: item.externalId, publishedAt: item.publishedAt, title: item.title, url: item.url, language: source.language, isBreaking: item.isBreaking, excerpt: item.excerpt, metadata: { feed: source.key, shadow_direct: true } },
          }),
        });
        if (ingestRes.ok) ingestSuccess += 1;
        else { ingestFailure += 1; sourceIngestFailures += 1; }
      }
      await reportSourceStatus(supabaseUrl, serviceRole, source, true);
      sourceResults.push({ source: source.key, ok: true, items: items.length, ingestFailures: sourceIngestFailures });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      await reportSourceStatus(supabaseUrl, serviceRole, source, false, message);
      sourceResults.push({ source: source.key, ok: false, error: message.slice(0, 300) });
    }
  }

  const sourceFailures = sourceResults.filter((item) => item.ok === false).length;
  if (jobId) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/nars_job_runs?id=eq.${jobId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: sourceFailures === SOURCES.length ? "failed" : "succeeded", finished_at: new Date().toISOString(), items_in: fetchedItems, items_out: ingestSuccess, error_count: ingestFailure + sourceFailures, metadata: { runner: "supabase_fallback", fetched_items: fetchedItems, ingest_success: ingestSuccess, ingest_failure: ingestFailure, source_failures: sourceFailures, sources: sourceResults } }),
      });
    } catch {}
  }

  return reply(sourceFailures === SOURCES.length ? 503 : 200, {
    ok: sourceFailures < SOURCES.length,
    runner: "supabase_fallback",
    startedAt,
    finishedAt: new Date().toISOString(),
    fetchedItems,
    ingestSuccess,
    ingestFailure,
    sourceFailures,
    sources: sourceResults,
  });
});
