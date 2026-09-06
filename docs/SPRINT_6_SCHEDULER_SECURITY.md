# BLACK ORACLE — Sprint 6 PAPER Scheduler Security

Status: DRAFT / PAPER ONLY / NOT DEPLOYED

## Security boundary

The scheduled PAPER pipeline uses two different server credentials for different trust domains:

- `SUPABASE_SERVICE_ROLE_KEY`: Supabase database administration only
- `CRON_SECRET`: authentication for scheduler -> Vercel internal PAPER endpoints

The service-role key must never be copied into an outbound Vercel HTTP Authorization header.

## Target policy

Scheduled `cycle` execution is pinned to the exact canonical production origin:

`https://black-oracle.vercel.app`

The scheduler rejects:
- arbitrary `*.vercel.app` deployments
- Preview deployments
- HTTP targets
- URLs containing credentials
- non-root paths, query strings, or fragments
- localhost or other external origins

Preview validation is performed through separate Preview/operator QA and readiness checks. The scheduler configuration is not repointed to a Preview deployment.

## Pipeline order

The scheduler runs sequentially:

1. `POST /api/trading-evidence-refresh`
2. `GET /api/trading-paper-cycle`

Evidence refresh failure does not suppress the PAPER cycle because deterministic protective exits must remain available. In that degraded case Sprint 5 governance sees absent/stale Evidence and fail-closes new ENTER decisions while the protective runtime continues.

## Timing budget

- Evidence refresh outer timeout: 56 seconds
- PAPER cycle outer timeout: 58 seconds
- combined downstream budget: 114 seconds
- internal budget ceiling: 115 seconds

This preserves headroom under the hosted Supabase Edge wall-clock constraint for telemetry and cleanup.

## Rollout requirement

Before the new scheduler revision is ever deployed, the same strong `CRON_SECRET` must be configured independently in:

- the Vercel server environment used by the internal PAPER endpoints
- the Supabase Edge Function secret environment used by `black-oracle-paper-scheduler`

The current production scheduler is not changed by this Sprint 6 branch. Scheduler deployment remains a separate explicit rollout action after Preview verification and human approval.
