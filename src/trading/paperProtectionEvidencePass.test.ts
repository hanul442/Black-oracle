import assert from 'node:assert/strict';
import test from 'node:test';
import { runPaperProtectionEvidencePass } from './paperProtectionEvidencePass';

const runtimeId = 'black-oracle-paper-vnext-100m-v03';
const snapshotRecordedAt = '2026-09-13T00:10:00.000Z';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

test('runs one complete frozen GET-only evidence pass and compares an optional baseline', async () => {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const rows = [
    {
      runtime_id: runtimeId,
      occurred_at: '2026-09-13T00:00:01Z',
      event_name: 'POSITION_UPDATED',
      strategy_version: 'v1',
      trace: { eventId: 'event-1', sequence: 1, timestamp: 1_000 },
    },
  ];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.searchParams.get('select') === 'recorded_at') {
      return response([{ recorded_at: snapshotRecordedAt }]);
    }
    return response(rows);
  };

  const result = await runPaperProtectionEvidencePass({
    runtimeId,
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'secret',
    pageSize: 500,
    fetchImpl,
    baseline: {
      sourceRows: 0,
      observations: 0,
      favorableOvershootRemoved: 0,
      grossExitValueDelta: 0,
      changedExits: 0,
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.init?.method, 'GET');
  assert.equal(calls[1]?.init?.method, 'GET');
  assert.equal(calls[0]?.url.searchParams.get('runtime_id'), `eq.${runtimeId}`);
  assert.equal(calls[1]?.url.searchParams.get('recorded_at'), `lte.${snapshotRecordedAt}`);
  assert.equal(result.export.truncated, false);
  assert.equal(result.export.rows, 1);
  assert.equal(result.export.snapshotRecordedAt, snapshotRecordedAt);
  assert.equal(result.diagnostic.sourceRows, 1);
  assert.equal(result.comparison?.sourceRowsDelta, 1);
});

test('fails closed instead of treating a capped frozen export as complete evidence', async () => {
  const fetchImpl: typeof fetch = async (input, init) => {
    assert.equal(init?.method, 'GET');
    const url = new URL(String(input));
    if (url.searchParams.get('select') === 'recorded_at') {
      return response([{ recorded_at: snapshotRecordedAt }]);
    }
    const limit = Number(url.searchParams.get('limit'));
    assert.equal(url.searchParams.get('recorded_at'), `lte.${snapshotRecordedAt}`);
    return response(Array.from({ length: limit }, (_, index) => ({
      runtime_id: runtimeId,
      occurred_at: new Date(index + 1).toISOString(),
      event_name: 'POSITION_UPDATED',
      strategy_version: 'v1',
      trace: { sequence: index + 1 },
    })));
  };

  await assert.rejects(() => runPaperProtectionEvidencePass({
    runtimeId,
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'secret',
    pageSize: 2,
    maxRows: 2,
    fetchImpl,
  }), /evidence export was truncated at 2 rows/);
});
