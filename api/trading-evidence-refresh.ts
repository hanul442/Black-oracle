import Parser from 'rss-parser';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.4-mini';
const MAX_MARKETS = 6;
const MAX_CANDIDATES = 36;
export const FSC_PRESS_RELEASE_RSS = 'https://www.fsc.go.kr/about/fsc_bbs_rss/?fid=0111';
export const BOK_MONETARY_POLICY_RSS = 'https://www.bok.or.kr/portal/bbs/P0000559/news.rss?menuNo=200690';
const BOK_MAX_AGE_MS = 48 * 60 * 60_000;
const BOK_MAX_FUTURE_SKEW_MS = 5 * 60_000;

const json = (response: any, status: number, body: Record<string, unknown>) =>
  response.status(status).json(body);

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unknown evidence refresh error.';

const isAuthorizedInternalCall = (authorization: string | undefined) => {
  if (!authorization?.startsWith('Bearer ')) return false;
  const presented = authorization.slice('Bearer '.length).trim();
  const accepted = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return accepted.includes(presented);
};

const parser = new Parser({
  timeout: 8_000,
  headers: { 'User-Agent': 'BlackOracle-Evidence/0.3' },
});

type Candidate = {
  candidateId: string;
  market: string;
  title: string;
  summary?: string;
  publisher: string;
  sourceUrl: string;
  publishedAt: number;
  sourceType: 'PRIMARY' | 'NEWS' | 'MACRO' | 'ANALYST';
  reliability: number;
  tags: string[];
};

type Classification = {
  candidateId: string;
  relevant: boolean;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;
  expiryHours: number;
  rationale: string;
  contradictionOf: string;
};

type NewsLanguage = 'EN' | 'KO';

const publisherReliability = (publisher: string) => {
  const normalized = publisher.toLowerCase();

  // Operational priors only. Language does not change the score.
  if (normalized.includes('reuters')) return 0.90;
  if (normalized.includes('bloomberg')) return 0.88;
  if (normalized.includes('financial times')) return 0.86;
  if (normalized.includes('wall street journal') || normalized.includes('wsj')) return 0.86;
  if (normalized.includes('연합뉴스') || normalized.includes('yna')) return 0.84;
  if (normalized.includes('cnbc')) return 0.80;
  if (normalized.includes('coindesk')) return 0.80;
  if (normalized.includes('the block')) return 0.76;
  if (normalized.includes('한국경제') || normalized.includes('hankyung')) return 0.76;
  if (normalized.includes('매일경제') || normalized.includes('mk.co.kr')) return 0.76;
  if (normalized.includes('서울경제') || normalized.includes('sedaily')) return 0.74;
  if (normalized.includes('조선비즈') || normalized.includes('chosunbiz')) return 0.74;
  if (normalized.includes('decrypt')) return 0.72;
  if (normalized.includes('cointelegraph')) return 0.64;
  return 0;
};

const assetTerms = (market: string, language: NewsLanguage = 'EN') => {
  const symbol = market.replace(/^KRW-/, '').toUpperCase();
  const english: Record<string, string[]> = {
    BTC: ['bitcoin', 'btc'],
    ETH: ['ethereum', 'ether', 'eth'],
    XRP: ['xrp', 'ripple'],
    SOL: ['solana', 'sol'],
    USDT: ['tether', 'usdt'],
    TRUMP: ['official trump', 'trump token', '$trump'],
  };
  const korean: Record<string, string[]> = {
    BTC: ['비트코인', 'BTC'],
    ETH: ['이더리움', '이더', 'ETH'],
    XRP: ['XRP', '리플'],
    SOL: ['솔라나', 'SOL'],
    USDT: ['테더', 'USDT'],
    TRUMP: ['트럼프 코인', 'TRUMP'],
  };
  return (language === 'KO' ? korean[symbol] : english[symbol]) || [symbol];
};

const matchesMarket = (text: string, market: string) => {
  const normalized = ` ${text.toLowerCase()} `;
  return assetTerms(market, 'EN').some((term) => {
    const lower = term.toLowerCase();
    if (lower.length <= 4) return new RegExp(`(^|[^a-z0-9])${lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(text);
    return normalized.includes(lower);
  });
};

const KOREAN_CRYPTO_REGULATORY_TERMS = [
  '가상자산',
  '디지털자산',
  '암호자산',
  '가상화폐',
  '코인거래소',
  '가상자산사업자',
  'virtual asset',
  'digital asset',
  'crypto asset',
];

export const isBroadKoreanCryptoRegulatory = (text: string) => {
  const normalized = text.toLowerCase();
  return KOREAN_CRYPTO_REGULATORY_TERMS.some((term) => normalized.includes(term.toLowerCase()));
};

const cleanTitlePublisher = (title: string, fallback: string) => {
  const parts = title.split(' - ');
  if (parts.length < 2) return { title: title.trim(), publisher: fallback };
  const publisher = parts[parts.length - 1].trim();
  return { title: parts.slice(0, -1).join(' - ').trim(), publisher };
};

const itemTimestamp = (item: any) => {
  const value = item.isoDate || item.pubDate || item.published || item.updated;
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const strictItemTimestamp = (item: any) => {
  const value = item.isoDate || item.pubDate || item.published || item.updated;
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const makeCandidateId = (market: string, index: number, source: string) =>
  `${market}-${source}-${index}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);

const collectCoinDesk = async (markets: string[], warnings: string[]) => {
  try {
    const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
    const result: Candidate[] = [];
    for (const market of markets) {
      const matching = (feed.items || [])
        .filter((item: any) => matchesMarket(`${item.title || ''} ${item.contentSnippet || ''}`, market))
        .slice(0, 2);
      matching.forEach((item: any, index: number) => {
        if (!item.link || !item.title) return;
        result.push({
          candidateId: makeCandidateId(market, index, 'coindesk'),
          market,
          title: String(item.title).trim(),
          summary: String(item.contentSnippet || '').trim().slice(0, 1200) || undefined,
          publisher: 'CoinDesk',
          sourceUrl: String(item.link),
          publishedAt: itemTimestamp(item),
          sourceType: 'NEWS',
          reliability: 0.80,
          tags: ['coindesk', 'language:en', market.replace(/^KRW-/, '').toLowerCase()],
        });
      });
    }
    return result;
  } catch (error) {
    warnings.push(`CoinDesk RSS: ${errorMessage(error)}`);
    return [];
  }
};

const collectEthereumPrimary = async (markets: string[], warnings: string[]) => {
  if (!markets.includes('KRW-ETH')) return [] as Candidate[];
  try {
    const feed = await parser.parseURL('https://blog.ethereum.org/feed.xml');
    return (feed.items || []).slice(0, 3).flatMap((item: any, index: number): Candidate[] => {
      if (!item.link || !item.title) return [];
      return [{
        candidateId: makeCandidateId('KRW-ETH', index, 'ethereum-foundation'),
        market: 'KRW-ETH',
        title: String(item.title).trim(),
        summary: String(item.contentSnippet || '').trim().slice(0, 1200) || undefined,
        publisher: 'Ethereum Foundation',
        sourceUrl: String(item.link),
        publishedAt: itemTimestamp(item),
        sourceType: 'PRIMARY',
        reliability: 0.96,
        tags: ['official', 'ethereum', 'protocol', 'language:en'],
      }];
    });
  } catch (error) {
    warnings.push(`Ethereum Foundation RSS: ${errorMessage(error)}`);
    return [];
  }
};

const collectFscPrimary = async (markets: string[], warnings: string[]) => {
  try {
    const feed = await parser.parseURL(FSC_PRESS_RELEASE_RSS);
    const relevant = (feed.items || [])
      .filter((item: any) => item?.title && item?.link)
      .filter((item: any) => isBroadKoreanCryptoRegulatory(`${item.title || ''} ${item.contentSnippet || ''} ${item.content || ''}`))
      .slice(0, 3);

    const result: Candidate[] = [];
    for (const market of markets) {
      for (const item of relevant) {
        const publishedAt = itemTimestamp(item);
        result.push({
          candidateId: makeCandidateId(market, publishedAt, 'fsc-korea'),
          market,
          title: String(item.title).trim(),
          summary: String(item.contentSnippet || item.content || '').trim().slice(0, 1200) || undefined,
          publisher: '금융위원회',
          sourceUrl: String(item.link),
          publishedAt,
          sourceType: 'PRIMARY',
          reliability: 0.94,
          tags: ['official', 'fsc-korea', 'regulation', 'language:ko', market.replace(/^KRW-/, '').toLowerCase()],
        });
      }
    }
    return result;
  } catch (error) {
    warnings.push(`금융위원회 RSS: ${errorMessage(error)}`);
    return [];
  }
};

const collectBokMacro = async (markets: string[], warnings: string[]) => {
  try {
    const feed = await parser.parseURL(BOK_MONETARY_POLICY_RSS);
    const now = Date.now();
    const relevant = (feed.items || [])
      .flatMap((item: any) => {
        if (!item?.title || !item?.link) return [];
        const publishedAt = strictItemTimestamp(item);
        if (publishedAt == null) return [];
        const ageMs = now - publishedAt;
        if (ageMs < -BOK_MAX_FUTURE_SKEW_MS || ageMs > BOK_MAX_AGE_MS) return [];
        return [{ item, publishedAt }];
      })
      .slice(0, 2);

    const result: Candidate[] = [];
    for (const market of markets) {
      for (const { item, publishedAt } of relevant) {
        result.push({
          candidateId: makeCandidateId(market, publishedAt, 'bok-monetary-policy'),
          market,
          title: String(item.title).trim(),
          summary: String(item.contentSnippet || item.content || '').trim().slice(0, 1200) || undefined,
          publisher: '한국은행',
          sourceUrl: String(item.link),
          publishedAt,
          sourceType: 'MACRO',
          reliability: 0.96,
          tags: ['official', 'bok-korea', 'macro', 'monetary-policy', 'language:ko', market.replace(/^KRW-/, '').toLowerCase()],
        });
      }
    }
    return result;
  } catch (error) {
    warnings.push(`한국은행 통화정책 RSS: ${errorMessage(error)}`);
    return [];
  }
};

const collectGoogleNews = async (
  markets: string[],
  warnings: string[],
  language: NewsLanguage,
) => {
  const result: Candidate[] = [];
  for (const market of markets) {
    const symbol = market.replace(/^KRW-/, '');
    const suffix = language === 'KO' ? '가상자산 when:24h' : 'crypto when:24h';
    const query = `${assetTerms(market, language).slice(0, 2).join(' OR ')} ${suffix}`;
    const locale = language === 'KO'
      ? 'hl=ko&gl=KR&ceid=KR:ko'
      : 'hl=en-US&gl=US&ceid=US:en';
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${locale}`;

    try {
      const feed = await parser.parseURL(url);
      let accepted = 0;
      for (const item of feed.items || []) {
        if (accepted >= 2 || !item.title || !item.link) break;
        const parsed = cleanTitlePublisher(String(item.title), 'Google News');
        const reliability = publisherReliability(parsed.publisher);
        if (reliability <= 0) continue;
        result.push({
          candidateId: makeCandidateId(market, accepted, `gnews-${language.toLowerCase()}-${symbol}`),
          market,
          title: parsed.title,
          summary: String(item.contentSnippet || '').trim().slice(0, 1200) || undefined,
          publisher: parsed.publisher,
          sourceUrl: String(item.link),
          publishedAt: itemTimestamp(item),
          sourceType: 'NEWS',
          reliability,
          tags: ['google-news', `language:${language.toLowerCase()}`, symbol.toLowerCase()],
        });
        accepted += 1;
      }
    } catch (error) {
      warnings.push(`Google News ${language} ${market}: ${errorMessage(error)}`);
    }
  }
  return result;
};

const dedupeCandidates = (items: Candidate[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.market}|${item.sourceUrl}|${item.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_CANDIDATES);
};

const extractOutputText = (payload: any) => {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  for (const item of payload?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('OpenAI response did not contain output text.');
};

const classificationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['candidateId', 'relevant', 'direction', 'strength', 'expiryHours', 'rationale', 'contradictionOf'],
        properties: {
          candidateId: { type: 'string' },
          relevant: { type: 'boolean' },
          direction: { type: 'string', enum: ['BULLISH', 'BEARISH', 'NEUTRAL'] },
          strength: { type: 'number', minimum: 0, maximum: 100 },
          expiryHours: { type: 'number', minimum: 4, maximum: 96 },
          rationale: { type: 'string' },
          contradictionOf: { type: 'string' },
        },
      },
    },
  },
};

const classifyCandidates = async (candidates: Candidate[], existingEvidence: any[]) => {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_API?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured for evidence classification.');
  if (!candidates.length) return [] as Classification[];

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
      store: false,
      reasoning: { effort: 'low' },
      instructions: [
        'You classify source-backed evidence for a crypto Paper trading research system.',
        'Candidates may be written in English or Korean. Apply identical analytical standards regardless of language.',
        'Use only the supplied headline, summary, publisher, timestamp and existing evidence. Never invent missing facts.',
        'Relevant means the supplied item could materially change the 4-48 hour thesis for that exact market.',
        'If the headline/summary is generic, promotional, ambiguous or not price-relevant, set relevant=false.',
        'Direction is the likely near-term effect if the stated fact is true, not a trade instruction.',
        'Strength measures materiality, not certainty. Source reliability is assigned outside the model and must not be inferred here.',
        'Use contradictionOf only when a new item clearly negates or supersedes one supplied existing evidence item; otherwise return an empty string.',
        'This classifier has no execution authority.',
      ].join('\n'),
      input: JSON.stringify({
        candidates: candidates.map(({ reliability, ...candidate }) => candidate),
        existingEvidence: existingEvidence.slice(0, 30).map((item) => ({
          id: item.id,
          market: item.market,
          title: item.title,
          direction: item.direction,
          publisher: item.publisher || item.source || null,
          observedAt: item.observedAt,
        })),
      }),
      max_output_tokens: 5_000,
      text: {
        format: {
          type: 'json_schema',
          name: 'black_oracle_external_evidence',
          strict: true,
          schema: classificationSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI classification failed with HTTP ${response.status}.`);
  }
  const parsed = JSON.parse(extractOutputText(payload));
  return Array.isArray(parsed?.items) ? parsed.items as Classification[] : [];
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { success: false, error: 'Method not allowed.' });
  }
  if (!isAuthorizedInternalCall(request.headers.authorization)) {
    return json(response, 401, { success: false, error: 'Unauthorized internal invocation.' });
  }
  if ((process.env.TRADING_PERSISTENCE_BACKEND ?? '').toLowerCase() !== 'supabase') {
    return json(response, 503, { success: false, error: 'Evidence refresh requires Supabase trading persistence.' });
  }

  let runtime: any;
  try {
    // @ts-ignore build-generated runtime bundle is created before Vercel packaging.
    runtime = await import('../server/trading/runtime-bundle.mjs');
    if (
      typeof runtime.claimTradingCycleLease !== 'function' ||
      typeof runtime.releaseTradingCycleLease !== 'function' ||
      typeof runtime.restoreRuntimeCheckpoint !== 'function' ||
      typeof runtime.saveRuntimeCheckpoint !== 'function' ||
      typeof runtime.buildRuntimeCheckpoint !== 'function' ||
      typeof runtime.buildExternalTradingEvidence !== 'function' ||
      !runtime.tradingEvidenceStore
    ) throw new Error('Trading runtime bundle is missing evidence refresh exports.');
  } catch (error) {
    return json(response, 500, { success: false, phase: 'startup-import', error: errorMessage(error) });
  }

  const runtimeId = process.env.TRADING_RUNTIME_ID?.trim() || 'black-oracle-paper';
  const owner = `evidence-refresh-${globalThis.crypto.randomUUID()}`;
  let leaseAcquired = false;
  const warnings: string[] = [];

  try {
    leaseAcquired = await runtime.claimTradingCycleLease(runtimeId, owner, 240);
    if (!leaseAcquired) {
      return json(response, 409, { success: false, skipped: true, reason: 'Paper runtime is busy.', runtimeId });
    }

    const restored = await runtime.restoreRuntimeCheckpoint(false);
    if (!restored.restored) {
      return json(response, 409, { success: false, skipped: true, reason: 'No Paper checkpoint is available.', runtimeId });
    }

    const snapshot = runtime.buildRuntimeCheckpoint('evidence-refresh-inspection');
    const openMarkets = (snapshot.session?.portfolio?.positions || []).map((item: any) => String(item.market));
    const candidateMarkets = (snapshot.loop?.lastCycle?.markets || []).map((item: any) => String(item.market));
    const markets = Array.from(new Set([...openMarkets, ...candidateMarkets]))
      .filter((market): market is string => /^KRW-[A-Z0-9]+$/.test(market))
      .slice(0, MAX_MARKETS);

    if (!markets.length) {
      return json(response, 200, { success: true, runtimeId, markets: [], candidates: 0, accepted: 0, warnings });
    }

    const [coinDesk, ethereumPrimary, fscPrimary, bokMacro, googleNewsEn, googleNewsKo] = await Promise.all([
      collectCoinDesk(markets, warnings),
      collectEthereumPrimary(markets, warnings),
      collectFscPrimary(markets, warnings),
      collectBokMacro(markets, warnings),
      collectGoogleNews(markets, warnings, 'EN'),
      collectGoogleNews(markets, warnings, 'KO'),
    ]);
    const candidates = dedupeCandidates([
      ...ethereumPrimary,
      ...fscPrimary,
      ...bokMacro,
      ...coinDesk,
      ...googleNewsEn,
      ...googleNewsKo,
    ]);
    const existingEvidence = runtime.tradingEvidenceStore.list(undefined, false);
    const classifications = await classifyCandidates(candidates, existingEvidence);
    const classificationById = new Map(classifications.map((item) => [item.candidateId, item]));

    const accepted: any[] = [];
    for (const candidate of candidates) {
      const classification = classificationById.get(candidate.candidateId);
      if (!classification) continue;
      const evidence = runtime.buildExternalTradingEvidence(candidate, classification, Date.now());
      if (!evidence) continue;
      const stored = runtime.tradingEvidenceStore.upsert(evidence);
      accepted.push({
        id: stored.id,
        market: stored.market,
        title: stored.title,
        direction: stored.direction,
        strength: stored.strength,
        reliability: stored.reliability,
        publisher: stored.publisher,
        sourceUrl: stored.sourceUrl,
        expiresAt: stored.expiresAt,
        language: stored.tags?.find((tag: string) => tag.startsWith('language:'))?.replace('language:', '') || null,
      });
    }

    const saved = await runtime.saveRuntimeCheckpoint('external-evidence-refresh');
    return json(response, 200, {
      success: true,
      runtimeId,
      markets,
      candidates: candidates.length,
      candidateBreakdown: {
        primary: ethereumPrimary.length + fscPrimary.length,
        macro: bokMacro.length,
        ethereumPrimary: ethereumPrimary.length,
        fscPrimary: fscPrimary.length,
        bokMacro: bokMacro.length,
        coindesk: coinDesk.length,
        english: googleNewsEn.length,
        korean: googleNewsKo.length,
      },
      accepted: accepted.length,
      evidence: accepted,
      warnings,
      persistence: saved.persistence,
      executionAuthority: false,
    });
  } catch (error) {
    return json(response, 500, { success: false, runtimeId, error: errorMessage(error), warnings });
  } finally {
    if (leaseAcquired) {
      try {
        await runtime.releaseTradingCycleLease(runtimeId, owner);
      } catch (error) {
        console.error('Evidence refresh lease cleanup failed:', error);
      }
    }
  }
}