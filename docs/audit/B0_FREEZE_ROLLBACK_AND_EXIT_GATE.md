# B0.4 Freeze, Rollback, and Exit-Gate Record

**Sprint / work package:** B0 / B0.4  
**Decision:** B0 `EXTEND`; B0.4 contract `CONTRACT_COMPLETE`  
**Release ready:** no  
**Production mutation:** none

## Frozen boundary

The v0.x production behavior and protected legacy state are frozen while B0 remains open. Beta adapters may use legacy stores only as `READ_ONLY` or `NONE`. Positions, orders, the runtime Paper Ledger, canonical event Ledger, checkpoints, strategy identity, and qualification cohorts must not be reset, re-keyed, re-seeded, truncated, or bulk rewritten.

All execution remains PAPER-only. No Live route, broker credential, withdrawal, leverage, or real-money payment authority is permitted. Deterministic Risk remains sovereign and cannot be bypassed by Council, Report, plan, Credit, or execution mode. Report remains an independent product and is neither an order prerequisite nor a Risk override.

Backtest, Forward, and Paper are separate performance streams. Missing, stale, failed, partial, or unrun evidence is unavailable; it is never zero or success. Pro multipliers change capacity only, and Balanced/Strategy/Research change workload preference only.

## Rollback rules

- Code/runtime cutover must name the exact requested SHA and the exact previous rollback artifact. A runtime whose reported revision cannot be matched is not eligible for cutover.
- Generic Railway redeploy is prohibited while it can repeat an unpinned or mismatched snapshot.
- Legacy down migrations and legacy data rewrites are prohibited.
- Database rollback is non-cascading and uses `RESTRICT`; it may remove only an empty beta namespace after dependency checks and may not touch protected state.
- The B0.3 candidate and rollback have not run anywhere. No production rollback is required for that package.
- Supabase runtime status can roll back from active function version 4 / bundle `b4b5f814…0ed0` to version 3 / bundle `02c0896d…48bb` without scheduler or data mutation.

## Exit-gate assessment

| B0 criterion | Result | Evidence |
|---|---|---|
| Service/source truth | BLOCKED | vNext configured/deployed SHAs disagree; S2 source is unpinned and stale |
| State ownership and scheduler targets | PARTIAL | Sanitized 10-record matrix exists; S2/vNext/qualification writer revisions remain unresolved |
| Beta namespace cannot mutate legacy | BLOCKED | Candidate passed static checks, but isolated database execution is `NOT RUN` |
| Rollback and qualification boundaries documented | PASS | B0.2/B0.3 contracts and this B0.4 record |
| Required validators, regressions, typecheck, build | PASS | Required before merge; CI evidence is recorded in the PR and ACTIVE_SPRINT |
| Documentation cannot authorize cutover | PASS | `productionCutoverAuthorized=false`; no production mutation |

B0 therefore remains `IN_PROGRESS` with decision `EXTEND`. B1 implementation is not authorized by this record.

## Stop conditions

Stop the affected mutation on secret exposure, Live trading or real payment, irreversible protected-state mutation, unverifiable deployment SHA, failed required CI, or UNKNOWN/DEGRADED runtime health. Independent read-only investigation may continue.

## Remaining blockers

1. Run the B0.3 candidate and negative probes only in an explicitly approved isolated database, then roll back with `RESTRICT`.
2. Obtain exact-SHA Railway deployment control for vNext and S2.
3. Complete external runtime-status HTTP probes.
4. Resolve current vNext/S2 runtime errors before any readiness or cutover claim.

Machine-readable authority is in `ops/b0-freeze-rollback-contract.json`; `scripts/verify-b0-freeze-rollback-contract.mjs` fails closed when any invariant or exit result is weakened.
