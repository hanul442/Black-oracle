# Cycle 008 — Autotrade Safety Gate and Bounded Autonomy

Date: 2026-09-21
Status: TEST
Research ID: EV-006
Experiment: EXP-EV006
Production impact: None

## Executive summary
BLACK ORACLE is moving toward a user-facing Autotrade path. Before strategy intelligence is allowed to place real orders, the execution boundary should be independently constrained by deterministic pre-trade controls. The core design principle is **bounded autonomy**: AI/strategy components may propose an action, but a separate risk gate decides whether an order is admissible.

## Sources and evidence quality
1. SEC Rule 15c3-5 guidance — official regulatory precedent. Requires automated pre-trade controls for electronic market access and controls against orders exceeding financial thresholds or erroneous price/size parameters. Evidence quality: A for the control pattern; it is not asserted here that this US broker-dealer rule directly governs BLACK ORACLE.
2. FINRA Algorithmic Trading / Market Access guidance — official supervisory precedent emphasizing testing, implementation controls and the risks of automated errors compounding quickly. Evidence quality: A for operational-control precedent.
3. Gong (2026), *AI Agents in Financial Markets: Architecture, Applications, and Systemic Implications* — recent conceptual paper arguing that agentic-finance risk depends on autonomy depth, execution coupling and supervisory observability, with bounded autonomy a plausible near-term equilibrium. Evidence quality: B; conceptual/system-level evidence rather than BO-specific causal validation.

## Gap against current BLACK ORACLE
Existing research covers evidence lineage, point-in-time correctness, execution-cost assumptions, Council evaluation and traceability. These improve whether a decision is trustworthy, but they do not independently constrain what an automated strategy is physically allowed to send to a venue. A bad model output, stale state, duplicate event or software fault can therefore remain an execution-layer risk even if upstream research quality is high.

## Proposed contract: `bo.order_gate.v1`
The gate should sit after strategy/Council decision generation and before broker/exchange adapters.

Required inputs:
- decision_id / strategy_id / model_version
- instrument / venue / side / order type / price / quantity
- current position and exposure snapshot
- account equity / available cash
- market-data freshness timestamp
- signal timestamp and expiry
- idempotency key
- paper/live environment flag

Initial deterministic checks:
1. max order notional
2. max position notional and concentration
3. max daily realized + unrealized loss
4. max order rate / duplicate-order rejection
5. stale signal / stale market-data rejection
6. price-deviation sanity band
7. allowed instrument / venue / order-type allowlist
8. live-mode explicit enable state
9. circuit-breaker state
10. idempotency and retry safety

The AI/LLM layer must not be able to override a failed hard gate. Override policy, if ever introduced, must be a separate authenticated control-plane action and auditable.

## Hypothesis
A deterministic independent order gate will block seeded erroneous/autonomous failure modes with negligible false rejects on a representative paper-trading workload, while preserving full causal linkage from rejected order back to decision and evidence lineage.

## EXP-EV006
Build a sandbox-only gate and replay normal paper orders plus seeded failures:
- 10x quantity error
- duplicate retry
- stale signal
- stale quote
- outlier limit price
- breached daily-loss state
- disallowed instrument
- rapid order burst
- adapter timeout followed by retry
- live flag accidentally enabled

### Success metrics
- 100% rejection of known hard-failure fixtures
- 0 duplicate executions in timeout/retry fixtures
- 100% rejected-order reason codes linked to decision_id
- zero live orders during the experiment
- false-reject rate measured separately on archived valid paper orders
- p95 gate latency recorded but never optimized by weakening controls

## Decision
**TEST.** Adopt the architecture only after sandbox and paper replay evidence exists. No production or paper-trading behavior is changed by this research entry.

## Risks / limitations
- Regulatory precedents are design references, not a legal determination for BO or Korean/crypto deployment.
- Static thresholds can themselves be badly calibrated; threshold values require account/venue-specific validation.
- A gate cannot repair a corrupted position/account state, so state reconciliation must be tested separately.
- Exchange/broker-native controls should be defense-in-depth, not a reason to remove BO-side controls.

## Traceability
Research EV-006 → EXP-EV006 → sandbox result → paper shadow result → ADOPT/REJECT/REVISIT → implementation PR, if justified.
