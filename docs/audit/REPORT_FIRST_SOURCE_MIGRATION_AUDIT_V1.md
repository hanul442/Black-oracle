# BLACK ORACLE Report-First Source Migration Audit v1

Status: READ-ONLY SOURCE AUDIT  
Date: 2026-09-20  
Audited base: `main@d95b679df69bf73985e971665a466f6ba0c3007b`  
Runtime changes: None

## 1. Executive finding

The current repository is still structurally trading-first, but several components are already strong foundations for the proposed Report-first product.

The migration should **not** delete `src/trading` or `server/trading` wholesale. Market-data, NARS/Evidence, research truth, forecast calibration, Council debate infrastructure, and AI cost telemetry are mixed into trading-oriented namespaces.

The correct program is:

1. preserve current runtime,
2. extract/re-home report-relevant primitives,
3. build the new Report plane,
4. migrate execution-only code to the AutoTrade project,
5. remove legacy imports only after parity and rollback gates pass.

## 2. Strong reusable foundations

### 2.1 AI cost telemetry — KEEP / REFACTOR

Files:

- `server/aiUsageLedger.ts`
- `api/ai-cost-status.ts`

Current strengths:

- records feature/operation/model,
- records token usage,
- records cached input,
- records web-search calls,
- estimates variable model cost,
- stores trace/market/strategy/evidence associations,
- exposes monthly usage aggregation,
- supports soft/hard budget concepts.

Report-first use:

- retain as internal cost truth,
- extend context from strategy-centric fields to `reportId`, `analystId`, `debateId`, `creditJobId`, `userActionType`,
- separate provider cost telemetry from user-facing Credit debits,
- never derive user Credits directly from a stale hard-coded price book,
- use measured P50/P90/P99 action cost to recalibrate Credit catalog.

This means BLACK ORACLE already has the beginning of the telemetry needed for sustainable Credits.

### 2.2 Council debate API — REFACTOR

File:

- `api/council-debate.ts`

Current strengths:

- structured specialist persona calls,
- Red Team stage,
- revision after challenge,
- arbiter-style synthesis,
- structured JSON schemas,
- AI usage recording,
- budget gate,
- evidence IDs and data gaps.

Report-first conversion:

`Council persona → Specialist Analyst`  
`Red Team → Counter-thesis / Adversarial Analyst`  
`Arbiter → Domain Lead Analyst`  
`capitalDecision → report synthesis / investment-attractiveness assessment`

Remove execution authority semantics from the public Report path.

Debate should become conditional on material disagreement instead of mandatory topology.

### 2.3 Forecast calibration — KEEP / REFACTOR

File:

- `server/eventLedgerForecastCalibration.ts`

Current strengths include:

- extraction of historical directional forecasts,
- realized outcome matching,
- Brier score,
- directional accuracy,
- empirical return distributions,
- minimum-sample fail-closed behavior.

Report-first use:

- decouple forecast evaluation from completed trades,
- evaluate published Report forecasts against market observations at the report horizon,
- add price-target error and timing error,
- retain calibration and no-fabrication behavior.

This is one of the most valuable existing assets for the proposed Forecast-vs-Actual product experience.

### 2.4 KRX research pipeline — KEEP / REHOME

Files include:

- `server/trading/equity/krxResearchTruth.ts`
- `server/trading/equity/krxShadowResearchLoop.ts`
- `server/trading/equity/krxShadowResearchScheduler.ts`
- `server/trading/equity/krxShadowResearchEvents.ts`
- `server/trading/equity/krxUniverseBuilder.ts`
- research-grade market-data providers under `server/trading/equity/`

These are currently under a trading namespace but already express research-specific concepts.

Target:

- re-home into a neutral `server/research/` and/or `server/market/` namespace,
- preserve point-in-time/freshness semantics,
- reuse scheduled research as the base of Scheduled Scan + Event Trigger + Delta Analysis.

### 2.5 NARS / Evidence — KEEP / REHOME

Relevant paths include:

- `api/nars-shadow-consume.ts`
- `api/nars-status.ts`
- `server/trading/narsConsumer.ts`
- `server/trading/narsCoverageAcquirer.ts`
- `server/trading/evidenceCoverageQueue.ts`
- `server/trading/externalEvidenceSource.ts`
- `server/eventLedgerEvidenceProjection.ts`

Target:

- make Evidence a first-class neutral research service,
- remove trading namespace dependence where unnecessary,
- preserve provenance, freshness and contradiction handling,
- centralize collection so individual Analysts do not duplicate searches.

## 3. UI components with high reuse value

### 3.1 Integrated market chart — REFACTOR

File:

- `src/mobile/v9/IntegratedMarketChart.tsx`

Current chart already provides:

- OHLCV,
- multiple timeframes,
- source/freshness display,
- data-quality truth,
- price overlays.

Current trading-specific overlays include:

- active Paper position,
- entry,
- stop loss,
- take-profit targets,
- candidate trade map.

Report-first target:

Remove/relocate:

- active Paper position block,
- execution-suitability wording,
- Paper mark,
- trading protection overlays.

Add:

- support/resistance zones,
- Report markers,
- historical Grade,
- Report version links,
- Bull/Base/Bear forecast path/band,
- Forecast-vs-Actual overlay,
- selected indicators used by the Technical Analyst,
- material event markers.

This file is better treated as a chart-engine starting point than deleted.

### 3.2 Current V11.1 shell — REPLACE GRADUALLY

Files:

- `src/mobile/BlackOracleMobileApp.tsx`
- `src/mobile/BlackOracleMobileAppV11_1.tsx`

The current production mobile shell still reflects trading-era navigation and read models.

Target public IA:

Home / Discover / Reports / Watchlist + global Search.

Do not rewrite this shell until Report contracts and read models exist.

## 4. Execution assets — MOVE_TO_AUTOTRADE

High-confidence execution-only examples:

- `api/trading-paper-cycle.ts`
- `api/trading-status.ts`
- `src/mobile/PositionMonitor.tsx`
- `src/mobile/v9/PositionSummary.tsx`
- `src/components/ExecutionLogger.tsx`
- `src/components/TradeAuditHistory.tsx`
- Paper session / paper loop modules
- execution checkpoint/runtime state
- protection replay
- order/trade projection
- trading persistence
- runtime lease and trading scheduler controls.

These should be preserved for the AutoTrade project rather than destructively removed.

## 5. Strategy assets — SPLIT

Paths include:

- `src/trading/autonomousStrategyFactory.ts`
- `server/trading/strategyFactoryRunner.ts`
- `server/trading/strategyHypothesisResearcher.ts`
- `server/trading/strategyShadowPool.ts`
- `server/trading/strategyExperimentLedger.ts`
- Strategy Factory API endpoints.

Trading strategy generation/routing belongs to AutoTrade.

However:

- experiment lineage,
- hypothesis tracking,
- challenger methodology,
- OOS/robustness concepts,

remain useful for Analyst prompt/method R&D.

Do not carry the full trading Strategy Factory into the public Report request path.

## 6. Replay and Ledger — SPLIT / REFACTOR

Files:

- `server/eventLedger.ts`
- `server/eventLedgerLineage.ts`
- `server/decisionReplay.ts`
- `api/decision-replay.ts`
- trade/event projections.

Target split:

### Report-first

- Report publication history,
- Evidence trace,
- Analyst inputs,
- Debate trace,
- Lead synthesis,
- Forecast,
- later evaluation.

### AutoTrade

- strategy selection,
- risk decision,
- order,
- fill,
- position,
- protection,
- trade outcome.

Do not make Report History depend on a trade existing.

## 7. Proposed NEW source boundaries

Recommended target namespaces:

```text
server/
  research/
    evidence/
    reports/
    analysts/
    debate/
    forecasts/
    evaluation/
    scheduler/
  market/
    instruments/
    pricing/
    chart/
    technical/
  commercial/
    entitlements/
    credits/
    alerts/
    billingTelemetry/
```

Front end:

```text
src/
  report/
  discover/
  watchlist/
  alerts/
  commercial/
  charts/
```

Execution-only code should eventually leave the public repository/project boundary or reside in the separate AutoTrade project.

## 8. Required NEW services

### Report Store

Versioned immutable publication records plus explicit corrections.

### Analyst Registry

Stable roles + method/prompt/config versions + activation rules.

### Activation Router

Select minimal useful Analyst set based on subject, event and available data.

### Disagreement Detector

Determine whether Debate is worth its incremental cost.

### Domain Lead Synthesis

Generate final report synthesis without execution authority.

### Forecast Store / Evaluation

Persist published forecast and compare against later market outcomes.

### Entitlement Engine

Answer whether a Plan permits an action.

### Credit Quote Engine

Return exact quoted Credit price before execution.

### Credit Ledger

Append-only grant/debit/reversal entries.

### Alert Engine

Rule monitoring separated from expensive AI actions.

## 9. Credit integration with existing cost telemetry

Recommended flow:

```text
User requests AI action
        ↓
Entitlement check
        ↓
Credit quote
        ↓
Credit balance reservation
        ↓
Research/AI job
        ↓
Existing AI usage telemetry
        ↓
Job success?
   ┌────┴────┐
   yes       no
   ↓         ↓
settle     reverse
Credit     Credit
        ↓
Cost analytics
```

Important: user-facing Credits and provider-cost estimates are related but separate ledgers.

## 10. Migration order

1. Land product contracts only.
2. Build Report schemas/read models.
3. Extract neutral market/evidence primitives.
4. Build Report Store + Agent Registry + Debate/Synthesis.
5. Build Forecast publication/evaluation.
6. Build Entitlement/Credit quote/ledger without real billing.
7. Build Alerts.
8. Build report-first UI.
9. Create AutoTrade target project and transfer execution modules.
10. Remove execution imports from BLACK ORACLE only after tests and rollback checkpoints.

## 11. Current deletion decision

**Delete nothing yet.**

The repo contains too many mixed research/execution dependencies for safe bulk deletion.

The next code-level change should be additive and namespace-safe, not destructive.
