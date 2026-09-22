# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A18 MERGED / FOUNDATION CLOSURE ACTIVE**

## Completed baseline
- BOT-S0 through BOT-S14 complete.
- BOT-A15 canonical Decision Replay merged.
- BOT-A16 five-surface Alpha IA + global Canonical Ledger merged.
- BOT-A17 release-readiness truth audit merged and identified source-health/freshness blockers.
- BOT-A18 implements the A17 source-truth remediation across API contracts and the active Alpha shell.

## BOT-A18 completed scope
- canonical `OK | DEGRADED | UNAVAILABLE` source-health envelope with `observedAt`, `stale`, `verifiedEmpty`, and `error`
- `/api/events` propagates canonical source health and fails closed on ledger-read failure
- Strategy Factory status exposes canonical source health with source-specific freshness semantics
- `/api/trading-status` operational Supabase reads distinguish verified-empty data from unavailable/non-OK reads
- active shell checks HTTP success before accepting a payload
- failed refreshes retain last-known-good data only as visibly stale/unavailable data
- Overview / Strategy Lab / Trading / Risk / Ledger consume a source-health state
- Ledger retains and renders coverage / health metadata instead of dropping it
- deterministic Risk, PAPER behavior, strategy promotion, order submission, broker credentials, database schema, and LIVE authority are unchanged

## Verification
Exact implementation head before documentation closeout: `0887fef3534e956f4a9dce53dd0e8b046d356438`.
- Black Oracle CI `35709793587`: **SUCCESS**
- Black Oracle Trading CI `35709793619`: **SUCCESS**
- prior CI diagnosis corrected: the final blocking type error was `LedgerHealthStatus` being compared with `OK`; canonical ledger health uses `HEALTHY | DEGRADED | CRITICAL`
- five-surface source-truth re-audit recorded in `docs/audit/BOT_A18_ALPHA_SOURCE_TRUTH_REAUDIT.md`

## Safety boundary
A18 is observability/presentation truth only. No broker/Risk/order/capital/LIVE authority expansion, credential exposure, protected PAPER-history mutation, strategy promotion change, or database migration.

## Runtime truth
Repository remediation is complete. Runtime evidence is recorded in `docs/runtime-truth/FOUNDATION_ATTESTATION_2026-09-22.md`; the family-wide canonical plan is `docs/ALPHA_ROADMAP.md`.

- A18 web deployment at exact main SHA `0a9361c05e5ba0212d7d1bceff032e27ac503ad2` is attested; Railway healthcheck and public `/health` pass, while protected APIs remain authentication-gated.
- Supabase data-plane reads timed out, so scheduler/writer/checkpoint lineage remains UNKNOWN.
- no protected PAPER service, database, scheduler, risk limit, or qualification history was changed.

## Exact next gate
1. complete authenticated A18 source-health payload smoke without exposing credentials;
2. recover read-only Supabase observability and prove one authoritative scheduler/writer/lineage;
3. verify the isolated BOR runtime and preserve the durable-storage blocker truth;
4. hand the completed Foundation evidence set to Astra for the final cross-system audit.

## Cycle state
- Phase: **FOUNDATION RUNTIME ATTESTATION**
- Repository Alpha source-truth: **PASS**
- Runtime Foundation: **BLOCKED / PARTIAL EVIDENCE**
- Single next priority: **exact runtime and single-writer proof**
