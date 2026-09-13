import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parsePaperProtectionEvidenceBaseline,
  runPaperProtectionEvidencePass,
} from './paperProtectionEvidencePass';

const runtimeId = 'black-oracle-paper-vnext-100m-v03';
const snapshotRecordedAt = '2026-09-13T00:10:00.000Z';
const exactFingerprint = `sha256:${'a'.repeat(64)}`;

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const metrics = {
  sourceRows: 0,
  observations: 0,
  favorableOvershootRemoved: 0,
  grossExitValueDelta: 0,
  changedExits: 0,
};

test('requires explicit provenance for JSON-loaded evidence baselines', () => {
  assert.throws(
    () => parsePaperProtectionEvidenceBaseline(metrics),
    /must declare source provenance/,
  );

  const historical = parsePaperProtectionEvidenceBaseline({
    source: { kind: 'historical-summary', label: '2026-09-13 prior read-only summary' },
    ...metrics,
  });
  assert.equal(historical.source.kind, 'historical-summary');

  const exact = parsePaperProtectionEvidenceBaseline({
    source: {
      kind: 'exact-snapshot',
      runtimeId,
      snapshotRecordedAt,
      snapshotFingerprint: exactFingerprint,
    },
    ...metrics,
  });
  assert.equal(exact.source.kind, 'exact-snapshot');
});

test('rejects malformed exact-snapshot fingerprint provenance', () => {
  assert.throws(
    () => parsePaperProtectionEvidenceBaseline({
      source: {
        kind: 'exact-snapshot',
        runtimeId,
        snapshotRecordedAt,
        snapshotFingerprint: 'not-a-fingerprint',
      },
      ...metrics,
    }),
    /canonical sha256 snapshotFingerprint/,
  );
});

test('runs one complete frozen GET-only evidence pass and labels a historical baseline comparison', async () => {
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
      source: { kind: 'historical-summary', label: 'prior read-only summary' },
      ...metrics,
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
  assert.match(result.export.snapshotFingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.diagnostic.sourceRows, 1);
  assert.equal(result.comparison?.sourceRowsDelta, 1);
  assert.equal(result.comparison?.baselineSourceKind, 'historical-summary');
  assert.equal(result.comparison?.sameSnapshot, null);
});

test('reports whether an exact baseline matches the current frozen snapshot', async () => {
  const rows = [
    {
      runtime_id: runtimeId,
      occurred_at: '2026-09-13T00:00:01Z',
      event_name: 'POSITION_UPDATED',
      strategy_version: 'v1',
      trace: { sequence: 1 },
    },
  ];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.searchParams.get('select') === 'recorded_at') {
      return response([{ recorded_at: snapshotRecordedAt }]);
    }
    return response(rows);
  };

  const first = await runPaperProtectionEvidencePass({
    runtimeId,
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'secret',
    fetchImpl,
  });

  const second = await runPaperProtectionEvidencePass({
    runtimeId,
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'secret',
    fetchImpl,
    baseline: {
      source: {
        kind: 'exact-snapshot',
        runtimeId,
        snapshotRecordedAt,
        snapshotFingerprint: first.export.snapshotFingerprint,
      },
      sourceRows: first.diagnostic.sourceRows,
      observations: first.diagnostic.observations,
      favorableOvershootRemoved: first.diagnostic.favorableOvershootRemoved,
      grossExitValueDelta: first.diagnostic.grossExitValueDelta,
      changedExits: first.diagnostic.changedExits,
    },
  });

  assert.equal(second.comparison?.baselineSourceKind, 'exact-snapshot');
  assert.equal(second.comparison?.sameSnapshot, true);
});

test('fails closed when an exact baseline belongs to another runtime', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.searchParams.get('select') === 'recorded_at') {
      return response([{ recorded_at: snapshotRecordedAt }]);
    }
    return response([]);
  };

  await assert.rejects(() => runPaperProtectionEvidencePass({
    runtimeId,
    supabaseUrl: 'https://example.supabase.co',
    supabaseKey: 'secret',
    fetchImpl,
    baseline: {
      source: {
        kind: 'exact-snapshot',
        runtimeId: 'different-runtime',
        snapshotRecordedAt,
        snapshotFingerprint: exactFingerprint,
      },
      ...metrics,
    },
  }), /does not match evidence runtime/);
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
