# BLACK ORACLE Council v2 + Runtime v2 Specification

Status: DESIGN CANDIDATE — no production trading authority
Base: `sprint/3b-trading-centric-realignment`

## 1. Objective

Council v2 is not a vote-counting mechanism and is not allowed to execute orders. Its purpose is to convert bounded evidence into an auditable advisory judgment, expose disagreement, falsify weak theses, and feed calibrated information into a separate deterministic policy/risk layer.

Runtime v2 is designed for the Paper phase first. The preferred free/low-cost operating model is Supabase Postgres + Cron + Queues + Edge Functions for online orchestration, with GitHub Actions reserved for offline validation, replay, Monte Carlo, and Council ablation. Vercel may remain as a frontend/API surface but is not the required trading scheduler.

## 2. Non-negotiable governance rules

1. Council output is advisory only.
2. Council, agents, adjudicators, and calibration components cannot bypass deterministic Risk/Execution gates.
3. Missing or stale data may force `NO_TRADE`; uncertainty is not converted into confidence by default.
4. Production weights cannot be mutated from an LLM recommendation.
5. Every Council run is versioned and replayable from immutable inputs.
6. Every probability must have a target definition, horizon, resolution rule, and later scoring record.
7. Failed experiments and rejected Council variants remain in the Trial Registry.
8. Paper -> Approval Live promotion remains a separate human-governed gate.

## 3. Council v2 architecture

```text
Raw Data / Evidence / Signals
           |
           v
Data Integrity Gate
- freshness
- provenance
- story clustering
- missing fields
- contradiction
- point-in-time eligibility
           |
           v
Dynamic Council Router
           |
   +-------+--------+----------------+
   |                |                |
   v                v                v
Technical/Regime  Event/Catalyst  Macro/Cross-asset
   |                |                |
   +-------+--------+----------------+
           |
           +--> Crypto Structure (only when real data exists)
           |
           v
Falsifier / Skeptic
           |
           v
Calibration Engine (deterministic/statistical)
           |
           v
Risk Officer
           |
           v
Meta-Verifier
           |
           v
Advisory Decision Contract
ENTER / HOLD / EXIT / NO_TRADE
           |
           v
Deterministic Policy + Risk Engine
           |
      REJECT / PASS
           |
           v
Execution Engine
```

## 4. Agent role decisions

### 4.1 Technical/Regime

`momentum_trend` and `mean_reversion` should no longer be assumed to be permanently active peer voters. The router decides which technical family is eligible from regime and data quality. Deterministic signal engines remain authoritative for indicator calculations; LLM use is limited to interpretation of supplied snapshots.

Decision: MERGE / DYNAMIC ROUTING.

### 4.2 Event/Catalyst

Retain and strengthen. It must reason from source-backed evidence only and must receive provenance, freshness, story-cluster, contradiction, and independence metadata.

Decision: KEEP + IMPROVE.

### 4.3 Macro/Cross-asset

Retain, but invoke only when the market/horizon has relevant macro context. It must not invent cross-asset states that were not supplied.

Decision: KEEP / CONDITIONAL.

### 4.4 Liquidity/Execution

Retain but redefine as an execution-feasibility reviewer rather than a directional voter. It evaluates spread, depth, turnover, data freshness, expected slippage, and venue feasibility.

Decision: KEEP + ROLE CHANGE.

### 4.5 Risk Officer

Retain. It reviews asymmetry, tail risk, concentration, correlation, drawdown state, invalidation quality, and reasons to abstain. It does not replace deterministic hard gates.

Decision: KEEP + IMPROVE.

### 4.6 Falsifier / Skeptic

New control role. It does not cast a normal directional vote. It must answer:
- what evidence would make the thesis false?
- what material evidence is missing?
- which claims are circular, duplicated, stale, or unsupported?
- what alternative explanation fits the same facts?

Decision: ADD P0.

### 4.7 Calibration Engine

Not an LLM voting agent. It computes empirical base rates, sample size, historical calibration, Brier/log-loss summaries, regime-conditioned performance, and confidence caps. LLMs may explain these outputs but cannot invent them.

Decision: ADD P0.

### 4.8 Crypto Structure

Add only when actual derivatives/on-chain/flow data is available. Candidate inputs include funding, basis, open interest, liquidation, taker imbalance, options skew/IV, exchange flows, and stablecoin/on-chain liquidity.

Decision: ADD P1, DATA-GATED.

### 4.9 Meta-Verifier

Replace the idea of a consensus-seeking adjudicator with a verifier. It checks claim-evidence consistency, preserves dissent, incorporates falsifier findings and calibration constraints, and produces a bounded advisory conclusion.

Decision: REBUILD.

## 5. Council input contract v2

Every Council run receives a point-in-time immutable context.

### Evidence item

```text
evidence_id
market
source_type
source
publisher
source_url or source_ref
story_cluster_id
published_at
observed_at
received_at
expires_at
direction
strength
reliability_prior
reliability_calibrated
independence_score
contradiction_of[]
tags[]
content_hash
```

Rules:
- `published_at`, `observed_at`, and `received_at` must not be conflated.
- duplicate syndication must be clustered before evidence counting.
- unavailable fields remain null/unknown; they must not be inferred silently.
- Evidence IDs in agent output must exist in the immutable run input.

### Market snapshot

```text
snapshot_id
market
exchange_event_time
received_at
processed_at
bar_open_time
last_trade_time
orderbook_time
regime
regime_confidence
liquidity metrics
strategy signals
position state
portfolio risk state
```

## 6. Specialist output contract v2

Every specialist returns structured fields:

```text
agent_id
agent_version
stance
probability_estimate
confidence_in_estimate
claim
evidence_ids[]
counter_evidence_ids[]
missing_evidence[]
invalidation_conditions[]
key_risks[]
alternative_explanations[]
action_implication
abstain_reason
```

A probability estimate is advisory and uncalibrated until constrained by the Calibration Engine.

## 7. Falsifier output contract

```text
thesis_id
material_counterclaims[]
unsupported_claims[]
duplicate_evidence_clusters[]
missing_evidence[]
alternative_explanations[]
observable_invalidation_conditions[]
falsification_severity
recommendation = PASS_TO_VERIFY | REDUCE_CONFIDENCE | NO_TRADE_REVIEW
```

## 8. Calibration contract

```text
forecast_family
horizon
target_definition
comparable_sample_n
regime_sample_n
predicted_bucket
historical_realized_rate
brier_score
log_loss
expected_calibration_error
base_rate
confidence_cap
insufficient_sample_flag
```

Rules:
- confidence caps are deterministic outputs.
- no calibrated probability is emitted when the target/horizon cannot be resolved.
- small samples must be visible and must reduce authority.

## 9. Final Council advisory contract

```text
council_run_id
trace_id
market
as_of
council_version
active_agents[]
raw_agent_outputs[] refs
falsifier_ref
calibration_ref
preserved_dissent[]
disagreement_index
evidence_coverage
evidence_independence
probability_raw
probability_calibrated
confidence_raw
confidence_capped
advisory_action
unresolved_uncertainty[]
primary_reason
invalidation_conditions[]
execution_authority = false
```

## 10. Dynamic routing policy

The Council Router selects the minimum useful expert set.

Examples:
- clean trend regime + no catalyst -> Technical + Liquidity + Risk + Falsifier + Calibration
- event shock -> Event + Technical + Liquidity + Risk + Falsifier + Calibration
- macro-sensitive horizon -> Macro + Technical + Risk + Falsifier + Calibration
- derivative crowding data available -> add Crypto Structure
- missing/stale evidence -> skip unnecessary agents and favor `NO_TRADE`

The router itself must be versioned and tested. More agents are not automatically better.

## 11. Council quality metrics

Every variant is evaluated against a strong single-agent and deterministic baseline.

Required metrics:
- Brier score
- log loss
- calibration error
- directional accuracy
- `NO_TRADE` precision/recall
- avoided-loss value
- net expectancy after costs
- max drawdown
- cost per decision
- latency per decision
- token usage
- agent prediction correlation
- agent error correlation
- evidence Jaccard overlap
- minority-agent accuracy
- falsifier hit rate
- disagreement index

Promotion rule: Council v2 cannot become the default decision advisory layer unless it improves risk-adjusted OOS decision quality versus both the current Council and a strong single-agent/simple-ensemble baseline without materially worsening calibration or drawdown.

## 12. Runtime v2 — Paper phase

Preferred layout:

```text
GitHub repository
   |
   +--> GitHub Actions
   |     - blind historical replay
   |     - Monte Carlo
   |     - parameter stress
   |     - Council ablation
   |     - calibration reports
   |     - CI/build/tests
   |
   +--> optional frontend deployment

Supabase
   |
   +--> Postgres
   |     - runtime state
   |     - evidence / clusters
   |     - decision lineage
   |     - Council runs
   |     - forecast contracts
   |     - experiment/trial registry
   |
   +--> Cron
   |     - enqueue scheduled work
   |
   +--> Queues / pgmq
   |     - paper_cycle
   |     - evidence_refresh
   |     - forecast_resolution
   |     - council_evaluation
   |
   +--> Edge Functions
         - bounded job workers
         - external API calls
         - checkpoint/reconciliation
```

## 13. Why Supabase-first for Paper

Current official Supabase capability supports Postgres Cron, including sub-minute schedules on supported Postgres versions, and Edge Function invocation. Free hosted Edge Functions currently expose a 150 second wall-clock limit and 2 second CPU time per request; this must be benchmarked against the current trading cycle before migration. Queues/pgmq are preferred for retries, visibility timeouts, and failure isolation.

The runtime design must therefore use short bounded jobs, not a permanently alive event loop.

## 14. Queue semantics

Every runtime job contains:

```text
job_id
job_type
runtime_id
trace_id
scheduled_for
created_at
attempt
max_attempts
visibility_timeout
payload_version
payload
status
last_error
completed_at
```

Rules:
- idempotency key required.
- failed jobs retry after visibility timeout.
- poison jobs move to a dead-letter/archive path after max attempts.
- a job must not mutate live trading state twice.
- current distributed lease may remain during transition as defense in depth until queue semantics are proven.

## 15. Online tables proposed for v2

No migration is authorized by this document. Proposed logical entities:

```text
bo_evidence_items
bo_evidence_clusters
bo_market_snapshots
bo_decision_traces
bo_council_runs
bo_council_agent_outputs
bo_forecast_contracts
bo_forecast_resolutions
bo_experiments
bo_trials
bo_runtime_jobs
bo_runtime_incidents
```

Existing checkpoint tables remain until an explicit migration plan proves compatibility.

## 16. Security model

1. Do not use `SUPABASE_SERVICE_ROLE_KEY` as a general HTTP bearer credential.
2. Scheduler/function secrets live in Supabase Vault or function secrets.
3. Separate service credentials by purpose or use a single narrowly scoped internal-auth contract.
4. Public/anon/authenticated roles receive no direct trading-runtime write privileges.
5. Security-definer database functions require explicit execute revocation/grants and fixed `search_path`.
6. Secret values must never enter frontend bundles, logs, Council context, or Ledger payloads.
7. Live execution credentials are not introduced in this sprint.

## 17. Documentation drift rule

Code is authoritative for current operational state. Docs that claim active cron/deployment/live capability must be corrected when configuration does not exist. A CI documentation check should eventually verify key runtime configuration assumptions.

## 18. P0 Council/Runtime Sprint scope

### P0-1 Council Context Contract v2
- unify debate/scenario evidence fields
- preserve provenance and time semantics
- add story-cluster/independence fields
- reject unknown evidence IDs in outputs

### P0-2 Falsifier
- implement independent falsification pass
- no execution authority
- structured output and tests

### P0-3 Calibration Engine skeleton
- deterministic scoring interface
- Brier/log-loss/base-rate data model
- confidence-cap output
- no fabricated probabilities when sample is absent

### P0-4 Council Meta-Verifier
- consumes specialists + Falsifier + Calibration
- preserves dissent
- cannot alter strategy/risk weights

### P0-5 Council Ablation Harness
- baseline single-agent
- current Council
- dynamic Council
- +Falsifier
- +Calibration
- output comparable metrics

### P0-6 Runtime Queue Prototype
- Supabase Cron -> queue -> bounded worker design
- idempotent job contract
- retry/visibility semantics
- no production execution

### P0-7 Runtime Benchmark
- measure current paper-cycle wall time and CPU-heavy sections
- prove compatibility with Edge Function limits before migration

### P0-8 Documentation Synchronization
- remove/repair claims of active Vercel cron when absent
- document actual scheduler state

## 19. P0 Acceptance Criteria

A P0 sprint is complete only when all of the following are true:

1. `npm run lint`, trading tests, and production build pass.
2. Council v2 input/output schemas have deterministic validation tests.
3. Two syndicated versions of one underlying story cannot count as two fully independent evidence items.
4. Agent output referencing a nonexistent Evidence ID is rejected or marked invalid.
5. Falsifier runs independently before Meta-Verifier and cannot issue an executable order.
6. Calibration Engine returns `insufficient_sample=true` rather than inventing calibrated confidence when no history exists.
7. Meta-Verifier preserves material dissent and emits `executionAuthority=false`.
8. Council variant IDs and model/prompt versions are persisted in experiment metadata.
9. Ablation harness can compare at least deterministic baseline, single-agent, current Council, and Council v2 candidate on identical point-in-time inputs.
10. Runtime job execution is idempotent under duplicate delivery in tests.
11. Failed queue work can be retried without duplicating portfolio mutation.
12. Edge Function suitability is benchmarked against the 150s wall-clock / 2s CPU constraints before any scheduler migration.
13. No Supabase service-role credential is accepted as a generic HTTP endpoint secret in new v2 code.
14. No Live/Approval-Live execution path is introduced.
15. README/runtime docs match the deployed/scheduled reality.

## 20. Out of scope for P0

- automatic live deployment
- automatic strategy-weight mutation
- Strategy Factory generation at scale
- reinforcement learning
- derivatives execution
- on-chain Agent without real data feed
- persistent WebSocket trading worker migration
- portfolio leverage
- futures/margin/shorting

## 21. Promotion path

```text
Council v2 Prototype
   -> historical blind replay
   -> ablation vs baselines
   -> calibration review
   -> multi-day real-time Paper shadow mode
   -> Grade review
   -> default Paper advisory layer
   -> later Approval-Live review
```

Council is promoted for evidence of incremental value, not architectural elegance.

## 22. Preliminary design verdict

- Current 6+1 Council: KEEP as baseline, do not expand blindly.
- Dynamic specialist routing: ADD.
- Falsifier: ADD P0.
- Calibration Engine: ADD P0.
- Evidence provenance/independence: REBUILD P0.
- Meta-Adjudicator: REBUILD as Meta-Verifier.
- Crypto Structure specialist: ADD only after real data acquisition.
- Supabase Cron/Queues/Edge: preferred Paper runtime candidate, benchmark required.
- GitHub Actions: preferred offline validation/experiment plane.
- Vercel: optional frontend/API surface; not a required scheduler.

The next implementation step is to convert P0-1 through P0-8 into code changes only after reviewing the exact migration/data-compatibility plan against the active Supabase project and current branch state.
