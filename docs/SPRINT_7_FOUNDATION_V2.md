# Black Oracle Sprint 7 — Foundation v2

Status: S7-01~S7-05 IMPLEMENTED ON DRAFT BRANCH / PAPER AUTHORITY UNCHANGED / NO PRODUCTION DEPLOYMENT

Base: `sprint/6-empirical-paper-validation` at `a22cb6d32dfce89156ff419120336c84f95a928e`.
Sprint 7 branch: `sprint/7-validation-integrity-target-contract`.
The pre-rebase Sprint 7 state is retained at `backup/sprint-7-pre-rebase-20260906`.

## 1. Objective

Sprint 7 converts the existing evidence-governed PAPER engine into a safer research-to-execution architecture without silently changing trading behavior, deployment authority or capital authority.

The target separation is:

`Evidence / Market Data -> Strategy Intent -> Portfolio Target -> Risk Overlay -> Execution Adapter -> Ledger / Validation -> Promotion Review`

The current deterministic PAPER path remains authoritative until enough empirical parity and validation evidence exists to justify a later, separately approved migration.

Architecture references used for the Sprint 7 direction include lifecycle/lineage ideas from institutional research systems, robustness discipline from strategy-validation platforms, intent/portfolio/risk/execution separation from systematic trading frameworks, recursive/lookahead integrity practices, and multi-agent Council concepts. None of those references grant execution authority to an LLM, Council, rating engine or Strategy Factory.

## 2. Non-negotiable authority boundary

Throughout Sprint 7:

- PAPER remains the only automated execution mode.
- The existing `PaperBroker` path remains the only order-authoritative path.
- Council/LLM output has no execution authority.
- Strategy Factory output has no execution authority.
- Strategy Intent, Portfolio Target, risk-adjusted target and parity objects have `executionAuthority: false`.
- Replay adapters are simulation/reference implementations only.
- Ratings and promotion eligibility are governance evidence only.
- No automatic Champion promotion exists.
- No automatic PAPER-to-LIVE transition exists.
- No production schema migration, scheduler change, credential change or capital increase is authorized by this branch.

## 3. S7-01 — Validation integrity + target-state foundation

### S7-01A — candle integrity hard gate

`validationIntegrity.ts` validates strategy input before evaluation:

- finite timestamps
- evaluation cutoff / future-candle rejection
- supplied-order chronology
- duplicate timestamps
- market/timeframe consistency
- OHLC validity
- volume validity
- minimum warm-up depth
- abnormal gaps surfaced as explicit WATCH evidence

Blocking integrity faults fail closed before a trading snapshot can be accepted.

### S7-01B — recursive warm-up stability

`warmupStability.ts` compares indicator outputs across multiple trailing warm-up windows while holding the terminal candle constant. It reports normalized drift and explicit `PASS / WATCH / REJECT / INSUFFICIENT_DATA` disposition.

### S7-01C — Portfolio Target contract

`portfolioTargetContract.ts` expresses target state separately from broker commands. It records current/target weight, current/target notional, delta, intent, risk disposition, strategy version and immutable zero execution authority.

This begins the architectural migration away from direct strategy-to-broker command coupling without changing current PAPER behavior.

## 4. S7-02 — Historical data integrity + reproducibility

Implemented:

- bounded Upbit minute-candle pagination up to 1,000 candles per research request
- exclusive `to` cursor behavior
- duplicate page-boundary detection
- deterministic candle canonicalization
- SHA-256 dataset checksum
- stable `datasetId`
- 400-candle validation default
- recursive 200/250/300/400 warm-up windows
- `InputValidationLedgerRecord`
- explicit separation of input-quality evidence from outcome/alpha validation

The real-time PAPER path still uses its established polling depth. Deep historical pagination is a validation/research primitive and does not silently alter runtime trading behavior.

## 5. S7-03 — Independent Strategy Intent + target parity

### S7-03A — post-governance target representation parity

Implemented observation pipeline:

`Legacy ExecutionDecision -> StrategyIntent(shadow) -> PortfolioTarget(shadow) -> RiskAdjustedTarget(shadow) -> ParityReport`

Coverage includes ENTER, HOLD, risk-rejected HOLD and EXIT semantics. PAPER `SIGNAL` events retain target/parity provenance IDs.

### S7-03B — independent pre-risk Strategy Intent seam

Implemented independent observation seam:

`Raw policy inputs -> IndependentStrategyIntent -> Independent risk projection -> Legacy ExecutionDecision comparator`

The independent implementation does not call the legacy execution policy to decide its own intent. It independently derives the candidate and compares the result with the authoritative legacy decision.

Two explicit parity boundaries now exist:

1. pre-governance policy parity
2. post-governance target parity

Both are audit-only in Sprint 7.

## 6. S7-04 — Replay/PAPER execution parity

### S7-04A — independent adapter/lifecycle harness

Implemented:

- simulation-only common execution-adapter contract
- independent deterministic Replay fill model
- wrapper around the actual PAPER broker
- fill parity across market, side, quantity, price, notional, fee, slippage and timestamp
- independent Replay spot-book accounting
- BUY lifecycle comparison
- BUY -> SELL round-trip comparison
- deliberate assumption mismatch tests that must reject parity

Replay accounting does not reuse PAPER portfolio accounting, preserving the independence of the comparison.

### S7-04B — runtime PAPER fill parity evidence

The runtime PAPER order path now constructs one immutable order request and sends that identical request to:

1. the independent Replay reference adapter, and
2. the existing authoritative PAPER broker.

The actual PAPER fill is compared with the reference fill and the result is appended to the Trading Ledger. Adapter parity can block later promotion review but cannot cancel, replace, resize or reroute the order that the authoritative PAPER broker has already processed.

The PAPER session also exposes cumulative policy/target/adapter parity counts for later promotion evidence assembly.

## 7. S7-05 — Promotion Hard Gate

### S7-05A — deterministic eligibility policy

`promotionHardGate.ts` separates three outcomes:

- `PASS`
- `BLOCKED`
- `INSUFFICIENT_DATA`

A strategy cannot receive a promotion-eligible result from rating alone. Required evidence includes:

1. input integrity
2. recursive warm-up stability
3. reproducible dataset + research-configuration lineage
4. Blind/OOS evidence
5. chronological walk-forward robustness
6. Monte Carlo survival
7. execution-cost/slippage stress
8. audit/evidence coverage
9. stage-aware Oracle Grade and rating confidence
10. independent policy parity
11. Portfolio Target parity
12. Replay/PAPER adapter parity

Current minimum grade floors are stage-aware:

- Experiment -> Incubator: `BBB-`
- Incubator -> Challenger: `A-`
- Challenger -> Champion Candidate: `AA-`

These are necessary but not sufficient conditions.

### S7-05B — persisted evidence assembler

`promotionEvidenceAssembler.ts` rebuilds promotion evidence only from traceable sources:

- persisted Blind/OOS samples
- persisted closed PAPER trades
- persisted grade-surveillance history
- persisted Trading Ledger parity
- cycle-level evidence linkage coverage
- Experiment Ledger research-configuration lineage
- explicitly supplied deterministic input-validation records

Ambiguous research-configuration lineage is not guessed. More than one valid attempted configuration without an explicit binding remains `MISSING_OR_AMBIGUOUS` and therefore insufficient for promotion.

### S7-05C — deterministic Cost Stress

`costStress.ts` applies additional execution-cost shocks to observed closed-trade returns using a bounded cost ladder. It evaluates whether expectancy, compound return and drawdown characteristics survive incremental friction instead of treating historical PAPER returns as cost-invariant.

Insufficient closed-trade depth remains `INSUFFICIENT_DATA` rather than generating synthetic confidence.

### S7-05D — market × timeframe provenance

Black Oracle applies the crypto strategy across multiple KRW markets, so a single BTC validation bundle is not sufficient for a strategy-wide promotion claim.

Promotion input provenance therefore requires:

`every market represented by the promotion evidence × 15m / 60m / 240m`

Each required market/timeframe pair must have its own dataset identity, checksum, integrity result and warm-up evidence.

Missing market/timeframe provenance is classified as insufficient evidence. A present but failed dataset is blocking evidence.

### S7-05E — bounded multi-market validation

`inputValidationEvidence.ts` provides:

- market-level 15m/60m/240m provenance construction
- strategy-level multi-market orchestration
- a hard maximum of 12 markets per validation run
- 400-candle default per timeframe
- a shared evaluation cutoff across one strategy validation run
- sequential processing between markets to avoid multiplying Upbit request bursts across the full universe

Within one market, only the three required timeframe research reads are allowed to run as the bounded batch.

### S7-05F — operator-triggered Promotion Readiness API

`api/trading-promotion-readiness.ts` exposes promotion evidence review without introducing promotion authority.

Properties:

- GET only
- Bearer authorization required
- Supabase persistence required
- loads the persisted PAPER checkpoint
- discovers the exact markets represented by persisted validation samples and closed trades
- runs bounded multi-market input validation only when explicitly called
- assembles the complete S7-05 evidence bundle
- returns eligibility and evidence provenance
- always returns `promotionAuthority: false`
- always returns `executionAuthority: false`
- always returns `liveDeploymentAuthority: false`

This expensive historical validation does not run as part of ordinary trading-status polling or the scheduled PAPER cycle.

## 8. Validation expectations

GitHub validation and external deployment QA are intentionally separate.

The Sprint 7 completion gate requires:

- TypeScript typecheck PASS
- trading-core tests PASS
- runtime bundle smoke PASS
- PAPER-cycle serverless bundle smoke PASS
- Evidence-refresh serverless bundle smoke PASS
- Trading-readiness serverless bundle smoke PASS
- Promotion-readiness serverless bundle smoke PASS
- Supabase scheduler Edge bundle smoke PASS
- production application build PASS

Vercel Preview remains an independent deployment/runtime QA gate. A Vercel failure cannot be represented as a passing Preview and does not change PAPER authority.

At the time this document was updated, the external Vercel commit status continued to report a build-rate-limit failure. No production deployment is implied by GitHub CI success.

## 9. Production-state boundary

A read-only inspection during Sprint 7 observed the existing PAPER runtime operating with a 15-minute scheduler, bounded market scan and bounded concurrent positions. Those observations are historical inspection values, not guarantees about the current database state.

Sprint 7 has not intentionally changed:

- production Supabase schema
- scheduler cadence
- scheduler target
- trading credentials
- deterministic hard risk limits
- PAPER capital authority
- LIVE authority

## 10. Sprint 7 completion definition

Sprint 7 Foundation v2 is code-complete only when the latest branch HEAD passes both GitHub validation workflows after S7-05 integration.

Even after code-complete status:

- the PR may remain Draft until external Preview/deployment QA is resolved
- no automatic merge is implied
- no production rollout is implied
- no qualification-window reset is implied
- no capital scaling is implied

## 11. Next increment — S7-06 Strategy lifecycle

Only after S7-05 is green should the next increment expand lifecycle automation.

Proposed S7-06 scope:

1. Strategy Vault state model: Research / Incubator / Challenger / Champion Candidate / Retired
2. immutable strategy-version and parent/child lineage
3. explicit promotion-review records rather than direct state mutation
4. drift monitoring across return, risk, regime and parity behavior
5. automatic demotion/retirement recommendations with no automatic capital reallocation
6. Champion/Challenger comparison against identical prospective windows
7. separation of research eligibility from deployment eligibility
8. operator UI/API visibility for blockers, evidence debt and next required sample

S7-06 must preserve the same rule established in Sprint 7: lifecycle automation may generate evidence and recommendations, but execution/capital authority remains separately controlled and human-approved.
