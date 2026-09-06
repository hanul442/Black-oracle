# Black Oracle Sprint 7 — Foundation v2

Status: IMPLEMENTATION IN PROGRESS / NO PRODUCTION DEPLOYMENT

Base: latest validated `sprint/6-empirical-paper-validation` head at stack/rebase time. Sprint 7 is intentionally maintained as a stacked branch until Sprint 6 is integrated.

## 1. Objective

Convert the existing evidence-governed PAPER engine into a safer research-to-execution architecture without changing current production authority.

Benchmark synthesis used for the architecture:

- Nebula: lifecycle, lineage, Vault, live drift monitoring
- StrategyQuant: robustness and stress-validation discipline
- LEAN / FinRL-X: strategy intent -> portfolio target -> risk -> execution separation
- Freqtrade: lookahead and recursive/warm-up integrity checks
- TradingAgents: Council/debate layer only; never direct execution authority

The immediate Sprint 7 order is:

1. Validation integrity before strategy evaluation
2. Standardized portfolio target contract
3. Replay/PAPER parity seam
4. Only then expand factory, grading, Vault, drift and allocation

## 2. Current-state audit

### KEEP

The following foundations already exist and remain strategically valid:

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
   - Current signal, sizing, risk and execution-command semantics are still compressed into one `ExecutionDecision`.
   - Target architecture must become `Strategy Intent -> Portfolio Target -> Risk Overlay -> Execution Adapter`.
   - Sprint 7 introduces a shadow target contract first so behavior does not change silently.

2. `blindValidation.ts`
   - Existing `noLookahead: true` correctly describes post-decision outcome anchoring.
   - It must not be interpreted as proof that every strategy input/indicator is globally free of future data.
   - Separate input-integrity gates are therefore required before strategy evaluation.

3. Upbit candle history
   - Current public minute-candle helper requests at most 200 observations, matching the exchange endpoint request cap.
   - This is enough for the current EMA200 minimum but not enough for meaningful recursive warm-up comparisons across 200/250/300/400 windows.
   - A paginated historical-candle reader is required before recursive stability becomes an authoritative gate.

4. Strategy Factory promotion logic
   - Factory candidates already fail closed on several validation metrics.
   - Future promotion must additionally require validation-integrity provenance, rating Hard Gates and reproducible configuration IDs before candidate status can advance.

5. Rating / deployment labels
   - Grade-derived labels are governance classifications only.
   - They must never imply execution or production-promotion authority.

### ADD

- Pre-strategy candle integrity gate
- Recursive indicator warm-up stability probe
- Standardized portfolio-target contract
- Replay/PAPER execution adapter contract and parity comparison
- Strategy Vault persistence + full lineage graph
- Test-to-live drift engine with HEALTHY/WATCH/DEGRADED/QUARANTINE/RETIRED lifecycle
- Portfolio allocator based on target weights rather than direct BUY/SELL commands
- Cross-engine execution/replay parity evidence

### DEPRECATE / DO NOT EXPAND

- Any path where Council, an LLM, Strategy Factory or Grade can directly place an order
- Automatic Champion promotion
- Automatic PAPER-to-LIVE promotion
- Automatic live strategy replacement
- Direct strategy-to-broker command coupling as a long-term architecture
- Treating a backtest/OOS grade as sufficient evidence for live eligibility

## 3. Sprint 7 implemented in this branch

### P0-A — deterministic candle integrity gate

New `validationIntegrity.ts` checks before strategy evaluation:

- invalid/non-finite timestamp
- future candle / evaluation-cutoff violation
- duplicate timestamp
- non-monotonic timestamp on the supplied evaluation order
- mixed market
- mixed timeframe
- invalid OHLC
- invalid volume
- minimum warm-up depth
- abnormal candle gaps (WATCH, not silent)

`server/trading/multiTimeframe.ts` now fails closed on blocking integrity faults before any trading snapshot is built.

### P0-B — recursive warm-up probe

New `warmupStability.ts` compares indicator outputs at the same terminal candle while varying trailing warm-up windows. It reports normalized per-indicator drift and PASS/WATCH/REJECT/INSUFFICIENT_DATA.

This probe is implemented and tested as a research primitive. It is intentionally not yet an authoritative live/PAPER gate because the current Upbit history reader only supplies 200 candles per timeframe.

### P1-A — shadow Portfolio Target contract

New `portfolioTargetContract.ts` expresses the desired target state with:

- current/target weight
- current/target notional
- delta notional
- target intent (`INCREASE_LONG`, `FLAT`, `MAINTAIN`)
- risk disposition
- strategy version
- immutable `executionAuthority: false`

The current PAPER session emits this target into the Trading Ledger and links submitted PAPER orders to `portfolioTargetId`.

Important: the existing deterministic PAPER decision -> broker path is still authoritative in this phase. The new contract is shadow-only so Sprint 7 does not alter production trading behavior before parity is proven.

## 4. Production-state boundary observed during implementation

Read-only Supabase inspection on 2026-09-06 showed the existing PAPER runtime still active and healthy:

- runtime: `black-oracle-paper`
- scheduler enabled: true
- most recent scheduler HTTP status: 200 / OK
- interval: 15 minutes
- max scanned markets: 6
- max concurrent open positions: 4
- persisted cycle count at inspection: 181
- persisted closed trades: 7
- persisted open positions: 4

No production table, scheduler configuration, Edge Function, risk limit or trading credential was changed by Sprint 7 implementation.

The current database contains the original Black Oracle runtime/scheduler tables. The Sprint 6 `black_oracle_operator_events` migration remains Git-side and was not auto-applied.

## 5. Next code increments

### S7-02 — Historical data integrity + pagination

- paginated Upbit candle history reader
- stable data-set ID / checksum
- recursive warm-up gate using >200 observations
- explicit input-integrity record in Validation Ledger

### S7-03 — Authoritative target pipeline

Refactor without strategy-behavior changes:

`Signal/Strategy -> StrategyIntent -> PortfolioTarget -> RiskAdjustedTarget -> ExecutionDecision`

Legacy and refactored outputs must be compared in shadow mode until parity is demonstrated.

### S7-04 — Replay / PAPER parity

- common execution adapter interface
- deterministic historical replay adapter
- existing PAPER broker adapter
- parity report: target, expected order, fill assumptions, fees, slippage, position state
- no Live adapter with order authority in this sprint

### S7-05 — Validation Hard Gate integration

Promotion requires all of:

- input integrity PASS
- warm-up stability PASS/WATCH within approved policy
- OOS / blind evidence
- walk-forward robustness
- Monte Carlo survival
- cost/slippage stress
- minimum sample and observation depth
- evidence/audit coverage
- grade confidence and Hard Gate compliance

## 6. Non-negotiable safety rules

- PAPER remains the only automated execution mode in this sprint.
- Council and LLM outputs have no execution authority.
- Strategy Factory output has no execution authority.
- Portfolio Target v1 has no execution authority.
- No automatic Champion or Council promotion.
- No automatic PAPER-to-LIVE transition.
- No production schema migration or deployment from this branch without explicit human approval.
