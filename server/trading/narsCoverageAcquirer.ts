import { LegacyOpenAIAdapter } from '../openaiCompat';
import { evidenceCoverageRequestStore, type StoredEvidenceCoverageRequest } from './evidenceCoverageQueue';

interface DiscoveredSource {
  title: string;
  url: string;
  publisher: string;
  publishedAt?: string | null;
  excerpt?: string | null;
  sourceType?: 'rss' | 'api' | 'filing' | 'government' | 'research' | 'newsletter' | 'social' | 'other';
}

const parseJson = (text: string) => {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned) as { sources?: DiscoveredSource[] };
};

const hostnameKey = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9.-]+/g, '-');
  } catch {
    return 'unknown-source';
  }
};

const discover = async (request: StoredEvidenceCoverageRequest): Promise<DiscoveredSource[]> => {
  const apiKey = String(process.env.OPENAI_API_KEY ?? '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is unavailable for evidence coverage discovery.');
  const ai = new LegacyOpenAIAdapter({ apiKey });
  const aliases = request.aliases.length ? request.aliases.join(', ') : request.market;
  const result = await ai.models.generateContent({
    contents: `You are the discovery stage of NARS, an evidence acquisition system.\n\nFind recent, source-backed information materially relevant to the trading instrument ${request.market}. Known entity aliases: ${aliases}.\n\nRules:\n- Prefer primary/official sources, project/company announcements, regulators, exchange notices and reputable financial news.\n- Do not provide investment advice and do not decide BUY/SELL.\n- Do not invent a source, title, date, quote or URL.\n- Return only sources actually found by web search.\n- Prefer sources from the last 7 days when available; structural/official documents may be older if still materially current.\n- Avoid duplicate syndications.\n- Maximum 6 sources.\n\nReturn strict JSON only:\n{\"sources\":[{\"title\":\"...\",\"url\":\"https://...\",\"publisher\":\"...\",\"publishedAt\":\"ISO date or null\",\"excerpt\":\"short factual description\",\"sourceType\":\"government|filing|research|api|rss|newsletter|social|other\"}]}`,
    config: { tools: [{ googleSearch: {} }] },
  });
  const groundedUrls = new Set<string>(
    (result.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
      .map((item: any) => item?.web?.uri)
      .filter((url: unknown): url is string => typeof url === 'string' && /^https?:\/\//i.test(url)),
  );
  const payload = parseJson(result.text);
  return (payload.sources ?? [])
    .filter((item) => item && typeof item.title === 'string' && typeof item.publisher === 'string' && typeof item.url === 'string')
    .filter((item) => /^https?:\/\//i.test(item.url) && groundedUrls.has(item.url))
    .slice(0, 6);
};

const ingestIntoNars = async (request: StoredEvidenceCoverageRequest, source: DiscoveredSource) => {
  const supabaseUrl = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase credentials are unavailable for NARS ingest.');
  const response = await fetch(`${supabaseUrl}/functions/v1/nars-ingest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: {
        key: `coverage:${hostnameKey(source.url)}`,
        name: source.publisher.trim(),
        type: source.sourceType ?? 'other',
        endpoint: source.url,
        metadata: {
          discovered_by: 'black_oracle_coverage_request',
          request_key: request.requestKey,
          market: request.market,
          execution_authority: false,
        },
      },
      document: {
        publishedAt: source.publishedAt || undefined,
        title: source.title.trim(),
        url: source.url,
        excerpt: source.excerpt || undefined,
        metadata: {
          coverage_request_key: request.requestKey,
          coverage_market: request.market,
          aliases: request.aliases,
          discovery_only: true,
          execution_authority: false,
        },
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    throw new Error(`NARS ingest rejected coverage source (${response.status}): ${JSON.stringify(body).slice(0, 300)}`);
  }
  return String(body.documentId ?? '');
};

/**
 * Converts evidence debt into NARS acquisition work. It deliberately does not
 * write TradingEvidence or grant execution authority. NARS must ingest, verify,
 * cluster, score and emit an EvidencePacket before Black Oracle can re-analyze it.
 */
export const acquirePendingEvidenceCoverage = async (maxRequests = 2) => {
  const now = Date.now();
  const requests = (await evidenceCoverageRequestStore.list(100))
    .filter((item) => item.status === 'PENDING' || item.status === 'FAILED')
    .filter((item) => item.lastAttemptAt == null || now - item.lastAttemptAt >= 30 * 60_000)
    .slice(0, Math.max(0, maxRequests));

  const results: Array<{ requestKey: string; market: string; discovered: number; ingested: number; error?: string }> = [];
  for (const request of requests) {
    try {
      await evidenceCoverageRequestStore.updateStatus(request.requestKey, 'ACQUIRING', { attemptedAt: now });
      const sources = await discover(request);
      let ingested = 0;
      for (const source of sources) {
        try {
          await ingestIntoNars(request, source);
          ingested += 1;
        } catch {
          // One bad source must not discard the other grounded discoveries.
        }
      }
      if (ingested === 0) {
        await evidenceCoverageRequestStore.updateStatus(request.requestKey, 'PENDING', {
          attemptedAt: Date.now(),
          reason: 'Coverage discovery completed without a NARS-ingestable grounded source. Keep new risk blocked and retry later.',
        });
      } else {
        await evidenceCoverageRequestStore.updateStatus(request.requestKey, 'ACQUIRING', {
          attemptedAt: Date.now(),
          reason: `${ingested} grounded source(s) were handed to NARS. Await verified EvidencePacket delivery before re-analysis.`,
        });
      }
      results.push({ requestKey: request.requestKey, market: request.market, discovered: sources.length, ingested });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown coverage acquisition error.';
      await evidenceCoverageRequestStore.updateStatus(request.requestKey, 'FAILED', { attemptedAt: Date.now(), reason: message }).catch(() => undefined);
      results.push({ requestKey: request.requestKey, market: request.market, discovered: 0, ingested: 0, error: message });
    }
  }
  return results;
};
