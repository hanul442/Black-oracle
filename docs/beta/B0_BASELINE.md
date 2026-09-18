# v1.0.0-beta.1 — B0 baseline and ownership boundary

Observed 2026-09-18. **B0 IN_PROGRESS; not a release or migration approval.**

## Authority and existing work

The approved sequence is B0 baseline → B1 Shell → B2 Report domain → B3 Report UI → B4 Strategy Library → B5 policy personalization → B6 Paper AutoTrade → B7 operations → B8 pricing → B9 release gates.

The current automation request takes precedence over older product proposals. Open PR #175 (`93628b94d81670683096b5827f9e4b54ca99ff59`) has green CI but proposes a different sprint sequence, a Report-to-execution vertical slice and Community/Marketplace scope. Do not merge it unchanged or silently relabel its tasks B0–B9. Preserve its design work and reconcile its six documents separately. Older stacked PRs, including protected qualification PR #115, are not implicitly approved for merge.

The existing `docs/automation/ACTIVE_SPRINT.md` tracks unresolved KRX production verification; this baseline does not mark that work done or overwrite its evidence. Main is `32d3b67e698b13e08549e099bf4ae1c82c0e5394`. The main-SHA connector returned no PR-triggered workflow runs; this is not evidence of failed or passed main CI. PR #175 CI runs 35281374633 and 35281374570 passed.

## Observed infrastructure

Project: `a0be3674-75d7-433d-b997-4427dcec1460`; production: `e6690b5a-ea93-4cf5-b35f-189dabdd2b4e`.

| Service | Latest deployment | SHA | Observation |
|---|---|---|---|
| web | 08b01477-2065-4827-9cd1-a5100b3ef6d4 | 32d3b67 | Matches observed main |
| v9-multiasset | 99585992-8ce9-44fb-bab4-0daaa0a9349c | 8c2f27a | Older than main; not an authorization to upgrade |
| s2-shadow | fa1c9937-32fb-482c-8260-ceef6ff44266 | 8c2f27a | Existing stale-source blocker persists |
| vnext | 11c37d70-0362-4687-8319-58efd066279e | 8933516 | Configured source is pinned to 7c5bfd0; discrepancy unresolved |

All four latest deployment records are SUCCESS and all four `/health` requests returned HTTP 200 with `PROCESS_LIVENESS`. Neither establishes trading health, persisted ownership, or in-process code SHA. Recent log samples show upstream timeouts on v9/S2 and checkpoint abort/timeout errors on web/vNext. No raw logs, positions, Ledger payloads or credentials are recorded here. Do not infer total error rates from the bounded log sample.

## Freeze and data ownership

Freeze v0.x execution semantics, existing runtime IDs, scheduler targets, risk limits, qualification identities and sample windows. Beta additions must not mutate legacy stores. This policy is a development boundary, not a claim that a new runtime authorization layer has already shipped.

| Data | Source evidence | Existing owner | Beta access / migration |
|---|---|---|---|
| Paper positions, orders, session and checkpoint | `server/trading/persistence.ts`: `black_oracle_trading_runtime`, keyed by `runtime_id` | Current runtime writer; deployed service-to-row mapping UNKNOWN | Sanitized read model only; no reset, re-key, copy or reseed |
| Canonical event history | `server/eventLedger.ts`: `black_oracle_events`, `event_key` deduplication, optional `runtime_id` | Existing event producers | Read-only adapter; preserve IDs and lineage; never bulk-rewrite |
| Runtime NARS inbox/evidence | `server/eventLedgerNarsAudit.ts`: runtime-scoped and legacy tables | Existing NARS consumer | Read-only; never infer missing scope or order authority |
| Strategy/risk identity | `server/trading/runtimeProfile.ts` and `src/trading/config.ts` | Existing engine and qualification policy | Reference immutable versions; personalization changes suitability/allocation/policy, not originals |
| Beta Reports and versions | Not implemented | Future Report domain | New namespace and versioned records; no dependency on order eligibility |
| Beta investor policy and allocations | Not implemented | Future authenticated investor domain | New namespace; audited effective time; no legacy mutation |
| Beta Credits | Not implemented | Future billing domain | Test-only settlement; no actual charging |

Code defaults are not deployment ownership evidence. Verify runtime identity, scheduler configuration and checkpoint ownership through an authorized, sanitized read-only path before considering B0 complete. Do not load runtime modules merely to inspect constants: `runtimeProfile.ts` imports a scheduler module.

## Product invariants

- Report is independently usable and informational, never a required order input or Risk bypass. AutoTrade remains independently usable.
- Every trade is Paper only; no live activation or execution credentials.
- Backtest, Forward and Paper performance stay separate. Missing, failed, unrun and stale results must not become zero/success.
- Core / Plus / Pro / Max / Enterprise are feature tiers. Pro ×2/×5/×20 change capacity only. Balanced / Strategy / Research are Pro-and-above profiles, not entitlements.
- No destructive migration, data deletion, real billing or qualification modification is authorized by this baseline.
- B1 RectangleButtons must fetch the specified ThreeUI registry and verify every required file/binary SHA-256. Source not fetched in B0; no imitation or claimed integration.

## Verification and next gate

Run `node scripts/verify-beta-baseline.mjs` and `node --test scripts/verify-beta-baseline.test.mjs`. They validate this offline policy snapshot, not runtime enforcement or health. The result deliberately reports `releaseReady: false`.

Next: reconcile #175 with the current contract, verify ownership and vNext revision discrepancy, and resolve the existing S2 exact-revision deployment blocker. Generic Railway redeploy is already proven to reuse the stale S2 snapshot and must not be repeated as a fresh-source deployment. A rollback must target a verified prior service deployment without replacing its checkpoint or resetting the performance window. No B1 production cutover until the relevant B0 safety gates are closed.
