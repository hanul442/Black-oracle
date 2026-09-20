# BLACK ORACLE Research Ledger — Cycle 007 Delta

Date: 2026-09-21
Parent ledger: `docs/research/research-ledger/ledger.md` (Cycle 006)
Production/Paper impact: None

## New records

| ID | Domain | Topic | Evidence | Status | Experiment | Production impact |
|---|---|---|---|---|---|---|
| AIML-006 | AI/ML + Quant + Evidence | Council coordination ablation and budget-matched multi-agent evaluation | B recent finance studies/survey; BO-specific causal test required | TEST | EXP-AIML006 | None |
| D-005 | Design/UX + Evidence | Decision-dashboard progressive disclosure and audit hierarchy | A- official design-system precedent | TEST / REFERENCE | EXP-D005 | None |

## Research lineage

### AIML-006
Research: recent financial multi-agent work suggests coordination design and fine-grained task decomposition may materially affect results, while recent reproducibility audits show execution/evaluation assumptions are often underreported.

Hypothesis: a structured Council with explicit evidence handoff and disagreement-aware arbitration adds measurable value over simpler baselines after matching information, tools, model family and compute budget.

Experiment: EXP-AIML006 — single agent vs uncoordinated specialists vs structured Council vs structured Council + disagreement/NO TRADE, evaluated through the frozen EXP-AIML005 task suite.

Result: pending.

Decision: TEST. No Council expansion/promotion without ablation evidence.

### D-005
Research: official data-visualisation guidance warns that dashboards are best for high-level monitoring and can overload users when detailed interpretation is left to the default surface.

Hypothesis: a three-layer Decision → Why → Audit hierarchy improves mobile decision speed and evidence retrieval without reducing traceability versus an all-at-once dense dashboard.

Experiment: EXP-D005 — matched-data usability test measuring task completion, time, critical errors, evidence retrieval, stale-data detection, workload and accessibility failures.

Result: pending.

Decision: TEST / REFERENCE. Merge with D-003/D-004; do not create a parallel component stack.

## Cycle 007 rule additions

### Coordination-ablation rule
A Council or multi-agent architecture is not intrinsically superior to a single agent. Council topology, decomposition, handoffs, arbitration, disagreement policy and compute/tool budgets are versioned experimental variables. Promotion requires a matched-budget ablation against simpler baselines. PnL alone is insufficient; groundedness, calibration/abstention, cost, latency and failure modes must also be evaluated.

### Decision-surface rule
Default market/trading surfaces should optimize for the immediate decision, not maximum simultaneous information density. Evidence and diagnostics may progressively disclose, but freshness, uncertainty, counter-evidence and audit lineage must remain reachable and essential chart meaning must have a textual/non-colour equivalent.

## Queue impact
The Cycle 006 priority order remains intentionally stable. New research does not displace the validation bottleneck.

1. EXP-DI001 + EXP-DI003 — canonical experiment validator + point-in-time manifest + seeded-leakage blind replay.
2. EXP-DI004 — immutable snapshot replay.
3. EXP-EV001 + EXP-Q002 — engine reproducibility + execution-cost stress on the same fixture.
4. EXP-AIML005 — freeze 30–50 BO finance-agent tasks and establish current baseline.
5. EXP-AIML006 — only after AIML-005 baseline exists, run Council coordination ablation.
6. Existing EV/Q/lineage experiments retain their Cycle 006 ordering.
7. EXP-D003 + EXP-D004 + EXP-D005 — one combined mobile financial-chart/dashboard usability program.

## Cycle decision
Cycle 007 deliberately did not add another alpha generator. The new AI research converts 'more agents' from an architectural assumption into a falsifiable BO experiment. The design research converts dashboard density into a measurable decision-UX question. Neither changes production or paper-trading behavior.

## Highest-priority next action
Implement EXP-DI001 + EXP-DI003 before expanding the research queue. In parallel only if capacity permits, freeze the first EXP-AIML005 task set; AIML-006 cannot be interpreted credibly without that baseline.
