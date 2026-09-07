import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildExternalTradingEvidence,
  paperLoopController,
  paperTradingSession,
  tradeCaseStore,
  tradingEvidenceStore,
} from "https://raw.githubusercontent.com/hanul442/Black-oracle/f5b2c06eee223da930dd41009589c2047109ae4e/supabase/functions/_shared/tradingRuntimeEdgeBundle.mjs";

const RUNTIME_ID = "black-oracle-paper-native-shadow";
const RUNTIME_TABLE = "black_oracle_trading_runtime";
const VERSION = "BO-SUPABASE-NATIVE-SHADOW-v0.2";
const MAX_EVIDENCE = 48;
const FEEDS = [
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", publisher: "CoinDesk", sourceType: "NEWS", reliability: 0.80 },
  { url: "https://www.fsc.go.kr/about/fsc_bbs_rss/?fid=0111", publisher: "Financial Services Commission", sourceType: "PRIMARY", reliability: 0.90 },
  { url: "https://www.bok.or.kr/portal/bbs/P0000559/news.rss?menuNo=200690", publisher: "Bank of Korea", sourceType: "MACRO", reliability: 0.92 },
] as const;
const ASSETS = [
  { market: "KRW-BTC", terms: ["bitcoin", "btc", "비트코인"] },
  { market: "KRW-ETH", terms: ["ethereum", "ether", "eth", "이더리움"] },
  { market: "KRW-XRP", terms: ["xrp", "ripple", "리플"] },
  { market: "KRW-SOL", terms: ["solana", "sol", "솔라나"] },
  { market: "KRW-DOGE", terms: ["dogecoin", "doge", "도지코인"] },
  { market: "KRW-ADA", terms: ["cardano", "ada", "카르다노"] },
] as const;
const POSITIVE = ["approval", "approved", "adoption", "inflow", "inflows", "rally", "surge", "record high", "upgrade", "partnership", "launch", "buying", "accumulation", "승인", "도입", "유입", "상승", "급등", "채택"];
const NEGATIVE = ["hack", "hacked", "exploit", "lawsuit", "ban", "outflow", "outflows", "liquidation", "crash", "fraud", "investigation", "breach", "selloff", "해킹", "소송", "금지", "유출", "청산", "급락", "사기", "조사"];
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const decodeXml = (value: string) => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const field = (item: string, name: string) => { const match = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i")); return match ? decodeXml(match[1]) : ""; };
const parseFeed = (xml: string) => Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map((match) => { const item = match[0]; const title = field(item, "title"); const link = field(item, "link") || field(item, "guid"); const description = field(item, "description"); const publishedText = field(item, "pubDate") || field(item, "dc:date") || field(item, "published"); const publishedAt = Date.parse(publishedText); return { title, link, description, publishedAt }; }).filter((item) => item.title && /^https?:\/\//i.test(item.link) && Number.isFinite(item.publishedAt));
const countHits = (text: string, words: readonly string[]) => words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
const classify = (text: string) => { const positive = countHits(text, POSITIVE); const negative = countHits(text, NEGATIVE); if (positive === 0 && negative === 0) return { direction: "NEUTRAL" as const, strength: 20, rationale: "No deterministic directional keyword matched; retained as neutral context." }; if (positive === negative) return { direction: "NEUTRAL" as const, strength: 25, rationale: `Directional keyword conflict (${positive}/${negative}); retained as neutral context.` }; const direction = positive > negative ? "BULLISH" as const : "BEARISH" as const; const hits = Math.max(positive, negative); return { direction, strength: Math.min(55, 35 + hits * 5), rationale: `${direction} deterministic keyword evidence (${positive} positive / ${negative} negative hits).` }; };
const collectEvidence = async () => {
  const now = Date.now();
  const responses = await Promise.allSettled(FEEDS.map(async (feed) => { const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8_000); try { const response = await fetch(feed.url, { headers: { accept: "application/rss+xml, application/xml, text/xml, */*", "user-agent": "Black-Oracle-Native-Shadow/0.2" }, signal: controller.signal }); if (!response.ok) throw new Error(`${feed.publisher} RSS HTTP ${response.status}`); return { feed, items: parseFeed(await response.text()).slice(0, 40) }; } finally { clearTimeout(timeout); } }));
  const evidence: any[] = []; const warnings: string[] = [];
  for (const result of responses) {
    if (result.status === "rejected") { warnings.push(result.reason instanceof Error ? result.reason.message : "RSS collection failed."); continue; }
    const { feed, items } = result.value;
    for (const item of items) {
      const text = `${item.title} ${item.description}`.toLowerCase();
      for (const asset of ASSETS) {
        if (!asset.terms.some((term) => text.includes(term))) continue;
        const deterministic = classify(text);
        const normalized = buildExternalTradingEvidence({ market: asset.market, title: item.title, summary: item.description, publisher: feed.publisher, sourceUrl: item.link, publishedAt: item.publishedAt, sourceType: feed.sourceType, reliability: feed.reliability, tags: ["supabase-native-shadow", "deterministic-classifier"] }, { relevant: true, direction: deterministic.direction, strength: deterministic.strength, expiryHours: feed.sourceType === "PRIMARY" ? 48 : 18, rationale: deterministic.rationale }, now);
        if (normalized) evidence.push(normalized);
      }
    }
  }
  const byId = new Map<string, any>(); for (const item of evidence) byId.set(item.id, item);
  return { evidence: Array.from(byId.values()).slice(0, MAX_EVIDENCE), warnings };
};
const resetRuntime = () => { paperTradingSession.reset(1_000_000); tradingEvidenceStore.clear(); tradeCaseStore.replaceAll([]); paperLoopController.restore({ schemaVersion: 1, running: false, config: { intervalMs: 15 * 60 * 1000, maxMarkets: 6, maxOpenPositions: 4 }, cycleCount: 0, lastCycle: null, marketHistory: [], cycleHistory: [], validationSamples: [], councilComparisons: [] }, false); };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") return json({ success: false, error: "Method not allowed." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"); const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ success: false, error: "Supabase server credentials are unavailable." }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const owner = `native-shadow-${crypto.randomUUID()}`;
  const { data: claimed, error: claimError } = await admin.rpc("claim_black_oracle_trading_cycle_lease", { p_runtime_id: RUNTIME_ID, p_owner: owner, p_lease_seconds: 840 });
  if (claimError) return json({ success: false, error: `Lease claim failed: ${claimError.message}` }, 500);
  if (!claimed) return json({ success: true, skipped: true, reason: "Native shadow cycle lease is already held." }, 409);
  try {
    const { data: row, error: loadError } = await admin.from(RUNTIME_TABLE).select("checkpoint").eq("runtime_id", RUNTIME_ID).maybeSingle();
    if (loadError) throw new Error(`Shadow checkpoint read failed: ${loadError.message}`);
    if (row?.checkpoint && typeof row.checkpoint === "object") { const checkpoint = row.checkpoint as any; paperTradingSession.restore(checkpoint.session); tradingEvidenceStore.replaceAll(Array.isArray(checkpoint.evidence) ? checkpoint.evidence : []); tradeCaseStore.replaceAll(Array.isArray(checkpoint.tradeCases) ? checkpoint.tradeCases : []); paperLoopController.restore(checkpoint.loop, false); } else resetRuntime();
    const collected = await collectEvidence();
    const merged = new Map<string, any>(tradingEvidenceStore.list(undefined, false).map((item: any) => [item.id, item])); for (const item of collected.evidence) merged.set(item.id, item); tradingEvidenceStore.replaceAll(Array.from(merged.values()).slice(0, MAX_EVIDENCE));
    const cycle = await paperLoopController.runCycle(); const savedAt = Date.now();
    const checkpoint = { schemaVersion: 1, savedAt, reason: "supabase-native-shadow-cycle", session: paperTradingSession.checkpoint(), evidence: tradingEvidenceStore.list(undefined, true), loop: paperLoopController.checkpoint(), tradeCases: tradeCaseStore.list() };
    const { error: saveError } = await admin.from(RUNTIME_TABLE).upsert({ runtime_id: RUNTIME_ID, schema_version: 1, saved_at: new Date(savedAt).toISOString(), reason: checkpoint.reason, checkpoint }, { onConflict: "runtime_id" });
    if (saveError) throw new Error(`Shadow checkpoint write failed: ${saveError.message}`);
    return json({ success: true, version: VERSION, runtimeId: RUNTIME_ID, authority: { mode: "PAPER_SHADOW", liveTrading: false, productionAuthority: false }, evidence: { active: tradingEvidenceStore.list().length, collected: collected.evidence.length, warnings: collected.warnings.slice(0, 8) }, cycle: { startedAt: cycle.startedAt, finishedAt: cycle.finishedAt, scanned: cycle.scanned, entered: cycle.entered, exited: cycle.exited, held: cycle.held, noTrade: cycle.noTrade, errors: cycle.errors.length } });
  } catch (error) {
    return json({ success: false, version: VERSION, runtimeId: RUNTIME_ID, error: error instanceof Error ? error.message : "Unknown native shadow cycle error." }, 500);
  } finally {
    try { await admin.rpc("release_black_oracle_trading_cycle_lease", { p_runtime_id: RUNTIME_ID, p_owner: owner }); } catch { /* Lease expiry remains the final fail-safe. */ }
  }
});
