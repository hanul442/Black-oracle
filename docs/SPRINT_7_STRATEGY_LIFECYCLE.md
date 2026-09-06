# Black Oracle Sprint 7 — Strategy Lifecycle Governance

Status: S7-06A / S7-06B / S7-06C IMPLEMENTED ON DRAFT BRANCH

Branch: `sprint/7-validation-integrity-target-contract`
PR: #29

## 1. Purpose

S7-06 extends the Strategy Factory and Strategy Genome work into an auditable research lifecycle without granting autonomous capital or execution authority.

The lifecycle is intentionally split into two layers:

1. **Research governance lifecycle** — Strategy Vault
2. **Actual Champion replacement / execution role** — existing Champion–Challenger governance

The Strategy Vault does not create a new broker route and does not make a strategy executable. Its purpose is to retain immutable lineage, promotion-review evidence and explicit operator decisions.

## 2. S7-06A — Strategy Vault + Promotion Review Ledger

`src/trading/strategyVault.ts`

Vault states:

- `RESEARCH`
- `INCUBATOR`
- `CHALLENGER`
- `CHAMPION_CANDIDATE`
- `RETIRED`

Allowed upward transitions are mapped directly to the S7-05 Promotion Hard Gate stages:

- `EXPERIMENT_TO_INCUBATOR`: RESEARCH -> INCUBATOR
- `INCUBATOR_TO_CHALLENGER`: INCUBATOR -> CHALLENGER
- `CHALLENGER_TO_CHAMPION_CANDIDATE`: CHALLENGER -> CHAMPION_CANDIDATE

There is deliberately no Vault `CHAMPION` transition. Final Champion replacement remains the responsibility of the existing Champion–Challenger registry and its separate approval boundary.

### Promotion review rule

A deterministic S7-05 `PASS` result is only evidence that a review may be approved. It never changes Vault state by itself.

The sequence is:

`Hard Gate evidence -> PENDING Promotion Review -> explicit human decision -> Vault state update`

Each review stores:

- genome ID
- source and target Vault state
- S7-05 policy version
- eligibility verdict
- stage minimum grade
- blockers
- insufficient-evidence gates
- evidence reasons
- request timestamp
- decision timestamp
- approver identity
- operator note

Every review has:

- `autoTransition: false`
- `requiresHumanApproval: true`
- `executionAuthority: false`
- `promotionAuthority: false`
- `capitalAuthority: false`

`BLOCKED` and `INSUFFICIENT_DATA` reviews may be retained for audit, but they cannot be approved.

Skipping lifecycle stages is rejected. A strategy with a pending review cannot open another promotion review or be retired until the pending review is resolved.

Retirement also requires an explicit operator identity, timestamp and reason.

## 3. Existing lineage reused rather than duplicated

S7-06 does not create another strategy-description format.

It builds on the existing Strategy Genome fields:

- genome ID
- generation
- parent genome IDs
- strategy version
- model version
- market scope
- regime scope
- timeframes
- signal weights
- entry/exit thresholds
- risk profile
- mutation history
- deterministic fingerprint

Strategy Factory candidates can therefore be registered directly into the Vault while preserving their existing parent/child lineage.

## 4. S7-06B — Multi-axis Strategy Drift Monitor

`src/trading/strategyDrift.ts`

The drift monitor compares a baseline observation window with a later observation window for the same genome.

It evaluates five independent dimensions:

1. sample depth
2. expectancy deterioration
3. maximum-drawdown expansion
4. regime-distribution shift
5. policy / target / adapter parity mismatch

Default policy currently uses:

- minimum 20 observations in each window
- expectancy deterioration WATCH at 10 bps; DEGRADED at 25 bps
- maximum-drawdown expansion WATCH at 1 percentage point; DEGRADED at 2 percentage points
- regime total-variation distance WATCH at 0.25; DEGRADED at 0.40
- any observed parity mismatch as degraded governance evidence

Regime shift is measured using total-variation distance and therefore supports regimes that appear in only one comparison window.

Possible outputs:

- `STABLE` -> `CONTINUE_OBSERVATION`
- `WATCH` -> `EXTEND_VALIDATION`
- `INSUFFICIENT_DATA` -> `EXTEND_VALIDATION`
- `DEGRADED` -> `DEMOTION_REVIEW`

A `DEMOTION_REVIEW` is a recommendation only. The module has:

- `automaticDemotion: false`
- `executionAuthority: false`
- `promotionAuthority: false`
- `capitalAuthority: false`

No drift result directly changes broker routing, portfolio targets, risk limits or capital allocation.

## 5. S7-06C — Runtime persistence without database migration

The Strategy Vault is now an optional schema-v1 extension of `TradingRuntimeCheckpoint`.

The existing Supabase persistence model already stores the entire runtime checkpoint as JSON. Therefore S7-06C does **not** require:

- a new Supabase table
- a new column
- a production migration
- scheduler changes
- credential changes

`server/trading/strategyVaultStore.ts` holds the runtime Vault controller. Runtime checkpoint save/restore now includes the Vault snapshot, and persistence validation reconstructs the Vault to reject malformed lifecycle records before accepting a checkpoint.

Legacy schema-v1 checkpoints without a `strategyVault` field remain valid.

Runtime persistence status now exposes only a governance summary:

- total entries
- Research count
- Incubator count
- Challenger count
- Champion Candidate count
- Retired count
- pending / approved / rejected review counts

All authority fields remain false.

## 6. Read-only operator inspection surface

`api/trading-strategy-vault.ts`

The API is intentionally read-only:

- GET only
- Bearer operator authorization required
- Supabase persistence required
- returns persisted Vault entries and review history
- returns lifecycle summary counts
- `mutationEndpointAvailable: false`
- `automaticPromotion: false`
- `automaticDemotion: false`

There is no HTTP endpoint in S7-06C that approves promotion, changes Vault state, retires a strategy or reallocates capital.

That omission is deliberate. Human approval should not be reduced to an unattended scheduler/webhook action merely because the core lifecycle object supports an explicit approval method.

## 7. Test invariants

S7-06 tests lock the following behavior:

- Genome registration always begins at RESEARCH
- parent/child lineage remains visible
- a Hard Gate PASS creates only a PENDING review
- state does not move before explicit approval
- BLOCKED or INSUFFICIENT reviews cannot be approved
- lifecycle stages cannot be skipped
- each upward stage requires a separate review
- checkpoint restore preserves lifecycle state and audit trail
- retirement requires explicit decision metadata
- runtime save/restore preserves Vault state
- old checkpoints remain readable without Vault data
- malformed Vault checkpoint extensions fail closed
- stable drift never causes automatic action
- moderate drift extends validation
- severe drift requests demotion review only
- parity mismatch is visible as degraded evidence
- insufficient drift samples never fabricate confidence

## 8. Authority matrix

| Component | Research evidence | Recommend lifecycle action | Change Vault state automatically | Execute PAPER order | Allocate capital | Deploy LIVE |
|---|---:|---:|---:|---:|---:|---:|
| Strategy Factory | Yes | Candidate selection | No | No | No | No |
| Promotion Hard Gate | Yes | Eligibility | No | No | No | No |
| Strategy Vault | Yes | Review workflow | No | No | No | No |
| Drift Monitor | Yes | Continue / extend / demotion review | No | No | No | No |
| Read-only Vault API | Yes | No | No | No | No | No |
| Existing PAPER broker | Execution result only | No | N/A | Yes, PAPER only | Existing bounded PAPER authority | No |
| Champion–Challenger registry | Comparative governance | Champion review | No unattended replacement | No direct broker authority | No | No |

## 9. Remaining S7-06 work

The next lifecycle increment should focus on evidence quality rather than adding more autonomous control:

### S7-06D — prospective Champion/Challenger lifecycle comparison

- identical prospective observation windows
- explicit Genome ID binding
- same market/regime/timeframe scope where comparison claims equivalence
- paired return/risk comparison
- drift-aware comparison
- promotion-review evidence linked to the exact prospective window
- no historical cherry-picking for Champion replacement

### S7-06E — evidence-debt / next-sample surface

For each candidate, expose exactly why promotion remains blocked and what additional observation is required, for example:

- Blind/OOS samples remaining
- observation days remaining
- closed trades remaining for Monte Carlo / Cost Stress
- parity fills remaining
- missing market × timeframe provenance
- rating hard-gate blocker
- drift watch/review status

This should improve operator decision quality without relaxing any Hard Gate.

## 10. Release boundary

S7-06 remains on the Draft Sprint 7 branch until the latest branch HEAD passes both GitHub validation workflows.

Vercel Preview remains a separate external deployment QA gate. A GitHub GREEN result does not override a Vercel deployment failure.

No merge, production rollout, qualification-window reset, capital scaling or LIVE transition is implied by S7-06 implementation.
