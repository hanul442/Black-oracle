# BLACK ORACLE Research Ledger

Last updated: 2026-09-20 — Cycle 006

| ID | Domain | Topic | Evidence | Status | Experiment | Production impact |
|---|---|---|---|---|---|---|
| D-001 | Design/Product | OpenBB shared dashboard context & persistent widgets | A (official docs) | TEST / REFERENCE | EXP-D001 | None |
| D-002 | Design | Accessible financial visualization gate | C precedent; verify against WCAG | TEST | EXP-D001 checklist | None |
| D-003 | Design | Accessible/mobile financial chart wrapper; Lightweight Charts precedent | A official docs | TEST / REFERENCE | EXP-D003 | None |
| AIML-001 | AI/ML + Quant | AlphaSeek trajectory-level factor lineage & redundancy | B | TEST | EXP-AIML001 | None |
| AIML-002 | AI/ML + Evidence | AI decision provenance / TEVV envelope for Council & Router | A process precedent | TEST / REFERENCE | EXP-AIML002 | None |
| AIML-003 | AI/ML + Infrastructure | Vendor-neutral Council/Router trace envelope with stable BO IDs | A- infrastructure precedent | TEST / REFERENCE | EXP-AIML003 | None |
| AIML-004 | AI/ML + Infrastructure | Two-tier GenAI trace envelope: metadata by default, sensitive content opt-in | A- official OTel precedent; evolving conventions | TEST / REFERENCE | EXP-AIML004 | None |
| AIML-005 | AI/ML + Quant | LLM executable Alpha Factory + multimodal factor screening | B+ peer-reviewed empirical paper; BO reproduction pending | TEST | EXP-AIML005 | None |
| AIML-006 | AI/ML + Evidence | Trading-firm-style Council topology: specialists → Bull/Bear → risk → portfolio approval | A- architecture/code precedent; performance evidence B | TEST / REFERENCE | EXP-AIML006 | None |
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
| Q-002 | Quant + AI/ML | Hierarchical RL / sentiment fusion and dynamic strategy aggregation | B empirical preprint; BO reproduction pending | TEST | EXP-Q002 | None |

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

### Snapshot-replay rule added in Cycle 005
Where licensing and storage economics permit, experiment manifests should be able to reference a retrievable immutable table/object snapshot, not only a mutable source URI and logical hash. Snapshot identity complements — and never replaces — point-in-time knowledge/availability semantics.

### Forecast-uncertainty rule added in Cycle 005
Forecast confidence is an evidence artifact, not an intrinsic property of a model score. Calibration method/version, calibration data identity, target coverage and empirical coverage/efficiency by horizon/regime should be separately traceable. Better calibration must not be interpreted as better alpha without a separate performance test.

### AI trace privacy rule added in Cycle 005
BLACK ORACLE internal decision/trace IDs remain canonical. External OpenTelemetry/GenAI conventions are versioned adapters. Model/tool metadata may be captured by default; full prompts, completions, tool arguments and tool results require an explicit capture policy because they may contain sensitive content.

### Alpha Factory rule added in Cycle 006
LLM-generated factors are research hypotheses, not strategies. Every generated, repaired, rejected and promoted candidate must remain attached to a trial-family ID, generator/config fingerprint, executable definition, point-in-time input contract and OOS result. Generation breadth must be treated as part of the multiple-testing budget.

### Council topology rule added in Cycle 006
Council structure is an experimental variable. Flat voting, specialist synthesis, Bull/Bear debate, risk veto and portfolio approval must be compared under matched evidence and inference budgets. More agents or longer debate are not considered improvements unless they measurably improve calibration, risk control, decision stability or auditability.

### Sentiment availability rule added in Cycle 006
Sentiment features must preserve publication time, availability/ingestion time, aggregation window, source coverage, duplicate handling and fallback behavior. Backtests must use what was actually knowable at the decision timestamp; sentiment accuracy does not excuse temporal contamination.

## Current queue
1. **EXP-DI001 + EXP-DI003** — implement the minimal `bo.experiment.v1` validator and point-in-time feature manifest; blind-replay a representative KRX experiment with seeded leakage.
2. **EXP-AIML005** — minimal Alpha Factory sandbox: typed factor DSL, full generated/rejected candidate accounting, leakage gates, redundancy analysis and untouched OOS evaluation.
3. **EXP-AIML006** — Council topology ablation: flat vote vs specialist synthesis vs Bull/Bear debate vs risk veto/portfolio approval under matched evidence.
4. **EXP-Q002** — hierarchical/dynamic Router benchmark: static weights vs hard routing vs soft dynamic weighting vs hierarchical aggregation, with point-in-time sentiment ablations.
5. **EXP-DI004** — compare mutable-source replay vs snapshot-addressable replay after a deliberate source correction; decide whether snapshot fields graduate into the canonical schema.
6. **EXP-EV001** — independent backtest reproducibility using the canonical record.
7. **EXP-EV003 / EXP-EV005** — reproduce DSR and PBO/CSCV examples, then test null vs stable-signal families with complete trial accounting.
8. **EXP-Q001** — archived-forecast conformal calibration benchmark: static vs adaptive vs regime-aware, scored by coverage and interval efficiency.
9. **EXP-EV004** — leakage-positive-control test; bind information horizons and exact split manifests into the canonical record.
10. **EXP-DI002** — instrument one KRX and one crypto data path with dataset/transformation lineage and seeded change-impact tests.
11. **EXP-AIML003 / AIML004 / AIML002** — trace/replay a sandbox Council/Router decision with stable BO IDs and compare metadata-only vs redacted/full-content policies.
12. **EXP-D003** — accessible/mobile financial-chart wrapper prototype.
13. **EXP-EV002** — robustness-gate prototype on archived candidates.
14. **EXP-D001** — shared context/persistent research-card UX prototype.
15. **EXP-AIML001** — lineage + redundancy sandbox after validation harness is trustworthy.

## Cycle 006 decision
Kou et al., TradingAgents, and HARLF materially strengthen the research rationale for BLACK ORACLE's Strategy Factory → Council → Router → Portfolio direction. The useful conclusion is architectural, not a performance claim.

Cycle 006 therefore adds three sandbox experiments:
- **EXP-AIML005** for executable LLM-generated alpha candidates with full research-budget accounting.
- **EXP-AIML006** for Council topology and adversarial/risk-review ablations.
- **EXP-Q002** for static vs dynamic vs hierarchical routing with point-in-time sentiment.

The strongest shared warning across the three references is that sophisticated agentic architecture cannot compensate for weak temporal integrity, hidden trial selection, or contaminated backtests. For that reason, **EXP-DI001 + EXP-DI003 remain the prerequisite and highest-priority engineering action**.

No production or paper-trading behavior was changed.

## Highest-priority next action
Implement **EXP-DI001 + EXP-DI003** first. Once the canonical experiment record and point-in-time manifest pass blind-replay/leakage fixtures, open **EXP-AIML005** as the first strategy-generation experiment. That sequence prevents a larger Alpha Factory search space from amplifying research debt before the evidence substrate can account for it.
