# Black Oracle Sprint 7 — Foundation v2

Status: IMPLEMENTATION IN PROGRESS / PAPER AUTHORITY UNCHANGED / NO PRODUCTION DEPLOYMENT

Base: `sprint/6-empirical-paper-validation`. On 2026-09-06 the Sprint 7 branch was replayed onto Sprint 6 head `a22cb6d32dfce89156ff419120336c84f95a928e`. The pre-rebase Sprint 7 state is retained at `backup/sprint-7-pre-rebase-20260906`.

## 1. Objective

Convert the existing evidence-governed PAPER engine into a safer research-to-execution architecture without silently changing trading behavior or production authority.

Benchmark synthesis used for the architecture:

- Nebula: lifecycle, lineage, Vault, live drift monitoring
- StrategyQuant: robustness and stress-validation discipline
- LEAN / FinRL-X: strategy intent -> portfolio target -> risk -> execution separation
- Freqtrade: lookahead and recursive/warm-up integrity checks
- TradingAgents: Council/debate layer only; never direct execution authority

Sprint 7 sequencing:

1. Validation integrity before strategy evaluation
2. Reproducible historical data identity and warm-up evidence
3. Standardized portfolio target contract
4. Independent StrategyIntent + shadow risk/target parity
5. Replay/PAPER execution-adapter parity
6. Validation Hard Gate integration
7. Only then expand Vault, drift, allocation and lifecycle automation

## 2. Current-state audit

### KEEP

The following foundations remain strategically valid:

- Evidence ingestion, source policy and evidence readiness
- Deterministic governance core and Council comparison/challenger architecture
- Council V2 with `executionAuthority: false` and `promotionAuthority: false`
- Blind outcome validation and chronological walk-forward validation
- Monte Carlo validation
- Experiment ledger / validation ledger / integrity ledger
- Strategy Genome, Strategy Factory and Strategy Router primitives
- Champion-Challenger primitive
- AAA-style rating engine with hard grade caps and confidence/coverage
- Portfolio exposure and correlation risk checks
- PAPER broker, PAPER portfolio, runtime checkpointing, scheduler leases and recovery controls
- Trade Case / decision trace / audit surfaces

### MODIFY

1. `executionPolicy.ts`
   - Signal, sizing, risk and execution-command semantics remain compressed into one `ExecutionDecision`.
   - Target architecture is `Strategy Intent -> Portfolio Target -> Risk Overlay -> Execution Adapter`.
   - Sprint 7 now has an independent shadow Strategy Intent/risk seam, but authority is not moved until observation parity is sufficient.

2. `blindValidation.ts`
   - `noLookahead: true` describes post-decision outcome anchoring.
   - It is not proof that every strategy input or indicator is globally future-data-free.
   - Input-integrity evidence is therefore maintained separately.

3. Upbit candle history
   - A single minute-candle request is capped at 200 observations.
   - Sprint 7 now provides bounded pagination so 200/250/300/400 warm-up comparisons can be reproduced without changing the current PAPER polling path.

4. Strategy Factory promotion logic
   - Future candidate advancement must require input-integrity provenance, reproducible configuration/data IDs, validation Hard Gates and rating confidence.

5. Rating / deployment labels
   - Grade-derived labels are governance classifications only.
   - They never imply execution or production-promotion authority.

### DEPRECATE / DO NOT EXPAND

- Any path where Council, an LLM, Strategy Factory or Grade can directly place an order
- Automatic Champion promotion
- Automatic PAPER-to-LIVE promotion
- Automatic live strategy replacement
- Direct strategy-to-broker command coupling as a long-term architecture
- Treating backtest/OOS grade as sufficient evidence for live eligibility

## 3. Implemented

### S7-01A — deterministic candle integrity gate

`validationIntegrity.ts` checks before strategy evaluation:

- invalid/non-finite timestamp
- future candle / evaluation-cutoff violation
- duplicate timestamp
- non-monotonic timestamp on supplied evaluation order
- mixed market
- mixed timeframe
- invalid OHLC
- invalid volume
- minimum warm-up depth
- abnormal candle gaps as WATCH rather than silent acceptance

`server/trading/multiTimeframe.ts` fails closed on blocking integrity faults before a trading snapshot is built.

### S7-01B — recursive warm-up stability primitive

`warmupStability.ts` compares terminal indicator outputs across trailing warm-up windows. It reports normalized indicator drift and PASS/WATCH/REJECT/INSUFFICIENT_DATA.

### S7-01C — shadow Portfolio Target contract

`portfolioTargetContract.ts` expresses desired target state with current/target weight, notionals, delta, target intent, risk disposition, strategy version and immutable `executionAuthority: false`.

The PAPER session records this target and links PAPER order audit events to `portfolioTargetId`. The legacy decision remains the only order authority.

### S7-02 — historical data integrity + reproducible dataset evidence

Implemented:

- bounded Upbit minute-candle pagination, up to 1,000 candles per research request
- explicit exclusive `to` cursor handling
- duplicate page-boundary detection that fails closed
- deterministic candle canonicalization
- SHA-256 dataset checksum and stable `datasetId`
- default 400-candle input-validation policy with 200/250/300/400 recursive warm-up windows
- explicit `InputValidationLedgerRecord`
- separation of input-quality evidence from outcome/alpha samples
- idempotent input-validation ledger merge
- tests for pagination boundaries, checksum reproducibility, material data mutation, 400-candle warm-up evidence and insufficient-history rejection

Important boundary: the current real-time PAPER multi-timeframe reader still requests the existing 200 candles per timeframe. The >200-candle reader is a validation/research primitive so API load, latency and PAPER behavior do not change silently.

### S7-03A — post-legacy shadow target pipeline parity

Implemented:

`Legacy ExecutionDecision -> StrategyIntent(shadow) -> PortfolioTarget(shadow) -> RiskAdjustedTarget(shadow) -> ParityReport`

- ENTER/HOLD/RISK-REJECT/EXIT semantics are parity-tested
- notional delta and BUY/SELL/null side semantics are compared against the authoritative legacy decision
- PAPER `SIGNAL` ledger records Intent, Target, post-risk Target and parity evidence
- submitted PAPER orders retain target/parity provenance IDs
- all objects have `executionAuthority: false`

### S7-03B — independent pre-risk Strategy Intent seam

Implemented:

`Signal/Position/Liquidity state -> IndependentStrategyIntent -> Independent risk projection -> Legacy ExecutionDecision comparator`

The independent seam does not call the legacy policy to determine its intent or risk result. It derives the candidate from the same raw policy inputs and then compares its projection against the current authoritative `ExecutionDecision`.

Coverage includes approved new long entry, weak-signal HOLD, portfolio-level entry block, deterministic risk rejection, protective stop-loss exit, healthy-position HOLD and deliberate notional tampering that must produce parity REJECT.

PAPER integration records the independent Strategy Intent and parity evidence in the `SIGNAL` ledger. Order audit events retain `independentPolicyParityId`. Governance remains after the authoritative legacy base decision. The independent seam cannot create, cancel, resize or promote an order.

This creates two explicit observation boundaries:

1. **pre-governance policy parity** — independent Strategy Intent/risk projection vs legacy `ExecutionDecision`
2. **post-governance target parity** — final legacy decision vs StrategyIntent/PortfolioTarget/post-risk Target representation

Neither boundary has execution authority in Sprint 7.

### S7-04A — deterministic Replay / PAPER execution-adapter parity harness

Implemented:

- common simulation-only `SimulationExecutionAdapter` contract
- independent `DeterministicReplayExecutionAdapter`
- `PaperBrokerExecutionAdapter` wrapper around the current PAPER broker
- per-fill parity report across market, side, quantity, fill price, notional, fee, slippage and timestamp
- independent Replay spot-book state model
- lifecycle parity against the actual `PaperPortfolio`
- BUY-only open-position state comparison
- BUY -> SELL full round-trip comparison
- explicit custom fee/slippage assumption comparison
- deliberate altered-fee test that must produce parity REJECT

The Replay implementation does not reuse `PaperBroker` fill code and the Replay spot book does not reuse `PaperPortfolio` accounting. This keeps the parity test meaningful instead of comparing a module with itself.

All Replay/PAPER adapter parity objects are simulation-only and have `executionAuthority: false`. No LIVE adapter was introduced.

S7-04A is a test/audit harness. It does not yet run a second replay fill inside each production PAPER order path; that runtime audit wiring is intentionally separated as S7-04B so broker behavior is not changed while the common contract is being validated.

## 4. Validation / branch integrity

On 2026-09-06:

- the stale/diverged Sprint 7 stack was detected before further expansion
- the original head was backed up to `backup/sprint-7-pre-rebase-20260906`
- Sprint 7 was replayed onto the latest Sprint 6 safety/security baseline
- rebased S7-02 and S7-03A checkpoints passed both main GitHub validation workflows
- the independent S7-03B seam passed typecheck, trading-core tests and serverless bundle smoke checks before final PAPER integration
- final S7-04A integrated head must pass both main workflows before this increment is considered complete
- Vercel commit status remains an independent external deployment QA blocker; the connected Vercel API does not expose the project required to retrieve the detailed deployment failure

Interpretation:

- GitHub typecheck/build/trading validation: code-quality gate
- Vercel Preview: deployment/runtime QA gate
- production rollout: separate human-approved gate

A Vercel failure must not be mislabeled as a passing Preview, but it also does not grant or revoke PAPER execution authority.

## 5. Production-state boundary observed during implementation

A read-only Supabase inspection on 2026-09-06 observed the existing PAPER runtime active at the time of inspection:

- runtime: `black-oracle-paper`
- scheduler enabled: true
- most recent scheduler HTTP status at inspection: 200 / OK
- interval: 15 minutes
- max scanned markets: 6
- max concurrent open positions: 4
- persisted cycle count at inspection: 181
- persisted closed trades at inspection: 7
- persisted open positions at inspection: 4

These are historical inspection values, not a claim of the current live database state.

No production table, scheduler configuration, Edge Function, risk limit or trading credential was changed by Sprint 7 implementation.

## 6. Next code increments

### S7-04B — PAPER runtime adapter-parity evidence

- construct one immutable PAPER order request before execution
- derive an independent Replay reference fill from that exact request
- execute the same request through the existing authoritative PAPER broker
- compare actual fill with Replay reference and append parity evidence to the ledger
- parity mismatch is audit/promotion-blocking evidence only; no order cancellation or alternate execution path in Sprint 7

### S7-05 — Validation Hard Gate integration

Promotion requires all of:

- input integrity PASS
- warm-up stability inside approved policy
- OOS / blind evidence
- walk-forward robustness
- Monte Carlo survival
- cost/slippage stress
- minimum sample and observation depth
- evidence/audit coverage
- grade confidence and Hard Gate compliance
- reproducible dataset/configuration lineage
- required policy/target/adapter parity evidence

## 7. Non-negotiable safety rules

- PAPER remains the only automated execution mode in Sprint 7.
- Council and LLM outputs have no execution authority.
- Strategy Factory output has no execution authority.
- Portfolio Target, Strategy Intent, post-risk Target and parity objects have no execution authority.
- Replay and PAPER comparison adapters are simulation-only; no LIVE adapter is introduced in Sprint 7.
- No automatic Champion or Council promotion.
- No automatic PAPER-to-LIVE transition.
- No production schema migration or deployment from this branch without explicit human approval.
- Production rollout, qualification arming and capital scaling remain separate human-approved gates.
