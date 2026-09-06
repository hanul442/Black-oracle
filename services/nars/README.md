# NARS v4

NARS is the upstream intelligence layer for collection, evidence and event processing. It is intentionally separated from Black Oracle execution authority.

## Runtime flow

Target runtime:

`Cron -> RSS/API adapters -> Cloudflare Queue -> nars-ingest -> Supabase nars_* ledger -> Story/Event Intelligence -> intel_outbox -> Black Oracle`

The existing NARS v3 Google Apps Script/Sheets system remains the production baseline while v4 runs in shadow mode.

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

The temporary Supabase poller currently uses a small verified set of official RSS feeds from Kyunghyang Shinmun, Maeil Business Newspaper and Dong-A Ilbo. Hankyung is excluded from the Supabase fallback runner because that runtime receives HTTP 403; it can still be observed through the v3 shadow path. The temporary poller must be retired when the Cloudflare collector is deployed.

## N4-03 Story and Event clustering

N4-03 introduces two distinct clustering layers.

```text
Document
   -> Story
      high-precision near-duplicate grouping
      same report across outlets / repeated versions

Story
   -> Event
      conservative event grouping
      separate headlines about the same underlying occurrence
```

### Story clustering

Story matching uses normalized headline trigram similarity with a default threshold of `0.72` inside a 12-hour candidate window.

The system intentionally prefers false splits over false merges. A weak match creates a new Story rather than forcing an existing Story assignment.

### Event clustering

Event matching is more flexible but remains deterministic and auditable. The `lexical_v2` baseline combines:

- pg_trgm similarity / word similarity
- normalized token Jaccard overlap
- exact shared-token count
- time proximity

A default Event threshold of `0.58` is used inside a 24-hour candidate window. Sparse matches require at least three shared meaningful tokens, token overlap, and close timing before receiving a high candidate score.

This is a baseline, not a semantic oracle. Embeddings and model-based challengers belong to later calibration work and must compete against this deterministic baseline rather than silently replacing it.

### Publisher identity

`v3_shadow` and `collector` can observe the same publisher through different source rows. Story/Event `source_count` therefore uses canonical publisher identity rather than raw `source_id`, preventing one publisher observed through two ingestion paths from being counted twice.

### Status semantics

- `detected`: one Story / one publisher or otherwise limited corroboration
- `developing`: multiple Stories or multiple distinct publishers

The lexical clustering engine does **not** assign `confirmed`. Confirmation belongs to the Evidence layer and must not be inferred from article count alone.

## Cluster observability

`nars_cluster_metrics_v1` tracks:

- total documents / Stories / Events
- unclustered documents
- multi-document Stories
- multi-Story Events
- maximum Story/Event size
- Story compression ratio
- Event compression ratio

`nars_cluster_review_queue_v1` surfaces low-margin automatic joins for audit. Current review bands include:

- Story-document links below `0.80`
- Event-Story links below `0.68`

The review queue is intentionally separate from automatic status changes.

## Schedulers

During the current shadow phase:

- `nars-shadow-poll-10m`: temporary direct RSS shadow collection every 10 minutes
- `nars-cluster-5m`: clusters newly ingested documents every 5 minutes

Both are temporary operational scaffolding. The collector scheduler should move to Cloudflare Workers/Queues once that deployment is available.

## Live Wire API

`nars-live-wire` is the service-role-only read API for the future newsroom/terminal UI.

Supported views:

- `view=documents` — raw live wire / sightings
- `view=stories` — near-duplicate Story clusters
- `view=events` — Event clusters
- `view=metrics` — shadow comparison + cluster health/compression metrics
- `view=review` — low-margin Story/Event joins requiring audit visibility

`view=events&event_id=<uuid>` returns Event detail plus its constituent Stories.

`view=review&type=story_document|event_story` can narrow the audit queue by link type.

Document filters include:

- `limit`
- `source`
- `breaking`
- `since`
- `seen_by=v3|collector|both|v3_only|collector_only`

Story filters include status, language, Event ID and time.

Event filters include status, language, time, minimum source count and minimum Story count.

## Comparison semantics

A **document** is stored once by exact `dedup_key`, while observations are stored separately in `nars_document_sightings`.

Supported observation origins:

- `v3_shadow`
- `collector`
- `manual`

This preserves first-seen and last-seen timing per ingestion path without duplicating the document ledger.

The legacy v3 `datetime` field is treated as retrieval/feed time with unverified publication semantics and is mapped to `retrieved_at`, not `published_at`.

## Security

- NARS contains no order/trade execution authority.
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

CI additionally runs `deno check` against every Supabase Edge Function using `deno.json` with npm dependency auto-resolution enabled.

## Cloudflare deployment

Required server-side secrets:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put NARS_SOURCE_CONFIG_JSON
```

After Cloudflare Worker/Queues are live and stable, disable `nars-shadow-poll-10m` and remove the temporary Supabase fallback runner.

## Sprint boundary

N4-03 covers deterministic near-duplicate Story clustering, conservative lexical Event clustering, canonical publisher counting, audit views and Terminal Event/Story read models.

Entity extraction, semantic embeddings, evidence grading, Intelligence Score and semantic challenger evaluation remain later work.
