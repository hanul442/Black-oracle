# BLACK ORACLE Research Ledger

Last updated: 2026-09-19 — Cycle 002

| ID | Domain | Topic | Evidence | Status | Experiment | Production impact |
|---|---|---|---|---|---|---|
| D-001 | Design/Product | OpenBB shared dashboard context & persistent widgets | A (official docs) | TEST / REFERENCE | EXP-D001 | None |
| D-002 | Design | Accessible financial visualization gate | C precedent; verify against WCAG | TEST | EXP-D001 checklist | None |
| AIML-001 | AI/ML + Quant | AlphaSeek trajectory-level factor lineage & redundancy | B | TEST | EXP-AIML001 | None |
| AIML-002 | AI/ML + Evidence | AI decision provenance / TEVV envelope for Council & Router | A process precedent | TEST / REFERENCE | EXP-AIML002 | None |
| EV-001 | Evidence/Validation | Cross-engine backtest implementation risk | A- | TEST | EXP-EV001 | None |
| EV-002 | Evidence/Validation | Separate robustness evidence from performance ranking | B+ | TEST | EXP-EV002 | None |
| EV-003 | Evidence/Validation + Quant | Deflated Sharpe / multiple-testing and trial-family accounting | A- | TEST | EXP-EV003 | None |
| EV-004 | Evidence/Validation + Quant | Purged / embargoed temporal validation | B pending primary implementation review | TEST (method verification required) | EXP-EV004 | None |

## Lineage rule

Every experiment result must link back to its research ID. An `ADOPT` decision requires recorded result evidence and implementation scope. `REJECT` must preserve the reason so the same idea is not repeatedly rediscovered. `REVISIT` must record the condition that would justify another test.

### Trial-family rule added in Cycle 002

Generated/rejected candidates must not disappear from the research record. Strategy/factor search should preserve enough metadata to reconstruct the search family, number of attempted candidates, parameter lineage, and OOS result. Promotion-only logging creates research survivorship bias and makes multiple-testing diagnostics unreliable.

## Current queue

1. **EXP-EV001** — independent backtest reproducibility harness.
2. **EXP-EV003** — trial-family accounting + DSR diagnostic, verified against published numerical examples before BO use.
3. **EXP-EV004** — leakage-positive-control test for purged/embargoed temporal validation.
4. **EXP-EV002** — robustness-gate prototype on archived candidates; integrate EV-003 rather than creating a competing score.
5. **EXP-AIML002** — Council/Router decision-provenance replay sandbox.
6. **EXP-D001** — shared context/persistent research-card UX prototype.
7. **EXP-AIML001** — lineage + redundancy sandbox after validation harness is trustworthy.

## Cycle 002 decision

The previous evidence-validation write bottleneck is resolved: `docs/research/evidence-validation/cycle-002-selection-bias-and-ai-governance.md` now contains the dedicated validation review. No production or paper-trading behavior was changed.

## Highest-priority next action

Implement the **validation specification before strategy-search acceleration**: define the canonical Experiment Ledger schema needed by EV-001/003/004, including research-family lineage, sample/information horizons, return-series fingerprints, execution assumptions, and OOS result linkage. This schema is the common dependency for reproducibility, leakage control, and multiple-testing evidence.
