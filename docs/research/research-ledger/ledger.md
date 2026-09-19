# BLACK ORACLE Research Ledger

Last updated: 2026-09-20 — Cycle 004

| ID | Domain | Topic | Evidence | Status | Experiment | Production impact |
|---|---|---|---|---|---|---|
| D-001 | Design/Product | OpenBB shared dashboard context & persistent widgets | A (official docs) | TEST / REFERENCE | EXP-D001 | None |
| D-002 | Design | Accessible financial visualization gate | C precedent; verify against WCAG | TEST | EXP-D001 checklist | None |
| D-003 | Design | Accessible/mobile financial chart wrapper; Lightweight Charts precedent | A official docs | TEST / REFERENCE | EXP-D003 | None |
| AIML-001 | AI/ML + Quant | AlphaSeek trajectory-level factor lineage & redundancy | B | TEST | EXP-AIML001 | None |
| AIML-002 | AI/ML + Evidence | AI decision provenance / TEVV envelope for Council & Router | A process precedent | TEST / REFERENCE | EXP-AIML002 | None |
| AIML-003 | AI/ML + Infrastructure | Vendor-neutral Council/Router trace envelope with stable BO IDs | A- infrastructure precedent | TEST / REFERENCE | EXP-AIML003 | None |
| DI-001 | Data Infrastructure + Evidence | Canonical `bo.experiment.v1` Experiment Ledger schema | A- infrastructure precedent; BO fields require test | ADOPT-SCHEMA-CANDIDATE | EXP-DI001 | None |
| DI-002 | Data Infrastructure | Dataset/run/feature lineage inspired by OpenLineage | A official spec precedent | TEST / REFERENCE | EXP-DI002 | None |
| DI-003 | Data Infrastructure + Evidence | Point-in-time feature availability contract | A- official implementation precedent | TEST | EXP-DI003 | None |
| EV-001 | Evidence/Validation | Cross-engine backtest implementation risk | A- | TEST | EXP-EV001 | None |
| EV-002 | Evidence/Validation | Separate robustness evidence from performance ranking | B+ | TEST | EXP-EV002 | None |
| EV-003 | Evidence/Validation + Quant | Deflated Sharpe / multiple-testing and trial-family accounting | A- | TEST | EXP-EV003 | None |
| EV-004 | Evidence/Validation + Quant | Purged / embargoed temporal validation | B pending primary implementation review | TEST (method verification required) | EXP-EV004 | None |
| EV-005 | Evidence/Validation + Quant | Probability of Backtest Overfitting / CSCV + research-budget accounting | A- peer-reviewed methodology | TEST | EXP-EV005 | None |

## Lineage rule

Every experiment result must link back to its research ID. An `ADOPT` decision requires recorded result evidence and implementation scope. `REJECT` must preserve the reason so the same idea is not repeatedly rediscovered. `REVISIT` must record the condition that would justify another test.

### Trial-family rule

Generated/rejected candidates must not disappear from the research record. Strategy/factor search should preserve enough metadata to reconstruct the search family, number of attempted candidates, parameter lineage, and OOS result. Promotion-only logging creates research survivorship bias and makes multiple-testing diagnostics unreliable.

### Canonical experiment rule

Validation experiments should converge on a versioned `bo.experiment.v1` record rather than creating separate incompatible ledgers. The candidate schema binds research/candidate identity to code/config fingerprints, dataset/source/schema identity, information horizons, exact split manifests, execution assumptions, output fingerprints, robustness diagnostics, AI decision traces, OOS results and append-only promotion decisions. The schema remains an **ADOPT-SCHEMA-CANDIDATE** until EXP-DI001 demonstrates replayability on representative archived experiments.

### Point-in-time feature rule added in Cycle 004

Dataset identity and split correctness do not prove that a feature was knowable at decision time. Decision-facing features should preserve event time and, where applicable, availability/knowledge time, revision identity, transform fingerprint and upstream snapshot lineage. Historical retrieval must be reproducible as-of the decision timestamp.

### Research-budget rule added in Cycle 004

Automated strategy/factor search must expose its effective research budget. Candidate counts, mutations, parameter variants, feature combinations and selection rounds remain part of the same research-family history. PBO/CSCV and DSR are complementary diagnostics and must not be collapsed into an opaque performance score.

## Current queue

1. **EXP-DI001** — implement a minimal `bo.experiment.v1` validator; backfill and independently replay four representative archived experiments.
2. **EXP-DI003** — point-in-time feature fixture with KRX + crypto; seed future, delayed, revised and session-boundary leakage cases.
3. **EXP-EV001** — independent backtest reproducibility using the canonical record.
4. **EXP-EV003 / EXP-EV005** — reproduce published DSR and PBO/CSCV examples, then test null vs stable-signal families with complete trial accounting.
5. **EXP-EV004** — leakage-positive-control test; bind information horizons and exact split manifests into the canonical record.
6. **EXP-DI002** — instrument one KRX and one crypto data path with dataset/transformation lineage and seeded change-impact tests.
7. **EXP-AIML003 / AIML002** — trace/replay a sandbox Council/Router decision using stable BO trace IDs and vendor-neutral adapters.
8. **EXP-D003** — accessible/mobile financial-chart wrapper prototype.
9. **EXP-EV002** — robustness-gate prototype on archived candidates; integrate diagnostics without creating a competing alpha score.
10. **EXP-D001** — shared context/persistent research-card UX prototype.
11. **EXP-AIML001** — lineage + redundancy sandbox after validation harness is trustworthy.

## Cycle 004 decision

The highest-value new gap is **causal data availability**, not another strategy generator. Feast's point-in-time join model is useful infrastructure precedent, but BO needs market-specific availability/revision/session semantics. Separately, Bailey et al.'s PBO/CSCV methodology is promoted to a formal TEST candidate because Strategy Factory search makes family-level selection overfit a first-class risk. On the UI side, TradingView Lightweight Charts is a credible prototype candidate, but BO should wrap it behind its own chart contract because accessibility semantics require explicit integration and licensing/attribution differs from TradingView's non-open-source chart products.

OpenTelemetry GenAI conventions were rechecked during this cycle. Current external reporting indicates the GenAI-specific convention surface remains in Development after moving to a dedicated repository in 2026. This reinforces the existing AIML-003 decision: keep stable BLACK ORACLE trace IDs and isolate external semantic-convention mappings behind versioned adapters rather than making BO's evidence schema depend on unstable field names.

No production or paper-trading behavior was changed.

## Highest-priority next action

Implement **EXP-DI001 + EXP-DI003 as one validation substrate**: a minimal `bo.experiment.v1` validator plus point-in-time feature manifest, then replay one representative KRX experiment with deliberately seeded leakage. This directly tests whether BLACK ORACLE can prove not only what dataset it used, but what information was actually knowable at the historical decision timestamp.
