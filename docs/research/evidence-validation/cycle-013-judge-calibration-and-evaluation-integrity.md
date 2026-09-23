# Cycle 013 — Judge Calibration & Evaluation Integrity

Date: 2026-09-23
Research ID: **EV-009**
Status: **TEST / REFERENCE**
Production impact: **None**

## Research question
BLACK ORACLE increasingly depends on automated evaluation for Council/agent regression, evidence quality, tool-use traces and promotion gates. If an LLM judge is biased, unstable, or susceptible to the candidate's presentation/trace, a candidate can appear to improve without actually improving. The evaluator therefore needs its own measured error model and provenance.

## New evidence reviewed

### 1. Feng et al., *Noisy but Valid: Robust Statistical Evaluation of LLMs with Imperfect Judges* — ICLR 2026
**Evidence quality: A.** Peer-reviewed ICLR paper. It shows that judge noise/bias can invalidate naive certification and develops a calibration-set approach that estimates judge TPR/FPR and adjusts hypothesis testing while retaining finite-sample Type-I error control. Transfer to BO still requires domain-specific calibration.

### 2. Zhang et al., *Can We Trust LLM Judges?* — 2026 preprint
**Evidence quality: B+.** Across four benchmarks and six models, judging accuracy tracks task capability but systematic leniency remains; the paper proposes calibrated weighted majority voting using estimated judge error rates. Useful challenger design, not adoption evidence.

### 3. Soumik, *Judging the Judges* — 2026 preprint with released artifacts
**Evidence quality: B.** Tests nine mitigation strategies across five judge models/four provider families. Bias and mitigation effectiveness are model-dependent; a mitigation that helps one judge need not transfer to another. This argues against hard-coding a generic “debias prompt.”

### 4. AgentAudit — 2026 preprint
**Evidence quality: B.** Full-lifecycle agent evaluation across planning, memory, tool selection/invocation, grounding, security and execution integrity. Crucially, the authors identify use of a single fixed judge model as a limitation. This reinforces BO's need to separate trace capture from judge verdicts and preserve re-judging capability.

### 5. APort Vault — 2026 preprint + released benchmark data
**Evidence quality: B+.** 225,964 payment-agent evaluations distinguish request, authorization and execution events and show deterministic pre-action authorization can eliminate observed forbidden-recipient transfers in the tested layer. This primarily reinforces EV-008/EV-006; it is not a reason to create another security ID.

## Comparison with current BLACK ORACLE architecture
BO already has:
- `AIML-005` BO-specific financial-agent evaluation tasks;
- `AIML-006/007` Council ablation and common-mode failure testing;
- `AIML-004` trace capture;
- `EV-007` audit bundle;
- deterministic controls such as `EV-006` and `EV-008`.

The missing layer is **evaluator provenance and evaluator error calibration**. A score produced by an LLM judge currently risks being treated as evidence without proving that the judge is sufficiently valid for that rubric/task distribution.

## Gap
A candidate model/agent and its evaluator can share provider/model-family/style preferences or presentation artifacts. Raw judge agreement, test-retest consistency, or a single aggregate score does not prove validity. Promotion decisions need to know which criteria are executable/deterministic, which require human labels, and which are delegated to calibrated probabilistic judges.

## Hypothesis — H-EV009
A calibrated evaluation stack that prioritizes deterministic checks, uses a small blinded human-labelled calibration set for subjective/non-executable criteria, records judge version/error estimates, and escalates high-disagreement cases will reduce false promotion/rejection decisions versus a single uncalibrated LLM judge, without making evaluation cost or latency operationally unacceptable.

## Experiment — EXP-EV009
Use the frozen 30–50 `AIML-005` BO finance-agent golden tasks after that set exists. Construct a hidden calibration subset with human labels and controlled perturbations.

Compare:
- **A — Single uncalibrated judge**
- **B — Same judge + explicit rubric + repeated/position-swapped scoring where applicable**
- **C — Two/three heterogeneous judges with disagreement reporting**
- **D — Deterministic/executable checks first; calibrated judge only for non-verifiable criteria; human escalation for low-confidence/disagreement cases**

Seed positive controls: numerically wrong but polished answer, correct terse answer, unsupported citation, stale evidence, swapped candidate order, verbosity/style perturbation, corrupted tool argument, missing tool step, hallucinated tool call, and candidate-authored reasoning text that attempts to influence the judge.

## Metrics / success criteria
Primary:
- false-promotion rate vs blinded human/executable gold;
- false-rejection rate;
- Cohen's kappa or appropriate chance-corrected agreement, not raw agreement alone;
- per-rubric TPR/FPR with uncertainty;
- calibration drift by task family and candidate model family;
- seeded-bias detection rate;
- judge-disagreement recall for genuinely ambiguous/incorrect cases.

Operational:
- cost per evaluated task;
- p95 evaluation latency;
- human-escalation rate;
- reproducibility under judge version pinning.

Initial engineering acceptance: all seeded deterministic failures must be caught by deterministic validators rather than delegated to an LLM judge. No `ADOPT` threshold for probabilistic judge accuracy is fixed before the BO calibration set exists.

## Proposed implementation path
1. Extend `bo.agent_eval.v1` with `evaluator_manifest`: judge model/provider/version, rubric version, prompt/template hash, temperature/sampling, calibration-set ID, measured TPR/FPR or agreement statistics, and evaluation timestamp.
2. Split rubrics into `DETERMINISTIC`, `EXECUTABLE`, `HUMAN_GOLD`, and `PROBABILISTIC_JUDGE` classes.
3. Store raw trace/artifacts independently of judge output so historical runs can be re-judged after evaluator upgrades.
4. Add disagreement/low-confidence escalation rather than silently averaging all judge outputs.
5. Reference evaluator metadata from `bo.audit_bundle.v1`; do not create a parallel ledger.

## Risks
- Human calibration labels can themselves be inconsistent or leak candidate identity.
- Multi-judge ensembles can share training/provider biases and are not automatically independent.
- Judge version changes can create apparent regression/improvement unrelated to the candidate.
- Extra judging increases cost/latency.
- Calibration from generic benchmarks may not transfer to BO finance tasks.

## Decision
**TEST / REFERENCE.** Do not use an uncalibrated LLM-judge score as sole promotion evidence for Council/agent changes. Do not adopt a multi-judge ensemble merely because it is larger; it must beat the calibrated single-judge baseline on BO tasks net of cost/latency. Deterministic/executable validation remains preferred whenever a criterion can be checked directly.

## Traceability
`EV-009 → H-EV009 → EXP-EV009 → pending result → ADOPT / REJECT / REVISIT`

## Interaction with existing research
- strengthens `AIML-005` rather than replacing it;
- uses `AIML-004` trace artifacts for re-judging;
- records evaluator evidence in `EV-007` audit bundles;
- does not weaken `EV-006`/`EV-008` deterministic safety boundaries;
- should run only after the AIML-005 golden task set is frozen.
