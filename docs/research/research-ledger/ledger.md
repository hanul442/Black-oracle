# BLACK ORACLE Research Ledger

Last updated: 2026-09-19 — Cycle 003

| ID | Domain | Topic | Evidence | Status | Experiment | Production impact |
|---|---|---|---|---|---|---|
| D-001 | Design/Product | OpenBB shared dashboard context & persistent widgets | A (official docs) | TEST / REFERENCE | EXP-D001 | None |
| D-002 | Design | Accessible financial visualization gate | C precedent; verify against WCAG | TEST | EXP-D001 checklist | None |
| AIML-001 | AI/ML + Quant | AlphaSeek trajectory-level factor lineage & redundancy | B | TEST | EXP-AIML001 | None |
| AIML-002 | AI/ML + Evidence | AI decision provenance / TEVV envelope for Council & Router | A process precedent | TEST / REFERENCE | EXP-AIML002 | None |
| AIML-003 | AI/ML + Infrastructure | Vendor-neutral Council/Router trace envelope with stable BO IDs | A- infrastructure precedent | TEST / REFERENCE | EXP-AIML003 | None |
| DI-001 | Data Infrastructure + Evidence | Canonical `bo.experiment.v1` Experiment Ledger schema | A- infrastructure precedent; BO fields require test | ADOPT-SCHEMA-CANDIDATE | EXP-DI001 | None |
| DI-002 | Data Infrastructure | Dataset/run/feature lineage inspired by OpenLineage | A official spec precedent | TEST / REFERENCE | EXP-DI002 | None |
| EV-001 | Evidence/Validation | Cross-engine backtest implementation risk | A- | TEST | EXP-EV001 | None |
| EV-002 | Evidence/Validation | Separate robustness evidence from performance ranking | B+ | TEST | EXP-EV002 | None |
| EV-003 | Evidence/Validation + Quant | Deflated Sharpe / multiple-testing and trial-family accounting | A- | TEST | EXP-EV003 | None |
| EV-004 | Evidence/Validation + Quant | Purged / embargoed temporal validation | B pending primary implementation review | TEST (method verification required) | EXP-EV004 | None |

## Lineage rule

Every experiment result must link back to its research ID. An `ADOPT` decision requires recorded result evidence and implementation scope. `REJECT` must preserve the reason so the same idea is not repeatedly rediscovered. `REVISIT` must record the condition that would justify another test.

### Trial-family rule added in Cycle 002

Generated/rejected candidates must not disappear from the research record. Strategy/factor search should preserve enough metadata to reconstruct the search family, number of attempted candidates, parameter lineage, and OOS result. Promotion-only logging creates research survivorship bias and makes multiple-testing diagnostics unreliable.

### Canonical experiment rule added in Cycle 003

Validation experiments should converge on a versioned `bo.experiment.v1` record rather than creating separate incompatible ledgers. The candidate schema binds research/candidate identity to code/config fingerprints, dataset/source/schema identity, information horizons, exact split manifests, execution assumptions, output fingerprints, robustness diagnostics, AI decision traces, OOS results and append-only promotion decisions. The schema remains an **ADOPT-SCHEMA-CANDIDATE** until EXP-DI001 demonstrates replayability on representative archived experiments.

## Current queue

1. **EXP-DI001** — implement a minimal `bo.experiment.v1` validator; backfill and independently replay four representative archived experiments.
2. **EXP-EV001** — run independent backtest reproducibility using the canonical record rather than ad-hoc metadata.
3. **EXP-EV003** — trial-family accounting + DSR diagnostic, verified against published numerical examples before BO use.
4. **EXP-EV004** — leakage-positive-control test; bind information horizons and exact split manifests into the canonical record.
5. **EXP-DI002** — instrument one KRX and one crypto data path with dataset/transformation lineage and seeded change-impact tests.
6. **EXP-AIML003 / AIML002** — trace/replay a sandbox Council/Router decision using stable BO trace IDs and vendor-neutral adapters.
7. **EXP-EV002** — robustness-gate prototype on archived candidates; integrate EV-003 rather than creating a competing score.
8. **EXP-D001** — shared context/persistent research-card UX prototype.
9. **EXP-AIML001** — lineage + redundancy sandbox after validation harness is trustworthy.

## Cycle 003 decision

The common dependency from Cycle 002 has been converted into a concrete schema candidate. MLflow dataset/run tracking, OpenLineage run/dataset lineage, and OpenTelemetry-compatible AI tracing were used as infrastructure precedents, but BLACK ORACLE will not couple its evidence model directly to any one external backend. Dataset digests alone are insufficient for market research: BO also needs source snapshots, feature-schema fingerprints, canonical-instrument mapping versions, information horizons, exact split manifests and execution assumptions. AI traces should store a stable internal `decision_trace_id` with adapter/convention versioning and default to references/hashes rather than unrestricted raw prompt/tool payload retention.

No production or paper-trading behavior was changed.

## Highest-priority next action

Implement and test the **minimal `bo.experiment.v1` validator + replay fixture**. Backfill one rule-based strategy, one supervised signal, one regime model and one Council/Router-assisted decision. Do not accelerate Strategy Factory search until the validation substrate can reconstruct these cases with low ambiguity.
