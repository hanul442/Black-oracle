# BLACK ORACLE Research Ledger

Last updated: 2026-09-19

| ID | Domain | Topic | Evidence | Status | Experiment | Production impact |
|---|---|---|---|---|---|---|
| D-001 | Design/Product | OpenBB shared dashboard context & persistent widgets | A (official docs) | TEST / REFERENCE | EXP-D001 | None |
| D-002 | Design | Accessible financial visualization gate | C precedent; verify against WCAG | TEST | EXP-D001 checklist | None |
| AIML-001 | AI/ML + Quant | AlphaSeek trajectory-level factor lineage & redundancy | B | TEST | EXP-AIML001 | None |
| EV-001 | Evidence/Validation | Cross-engine backtest implementation risk | A- | TEST | EXP-EV001 | None |
| EV-002 | Evidence/Validation | Separate robustness evidence from performance ranking | B+ | TEST | EXP-EV002 | None |

## Lineage rule

Every experiment result must link back to its research ID. An `ADOPT` decision requires recorded result evidence and implementation scope. `REJECT` must preserve the reason so the same idea is not repeatedly rediscovered. `REVISIT` must record the condition that would justify another test.

## Current queue

1. **EXP-EV001** — independent backtest reproducibility harness.
2. **EXP-EV002** — robustness-gate prototype on archived candidates.
3. **EXP-D001** — shared context/persistent research-card UX prototype.
4. **EXP-AIML001** — lineage + redundancy sandbox after validation harness is trustworthy.

## Bottleneck

EV-001 and EV-002 source reviews are recorded here, but their dedicated evidence-validation cycle file could not be written during this cycle because the repository write interface rejected that payload. No production behavior was changed. Retry the dedicated evidence document in a later cycle while preserving these IDs.
