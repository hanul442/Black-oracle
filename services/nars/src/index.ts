import { parseFeed } from './rss';
import { readSourceConfig } from './sourceConfig';
import type { Env, QueueMessage, SourceRecord } from './types';

const USER_AGENT = 'NARS-v4/4.0 (+https://github.com/hanul442/Black-oracle)';

async function reportSourceStatus(env: Env, source: SourceRecord, ok: boolean, error?: string): Promise<void> {
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/nars-source-status`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      source: {
        key: source.key,
        name: source.name,
        type: source.type,
        endpoint: source.endpoint,
        country: source.country,
        language: source.language,
        tier: source.tier,
        metadata: source.metadata,
      },
      ok,
      error: error?.slice(0, 1000),
    }),
  });
  if (!response.ok) console.error(JSON.stringify({ type: 'source_status_error', source: source.key, status: response.status }));
}

async function fetchSource(source: SourceRecord): Promise<QueueMessage[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), 12_000);
  try {
    const response = await fetch(source.endpoint, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.2',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`source_http_${response.status}`);
    const xml = await response.text();
    const docs = parseFeed(xml, source);
    const fetchedAt = new Date().toISOString();
    return docs.map((document) => ({
      source: {
        key: source.key,
        name: source.name,
        type: source.type,
        endpoint: source.endpoint,
        country: source.country,
        language: source.language,
        tier: source.tier,
        metadata: source.metadata,
      },
      document,
      fetchedAt,
      attempt: 0,
    }));
  } finally {
    clearTimeout(timer);
  }
}

async function collect(env: Env): Promise<{ sources: number; queued: number; failures: string[] }> {
  const sources = readSourceConfig(env).filter((source) => source.type === 'rss');
  let queued = 0;
  const failures: string[] = [];

  for (const source of sources) {
    try {
      const messages = await fetchSource(source);
      for (let i = 0; i < messages.length; i += 100) {
        const batch = messages.slice(i, i + 100).map((body) => ({ body }));
        if (batch.length) await env.NARS_INGEST_QUEUE.sendBatch(batch);
        queued += batch.length;
      }
      await reportSourceStatus(env, source, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      failures.push(`${source.key}:${message}`);
      await reportSourceStatus(env, source, false, message);
    }
  }
  return { sources: sources.length, queued, failures };
}

async function ingest(env: Env, message: QueueMessage): Promise<void> {
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/nars-ingest`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ source: message.source, document: message.document }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`nars_ingest_${response.status}:${detail}`);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'nars-collector', version: '4.0.0-foundation', now: new Date().toISOString() });
    }
    if (url.pathname === '/run' && request.method === 'POST') {
      const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (auth !== env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
      return Response.json(await collect(env));
    }
    return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(collect(env).then((result) => console.log(JSON.stringify({ type: 'collect', ...result }))));
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await ingest(env, message.body);
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({ type: 'ingest_error', id: message.id, error: error instanceof Error ? error.message : 'unknown' }));
        message.retry({ delaySeconds: Math.min(3600, 30 * (2 ** Math.min(message.attempts, 6))) });
      }
    }
  },
} satisfies ExportedHandler<Env, QueueMessage>;
