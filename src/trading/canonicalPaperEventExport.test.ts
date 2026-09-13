import assert from 'node:assert/strict';
import test from 'node:test';
import { exportCanonicalPaperEvents } from './canonicalPaperEventExport';

const runtimeId = 'black-oracle-paper-vnext-100m-v03';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

test('exports runtime-scoped canonical rows across deterministic pages using GET only', async () => {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const pages = [
    [
      { runtime_id: runtimeId, occurred_at: '2026-09-13T00:00:01Z', event_name: 'POSITION_UPDATED', strategy_version: 'v1', trace: { sequence: 1 } },
      { runtime_id: runtimeId, occurred_at: '2026-09-13T00:00:02Z', event_name: 'ORDER_FILLED', strategy_version: 'v1', trace: { sequence: 2 } },
    ],
    [
      { runtime_id: runtimeId, occurred_at: '2026-09-13T00:00:03Z', event_name: 'POSITION_UPDATED', strategy_version: 'v1', trace: { sequence: 3 } },
    ],
  ];

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return response(pages[calls.length - 1] ?? []);
  };

  const result = await exportCanonicalPaperEvents({
    runtimeId,
    supabaseUrl: 'https://example.supabase.co/',
    supabaseKey: 'secret',
    pageSize: 2,
    fetchImpl,
  });

  assert.equal(result.rows.length, 3);
  assert.equal(result.pages, 2);
  assert.equal(result.truncated, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.init?.method, 'GET');
  assert.equal(calls[1]?.init?.method, 'GET');
  assert.equal(calls[0]?.url.searchParams.get('runtime_id'), `eq.${runtimeId}`);
  assert.equal(calls[0]?.url.searchParams.get('order'), 'occurred_at.asc,recorded_at.asc,id.asc');
  assert.equal(calls[0]?.url.searchParams.get('offset'), '0');
  assert.equal(calls[1]?.url.searchParams.get('offset'), '2');
  assert.equal(calls[0]?.url.searchParams.get('select'), 'runtime_id,occurred_at,event_name,strategy_version,trace');
});

test('stops at maxRows and marks a capped export as truncated', async () => {
  const calls: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    const limit = Number(url.searchParams.get('limit'));
    const offset = Number(url.searchParams.get('offset'));
    return response(Array.from({ length: limit }, (_, index) => ({
      runtime_id: runtimeId,
      occurred_at: new Date((offset + index + 1) * 1_000).toISOString(),
      event_name: 'POSITION_UPDATED',
      strategy_version: 'v1',
      trace: { sequence: offset + index + 1 },
    })));
  };

  const result = await exportCanonicalPaperEvents({
    runtimeId,
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'secret',
    pageSize: 2,
    maxRows: 3,
    fetchImpl,
  });

  assert.equal(result.rows.length, 3);
  assert.equal(result.pages, 2);
  assert.equal(result.truncated, true);
  assert.equal(calls[1]?.searchParams.get('limit'), '1');
});

test('fails closed when runtime or credentials are missing', async () => {
  await assert.rejects(() => exportCanonicalPaperEvents({
    runtimeId: ' ', supabaseUrl: 'https://example.supabase.co', supabaseKey: 'secret',
  }), /runtimeId is required/);
  await assert.rejects(() => exportCanonicalPaperEvents({
    runtimeId, supabaseUrl: '', supabaseKey: 'secret',
  }), /supabaseUrl is required/);
  await assert.rejects(() => exportCanonicalPaperEvents({
    runtimeId, supabaseUrl: 'https://example.supabase.co', supabaseKey: '',
  }), /supabaseKey is required/);
});

test('surfaces read failures without retrying or mutating state', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    calls += 1;
    assert.equal(init?.method, 'GET');
    return new Response('denied', { status: 403 });
  };

  await assert.rejects(() => exportCanonicalPaperEvents({
    runtimeId,
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'secret',
    fetchImpl,
  }), /export failed \(403\): denied/);
  assert.equal(calls, 1);
});
