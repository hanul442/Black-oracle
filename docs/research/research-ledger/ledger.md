# BLACK ORACLE Research Ledger

Last updated: 2026-09-22 — Cycle 011

| ID | Domain | Topic | Evidence | Status | Experiment | Production impact |
|---|---|---|---|---|---|---|
| D-001 | Design/Product | OpenBB shared dashboard context & persistent widgets | A official docs | TEST / REFERENCE | EXP-D001 | None |
| D-002 | Design | Accessible financial visualization gate | C precedent; verify against WCAG | TEST | EXP-D001 checklist | None |
| D-003 | Design | Accessible/mobile financial chart wrapper | A official docs | TEST / REFERENCE | EXP-D003 | None |
| D-004 | Design | Evidence-first chart semantics | A- design-system precedent | TEST / REFERENCE | EXP-D004 | None |
| D-005 | Design | Decision-dashboard progressive disclosure | A- authoritative design precedent | TEST / REFERENCE | EXP-D005 | None |
| AIML-001 | AI/ML + Quant | Factor lineage & redundancy | B | TEST | EXP-AIML001 | None |
| AIML-002 | AI/ML + Evidence | AI decision provenance / TEVV envelope | A process precedent | TEST / REFERENCE | EXP-AIML002 | None |
| AIML-003 | AI/ML + Infrastructure | Vendor-neutral Council/Router trace envelope | A- | TEST / REFERENCE | EXP-AIML003 | None |
| AIML-004 | AI/ML + Infrastructure | Two-tier GenAI trace envelope | A- | TEST / REFERENCE | EXP-AIML004 | None |
| AIML-005 | AI/ML + Product/Evidence | BO-specific financial-agent evaluation harness | B+ | TEST | EXP-AIML005 | None |
| AIML-006 | AI/ML + Evidence | Council coordination ablation: single vs multi-agent protocols | B | TEST | EXP-AIML006 | None |
| AIML-007 | AI/ML + Evidence | Common-mode model/provider/data/tool dependency risk | A- institutional risk precedent | TEST / REFERENCE | EXP-AIML007 | None |
| DI-001 | Data Infrastructure + Evidence | Canonical `bo.experiment.v1` schema | A- precedent; BO fields require test | ADOPT-SCHEMA-CANDIDATE | EXP-DI001 | None |
| DI-002 | Data Infrastructure | Dataset/run/feature lineage | A official spec precedent | TEST / REFERENCE | EXP-DI002 | None |
| DI-003 | Data Infrastructure + Evidence | Point-in-time feature availability contract | A- | TEST | EXP-DI003 | None |
| DI-004 | Data Infrastructure + Evidence | Snapshot-addressable research data | A- | TEST / REFERENCE | EXP-DI004 | None |
| EV-001 | Evidence/Validation | Cross-engine backtest implementation risk | A- | TEST | EXP-EV001 | None |
| EV-002 | Evidence/Validation | Separate robustness evidence from performance ranking | B+ | TEST | EXP-EV002 | None |
| EV-003 | Evidence/Validation + Quant | Deflated Sharpe / multiple-testing accounting | A- | TEST | EXP-EV003 | None |
| EV-004 | Evidence/Validation + Quant | Purged / embargoed temporal validation | B pending primary implementation review | TEST | EXP-EV004 | None |
| EV-005 | Evidence/Validation + Quant | PBO / CSCV + research-budget accounting | A- peer-reviewed | TEST | EXP-EV005 | None |
| EV-006 | Evidence/Validation + Autotrade | Independent deterministic pre-trade order gate / bounded autonomy | A regulatory precedent + B conceptual agentic-finance evidence | TEST | EXP-EV006 | None |
| EV-007 | Evidence/Validation + AI/ML | Canonical per-run portfolio-agent audit bundle | B+ recent research + released benchmark artifacts | TEST / REFERENCE | EXP-EV007 | None |
| Q-001 | Quant + Evidence | Regime-aware/adaptive conformal uncertainty | B | TEST | EXP-Q001 | None |
| Q-002 | Quant + Execution | Execution-cost model risk | B | TEST | EXP-Q002 | None |
| Q-003 | Quant + Evidence | Market-neutrality intent vs measured realized exposure constraints | B+ peer-reviewed recent paper | REFERENCE / TEST | EXP-Q003 | None |
| Q-004 | Quant + Execution | Cross-strategy intent netting and cooperative transaction-cost coordination | B+ Stanford optimization manuscript/code precedent | TEST / REFERENCE | EXP-Q004 | None |

## Core lineage rules
Every experiment result links to its research ID. `ADOPT` requires recorded result evidence and implementation scope. `REJECT` preserves the reason; `REVISIT` records the condition for another test. Generated/rejected candidates remain in the trial-family history so multiple-testing diagnostics remain meaningful.

`bo.experiment.v1` remains an **ADOPT-SCHEMA-CANDIDATE** until EXP-DI001 demonstrates replayability. Decision-facing features preserve point-in-time availability/knowledge semantics and, where possible, immutable snapshot identity. Forecast calibration remains separate from alpha performance. AI trace IDs remain BO-canonical with external telemetry as adapters. Agent changes require versioned BO-specific evaluation tasks. Execution assumptions are a versioned model family rather than a single fee scalar.

### Bounded-autonomy rule added in Cycle 008
A strategy, Council, router or LLM may propose an order but must not possess authority to bypass deterministic execution safety controls. Live-capable orders must traverse a separately testable pre-trade gate with explicit exposure, loss, freshness, duplication, price/size, instrument/venue and circuit-breaker checks. Gate failures are evidence artifacts linked to the originating decision. Broker/exchange controls are defense-in-depth rather than substitutes for BO-side controls.

### Strategy-property verification rule added in Cycle 008
Names such as `market_neutral`, `hedged`, `low_beta` or `defensive` are hypotheses, not evidence. Promotion should separately measure realized exposure/constraint compliance across OOS windows and regimes, and keep that evidence distinct from return performance.

### Failure-domain diversity rule added in Cycle 009
Agent-role diversity is not assumed to equal resilience. Council evaluation must record relevant model/provider/data/retrieval/tool dependencies and measure correlated error, false consensus and fault tolerance. Diversity is promotable only when controlled tests show resilience gains net of accuracy, latency, cost, privacy and operational-complexity regressions. Deterministic execution safety remains independent of Council consensus.

### Audit-bundle rule added in Cycle 010
Passing controls in isolation is insufficient for promotion. A portfolio-agent candidate should eventually emit one content-addressed `bo.audit_bundle.v1` that references the exact experiment identity, point-in-time certificate, immutable data/evidence snapshot, typed constraints and adherence, execution assumptions/cost sensitivity, agent dependency trace, order-gate evidence where applicable, exposures/turnover, result artifacts and replay pointers. The bundle is a manifest over canonical BO artifacts, not a second ledger. Validator versions and tested invariants must be explicit so a certificate cannot imply checks that were never performed.

### Cross-strategy execution rule added in Cycle 011
Strategy sleeves may generate independent immutable order intents, but simultaneous economically offsetting intents should be evaluated for portfolio-level netting before external execution. Netting/coordination is upstream of and cannot bypass `bo.order_gate.v1`. Original intent, coordinated external proposal, sleeve-level virtual allocation and final fill attribution must remain replayable. Simple one-shot netting is the baseline; iterative cost-feedback coordination is a challenger that must demonstrate incremental value net of latency, model risk and operational complexity.

## Current queue
1. **EXP-DI001 + EXP-DI003** — implement minimal `bo.experiment.v1` validator and point-in-time feature manifest; blind-replay a representative KRX experiment with seeded leakage.
2. **EXP-EV006** — implement sandbox-only `bo.order_gate.v1`; replay valid paper orders plus seeded quantity, duplicate, stale-data, outlier-price, loss-limit and retry failures. No live orders.
3. **EXP-EV007** — once DI001/DI003 fixtures exist, generate `bo.audit_bundle.v1` for the same KRX run and require blind reconstruction plus detection of seeded contamination, constraint, cost and run/evidence-ID failures.
4. **EXP-Q004** — on archived/paper multi-strategy intents, compare independent execution vs one-shot netting; only then test iterative cost-feedback coordination. Preserve sleeve attribution and route every external proposal through EV006.
5. **EXP-DI004** — mutable-source vs snapshot-addressable replay after deliberate source correction.
6. **EXP-EV001 + EXP-Q002** — independent backtest reproducibility and execution-cost stress on the same strategies.
7. **EXP-AIML005 + EXP-AIML006 + EXP-AIML007** — freeze 30–50 BO finance-agent tasks, baseline current configuration, ablate Council coordination under equal budgets, then inject common-mode model/provider/data/tool failures and measure false consensus/error correlation.
8. **EXP-EV003 / EXP-EV005** — DSR and PBO/CSCV positive/negative controls with complete trial accounting.
9. **EXP-Q003** — verify realized exposure constraints for neutral/hedged candidate strategies; do not adopt the external DRL strategy.
10. **EXP-Q001 / EXP-EV004 / EXP-DI002** — calibration, leakage-positive controls and lineage instrumentation.
11. **EXP-AIML002/003/004** — Council/Router trace-replay sandbox.
12. **EXP-D003 + EXP-D004 + EXP-D005 + EXP-D001** — chart semantics/accessibility, progressive disclosure and shared-context UX after core validation infrastructure.
13. **EXP-EV002 / EXP-AIML001** — robustness gate and strategy lineage/redundancy once the validation harness is trustworthy.

## Cycle 011 decision
The research scan reviewed recent portfolio optimization/transaction-cost work, uncertainty/XAI visualization work, and market/data/agent themes. Most findings overlapped existing Q-001/Q-002/D-003–D-005/AIML work and were not added merely to increase the ledger. One non-duplicative execution-architecture gap was promoted: BO can have multiple strategy sleeves simultaneously propose offsetting trades, yet the current research architecture does not explicitly test portfolio-level intent netting before broker execution.

The 2026 Stanford work by Devanathan, Bell, Rueter and Boyd is retained as a strong optimization precedent for multi-manager transaction-cost coordination. BLACK ORACLE will first test the simpler and more auditable baseline—one-shot intent netting—and treat iterative distributed cost feedback as a challenger. No external cost parameters, portfolio rules or performance claims are copied.

Cycle 011 also repaired a ledger omission: D-005 existed as a Cycle 007 research document but was missing from the central table/queue. It is now indexed without changing its prior TEST / REFERENCE decision.

No production or paper-trading behavior was changed.

## Highest-priority next action
Implementation still outranks additional literature accumulation. Execute **EXP-DI001 + EXP-DI003** first. Then implement **EXP-EV006 `bo.order_gate.v1` in sandbox**, because Q-004's external-order path depends on that safety boundary. Once archived multi-strategy order intents are available, run **EXP-Q004 condition A vs B (independent vs one-shot netting)** before spending engineering effort on iterative cooperative optimization.