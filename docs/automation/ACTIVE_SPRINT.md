# BLACK ORACLE Active Sprint

## Sprint
- **ID:** B0
- **Title:** Frozen Baseline
- **Status:** IN_PROGRESS
- **Governing plan:** `docs/BLACK_ORACLE_BETA_SPRINT_MASTER_PLAN_V2.md`
- **Canonical main at checkpoint:** `7ec3770a3bcb1e0227cd40e08a8fe9cbf0df9b07`
- **Session checkpoint:** 2026-09-18T17:57:54Z

## Objective
Prove deployed-source truth, state ownership, legacy read-only boundaries, rollback targets, and protected qualification boundaries before B1 implementation.

## Work-package status
- **B0.1 — IN_PROGRESS:** Railway service/deployment/source inventory captured; fail-closed runtime readiness v0.3 is deployed as Supabase Edge Function version 4 with an exact bundle hash, while independent HTTP response probes remain blocked by runner networking.
- **B0.2 — IN_PROGRESS:** runtime/storage actors are catalogued; deployed source bounds public runtime enumeration and no longer accepts 409 or scheduler heartbeat as checkpoint proof, while qualification ownership and endpoint probe evidence remain incomplete.
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
- Implemented `BO-RUNTIME-STATUS-v0.3` readiness policy in source: fresh persisted checkpoint, recent scheduler 2xx where required, zero cycle errors, and no Evidence attachment failure.
- Restricted unauthenticated runtime status to the legacy and native-shadow PWA IDs; internal and qualification IDs share a 404 response.
- Hardened canonical scheduler health so HTTP 409 or missing status cannot be reported HEALTHY.
- Added readiness policy regression tests and a deployment/rollback contract.
- Merged PR #185 as `7ec3770a3bcb1e0227cd40e08a8fe9cbf0df9b07` after Black Oracle CI 879, Trading CI 1058, and NARS CI 146 passed.
- Deployed that exact merged v0.3 source as Supabase Edge Function version 4; retrieved ACTIVE artifact bundle SHA-256 is `b4b5f8145fc0fe10b16157a2e53432d099700b7be0396ab9a81486ef715f0ed0`.
- Preserved rollback to function version 3 / bundle `02c0896d442d39acf77b898c001678ba692f8d1b4de9ad6a86d590d99c8f48bb`.
- Kept endpoint health `UNKNOWN`: direct, browser-mediated, and read-only SQL probes timed out from this runner and were not promoted to PASS.

## Evidence
- Railway production services: 4; latest deployment states report SUCCESS.
- Web deployment: `32d3b67e698b13e08549e099bf4ae1c82c0e5394`.
- vNext configured pin: `7c5bfd09297ad8497312b372f60386aeb7cfedcd`; latest deployment metadata in the evidence manifest: `8933516036f0910634fd53e97df1e81cc54637ea`.
- S2 Shadow deployment: `8c2f27aa53345a9738847e05f204cd38cf393d02`.
- v9 multiasset deployment: `8c2f27aa53345a9738847e05f204cd38cf393d02`.
- Railway SUCCESS is recorded as deployment completion only; runtime health remains UNKNOWN.
- Supabase boundary: 47 scoped tables, 47 with RLS, 0 browser-granted, 44 destructively mutable by `service_role`, 0 beta namespaces.
- No-JWT functions: two custom hashed-header jobs fail closed; public runtime status v0.3 has a verified deployed allowlist artifact but still lacks independent HTTP response probes.
- Runtime status production: v0.3 / function version 4 / bundle SHA-256 `b4b5f8145fc0fe10b16157a2e53432d099700b7be0396ab9a81486ef715f0ed0`; current endpoint/runtime health remains UNKNOWN.

## Active PRs / branches
- PR #183 — merged B0.2/B0.3 storage-authority boundary as `93fa639b2e9d6af837c8d0afa9edf45aebb11a59`.
- PR #185 — merged B0.1/B0.2 fail-closed runtime readiness as `7ec3770a3bcb1e0227cd40e08a8fe9cbf0df9b07`.
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
- Current B0.1/B0.2 readiness branch: readiness/scheduler policy 17/17 PASS; baseline tests 31/31 PASS; trading regressions 314/314 PASS; TypeScript lint PASS; production build PASS.
- Local Deno check unavailable because Deno is not installed in this runner; GitHub NARS CI supplied the authoritative Edge Function typecheck.
- PR #185 final head: Black Oracle CI 879 PASS; Trading CI 1058 PASS; NARS CI 146 PASS, including authoritative Deno typecheck.
- Baseline validator returns `contractValid=true`, `releaseReady=false`, `b0Status=IN_PROGRESS`.
- Merged session scope is documentation, manifests, and offline validators/tests only.
- Browser verification: not applicable; no UI change.
- Production deployment: Supabase Edge Function only; no Railway service deployed.
- This documentation-only closing checkpoint must pass GitHub CI before merge.
- The closing checkpoint commit must pass Black Oracle, Trading, and NARS CI before PR #185 can merge.

## Deployment / rollback
- No Railway deployment.
- Supabase runtime-status deployment: ACTIVE version 4, bundle `b4b5f8145fc0fe10b16157a2e53432d099700b7be0396ab9a81486ef715f0ed0`.
- Rollback: redeploy the recorded version 3 source bundle `02c0896d442d39acf77b898c001678ba692f8d1b4de9ad6a86d590d99c8f48bb`; no scheduler or database row mutation is required.
- Do not use generic Railway redeploy for S2; it is proven to reuse the stale snapshot.

## Blockers
1. vNext configured/deployed revision mismatch.
2. S2 exact latest-source deployment control unavailable through the connected tool surface.
3. Scheduler HTTP 409-as-success semantics do not prove checkpoint persistence.
4. Exact remaining service/runtime/scheduler/qualification ownership matrix is incomplete.
5. Persistence/upstream 503/521/522 failures and 409 contention prevent readiness claims.
6. Future Data API grants require verification; the two custom-token no-JWT jobs are reviewed, while runtime-status v0.3 still needs independent HTTP response probes.
7. B0.3 is not database-enforced: the operational `service_role` has destructive access to 44 scoped legacy tables and no beta write namespace exists.
8. Three service-only NARS views lack `security_invoker=true`; they remain non-browser-readable but require hardening before broader grants.
9. Runtime status v0.3 is deployed and artifact-verified, but direct and browser-mediated HTTP probes and the read-only database cross-check timed out; readiness remains UNKNOWN.

## Next safe actions
1. Continue sanitized read-only ownership verification for remaining B0.2 actors.
2. Design and separately review a least-privilege beta identity plus beta write namespace; prove prohibited legacy mutations fail before applying production DDL.
3. Run independent GET probes for both allowed runtime IDs and a forbidden qualification ID from a network that can reach the Supabase endpoint; do not promote health before the responses match the v0.3 contract.
4. Resolve or explicitly carry forward vNext revision mismatch and S2 exact-source blocker under B0.6.
5. Classify older pre-beta PR deltas before reuse.
6. Keep B0 IN_PROGRESS; do not begin B1 implementation until the complete B0 exit gate passes.
