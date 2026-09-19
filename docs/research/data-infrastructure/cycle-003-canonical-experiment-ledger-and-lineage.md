# Cycle 003 — Canonical Experiment Ledger & Data/Agent Lineage

Date: 2026-09-19

## Executive decision

Cycle 003 resolves the common dependency identified in Cycle 002: BLACK ORACLE needs a canonical Experiment Ledger contract before Strategy Factory search is accelerated.

Three external patterns are useful but should be adapted rather than copied:

1. **MLflow dataset/run tracking** — dataset digest, source, schema/profile, experiment runs, metrics and artifacts.
2. **OpenLineage** — explicit Run / Job / Dataset identities and extensible lineage facets.
3. **OpenTelemetry-compatible AI tracing** — trace/span identity for Council/Router/agent execution; current GenAI semantic conventions remain a moving target, so BO should pin an internal schema version rather than couple its evidence model to unstable external attribute names.

No production or paper-trading behavior is changed by this research.

---

## DI-001 — Canonical Experiment Ledger schema

**Status:** TEST → ADOPT-SCHEMA-CANDIDATE (implementation still gated)

**Evidence grade:** A- for infrastructure precedent; BO-specific fields remain design hypotheses.

### Research question

What is the minimum immutable metadata required to reproduce a BLACK ORACLE research result and connect it to the exact data, code, candidate family, validation protocol, AI decision path, and OOS outcome?

### External evidence

MLflow tracks experiment runs and can associate runs with datasets. Its Dataset abstraction records a name, digest/fingerprint, source, schema, and optional profile. OpenLineage models executions as Runs of Jobs consuming/producing Datasets, with extensible facets and explicit lineage relationships. These are mature precedents for separating identity from mutable presentation metadata.

### BLACK ORACLE gap

Cycle 002 already requires trial-family accounting, information horizons, return-series fingerprints, execution assumptions and OOS linkage, but these fields are not yet unified under one versioned contract. Separate ad-hoc ledgers would make EV-001/003/004 incomparable and weaken replayability.

### Proposed canonical record

```yaml
schema_version: bo.experiment.v1
experiment_id: exp_...
research_ids: [EV-001, EV-003, EV-004]
research_family_id: rf_...
candidate_id: cand_...
parent_candidate_id: null
trial_index: 1

code:
  git_commit: <sha>
  config_hash: <sha256>
  environment_fingerprint: <hash-or-lockfile-ref>

data:
  dataset_id: ds_...
  dataset_digest: <content-or-manifest-hash>
  source_snapshot_ids: []
  canonical_instrument_version: <version>
  feature_schema_hash: <sha256>
  sample_start: <timestamp>
  sample_end: <timestamp>
  information_horizon_spec: <ref>

validation:
  protocol_id: <walk-forward/purged/etc>
  split_manifest_hash: <sha256>
  purge_spec: null
  embargo_spec: null
  random_seed: null
  trial_family_size_observed: 1
  effective_trials_method: null

execution:
  engine_id: <engine+version>
  fees_model: <ref>
  slippage_model: <ref>
  fill_model: <ref>
  latency_model: <ref>

outputs:
  return_series_hash: <sha256>
  artifact_manifest_hash: <sha256>
  metrics: {}
  robustness_diagnostics: {}
  oos_result_id: null

ai_provenance:
  decision_trace_id: null
  model_policy_versions: []
  evidence_snapshot_ids: []

promotion:
  state: TEST
  decision_id: null
  reason: null
  decided_at: null
```

### Design rules

- IDs and hashes are immutable; human-readable labels may change.
- Store references/hashes for large or sensitive payloads instead of copying payloads into the ledger.
- `dataset_digest` is not enough by itself: source snapshot, feature schema and canonical-instrument mapping version must also be recoverable.
- `information_horizon_spec` is mandatory for supervised/event labels that consume future intervals; `null` requires an explicit reason for rule-based/unsupervised cases.
- `split_manifest_hash` records the actual observations assigned to each split, not merely `n_splits=5`.
- Every Strategy Factory candidate, including rejected candidates, receives a family/candidate identity before performance is known.
- Promotion state cannot overwrite prior states; decisions append to a decision history/event stream.

### Hypothesis

`H-DI001`: Requiring `bo.experiment.v1` for validation experiments will raise independent replay/reconstruction completeness while making EV-001/003/004 diagnostics computable from the same records, at acceptable storage and runtime overhead.

### Experiment — EXP-DI001

Backfill the schema for a small stratified sample of archived experiments: one rule-based strategy, one supervised signal, one regime model, and one Council/Router-assisted decision. Have an independent replay script/evaluator attempt reconstruction using only ledger references and declared artifacts.

### Success metrics

- required-field completeness;
- exact dataset/split reconstruction rate;
- metric recomputation agreement;
- missing-artifact rate;
- lineage ambiguity count;
- time to reconstruct an experiment;
- per-run metadata/storage overhead;
- percentage of EV-001/003/004 diagnostics computable without manual archaeology.

### Adoption boundary

Do not block all existing research immediately. First run EXP-DI001 and migrate the validation harness. Production strategy execution remains untouched.

---

## DI-002 — Dataset lineage: borrow OpenLineage concepts, not the whole platform

**Status:** TEST / REFERENCE

**Evidence grade:** A (official OpenLineage specification precedent)

### What is new for BO

OpenLineage explicitly separates Dataset, Job and Run identities and supports dataset/field lineage. BO can use this conceptual model to connect:

`raw market/news source → normalized dataset → canonical instrument mapping → feature set → label → experiment split → model/strategy → signal → decision → trade/outcome`.

### Gap

BO's evidence lineage and market-data lineage risk becoming parallel graphs. A strategy can be perfectly reproducible at the code level while still using a silently revised instrument mapping or feature transformation.

### Hypothesis

`H-DI002`: A compact lineage manifest at dataset/feature boundaries will reduce unknown-cause validation discrepancies and make canonical-instrument changes impact-analyzable.

### Experiment — EXP-DI002

Instrument one KRX pipeline and one crypto pipeline with dataset/run identities and transformation edges. Deliberately change a canonical-instrument mapping and a feature transform, then test whether affected experiments/signals can be enumerated automatically.

### Metrics

- lineage edge completeness;
- affected-run discovery recall in seeded-change tests;
- unresolved dataset/version count;
- instrumentation latency/storage overhead.

### Boundary

Do not deploy OpenLineage infrastructure merely because the standard exists. Start with BO-native manifests compatible with its concepts; adopt a server/backend only if operational scale justifies it.

---

## AIML-003 — Vendor-neutral Council/Router trace envelope

**Status:** TEST / REFERENCE

**Evidence grade:** A- for MLflow/OpenTelemetry interoperability; external GenAI semantic conventions are not treated as stable BO schema.

### Research question

Can AIML-002 provenance become operationally traceable without locking BLACK ORACLE to one agent framework or observability vendor?

### Evidence

MLflow Tracing is built on/compatible with OpenTelemetry and supports OTLP ingestion/export. Current tooling can join LLM/agent/tool spans into traces and propagate trace context across services. This is useful infrastructure precedent for Council and Router replay.

### BO proposal

Keep the Experiment Ledger's `decision_trace_id` vendor-neutral. A BO trace adapter maps internal stable fields to the selected telemetry backend. Pin the adapter/convention snapshot in metadata so external semantic-convention changes cannot mutate historical meaning.

Minimum internal span types:

- `bo.council.invoke`
- `bo.agent.invoke`
- `bo.model.invoke`
- `bo.retrieval`
- `bo.tool.execute`
- `bo.router.select`
- `bo.strategy.evaluate`
- `bo.decision.emit`

Each span carries references, not necessarily raw content: `case_id`, `evidence_snapshot_id`, model/prompt-policy version, tool/data freshness, parent trace/span IDs, latency, status, and output artifact hash.

### Experiment — EXP-AIML003

Trace a sandbox Council evaluation across at least two agent/model paths. Replay the decision using recorded evidence/artifact references and compare failure attribution with current logs.

### Metrics

- end-to-end trace completeness;
- orphan span rate;
- replay success;
- unknown-cause failure rate;
- trace latency/storage cost;
- backend portability test using the same internal envelope.

### Risk

Full prompt/tool payload logging can create privacy, cost, and evidence-retention problems. Default to hashes/references and explicitly opt in to content retention for controlled experiments.

---

## Cross-cycle integration

The proposed dependency chain is now:

`Canonical data identity → candidate/trial identity → validation split identity → execution assumptions → output fingerprints → robustness diagnostics → AI/decision trace → OOS result → promotion decision`.

This makes the Cycle 002 validation controls computable from a shared evidence substrate instead of separate research scripts.

## Decision

- **DI-001:** ADOPT-SCHEMA-CANDIDATE; must pass EXP-DI001 before becoming mandatory.
- **DI-002:** TEST / REFERENCE; BO-native manifest first, infrastructure later.
- **AIML-003:** TEST / REFERENCE; vendor-neutral internal trace contract first.
- No strategy, risk, order, or paper/live execution logic changed.

## Highest-priority next action

Build a minimal `bo.experiment.v1` validator + backfill/replay fixture for four representative archived experiments. The first implementation target is validation infrastructure, not Strategy Factory throughput.
