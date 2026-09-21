# ACTIVE SPRINT — BOT Alpha Strategy Validation Integration

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
- BOT-S4 immutable validation stage results/evaluation — merged #215 as `f878f1f654c525e2e781b6a124ad1d6d7f8c4935`.
- BOT-S5 end-to-end Upbit KRW scanner flow — merged #216 as `84b267a286d22d83dd85a544804af147cb7a122f`.

## Active — BOT-S6 Strategy Factory validation integration

### Objective
Bind Strategy Factory candidate promotion eligibility to the canonical S3/S4 validation experiment/result lineage. A candidate may be marked validation-eligible only when its exact strategy lineage has a complete canonical evaluation with status `PASS`.

### Acceptance criteria
- Add a small immutable Strategy Factory validation-binding contract; do not rewrite the legacy factory evaluator.
- Exact `strategyId` + `strategyRevision` + `experimentId` binding is required.
- Canonical evaluation must be `PASS`; `BLOCKED` and `INSUFFICIENT_DATA` fail closed.
- All required S3/S4 stage-result fingerprints must be present through the canonical evaluation contract.
- Binding output remains evidence/review only with `promotionAuthority=false`, `executionAuthority=false`, `capitalAuthority=false`.
- Missing/mismatched evidence cannot create `CHAMPION_CANDIDATE`, route an order, mutate PAPER, or change deterministic Risk.
- Deterministic tests cover PASS, insufficient/blocked, lineage mismatch, authority escalation and malformed identity.

### Safety boundary
Evidence integration only. No automatic Champion promotion, Router/Risk bypass, capital allocation, broker/private Upbit credential access, order submission, PAPER behavior change, LIVE_SHADOW activation or unrestricted LIVE authority. Existing PAPER behavior and lineage remain unchanged.

### Rollback
Repository-only revert of S6. S0-S5 scanner/validation contracts and existing PAPER/runtime/database state remain authoritative and unchanged.

### Research review gate
Read Strategy Factory implementation plus `docs/research/research-ledger/ledger.md`, S3 and S4 research records before implementation. Constraining precedents: DI-001/EXP-DI001, DI-003/EXP-DI003, DI-004/EXP-DI004, EV-001/EXP-EV001, EV-002/EXP-EV002, EV-003/EXP-EV003, EV-005/EXP-EV005, Q-002/EXP-Q002. Research thresholds remain TEST/REFERENCE and are not silently promoted.

### Exact next gate
Record S6 research review → implement one bounded validation-binding contract → deterministic tests → both required CI green → merge only if verified → no deploy unless the contract changes runtime behavior (not expected).

## Current deployment state
No S6 deployment planned. Existing legacy Railway/PAPER services remain unchanged. BOT repository/runtime/database separation remains preserved.

## Cycle exit target
- Phase: PLAN COMPLETE → RESEARCH REVIEW
- Blockers: none identified at plan time
- Single next priority: complete S6 validation-binding implementation and verification.
