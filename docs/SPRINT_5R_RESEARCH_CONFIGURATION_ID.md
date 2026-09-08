# BLACK ORACLE — Research Configuration Identity Contract

Status: **DRAFT / PAPER ONLY**

## 1. Purpose

`Research Configuration ID` is the canonical cross-source identity for one concrete strategy configuration when that same configuration appears in Strategy Factory and Experiment Ledger.

The objective is to make Deflated Sharpe Ratio trial counting auditable and deduplicated across research subsystems without guessing that two configurations are identical.

## 2. Canonical identity

A Strategy Genome produces a deterministic id in this form:

`rcfg-v1-<16 hex characters>`

The id is derived from normalized effective strategy configuration only:
- strategy version
- model version
- market scope
- supported regimes
- timeframes
- strategy weights
- entry / exit / confidence thresholds
- deterministic risk limits

Lineage metadata such as Genome id, generation number, creation timestamp, parent ids and mutation history does not change the configuration id when the effective strategy configuration is unchanged.

## 3. Experiment binding

An Experiment may evaluate only a subset of markets or regimes. Experiment evaluation scope therefore must not be reinterpreted as Strategy Genome configuration.

When an Experiment tests a specific Strategy Genome, `bindExperimentSpecToStrategyGenome()` writes the Genome-derived `researchConfigurationId` into the normalized Experiment Spec. Strategy/model version mismatches fail closed rather than inventing cross-source identity.

`RuntimeExperimentLedgerStore.planForStrategyGenome()` is the runtime entry point for planning a Strategy-bound experiment with this canonical identity.

## 4. DSR lineage rules

Only actually tried configurations count:
- Strategy Factory: a candidate must appear in a persisted PAPER shadow observation.
- Experiment Ledger: an experiment must reach `EXPERIMENT_STARTED` or `EXPERIMENT_COMPLETED`.
- Planned-only experiments do not count.

When both sources carry canonical ids, the DSR lineage engine computes the union of Research Configuration ids and removes exact cross-source overlap.

Example:
- Strategy Factory observed configurations: 9
- Experiment Ledger tried configurations: 4
- exact canonical overlap: 2
- DSR tried configurations: 11, not 13

This state is reported as `COMBINED_CANONICAL` with lineage integrity `PASS`.

If any mixed-source trial lacks canonical binding, BLACK ORACLE does not guess equivalence. It reports `COMBINED_CONSERVATIVE`, uses a conservative upper trial count, exposes a defensible lower bound, and marks lineage integrity `CONSERVATIVE`.

## 5. Backward compatibility

Existing Strategy Factory checkpoints remain usable because canonical ids can be deterministically reconstructed from persisted candidate Genomes without rewriting historical observations.

Existing Experiment Ledger entries that lack `researchConfigurationId` remain countable within Experiment Ledger by their normalized experiment-configuration fingerprint, but they cannot claim cross-source equality with a Strategy Genome. Mixed-source DSR therefore remains conservative until canonical binding exists.

## 6. Operator visibility

The LAB Research Validation surface exposes:
- DSR trial count and source
- lineage integrity
- canonical configuration total
- Strategy Factory / Experiment Ledger cross-source overlap
- unmapped trial count
- lower-bound trial count
- Strategy Factory / Experiment Ledger source counts

Missing canonical mapping is displayed as research uncertainty rather than silently deduplicated.

## 7. Authority boundary

Research Configuration identity affects research lineage and selection-bias correction only.

It grants:
- no execution authority
- no promotion authority
- no automatic Champion / Challenger promotion
- no automatic PAPER-to-LIVE transition

DSR, PBO, Grade and Council challenger evidence remain review inputs under existing BLACK ORACLE governance.
