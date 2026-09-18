# BLACK ORACLE Active Sprint

## Sprint
- **ID:** B0
- **Title:** Frozen Baseline
- **Status:** IN_PROGRESS
- **Governing plan:** `docs/BLACK_ORACLE_BETA_SPRINT_MASTER_PLAN_V2.md`
- **Canonical main at checkpoint:** `93fa639b2e9d6af837c8d0afa9edf45aebb11a59`
- **Session checkpoint:** 2026-09-18T17:00:00Z

## Objective
Prove deployed-source truth, state ownership, legacy read-only boundaries, rollback targets, and protected qualification boundaries before B1 implementation.

## Work-package status
- **B0.1 — IN_PROGRESS:** Railway service/deployment/source inventory captured; exact runtime-reported revisions remain incomplete.
- **B0.2 — IN_PROGRESS:** `black-oracle-paper-vnext-100m-v03` owner resolved to `black-oracle-web`; Supabase storage/function actors are now catalogued, while remaining qualification ownership and readiness semantics still require proof.
- **B0.3 — IN_PROGRESS / FAIL-CLOSED:** 47/47 scoped tables have RLS and no browser table grants, but `service_role` can destructively mutate 44 tables and no beta write namespace exists. The legacy read-only rule is not database-enforced.
- **B0.4 — IN_PROGRESS:** PAPER-only, deterministic Risk, performance-stream separation, rollback, and qualification invariants encoded in the offline validator.
- **B0.5 — COMPLETED:** PR #177 merged; PR #179 evidence remapped and closed; PR #175 compared, compatible concepts preserved, excluded/conflicting scope documented, and PR closed.
- **B0.6 — BLOCKED:** S2 stale source and vNext configured/deployed revision mismatch remain open.

## Completed this session
- Merged governing plan PR #177 as `f45d3d08f78dcd2882dafec8429ed9cb46b8024b` after Black Oracle CI 864 and Trading CI 1043 passed.
- Revalidated Railway production service configuration and recent deployment metadata without reading secret values.
- Created a fresh B0 branch from governing `main`; did not merge the conflicting S0 branch.
- Remapped PR #179's useful audit manifest, validator, and negative tests to B0.1-B0.6.
- Preserved Report/AutoTrade independence, PAPER-only authority, Risk sovereignty, protected historical state, and explicit UNKNOWN health semantics.
- Verified from Railway boot/cycle logs that `black-oracle-web` owns `black-oracle-paper-vnext-100m-v03`.
- Recorded current degraded evidence: 409 contention, persistence rollback/abort, upstream 503/521/522 failures, and KRX timeouts.
- Closed PR #175 after unique-delta review; compatible concepts are already preserved, while Marketplace/Community/public uploads/sales and conflicting pricing/sprint scope remain post-beta.
- No runtime, scheduler, database, secret, billing, order, position, Ledger, checkpoint, or qualification mutation.
- Inspected scoped Supabase grants, RLS/policy counts, function execution grants, view security mode, and deployed no-JWT function authorization through sanitized read-only paths.
- Recorded the B0.3 enforcement gap in `docs/audit/B0_STORAGE_AUTHORITY_BOUNDARY.md` and manifest schema v4.
- Added negative baseline tests that reject fabricated beta isolation, hidden destructive grants, browser table exposure, hidden view-security gaps, and a falsely completed public-status auth review.

## Evidence
- Railway production services: 4; latest deployment states report SUCCESS.
- Web deployment: `32d3b67e698b13e08549e099bf4ae1c82c0e5394`.
- vNext configured pin: `7c5bfd09297ad8497312b372f60386aeb7cfedcd`; latest deployment metadata in the evidence manifest: `8933516036f0910634fd53e97df1e81cc54637ea`.
- S2 Shadow deployment: `8c2f27aa53345a9738847e05f204cd38cf393d02`.
- v9 multiasset deployment: `8c2f27aa53345a9738847e05f204cd38cf393d02`.
- Railway SUCCESS is recorded as deployment completion only; runtime health remains UNKNOWN.
- Supabase boundary: 47 scoped tables, 47 with RLS, 0 browser-granted, 44 destructively mutable by `service_role`, 0 beta namespaces.
- No-JWT functions: two custom hashed-header jobs fail closed; public runtime status remains pending output/enumeration review.

## Active PRs / branches
- PR #183 — merged B0.2/B0.3 storage-authority boundary as `93fa639b2e9d6af837c8d0afa9edf45aebb11a59`.
- PR #177 — merged governing B0-B9 plan.
- PR #180 — merged B0 baseline manifest/validator/evidence package.
- PR #181 — merged v03 ownership proof and legacy-plan reconciliation.
- PRs #175, #176, and #179 — closed with evidence/disposition preserved.
- Older pre-beta PRs remain open historical candidates and require separate B0 delta classification before reuse; none is authorized for merge by this checkpoint.

## Validation
- PR #177 final head: Black Oracle CI 864 PASS; Trading CI 1043 PASS.
- PR #180 final head: offline tests 16/16 PASS; Black Oracle CI 867 PASS; Trading CI 1046 PASS.
- PR #181 final head: offline tests 18/18 PASS; Black Oracle CI 869 PASS; Trading CI 1048 PASS.
- Current B0.2/B0.3 branch: baseline tests 25/25 PASS; TypeScript lint PASS; production build PASS; trading regressions 303/303 PASS (run with `node --import tsx --test` because the `tsx` CLI IPC socket is unavailable in this sandbox).
- PR #183 final head: Black Oracle CI 874 PASS; Trading CI 1053 PASS.
- Baseline validator returns `contractValid=true`, `releaseReady=false`, `b0Status=IN_PROGRESS`.
- Merged session scope is documentation, manifests, and offline validators/tests only.
- Browser verification: not applicable; no UI change.
- Production deployment target: NONE.
- This documentation-only closing checkpoint must pass GitHub CI before merge.

## Deployment / rollback
- No Railway deployment.
- Rollback: revert PR #183 and this checkpoint PR; production runtime is unchanged.
- Do not use generic Railway redeploy for S2; it is proven to reuse the stale snapshot.

## Blockers
1. vNext configured/deployed revision mismatch.
2. S2 exact latest-source deployment control unavailable through the connected tool surface.
3. Scheduler HTTP 409-as-success semantics do not prove checkpoint persistence.
4. Exact remaining service/runtime/scheduler/qualification ownership matrix is incomplete.
5. Persistence/upstream 503/521/522 failures and 409 contention prevent readiness claims.
6. Future Data API grants and no-JWT custom-auth boundaries require verification.
7. B0.3 is not database-enforced: the operational `service_role` has destructive access to 44 scoped legacy tables and no beta write namespace exists.
8. Three service-only NARS views lack `security_invoker=true`; public runtime status still needs output/enumeration review.

## Next safe actions
1. Continue sanitized read-only ownership verification for remaining B0.2 actors.
2. Design and separately review a least-privilege beta identity plus beta write namespace; prove prohibited legacy mutations fail before applying production DDL.
3. Define runtime readiness semantics that fail closed on persistence/upstream failure and 409 contention.
4. Resolve or explicitly carry forward vNext revision mismatch and S2 exact-source blocker under B0.6.
5. Classify older pre-beta PR deltas before reuse.
6. Keep B0 IN_PROGRESS; do not begin B1 implementation until the complete B0 exit gate passes.
