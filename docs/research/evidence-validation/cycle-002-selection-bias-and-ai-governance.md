# Cycle 002 — Selection Bias, Validation Leakage, and AI Governance

Date: 2026-09-19

## Executive decision

This cycle adds two validation controls to the R&D queue without changing production or paper trading behavior:

1. **EV-003 — Multiple-testing / selection-bias gate** using Deflated Sharpe Ratio (DSR) as a candidate robustness diagnostic.
2. **AIML-002 — AI decision provenance gate** inspired by NIST AI RMF's GOVERN/MAP/MEASURE/MANAGE lifecycle and TEVV emphasis.

The central design principle is that a strategy's reported performance and the evidence supporting that performance are separate objects. Strategy Factory search volume itself is evidence that must be recorded because repeated trials inflate the probability of discovering apparently strong results by chance.

---

## EV-003 — Deflated Sharpe Ratio / research-trial accounting

**Status:** TEST

**Source:** Bailey & López de Prado, *The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting, and Non-Normality*, Journal of Portfolio Management 40(5), 2014. DOI: 10.3905/jpm.2014.40.5.094.

**Evidence grade:** A-

### What is substantive

The paper argues that an observed Sharpe ratio can be materially inflated when researchers select the best result from many trials. DSR adjusts the inference around Sharpe for multiple testing / selection bias and non-normal return distributions. This is directly relevant to BLACK ORACLE because Strategy Factory / Genome-style search can create many correlated candidate strategies and parameterizations.

### BO gap

The R&D ledger records experiments, but the current research system does not yet require every generated candidate to contribute to an explicit trial-family count or effective-trials estimate. If only promoted candidates survive into the ledger, BO can acquire survivorship bias at the research-process level.

### Hypothesis

`H-EV003`: Adding trial-family accounting plus DSR-style diagnostics will reject a non-trivial subset of candidates that pass naive Sharpe/return thresholds, especially in large Strategy Factory search batches, while retaining candidates that demonstrate stable OOS evidence.

### Experiment — EXP-EV003

On archived or synthetic strategy-search batches:

1. preserve every attempted candidate and parameter family;
2. calculate ordinary Sharpe and supporting distribution statistics;
3. estimate the number of trials and, where feasible, effective independent trials for correlated candidates;
4. calculate a DSR-style selection-bias diagnostic;
5. compare candidate acceptance under the existing performance gate vs performance + robustness gate;
6. run forward/OOS validation on both accepted sets.

### Metrics

- naive-pass → robustness-fail rate;
- OOS Sharpe / Sortino and MDD of survivors;
- OOS survival rate;
- number and effective number of trials per research family;
- correlation / redundancy among generated candidates;
- false promotion rate on null/synthetic data;
- compute cost and latency added by the gate.

### Adoption boundary

DSR must **not** become a standalone alpha score or automatic trading signal. It is a research-evidence diagnostic. Adoption requires a verified implementation against published numerical examples and a BO-specific calibration study.

### Implementation candidate

Extend Experiment Ledger records with fields conceptually equivalent to:

- `research_family_id`
- `candidate_id`
- `parent_candidate_id`
- `trial_index`
- `parameter_fingerprint`
- `return_series_hash`
- `sample_start/end`
- `n_trials_observed`
- `n_effective_trials` (method recorded)
- `sharpe_raw`
- `dsr_diagnostic`
- `oos_result_id`

This also strengthens AIML-001 factor/strategy lineage because rejected trials remain visible rather than disappearing from the research history.

---

## EV-004 — Purged / embargoed temporal validation

**Status:** DISCOVERED → TEST after primary-method verification

**Evidence grade:** B pending primary-source implementation review

### Research question

Does BO's model/strategy validation prevent label-horizon overlap and temporal leakage when training samples and test samples share information windows?

### Gap

Generic K-fold validation is unsafe for many financial labels because adjacent observations can share future-return horizons or derived features. BO needs a validation contract that records the information interval used by each sample, not merely a row timestamp.

### Proposed experiment — EXP-EV004

Compare current validation with a purged/embargoed temporal split on one representative supervised signal and one regime classifier. Inject a known leakage feature as a positive control; the leakage-safe protocol should materially reduce the apparent performance advantage.

### Metrics

- leakage-positive-control detection;
- OOS metric delta vs naive split;
- fold-to-fold dispersion;
- regime coverage across folds;
- training-data loss from purge/embargo;
- runtime overhead.

### Boundary

Do not mandate a single CV scheme for every strategy. Event-driven labels, fixed-horizon labels, unsupervised regime models, and pure rule-based strategies require different validation contracts.

---

## AIML-002 — AI decision provenance / TEVV control

**Status:** TEST / REFERENCE

**Source:** NIST AI Risk Management Framework and NIST AI Resource Center. AI RMF is voluntary and organizes risk management around GOVERN, MAP, MEASURE, and MANAGE; AIRC emphasizes testing, evaluation, verification, and validation (TEVV). NIST states AI RMF 1.0 is under revision as of 2026, so this is a governance reference rather than a frozen compliance standard.

**Evidence grade:** A for governance/process precedent; not evidence of trading performance.

### BO relevance

Council, Router, forecasting models, and future LLM/agent components can affect investment recommendations. BO already values Evidence Ledger and Experiment Ledger traceability, but research provenance should explicitly connect AI outputs to model/version, input evidence, evaluation, override, and downstream action.

### Hypothesis

`H-AIML002`: A compact provenance envelope around Council/Router decisions will materially improve post-hoc reproducibility and failure attribution without unacceptable latency/storage overhead.

### Experiment — EXP-AIML002

For a sandbox Council/Router evaluation, capture:

- decision/case ID;
- model and prompt/policy version;
- evidence snapshot IDs;
- data timestamp / freshness;
- tool/model calls relevant to the decision;
- confidence/calibration output where applicable;
- human/system override;
- downstream strategy/trade decision ID;
- realized outcome and evaluation record.

Replay a sample of historical decisions and measure whether an independent evaluator can reconstruct why the decision occurred.

### Metrics

- replay/reconstruction success rate;
- missing-provenance rate;
- evidence-to-decision lineage completeness;
- latency and storage overhead;
- percentage of failures attributable to data, model, prompt/policy, router, execution, or unknown cause.

### Adoption boundary

Do not convert NIST categories directly into a trading score. The value is process control and TEVV discipline.

---

## Cross-cycle synthesis

EV-001 asks whether different backtest implementations reproduce the result. EV-003 asks whether the selected result survives the fact that many alternatives were tried. EV-004 asks whether validation leaks future information. AIML-002 asks whether an AI-assisted decision can be reconstructed and attributed after the fact.

Together they define a stronger promotion chain:

`Candidate lineage → leakage-safe validation → implementation reproducibility → multiple-testing robustness → OOS/forward evidence → promotion decision → outcome attribution`

The recommended order remains validation infrastructure before accelerating Strategy Factory search. A faster strategy generator without trial accounting increases evidence debt.

## Risks / open questions

- Effective-trial estimation for highly correlated strategy families is method-sensitive.
- DSR and related statistics should complement, not replace, economic rationale, costs, liquidity, capacity, and forward evidence.
- Purge/embargo parameters must derive from label/information horizons rather than arbitrary percentages.
- Provenance logging can become expensive or leak sensitive data; store references/hashes where full payload retention is unnecessary.
