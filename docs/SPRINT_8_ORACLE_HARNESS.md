# Black Oracle Sprint 8 — Oracle Evaluation Harness

Status: S8-01 IMPLEMENTED ON DRAFT BRANCH

Branch: `sprint/8-oracle-evaluation-harness`
Base: `sprint/7-validation-integrity-target-contract`

## 1. Purpose

Oracle Harness is the research-control layer that turns existing Black Oracle validation modules into one deterministic KEEP / DISCARD / CRASH decision surface.

The design principle is deliberately asymmetric:

> strategy generation must never scale faster than strategy rejection and validation capacity.

The Harness therefore does not generate strategies, execute trades, allocate capital, or replace a Champion. It evaluates a candidate using the existing Sprint 7 Promotion Hard Gate and makes the resulting research disposition explicit.

## 2. Existing components reused

S8-01 does not duplicate validation logic. It orchestrates the components already present on Sprint 7:

- Strategy Genome — immutable strategy identity and lineage
- Strategy Factory — research candidate generation
- Blind/OOS validation
- Walk-forward validation
- Monte Carlo survival testing
- Cost/slippage stress
- Input-integrity and recursive warm-up validation
- Evidence/audit coverage
- Oracle Grade System
- policy / target / execution-adapter parity
- Promotion Hard Gate
- Strategy Vault and human promotion review
- Champion–Challenger governance

The authoritative promotion decision remains `buildStrategyPromotionEligibility()` from `promotionHardGate.ts`. Oracle Harness is an orchestration and operator-observability layer around it.

## 3. Harness dispositions

| Promotion Hard Gate | Harness disposition | Next action | Meaning |
|---|---|---|---|
| `PASS` | `KEEP` | `REQUEST_PROMOTION_REVIEW` | Candidate survived validation, but a human review is still required. |
| `INSUFFICIENT_DATA` | `KEEP` | `EXTEND_VALIDATION` | Candidate is retained as research only; missing evidence must be collected. |
| `BLOCKED` | `DISCARD` | `ARCHIVE_REJECTED_CANDIDATE` | At least one observed hard gate failed. No promotion is allowed. |
| evaluator/input failure | `CRASH` | `INVESTIGATE_HARNESS_FAILURE` | Harness fails closed and grants no authority. |

`KEEP` must never be interpreted as automatic promotion or execution eligibility.

## 4. Five-axis operator view

The Harness projects Promotion Hard Gate checks into five operator-facing axes. These axes are descriptive; they never override the hard-gate verdict.

### PERFORMANCE

- `BLIND_OOS`
- `RATING_HARD_GATE`

### RISK

- `MONTE_CARLO_SURVIVAL`

### ROBUSTNESS

- `WARMUP_STABILITY`
- `WALK_FORWARD`

### EXECUTION

- `COST_STRESS`
- `POLICY_PARITY`
- `TARGET_PARITY`
- `ADAPTER_PARITY`

### EVIDENCE

- `INPUT_INTEGRITY`
- `REPRODUCIBLE_LINEAGE`
- `AUDIT_COVERAGE`
- unknown future governance checks default here until explicitly classified

Each axis exposes:

- status: `PASS`, `INSUFFICIENT_DATA`, or `FAIL`
- passed check count
- total check count
- pass rate
- blocker keys
- insufficient-evidence keys
- original gate reasons

The pass rate is presentation telemetry only. It is not a replacement composite score and cannot compensate for a failed Hard Gate.

## 5. Grade policy

Oracle Harness preserves the existing Oracle Grade and raw score from the rating engine. It does not invent a second scoring system.

The existing Promotion Hard Gate remains stage-aware:

- Experiment -> Incubator: minimum `BBB-`
- Incubator -> Challenger: minimum `A-`
- Challenger -> Champion Candidate: minimum `AA-`

Those grade floors are necessary but not sufficient. A high grade cannot compensate for failed parity, poor input integrity, failed cost stress, insufficient OOS evidence, or another Hard Gate blocker.

## 6. Fail-closed invariants

Every Harness result has:

- `autoTransition: false`
- `promotionAuthority: false`
- `executionAuthority: false`
- `capitalAuthority: false`
- `liveDeploymentAuthority: false`

Additional invariants:

1. Missing Experiment ID, Genome ID, or promotion stage produces `CRASH`, not an unauditable result.
2. An exception in the underlying evaluator produces `CRASH` and no authority.
3. `INSUFFICIENT_DATA` never becomes a false `PASS` or `DISCARD`; it remains research-only and requests more evidence.
4. `BLOCKED` cannot be rescued by average pass rate or grade.
5. `PASS` requests a human promotion review; it never changes Strategy Vault state automatically.

## 7. Files

### `src/trading/oracleHarness.ts`

Implements:

- `runOracleHarness()`
- `summarizeOracleHarnessAxes()`
- KEEP / DISCARD / CRASH disposition contract
- five-axis classification
- fail-closed crash handling
- explicit authority boundary

### `src/trading/oracleHarness.test.ts`

Locks:

- PASS -> KEEP + explicit promotion review
- INSUFFICIENT_DATA -> KEEP + extend validation
- BLOCKED -> DISCARD
- evaluator exception -> CRASH
- missing audit identity -> CRASH
- five-axis mapping and forward-compatible unknown-check handling

### `src/trading/index.ts`

Exports the Harness through the trading domain package.

## 8. Intended pipeline

```text
Strategy Factory / manual candidate
              |
              v
        Strategy Genome
              |
              v
      ORACLE HARNESS
              |
      +-------+-------+----------------+
      |               |                |
     KEEP          DISCARD           CRASH
      |               |                |
      |               +-> archive      +-> investigate
      |
      +-> insufficient evidence -> extend validation
      |
      +-> hard-gate PASS -> pending human promotion review
                                |
                                v
                         Strategy Vault
                                |
                                v
                       Champion–Challenger
                                |
                                v
                      separate PAPER authority
```

## 9. What S8-01 deliberately does not do

- no automatic Strategy Factory mutation loop
- no unattended Vault transition
- no automatic Champion replacement
- no Council bypass
- no broker route
- no portfolio target mutation
- no capital scaling
- no LIVE deployment
- no new independent composite score

This keeps the first Harness increment small enough to audit and prevents the validation layer from accidentally becoming an execution layer.

## 10. Next increments

### S8-02 — Harness Ledger Adapter

Persist each Harness result alongside the existing experiment lineage without erasing the distinction between `INSUFFICIENT_DATA` and completed PASS/REJECT outcomes.

### S8-03 — Factory -> Harness Adapter

Allow Strategy Factory candidates to enter the Harness with immutable Genome ID, parent lineage, mutation metadata, research configuration, and exact validation dataset provenance.

### S8-04 — Evidence Debt / Next Sample

Expose exactly what prevents a retained candidate from advancing:

- Blind/OOS samples remaining
- observation days remaining
- Monte Carlo trade depth remaining
- parity observations/fills remaining
- missing market × timeframe provenance
- audit coverage shortfall
- rating blocker
- drift watch/review state

### S8-05 — Prospective Champion–Challenger Harness

Compare Champion and Challenger over identical prospective windows, bound to exact Genome IDs and equivalent market/regime/timeframe scope. No historical cherry-picking may authorize Champion replacement.

### S8-06 — Operator Surface

Add a read-only Harness dashboard/table showing:

- experiment and Genome IDs
- mutation description
- five-axis status
- Oracle Grade
- KEEP / DISCARD / CRASH
- blocker/evidence-debt details
- lineage and promotion-review links

Any mutation or approval surface remains a separate explicit-governance change.

## 11. Release boundary

S8-01 is implemented on a branch based on the Draft Sprint 7 validation branch because the Harness directly depends on S7 Promotion Hard Gate and Strategy lifecycle work.

No merge to `main`, production rollout, qualification-window reset, capital scaling, or LIVE transition is implied by this branch.
