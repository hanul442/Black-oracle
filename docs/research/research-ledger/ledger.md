# BLACK ORACLE Research Ledger

Last updated: 2026-09-20 — Cycle 006

| ID | Domain | Topic | Evidence | Status | Experiment | Production impact |
|---|---|---|---|---|---|---|
| D-001 | Design/Product | OpenBB shared dashboard context & persistent widgets | A (official docs) | TEST / REFERENCE | EXP-D001 | None |
| D-002 | Design | Accessible financial visualization gate | C precedent; verify against WCAG | TEST | EXP-D001 checklist | None |
| D-003 | Design | Accessible/mobile financial chart wrapper; Lightweight Charts precedent | A official docs | TEST / REFERENCE | EXP-D003 | None |
| D-004 | Design | Evidence-first chart semantics: direct labels, non-color state, progressive disclosure | A- official design-system precedent | TEST / REFERENCE | EXP-D004 (integrate with D003) | None |
| AIML-001 | AI/ML + Quant | AlphaSeek trajectory-level factor lineage & redundancy | B | TEST | EXP-AIML001 | None |
| AIML-002 | AI/ML + Evidence | AI decision provenance / TEVV envelope for Council & Router | A process precedent | TEST / REFERENCE | EXP-AIML002 | None |
| AIML-003 | AI/ML + Infrastructure | Vendor-neutral Council/Router trace envelope with stable BO IDs | A- infrastructure precedent | TEST / REFERENCE | EXP-AIML003 | None |
| AIML-004 | AI/ML + Infrastructure | Two-tier GenAI trace envelope: metadata by default, sensitive content opt-in | A- official OTel precedent; evolving conventions | TEST / REFERENCE | EXP-AIML004 | None |
| AIML-005 | AI/ML + Product/Evidence | BO-specific financial-agent evaluation harness | B+ recent finance benchmarks + industry framework | TEST | EXP-AIML005 | None |
| DI-001 | Data Infrastructure + Evidence | Canonical `bo.experiment.v1` Experiment Ledger schema | A- infrastructure precedent; BO fields require test | ADOPT-SCHEMA-CANDIDATE | EXP-DI001 | None |
| DI-002 | Data Infrastructure | Dataset/run/feature lineage inspired by OpenLineage | A official spec precedent | TEST / REFERENCE | EXP-DI002 | None |
| DI-003 | Data Infrastructure + Evidence | Point-in-time feature availability contract | A- official implementation precedent | TEST | EXP-DI003 | None |
| DI-004 | Data Infrastructure + Evidence | Snapshot-addressable research data for blind replay | A- official DuckDB/Iceberg precedent | TEST / REFERENCE | EXP-DI004 | None |
| EV-001 | Evidence/Validation | Cross-engine backtest implementation risk | A- | TEST | EXP-EV001 | None |
| EV-002 | Evidence/Validation | Separate robustness evidence from performance ranking | B+ | TEST | EXP-EV002 | None |
| EV-003 | Evidence/Validation + Quant | Deflated Sharpe / multiple-testing and trial-family accounting | A- | TEST | EXP-EV003 | None |
| EV-004 | Evidence/Validation + Quant | Purged / embargoed temporal validation | B pending primary implementation review | TEST (method verification required) | EXP-EV004 | None |
| EV-005 | Evidence/Validation + Quant | Probability of Backtest Overfitting / CSCV + research-budget accounting | A- peer-reviewed methodology | TEST | EXP-EV005 | None |
| Q-001 | Quant + Evidence | Regime-aware/adaptive conformal uncertainty calibration | B recent theory + empirical preprint/benchmark | TEST | EXP-Q001 | None |
| Q-002 | Quant + Execution | Execution-cost model risk / nonlinear impact stress family | B recent preprint + open implementation | TEST | EXP-Q002 | None |

## Lineage rule
Every experiment result must link back to its research ID. An `ADOPT` decision requires recorded result evidence and implementation scope. `REJECT` must preserve the reason so the same idea is not repeatedly rediscovered. `REVISIT` must record the condition that would justify another test.

### Trial-family rule
Generated/rejected candidates must not disappear from the research record. Strategy/factor search should preserve enough metadata to reconstruct the search family, number of attempted candidates, parameter lineage, and OOS result. Promotion-only logging creates research survivorship bias and makes multiple-testing diagnostics unreliable.

### Canonical experiment rule
Validation experiments should converge on a versioned `bo.experiment.v1` record rather than creating separate incompatible ledgers. The candidate schema binds research/candidate identity to code/config fingerprints, dataset/source/schema identity, information horizons, exact split manifests, execution assumptions, output fingerprints, robustness diagnostics, AI decision traces, OOS results and append-only promotion decisions. The schema remains an **ADOPT-SCHEMA-CANDIDATE** until EXP-DI001 demonstrates replayability on representative archived experiments.

### Point-in-time feature rule
Dataset identity and split correctness do not prove that a feature was knowable at decision time. Decision-facing features should preserve event time and, where applicable, availability/knowledge time, revision identity, transform fingerprint and upstream snapshot lineage. Historical retrieval must be reproducible as-of the decision timestamp.

### Research-budget rule
Automated strategy/factor search must expose its effective research budget. Candidate counts, mutations, parameter variants, feature combinations and selection rounds remain part of the same research-family history. PBO/CSCV and DSR are complementary diagnostics and must not be collapsed into an opaque performance score.

### Snapshot-replay rule
Where licensing and storage economics permit, experiment manifests should be able to reference a retrievable immutable table/object snapshot, not only a mutable source URI and logical hash. Snapshot identity complements — and never replaces — point-in-time knowledge/availability semantics.

### Forecast-uncertainty rule
Forecast confidence is an evidence artifact, not an intrinsic property of a model score. Calibration method/version, calibration data identity, target coverage and empirical coverage/efficiency by horizon/regime should be separately traceable. Better calibration must not be interpreted as better alpha without a separate performance test.

### AI trace privacy rule
BLACK ORACLE internal decision/trace IDs remain canonical. External OpenTelemetry/GenAI conventions are versioned adapters. Model/tool metadata may be captured by default; full prompts, completions, tool arguments and tool results require an explicit capture policy because they may contain sensitive content.

### Agent-evaluation rule added in Cycle 006
Council/Research/Router changes must not be promoted from anecdotal demos alone. Evaluation should use versioned BO-specific finance tasks, frozen information cutoffs, explicit allowed tools, objective graders where possible, versioned rubrics/judges where necessary, execution traces, and quality/cost/latency regression reporting. External benchmark leaderboards are references, not production model-selection rules.

### Execution-model rule added in Cycle 006
Execution assumptions are a versioned model family, not a single fee scalar. Strategy evidence should identify fee, spread, slippage, impact, fill, latency, liquidity/participation and venue/session assumptions, and promotion should inspect robustness across transparent execution-cost stresses before paper/live use.

## Current queue
1. **EXP-DI001 + EXP-DI003** — implement minimal `bo.experiment.v1` validator and point-in-time feature manifest; blind-replay a representative KRX experiment with seeded leakage.
2. **EXP-DI004** — compare mutable-source replay vs snapshot-addressable replay after deliberate source correction.
3. **EXP-EV001 + EXP-Q002** — run independent backtest reproducibility and execution-cost stress on the same representative strategies so engine risk and cost-model risk are measured separately.
4. **EXP-AIML005** — build a 30–50 task BO finance-agent regression suite from archived Council/Research workflows; baseline current configuration before changing models/prompts/tools.
5. **EXP-EV003 / EXP-EV005** — reproduce DSR and PBO/CSCV examples, then test null vs stable-signal families with complete trial accounting.
6. **EXP-Q001** — archived-forecast conformal calibration benchmark.
7. **EXP-EV004** — leakage-positive-control test; bind information horizons and exact split manifests into canonical record.
8. **EXP-DI002** — instrument one KRX and one crypto data path with lineage and seeded change-impact tests.
9. **EXP-AIML003 / AIML004 / AIML002** — trace/replay sandbox Council/Router decisions.
10. **EXP-D003 + EXP-D004** — one accessible/mobile chart wrapper plus semantic-contract usability test; do not create parallel chart stacks.
11. **EXP-EV002** — robustness-gate prototype on archived candidates.
12. **EXP-D001** — shared context/persistent research-card UX prototype.
13. **EXP-AIML001** — lineage + redundancy sandbox after validation harness is trustworthy.

## Cycle 006 decision
Three gaps were added without introducing another alpha generator. AIML-005 establishes a BO-specific regression harness for financial agents because recent benchmarks consistently show that tool access, task design, traceability, groundedness and evaluation harnesses materially affect agent quality. Q-002 makes execution-cost assumptions explicit because recent work shows nonlinear impact/cost models can change strategy behavior and rankings. D-004 turns chart accessibility into a semantic policy rather than a component-only concern.

No external leaderboard is treated as a model recommendation, no execution-impact parameters are copied into live assumptions, and D-004 is folded into the existing BOFinancialChart work instead of spawning a duplicate component system.

No production or paper-trading behavior was changed.

## Highest-priority next action
Do not let the research queue outrun implementation. Execute **EXP-DI001 + EXP-DI003** first. Once the canonical replay fixture exists, use the same fixture to attach Q-002 execution-model manifests and EV-001 engine comparisons. In parallel only if capacity permits, freeze the first 30 BO agent-evaluation tasks for EXP-AIML005 so future Council/Router changes have a regression baseline.