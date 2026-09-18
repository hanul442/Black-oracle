# BLACK ORACLE Active Sprint

## Sprint
- **ID:** BO-S0-V3-01
- **Title:** S0 — System Audit & Reset
- **Governing baseline:** Product Constitution v2 / Master Sprint Plan v3
- **Canonical main:** `55be5181d807bae3f4044c1cb3d39650506266f3`

## Objective
Establish one verified source of truth for GitHub, Railway, Supabase, scheduler ownership, protected PAPER state, and legacy work before S1/S2 implementation begins.

S0 is an audit/reset of **interpretation and ownership**, not a destructive runtime reset.

## Current phase
**AUDIT — IN_PROGRESS**

## Completed checkpoints
- Product Constitution v2 and Master Sprint Plan v3 merged through PR #178.
- New S0 branch created from canonical main.
- Railway production project and all four services enumerated.
- Latest Railway deployment SHAs recorded.
- vNext configured pin `7c5bfd0` vs deployed `8933516` mismatch reconfirmed.
- Supabase checkpoint rows and scheduler target map read through sanitized queries.
- Active cron jobs enumerated without exposing command secrets.
- Supabase-native shadow ownership verified from deployed Edge Function source.
- First KEEP / MIGRATE / ABSORB / RETIRE / DELETE-LATER inventory recorded.
- Offline S0 baseline manifest and invariant validator added.

## Inherited blocker from previous active sprint
The earlier KRX truth sprint proved that generic S2 Railway redeploy reuses stale source `8c2f27a`. That evidence remains valid and is absorbed into S0.

Do **not** repeat generic redeploy to solve exact-revision freshness.

## Current blockers
1. vNext configured/deployed revision mismatch.
2. S2 exact-revision/source freshness remains unresolved.
3. `black-oracle-paper` and `black-oracle-paper-vnext-s1r2` scheduler 409-as-success semantics need reconciliation against stale durable checkpoints.
4. Owner of `black-oracle-paper-vnext-100m-v03` is not yet proven.
5. Legacy open PRs/branches still require final disposition and unique-delta accounting.
6. Future Data API grants/RLS exposure require explicit mapping.
7. Active Edge Functions with `verify_jwt=false` require custom-auth review before reuse.

## Protected invariants
- Current trading authority remains **PAPER-only**.
- Protected qualification samples and runtime IDs are not reset, re-keyed, copied, or silently mixed.
- Deterministic Risk remains sovereign.
- Report does not authorize AutoTrade.
- Historical audit/event/evidence records are not rewritten.
- No real billing, live credentials, destructive migration, or automatic Champion promotion.
- Missing or uncertain state remains explicit.

## Next checkpoints
1. Prove the writer/owner of `black-oracle-paper-vnext-100m-v03`.
2. Explain 409 scheduler results vs checkpoint freshness without mutating production.
3. Reconcile/close superseded planning PRs after unique-delta accounting.
4. Build exact runtime/service/scheduler/qualification ownership matrix.
5. Verify table grants and no-JWT Edge Function custom-auth boundaries.
6. Move S0 to **GATE_REVIEW** only after the offline validator and required repository CI are green.

## Relevant branch / PR
- Branch: `s0/system-audit-reset-v3`
- S0 PR: pending creation from this branch
- PR #178: merged canonical redesign
- PR #175/#176/#177: superseded/absorb candidates
- PR #115: protected qualification work; not an implicit merge candidate

## Status
**S0 IN_PROGRESS / releaseReady=false**
