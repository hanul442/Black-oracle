import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  JsonTradingCheckpointStore,
  SupabaseTradingCheckpointStore,
  type TradingRuntimeCheckpoint,
} from './persistence';

const buildCheckpoint = (): TradingRuntimeCheckpoint => ({
  schemaVersion: 1,
  savedAt: 123456,
  reason: 'test',
  session: {
    schemaVersion: 1,
    portfolio: {
      initialEquity: 1_000_000,
      cash: 1_000_000,
      dailyStartEquity: 1_000_000,
      realizedPnl: 0,
      feesPaid: 0,
      peakEquity: 1_000_000,
      positions: [],
      equityCurve: [],
    },
    markPrices: [],
    entryMetadata: [],
    closedTrades: [],
    ledger: [],
    processedOrderIds: [],
  },
  evidence: [],
  loop: {
    schemaVersion: 1,
    running: true,
    config: {
      intervalMs: 900_000,
      maxMarkets: 6,
      maxOpenPositions: 4,
    },
    cycleCount: 12,
    lastCycle: null,
  },
});

test('JSON checkpoint store roundtrips runtime state', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'black-oracle-trading-'));
  const filePath = path.join(directory, 'runtime.json');
  const store = new JsonTradingCheckpointStore(filePath);

  try {
    const checkpoint = buildCheckpoint();
    await store.save(checkpoint);
    const restored = await store.load();

    assert.deepEqual(restored, checkpoint);
    assert.equal(store.status().backend, 'json');
    assert.equal(store.status().writes, 1);
    assert.equal(store.status().restores, 1);
    assert.equal(store.status().lastError, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('missing checkpoint returns null without marking persistence faulty', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'black-oracle-trading-missing-'));
  const filePath = path.join(directory, 'does-not-exist.json');
  const store = new JsonTradingCheckpointStore(filePath);

  try {
    const restored = await store.load();
    assert.equal(restored, null);
    assert.equal(store.status().lastError, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Supabase checkpoint store upserts and restores the runtime row', async () => {
  const checkpoint = buildCheckpoint();
  let stored: TradingRuntimeCheckpoint | null = null;
  const calls: Array<{ url: string; method: string; headers: Headers; body?: string }> = [];

  const fakeFetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? init.body : undefined;
    calls.push({ url, method, headers, body });

    if (method === 'POST') {
      const payload = JSON.parse(body ?? '{}') as { checkpoint?: TradingRuntimeCheckpoint; runtime_id?: string };
      assert.equal(payload.runtime_id, 'paper-primary');
      assert.equal(headers.get('apikey'), 'service-role-test');
      assert.equal(headers.get('authorization'), 'Bearer service-role-test');
      assert.match(headers.get('prefer') ?? '', /resolution=merge-duplicates/);
      stored = payload.checkpoint ?? null;
      return new Response(null, { status: 201 });
    }

    assert.match(url, /runtime_id=eq(?:\.|%2E)paper-primary/);
    assert.equal(headers.get('apikey'), 'service-role-test');
    return new Response(JSON.stringify(stored ? [{ checkpoint: stored }] : []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const store = new SupabaseTradingCheckpointStore({
    url: 'https://example.supabase.co',
    serviceRoleKey: 'service-role-test',
    runtimeId: 'paper-primary',
    fetchImpl: fakeFetch,
  });

  await store.save(checkpoint);
  const restored = await store.load();

  assert.deepEqual(restored, checkpoint);
  assert.equal(store.status().backend, 'supabase');
  assert.equal(store.status().runtimeId, 'paper-primary');
  assert.equal(store.status().writes, 1);
  assert.equal(store.status().restores, 1);
  assert.equal(store.status().lastError, null);
  assert.equal(calls.length, 2);
});

test('Supabase checkpoint store treats an absent runtime row as a fresh Paper account', async () => {
  const fakeFetch = (async () => new Response('[]', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;

  const store = new SupabaseTradingCheckpointStore({
    url: 'https://example.supabase.co',
    serviceRoleKey: 'service-role-test',
    fetchImpl: fakeFetch,
  });

  assert.equal(await store.load(), null);
  assert.equal(store.status().lastError, null);
});

test('Supabase checkpoint store retries transient PGRST303 future-time rejection', async () => {
  const checkpoint = buildCheckpoint();
  let attempts = 0;

  const fakeFetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
    attempts += 1;
    if (attempts === 1) {
      return new Response(JSON.stringify({
        code: 'PGRST303',
        message: 'JWT issued at future',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    assert.equal(init?.method, 'POST');
    return new Response(null, { status: 201 });
  }) as typeof fetch;

  const store = new SupabaseTradingCheckpointStore({
    url: 'https://example.supabase.co',
    serviceRoleKey: 'service-role-test',
    runtimeId: 'paper-primary',
    fetchImpl: fakeFetch,
    retryDelaysMs: [0],
  });

  await store.save(checkpoint);
  assert.equal(attempts, 2);
  assert.equal(store.status().writes, 1);
  assert.equal(store.status().lastError, null);
});

test('Supabase checkpoint store does not retry a non-transient authentication failure', async () => {
  let attempts = 0;
  const fakeFetch = (async () => {
    attempts += 1;
    return new Response(JSON.stringify({
      code: 'PGRST301',
      message: 'invalid JWT',
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const store = new SupabaseTradingCheckpointStore({
    url: 'https://example.supabase.co',
    serviceRoleKey: 'service-role-test',
    runtimeId: 'paper-primary',
    fetchImpl: fakeFetch,
    retryDelaysMs: [0, 0],
  });

  await assert.rejects(
    () => store.save(buildCheckpoint()),
    /Supabase checkpoint write failed \(401\)/,
  );
  assert.equal(attempts, 1);
  assert.match(store.status().lastError ?? '', /401/);
});