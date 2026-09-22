# Cycle 011 — Cross-Strategy Netting and Cost Coordination

Date: 2026-09-22
Research ID: Q-004
Status: TEST / REFERENCE
Experiment: EXP-Q004
Production impact: None

## Executive summary
BLACK ORACLE's Strategy Factory can eventually produce several independently generated strategy sleeves that propose trades in the same instrument at the same decision time. If those proposals are sent independently to execution, BO can pay spread, fees, slippage and market impact on economically offsetting trades. A 2026 Stanford manuscript by Devanathan, Bell, Rueter and Boyd studies the analogous multi-PM problem: independently optimized trade lists are netted at the firm level and a distributed cost-feedback protocol lets managers revise trades without revealing their internal objectives. The authors report convergence to the firm-level optimum and meaningful savings after only a few adjustment rounds in their experiments.

This is relevant as an execution-architecture precedent, not as evidence that the method will improve BO returns. The manuscript is not treated as a production-ready trading algorithm and its cost model/calibration must not be copied into KRX or crypto execution without BO-specific evidence.

## Source quality
B+ / strong research precedent. The work is a 2026 Stanford manuscript/preprint from an established optimization group, with code linked from the author's Stanford page. It is not yet used here as peer-reviewed evidence and does not establish BO-specific execution savings.

Primary references:
- N. Devanathan, L. Bell, D. Rueter, S. Boyd, “A Distributed Method for Cooperative Transaction Cost Mitigation,” Stanford / arXiv:2603.07881, 2026.
- Stephen Boyd, Stanford papers page and project page, including manuscript and code link.

## What is new for BLACK ORACLE
Q-002 already treats execution-cost assumptions as a model-risk family. EV-006 already places a deterministic safety gate before broker execution. Neither asks whether BO should first aggregate simultaneous strategy intentions so that economically offsetting orders never reach the broker.

The missing layer is therefore:

`Strategy sleeves -> immutable order intents -> portfolio coordinator/netter -> cost-aware adjustment (optional) -> deterministic bo.order_gate.v1 -> broker adapter`

This is deliberately upstream of `bo.order_gate.v1`. Netting or coordination must never weaken risk limits, freshness checks, allowlists, loss limits or circuit breakers.

## Hypothesis H-Q004
For simultaneously active BO strategy sleeves, portfolio-level intent netting can reduce expected executable notional and modeled transaction cost without materially degrading each sleeve's post-cost objective, risk mandate, attribution integrity or deterministic safety constraints.

A stronger iterative cost-feedback protocol is useful only if it provides incremental benefit over simple one-shot netting after accounting for latency, complexity and model-risk costs.

## EXP-Q004 — shadow cross-strategy execution coordinator
Use archived/paper Strategy Factory outputs only. No live orders.

### Conditions
A. Independent execution: every sleeve sends its proposed trade separately.

B. One-shot exact netting: same instrument/venue/time-bucket buy and sell intents are algebraically netted while preserving per-sleeve virtual fills/attribution.

C. Cost-aware coordination: after initial netting, expose a versioned estimated marginal transaction-cost signal to sleeves and allow a small fixed number of re-optimization rounds. This is a research condition, not a production behavior.

### Required invariants
- original sleeve intent is immutable and content-addressed;
- netting never manufactures exposure absent from aggregate intent;
- all final external orders still pass `bo.order_gate.v1`;
- sleeve-level virtual allocation sums exactly to externally executed quantity;
- strategy PnL/turnover attribution remains reconstructable;
- no strategy can use another sleeve's private signal/evidence as an unintended information channel;
- cancellation/retry/idempotency semantics remain explicit;
- point-in-time and audit-bundle IDs link original intent, coordinated intent and external order.

### Seeded cases
1. equal and opposite same-instrument intents;
2. partial offset;
3. same direction, different urgency;
4. conflicting limit prices;
5. one stale intent mixed with one valid intent;
6. one sleeve breaching its mandate although aggregate portfolio looks safe;
7. retry after coordinator timeout;
8. venue mismatch / non-fungible instrument mapping;
9. cost-model misspecification stress;
10. regime/liquidity shock where coordination delay itself becomes costly.

## Metrics
Primary:
- external gross notional reduction;
- modeled and realized-paper transaction-cost reduction;
- spread crossings avoided;
- turnover reduction;
- post-cost portfolio objective delta;
- per-sleeve objective/regret delta;
- constraint violations (target: zero for hard constraints);
- attribution reconstruction error (target: zero for deterministic fixture);
- duplicate external orders after retries (target: zero).

Secondary:
- p50/p95 coordination latency;
- incremental benefit of condition C over simple netting B;
- sensitivity to cost-model error;
- exposure drift by strategy and aggregate portfolio;
- audit-bundle completeness.

## Success / decision rule
`ADOPT` is available first for simple one-shot netting only if deterministic fixtures preserve all invariants, hard-constraint violations and attribution errors are zero, and archived/paper evaluation shows repeatable cost/notional reduction without material objective degradation.

The iterative distributed cost-feedback condition requires separate evidence. If its incremental savings over one-shot netting are small, unstable, or dependent on fragile cost estimates, classify it `REJECT` or `REFERENCE` even if simple netting is adopted.

## Implementation candidate
Introduce research-only interfaces rather than modifying strategy code:

- `OrderIntentV1`: strategy_id, experiment/decision_id, instrument canonical ID, venue, side, quantity, price/urgency semantics, valid_from/to, mandate reference, evidence hash.
- `CoordinationBatchV1`: point-in-time batch identity and eligible intents.
- `NettingResultV1`: original intents, netted external proposal, per-sleeve virtual allocation, residuals and reason codes.
- `CostFeedbackV1` (experimental): versioned execution-cost model and marginal-cost signal.
- `ExecutionAttributionV1`: mapping from external fills back to sleeve intents.

Persist these as artifacts referenced by `bo.audit_bundle.v1`; do not create a second ledger.

## Risks
- attribution ambiguity after internal crossing/netting;
- cost-model error causing unnecessary re-optimization;
- latency from iterative coordination;
- hidden coupling between otherwise independent strategies;
- aggregate-safe positions masking sleeve-level mandate violations;
- venue/instrument fungibility mistakes;
- retry/cancellation race conditions;
- accidental information leakage across strategy sleeves.

## Decision
TEST / REFERENCE.

Simple intent netting is the primary candidate. Iterative cooperative cost mitigation remains a challenger and must beat simple netting under the same archived/paper fixture before any promotion. No production or paper-trading behavior is changed by this research entry.
