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

## Next checkpoint
Establish a safe exact-revision deployment path for `black-oracle-paper-s2-shadow` containing PR #173, deploy S2 Shadow only if the exact revision is guaranteed, then VERIFY KRX disposition plus `RESEARCH_CYCLE` / `CANONICAL_APPEND` telemetry.

## Blockers
- Railway generic redeploy may reuse the currently attached/stale deployment snapshot rather than guarantee the latest GitHub main revision. Do not treat deployment SUCCESS as revision correctness.
- If exact source revision cannot be guaranteed safely in the current tooling, remain in DEPLOY and record the blocker rather than mutating S1R2 or fabricating verification.

## Relevant PR / branch
- PR #173 — merged.
- Merge commit: `520270c467da3d15cc46262fda836e26fefca755`.
- Protected qualification work such as PR #115 remains isolated and is not part of this sprint.

## Validation status
GREEN for merged #173 scope. Production verification pending exact-revision S2 deployment.

## Deploy status
PENDING. Last verified S2 Shadow deployment before this state file was on stale revision `8c2f27aa53345a9738847e05f204cd38cf393d02`; exact current state must be rechecked immediately before deployment.

## Protected invariants
- Protected ₩100M S1R2 Paper qualification runtime/sample untouched.
- No real-money trading authority changes.
- No Risk/Router/Council/Execution hard-gate relaxation.
- No fabricated market data, Evidence, Council participation, Monte Carlo metrics, prices, or lineage.
- No destructive migration, secret mutation, portfolio/account mutation, or canonical-ledger semantic rewrite.

## Next action
Resume DEPLOY: inspect GitHub/Railway revision truth only for S2 Shadow and determine whether an exact-revision, low-risk deployment containing #173 can be made. If yes, deploy S2 only and proceed to VERIFY. If no, persist the blocker here and do not bypass it.
