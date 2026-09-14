import assert from 'node:assert/strict';
import test from 'node:test';
import { exportCanonicalPaperEvents } from './canonicalPaperEventExport';

const runtimeId = 'black-oracle-paper-vnext-100m-v03';
const snapshotRecordedAt = '2026-09-13T00:10:00.000Z';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

test('freezes a runtime-scoped snapshot before deterministic GET-only pagination', async () => {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const pages = [
    [
      { id: 101, runtime_id: runtimeId, occurred_at: '2026-09-13T00:00:01Z', recorded_at: '2026-09-13T00:00:01.100Z', event_name: 'POSITION_UPDATED', strategy_version: 'v1', trace: { sequence: 1 } },
      { id: 102, runtime_id: runtimeId, occurred_at: '2026-09-13T00:00:02Z', recorded_at: '2026-09-13T00:00:02.100Z', event_name: 'ORDER_FILLED', strategy_version: 'v1', trace: { sequence: 2 } },
    ],
    [
      { id: 103, runtime_id: runtimeId, occurred_at: '2026-09-13T00:00:03Z', recorded_at: '2026-09-13T00:00:03.100Z', event_name: 'POSITION_UPDATED', strategy_version: 'v1', trace: { sequence: 3 } },
    ],
  ];
  let pageIndex = 0;

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.searchParams.get('select') === 'recorded_at') {
      return response([{ recorded_at: snapshotRecordedAt }]);
    }
    return response(pages[pageIndex++] ?? []);
  };

  const result = await exportCanonicalPaperEvents({
    runtimeId,
    supabaseUrl: 'https://example.supabase.co/',
    supabaseKey: 'secret',
    pageSize: 2,
    fetchImpl,
  });

  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0]?.id, 101);
  assert.equal(result.rows[0]?.recorded_at, '2026-09-13T00:00:01.100Z');
  assert.equal(result.pages, 2);
  assert.equal(result.truncated, false);
  assert.equal(result.snapshotRecordedAt, snapshotRecordedAt);
  assert.equal(calls.length, 3);
  assert.equal(calls[0]?.init?.method, 'GET');
  assert.equal(calls[1]?.init?.method, 'GET');
  assert.equal(calls[2]?.init?.method, 'GET');
  assert.equal(calls[0]?.url.searchParams.get('runtime_id'), `eq.${runtimeId}`);
  assert.equal(calls[0]?.url.searchParams.get('order'), 'recorded_at.desc');
  assert.equal(calls[0]?.url.searchParams.get('limit'), '1');
  assert.equal(calls[1]?.url.searchParams.get('runtime_id'), `eq.${runtimeId}`);
  assert.equal(calls[1]?.url.searchParams.get('recorded_at'), `lte.${snapshotRecordedAt}`);
  assert.equal(calls[2]?.url.searchParams.get('recorded_at'), `lte.${snapshotRecordedAt}`);
  assert.equal(calls[1]?.url.searchParams.get('order'), 'occurred_at.asc,recorded_at.asc,id.asc');
  assert.equal(calls[1]?.url.searchParams.get('offset'), '0');
  assert.equal(calls[2]?.url.searchParams.get('offset'), '2');
  assert.equal(calls[1]?.url.searchParams.get('select'), 'id,runtime_id,occurred_at,recorded_at,event_name,strategy_version,trace');
});

test('returns an empty complete snapshot without paging when the runtime has no events', async () => {
  const calls: URL[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    assert.equal(init?.method, 'GET');
    const url = new URL(String(input));
    calls.push(url);
    return response([]);
  };

  const result = await exportCanonicalPaperEvents({
    runtimeId,
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'secret',
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(result.rows.length, 0);
  assert.equal(result.pages, 0);
  assert.equal(result.truncated, false);
  assert.equal(result.snapshotRecordedAt, null);
});

test('stops at maxRows and marks a capped frozen snapshot as truncated', async () => {
  const calls: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.searchParams.get('select') === 'recorded_at') {
      return response([{ recorded_at: snapshotRecordedAt }]);
    }
    const limit = Number(url.searchParams.get('limit'));
    const offset = Number(url.searchParams.get('offset'));
    assert.equal(url.searchParams.get('recorded_at'), `lte.${snapshotRecordedAt}`);
    return response(Array.from({ length: limit }, (_, index) => ({
      id: offset + index + 1,
      runtime_id: runtimeId,
      occurred_at: new Date((offset + index + 1) * 1_000).toISOString(),
      recorded_at: new Date((offset + index + 1) * 1_000 + 100).toISOString(),
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
  assert.equal(result.snapshotRecordedAt, snapshotRecordedAt);
  assert.equal(calls[2]?.searchParams.get('limit'), '1');
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

test('surfaces snapshot read failures without paging, retrying, or mutating state', async () => {
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
  }), /snapshot read failed \(403\): denied/);
  assert.equal(calls, 1);
});

test('surfaces page read failures after a valid watermark without retrying', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    calls += 1;
    assert.equal(init?.method, 'GET');
    if (calls === 1) return response([{ recorded_at: snapshotRecordedAt }]);
    return new Response('denied', { status: 403 });
  };

  await assert.rejects(() => exportCanonicalPaperEvents({
    runtimeId,
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'secret',
    fetchImpl,
  }), /export failed \(403\): denied/);
  assert.equal(calls, 2);
});
