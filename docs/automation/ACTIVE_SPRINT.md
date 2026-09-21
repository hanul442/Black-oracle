# ACTIVE SPRINT — BOT-S7 Champion–Challenger + Strategy Router / NO_TRADE

Date: **2026-09-21**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **IN PROGRESS**

## Completed
- BOT-S0 repository boundary bootstrap.
- BOT-S1 scanner input boundary — merged #211.
- BOT-S2 runtime/database ownership contract — merged #212.
- BOT-S3 canonical validation experiment manifest — merged.
- CLEANUP-01 separation ownership audit — merged.
- BOT-S4 immutable validation stage results/evaluation — merged #215.
- BOT-S5 end-to-end Upbit KRW scanner flow — merged #216.
- BOT-S6 Strategy Factory validation integration — merged #219.

## BOT-S7 PLAN

### Objective
Add an authority-free deterministic Champion–Challenger comparison and Strategy Router contract. It consumes S6 canonical validation bindings and resolves to `SELECT` only when exactly one eligible candidate is deterministically preferable under supplied evidence; otherwise it resolves explicitly to `NO_TRADE`.

### Acceptance criteria
1. Champion and Challenger identities/revisions must be distinct, non-empty, and bound to canonical S6 validation evidence.
2. Both candidates must be `validationEligible=true` with `validationStatus=PASS`; otherwise `NO_TRADE`.
3. Observation/freshness and regime-fit inputs are explicit, finite, bounded contract inputs; stale/missing/ambiguous state resolves `NO_TRADE`.
4. Comparison uses only caller-supplied evidence scores and deterministic tie-breaking rules; no hidden research cutoff is introduced.
5. Exact score ties resolve `NO_TRADE`; the router never guesses.
6. Output carries evidence fingerprints and explicit reason codes for replay/audit.
7. `promotionAuthority=false`, `executionAuthority=false`, `capitalAuthority=false`, `riskBypassAuthority=false`, `liveAuthority=false` are immutable.
8. No automatic Champion replacement, Risk bypass, order submission, capital allocation, PAPER mutation, broker credential access, or LIVE behavior change.
9. Deterministic tests cover select, tie, stale, missing regime fit, invalid validation, identity/lineage mismatch, non-finite inputs, and authority escalation.
10. Both required GitHub CI workflows must be green before merge.

### Safety boundary
S7 is proposal/evidence plumbing only. Router output cannot place or resize an order and cannot promote a Challenger. Deterministic Risk remains mandatory downstream. Existing PAPER/runtime/database/deployment behavior remains unchanged.

### Rollback path
Repository-only revert of the S7 merge. S0-S6, existing PAPER behavior, runtime and database remain unchanged.

### Exact next gate
Research review recorded → implement bounded contract + deterministic tests → verify exact commit and required CI → merge only if green → no deployment unless contract integration separately requires it.

## Research review constraints
- S6 precedent: canonical validation evidence is necessary but does not itself grant promotion/execution authority.
- DI-001 / EXP-DI001: reuse canonical experiment/evidence identity; do not create a parallel promotion truth.
- DI-003 / EXP-DI003 and DI-004 / EXP-DI004: point-in-time inputs and exact lineage remain replayable; unsafe/stale inputs are not repaired downstream.
- EV-001 / EXP-EV001 and EV-002 / EXP-EV002: validation identity/robustness evidence remains distinct from ranking.
- EV-003 / EXP-EV003 and EV-005 / EXP-EV005: no DSR/PBO numerical cutoff is promoted here.
- Q-002 / EXP-Q002: Router remains an experimental architecture surface; S7 adopts deterministic fail-closed routing mechanics, not research performance claims.
- Legacy Sprint-7 precedent (#29) keeps Champion replacement outside automatic Vault/lifecycle authority.

## Current deployment state
No S7 deployment is authorized or required by this bounded package. Existing legacy Railway/PAPER services remain unchanged. BOT repository/runtime/database separation remains preserved.

## Cycle state
- Phase: **BOT-S7 PLAN COMPLETE / IMPLEMENTATION STARTING**
- Blockers: none for bounded repository contract
- Alpha status: S0-S6 complete; S7 active
- Single next priority: **implement and verify deterministic Champion–Challenger Router with fail-closed NO_TRADE**
