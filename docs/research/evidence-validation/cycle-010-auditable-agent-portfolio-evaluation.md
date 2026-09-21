# Cycle 010 — Auditable Portfolio-Agent Evaluation

Date: 2026-09-22
Research ID: EV-007
Status: TEST / REFERENCE
Production impact: None

## Research question
Can BLACK ORACLE turn its existing point-in-time, execution-cost, constraint and agent-evaluation work into a single per-run audit bundle that makes an agent portfolio decision independently inspectable and replayable?

## New material reviewed
### OpenPM: Auditable Point-in-Time Evaluation for LLM Portfolio-Management Agents (Cai et al., 2026)
Evidence quality: **B+** — recent arXiv research with released code/data and explicit audit artifacts; useful engineering benchmark, but the reported portfolio result is a short frozen window, excludes market impact and is explicitly not validated alpha.

OpenPM combines several controls that BLACK ORACLE currently tracks as separate research threads: strict point-in-time information availability, typed/enforced risk constraints, cost sensitivity, frozen evidence for model comparison, and per-run audit artifacts. Its released benchmark uses a content-hashed freeze and provenance archives. The most relevant design contribution is not its strategy result but the idea that every portfolio-agent run should emit a compact, machine-checkable evidence package.

## Comparison with current BLACK ORACLE architecture
BLACK ORACLE already has stronger or adjacent primitives under DI-001 (`bo.experiment.v1`), DI-003 (point-in-time availability), DI-004 (snapshot replay), Q-002 (execution-cost model risk), EV-006 (`bo.order_gate.v1`) and AIML-005/006/007 (agent evaluation and Council ablations). The remaining gap is **integration evidence**: these controls can pass independently while a portfolio-agent run still lacks one canonical artifact proving that the exact information set, constraints, execution assumptions and decisions belonged to the same run.

OpenPM therefore does **not** justify replacing BO's architecture. It provides a useful reference for bundling evidence and for freezing upstream analyst evidence when comparing downstream constructors/routers.

## Gap
No current BO research item explicitly requires a promotion candidate to emit a single signed/content-addressed audit bundle containing:

- experiment/run identity and code/config hashes;
- point-in-time contamination result;
- dataset/snapshot and feature-manifest identity;
- typed mandate/constraint set plus adherence report;
- execution-cost sensitivity curve/model IDs;
- order-gate decisions/rejections where applicable;
- Council/agent evidence snapshot and dependency manifest;
- realized turnover/exposure metrics;
- result hashes and replay pointers.

Without this bundle, evidence can be individually present but operationally fragmented.

## Hypothesis H-EV007
If every candidate portfolio-agent run emits a canonical `bo.audit_bundle.v1`, an independent reviewer should be able to reconstruct the decision information set, verify hard constraints and identify contamination/cost assumptions without reading ad-hoc logs or relying on the original operator.

## Experiment EXP-EV007
Use one archived KRX research run after EXP-DI001/DI003 establishes the validator baseline.

1. Generate a normal run using `bo.experiment.v1` and point-in-time manifest.
2. Emit `bo.audit_bundle.v1` referencing immutable artifacts rather than duplicating raw data.
3. Seed four failure classes in separate fixtures: future-information contamination, mandate violation, optimistic transaction-cost assumption, and mismatched evidence/run ID.
4. Give the bundle plus referenced immutable artifacts to a blind replay/review path with no access to the original operator's working notes.
5. Verify whether each seeded failure is detected and whether the clean run can be reconstructed.
6. Repeat a constructor/router comparison while freezing the analyst evidence snapshot so downstream model effects are isolated from upstream evidence variation.

## Proposed success metrics
- Seeded hard-failure detection: **100%** for the defined positive-control fixtures.
- Clean-run false rejection: **0** in the initial fixture set.
- Required artifact/reference completeness: **100%**.
- Constraint reconstruction: exact typed constraint set and pass/fail outcomes reproduced.
- Decision-time information reconstruction: all decision-facing records resolve to point-in-time-valid versions.
- Replay identity: deterministic artifacts/metrics match expected hashes where determinism is required; nondeterministic agent outputs retain trace/model/prompt/evidence identities sufficient for audit.
- Reviewer dependence on ad-hoc notes: **0 required fields**.

These are engineering acceptance criteria for the fixture, not claims about investment performance.

## Proposed implementation path
`bo.audit_bundle.v1` should be a thin manifest over existing BO canonical IDs, not a second ledger. Suggested sections:

`identity -> data_snapshot -> point_in_time_certificate -> evidence_snapshot -> model_agent_dependency -> mandate_constraints -> execution_model -> order_gate -> portfolio_exposure_turnover -> result_artifacts -> replay`

Use content hashes and immutable references where possible. Keep BO IDs canonical; external benchmark formats are adapters/references only. The bundle should be generated automatically at experiment close and fail closed for promotion when mandatory sections are missing.

## Risks / non-adoption conditions
- Duplicating DI-001 rather than referencing it would create schema drift.
- A certificate can create false confidence if its checks are incomplete; every certificate must identify validator version and tested invariants.
- OpenPM's short-window, long-only S&P 500 results and absence of market impact are not transferable evidence for BO alpha or KRX/crypto execution.
- Freezing analyst evidence is appropriate for controlled constructor ablations, but not for claims about full end-to-end live performance.
- Do not make this a production trading dependency until replay fixtures are stable; initial scope is research/paper/shadow evidence only.

## Decision
**TEST / REFERENCE.** Adopt the *audit-bundle hypothesis* into the validation queue, not OpenPM's strategy, parameters, portfolio universe or reported returns.

## Traceability
EV-007 -> H-EV007 -> EXP-EV007 -> pending result -> ADOPT / REJECT / REVISIT.

EV-007 depends on EXP-DI001 + EXP-DI003 for canonical replay and should reuse Q-002, EV-006 and AIML-005/007 artifacts rather than reimplementing them.

## Sources
- Cai et al. (2026), *OpenPM: Auditable Point-in-Time Evaluation for LLM Portfolio-Management Agents*, arXiv:2608.09988.
- OpenPM-Bench released dataset/code documentation: content-hashed freeze, provenance archives and point-in-time benchmark layers.
- Feast official feature-view / schema-validation documentation was reviewed as supporting infrastructure reference; its schema checks are useful but are not a substitute for BO's temporal contamination checks.

## Production safety
No external strategy, threshold, model, portfolio weight or trading parameter is adopted. No production or paper-trading behavior is changed in Cycle 010.