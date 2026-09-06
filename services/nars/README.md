# NARS v4 — N4-01 Foundation

Deployable upstream intelligence collector for NARS. This service is intentionally separated from Black Oracle execution authority.

## Runtime flow

`Cron -> RSS adapters -> Cloudflare Queue -> nars-ingest Edge Function -> Supabase nars_* tables -> intel_outbox -> Black Oracle`

## Safety properties

- No order/trade execution code.
- Supabase service-role secret is server-only.
- Idempotent document ingestion through `dedup_key`.
- Collector and ingestion are asynchronous; a slow feed cannot hold the DB writer lock.
- Queue retries use exponential backoff and a dead-letter queue.
- Existing NARS v3 Google Apps Script/Sheets pipeline can continue in parallel during shadow validation.

## Local checks

```bash
npm install
npm test
npx wrangler types
npx wrangler dev
```

Test scheduled collection locally:

```bash
curl 'http://localhost:8787/cdn-cgi/local/scheduled?format=json'
```

## Required Cloudflare secrets

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put NARS_SOURCE_CONFIG_JSON
```

Never commit `.dev.vars` or the service-role key.

## Current scope

N4-01 intentionally does **not** implement semantic event clustering or LLM analysis. Those belong to N4-03+. The event/outbox tables are present only as stable contracts for later sprints.
