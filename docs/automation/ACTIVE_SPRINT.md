# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A18 REPOSITORY COMPLETE / FINAL DOCS CI GATE**

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
Repository remediation is complete, but deployment is a separate gate. Current Railway services must be re-attested for exact deployed revision, scheduler ownership, and single-writer PAPER semantics before runtime Foundation is called complete.

## Exact next gate
Run docs-inclusive exact-head Black Oracle CI + Trading CI. If both are GREEN and PR #236 remains mergeable, merge A18. Then perform runtime Foundation closure:
1. attest exact BOT deployed revision
2. attest one authoritative PAPER scheduler/writer per runtime
3. provision and verify independent BOR runtime/storage boundary
4. reconcile stale issues/PRs and publish one canonical Alpha roadmap

## Cycle state
- Phase: **A18 DOCUMENT → FINAL CI / MERGE**
- Repository Alpha source-truth: **PASS**
- Runtime Foundation: **PENDING ATTESTATION**
- Single next priority after merge: **Foundation runtime closure**
