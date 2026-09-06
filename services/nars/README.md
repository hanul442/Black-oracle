# NARS v4

NARS is the upstream intelligence layer for collection, evidence and event processing. It is intentionally separated from Black Oracle execution authority.

## Runtime flow

Target runtime:

`Cron -> RSS/API adapters -> Cloudflare Queue -> nars-ingest -> Supabase nars_* ledger -> Event Intelligence -> intel_outbox -> Black Oracle`

During **N4-02 Shadow Data Plane**, the existing NARS v3 Google Apps Script/Sheets system remains the production baseline while v4 collects in parallel.

## N4-02 shadow topology

```text
NARS v3 / Google Sheets NEWS
        -> nars-shadow-batch
        -> v3_shadow sighting

Official RSS feeds
        -> nars-shadow-poll (temporary Supabase runner, every 10 min)
        -> nars-ingest
        -> collector sighting

Both paths
        -> exact document dedup
        -> nars_document_sightings
        -> nars_live_wire_v1
        -> nars_shadow_metrics_v1
```

The temporary Supabase poller currently uses a small, verified set of official RSS feeds from Kyunghyang Shinmun, Maeil Business Newspaper and Dong-A Ilbo. Hankyung is excluded from the Supabase fallback runner because that runtime receives HTTP 403; it can still be observed through the v3 shadow path. The temporary poller must be retired when the Cloudflare collector is deployed.

## Comparison semantics

A **document** is stored once by exact `dedup_key`, but observations are stored separately in `nars_document_sightings`.

Supported observation origins:

- `v3_shadow`
- `collector`
- `manual`

This lets NARS measure:

- v3-only documents
- collector-only documents
- documents seen by both paths
- first-seen time by origin
- collector minus v3 detection latency
- repeated observations without duplicating the document ledger

The legacy v3 `datetime` field is treated as **retrieval/feed time with unverified publication semantics** and is therefore mapped to `retrieved_at`, not `published_at`.

## Live Wire

`nars-live-wire` is a server-only read API for the future terminal UI.

Filters include:

- `limit`
- `source`
- `breaking`
- `since`
- `seen_by=v3|collector|both|v3_only|collector_only`

`?view=metrics` returns the aggregate shadow comparison view.

## Security

- No order/trade execution code exists in NARS.
- `nars_intel_outbox` is the one-way boundary toward Black Oracle.
- NARS tables use RLS with no public policies by design.
- `anon` and `authenticated` access is revoked; data-plane APIs are service-role only.
- The temporary scheduled poller does not expose the service-role key. It validates a dedicated cron token whose plaintext is stored in Supabase Vault and whose SHA-256 digest is stored in `nars_system_meta`.
- Never commit `.dev.vars`, service-role keys or cron tokens.

## Local checks

```bash
npm install
npm test
npm run check
```

CI additionally runs `deno check` against every Supabase Edge Function.

## Cloudflare deployment

Required server-side secrets:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put NARS_SOURCE_CONFIG_JSON
```

After Cloudflare Worker/Queues are live and stable, disable `nars-shadow-poll-10m` and remove the temporary Supabase fallback runner.

## Sprint boundary

N4-02 covers the shadow data plane, exact dedup, source health, sightings, Live Wire and comparative observability.

Semantic near-duplicate grouping, entity extraction and Event clustering belong to **N4-03**.
