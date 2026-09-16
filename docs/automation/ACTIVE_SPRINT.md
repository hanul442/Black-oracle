# BLACK ORACLE Active Sprint

## Sprint
- **ID:** BO-P0-KRX-TRUTH-01
- **Title:** Korea Equity canonical producer truth and production verification

## Objective
Make the KRX account-free research path truthfully distinguish upstream/source emptiness, filtering/Committee emptiness, nomination blocking, and canonical persistence failures, then verify that truth on the isolated S2 Shadow production runtime without changing trading authority or the protected S1R2 qualification runtime.

## User-visible outcome
Korea Equity observability no longer conflates `0 Committee candidates` with `0 KRX instruments`, and operator/runtime state reports whether failure is in research or canonical persistence before downstream Markets repair continues.

## Acceptance criteria
- KRX scheduler distinguishes SOURCE_EMPTY, VOLUME_PREFILTER_EMPTY, PROFILE_EMPTY, COMMITTEE_EMPTY, NOMINATION_BLOCKED, and NOMINATION_READY.
- Research-cycle failures and canonical-append failures are reported separately.
- A research cycle is promoted to latest successful scheduler truth only after canonical events persist successfully.
- Existing market-data provenance and execution-suitability semantics remain unchanged.
- Risk, Router, Council authority, execution gates, portfolio authority, and protected S1R2 qualification state remain unchanged.
- Relevant CI/typecheck/trading/runtime/build checks are green.
- S2 Shadow runs an exact revision containing PR #173 and production telemetry is verified before this sprint is DONE.

## Current phase
DEPLOY

## Completed checkpoints
- DISCOVER: Production logs showed `0 candidate(s)` was Committee output, not proof of an empty KRX universe; canonical append also showed Supabase/Cloudflare failures.
- PLAN: Limited repair to scheduler truth/observability; no source/filter/threshold/execution semantic changes.
- IMPLEMENT: Added KRX research truth classification and canonical-persistence-aware scheduler state.
- TEST: Black Oracle CI and Trading CI passed, including typecheck, trading core/regression tests, Supabase function typecheck, runtime bundle, scheduler smoke tests, and production build.
- REVIEW: Diff constrained to KRX scheduler truth and regression coverage; protected invariants unchanged.
- MERGE: PR #173 merged as `520270c467da3d15cc46262fda836e26fefca755`.
- STATE: Canonical scheduler state file created after prior connector write blocker cleared.
- DEPLOY DISCOVERY: Rechecked S2 Shadow deployments. Latest remains SUCCESS on `8c2f27aa53345a9738847e05f204cd38cf393d02`; current Railway tools expose generic redeploy/create-service paths but no safe operation that pins an existing S2 service to an exact GitHub commit SHA. Generic redeploy therefore cannot satisfy the exact-revision acceptance criterion.

## Next checkpoint
Resolve the exact-revision S2 deployment blocker without changing secrets or protected runtimes. Prefer an existing Railway source/revision mechanism if it becomes available; otherwise use a new safe GitHub source event only if it can guarantee that S2 receives a revision containing #173. After exact revision is proven, deploy S2 only and VERIFY KRX disposition plus `RESEARCH_CYCLE` / `CANONICAL_APPEND` telemetry.

## Blockers
- **ACTIVE:** Railway generic redeploy may reuse the currently attached/stale deployment snapshot and the available service configuration tool does not expose source-branch/commit mutation. Latest S2 is still `8c2f27aa...`, so exact revision containing #173 cannot currently be guaranteed through the available Railway mutation surface.
- Do not treat deployment SUCCESS as revision correctness.
- Do not mutate secrets, S1R2, qualification logic, or trading authority to work around this blocker.

## Relevant PR / branch
- PR #173 — merged.
- Merge commit: `520270c467da3d15cc46262fda836e26fefca755`.
- Active scheduler-state commit created at `3024923592345a450d510706527baf0e488452dd`.
- Protected qualification work such as PR #115 remains isolated and is not part of this sprint.

## Validation status
GREEN for merged #173 scope. Production verification pending exact-revision S2 deployment.

## Deploy status
BLOCKED. S2 Shadow latest verified deployment is `4140402d-915d-460c-be05-a58449d2d65c`, status SUCCESS, commit `8c2f27aa53345a9738847e05f204cd38cf393d02`; this is stale relative to #173. No deployment mutation performed in this checkpoint.

## Protected invariants
- Protected ₩100M S1R2 Paper qualification runtime/sample untouched.
- No real-money trading authority changes.
- No Risk/Router/Council/Execution hard-gate relaxation.
- No fabricated market data, Evidence, Council participation, Monte Carlo metrics, prices, or lineage.
- No destructive migration, secret mutation, portfolio/account mutation, or canonical-ledger semantic rewrite.

## Next action
Stay in DEPLOY and resolve the exact-revision source blocker. Do not switch sprint yet: the blocker is directly tied to production verification of the merged P0 repair. Once a safe exact-revision path exists, deploy only S2 Shadow, verify deployed SHA contains #173, inspect KRX runtime telemetry, then advance to VERIFY/DONE if acceptance criteria pass.
