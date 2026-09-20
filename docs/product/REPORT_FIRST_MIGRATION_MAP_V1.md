# BLACK ORACLE Report-First Migration Map v1

Status: AUDIT / IMPLEMENTATION INPUT  
Date: 2026-09-20  
Base runtime: main at d95b679df69bf73985e971665a466f6ba0c3007b

## 1. Purpose

BLACK ORACLE is moving from a combined Report + AutoTrade product concept toward a public Report-first research product with AutoTrade separated into another project.

This document defines migration classes before destructive deletion.

## 2. Classification vocabulary

- **KEEP** — belongs in report-first BLACK ORACLE.
- **REFACTOR** — concept remains but purpose/API/UI changes.
- **MOVE_TO_AUTOTRADE** — preserve and migrate to the separate AutoTrade project.
- **DELETE_AFTER_MIGRATION** — remove only after dependencies and history are preserved.
- **NEW** — missing capability required by report-first product.
- **INTERNAL_ONLY** — useful R&D/ops capability but not public navigation.

## 3. High-level classification

| Existing concept | Classification | Report-first role |
|---|---|---|
| NARS | KEEP | Evidence producer |
| Evidence provenance/freshness | KEEP | Core report trust layer |
| Research Ledger | KEEP | R&D governance |
| Market data | KEEP | Chart/report input |
| Council personas | REFACTOR | Specialist Analysts |
| Council debate | REFACTOR | Analyst Debate |
| Red Team | KEEP/REFACTOR | Counter-thesis/adversarial review |
| Arbiter | REFACTOR | Domain Lead synthesis; remove universal execution arbiter |
| Decision Replay | REFACTOR | Report History / Research Trace |
| Outcome | REFACTOR | Forecast-vs-Actual evaluation |
| Grade System | REFACTOR | Public Investment Attractiveness Grade plus internal grades |
| Strategy Factory | MOVE_TO_AUTOTRADE / INTERNAL_ONLY | trading strategies move; research-method experiments may remain |
| Strategy Router | MOVE_TO_AUTOTRADE | execution allocation |
| Deterministic Risk | MOVE_TO_AUTOTRADE | execution protection |
| Paper Broker | MOVE_TO_AUTOTRADE | execution |
| Order / Position / Trade | MOVE_TO_AUTOTRADE | execution state |
| Paper qualification | MOVE_TO_AUTOTRADE | trading validation |
| Monte Carlo/OOS | SPLIT | trading validation moves; forecast/research validation remains internal |
| System/runtime screens | INTERNAL_ONLY | ops/admin rather than public IA |
| Community | DEFER | not required for report-first v1 |

## 4. Proposed public information architecture

### Home

- overall market condition,
- investment issues,
- watchlist changes,
- new/high-grade reports.

### Discover

- Market,
- Industry,
- Sector,
- Company,
- Security,
- Event,
- Crypto.

### Reports

- latest,
- high-grade,
- upgraded/downgraded,
- report type,
- watchlist relevance.

Report list card:

- price when applicable,
- Grade,
- one-line assessment.

### Watchlist

- saved assets,
- Alerts,
- Alert History.

Global Search exists outside the bottom-nav count.

## 5. Report detail layers

### Core preview

- price,
- Grade,
- one-line assessment,
- basic chart,
- news/filings,
- report section preview,
- initial debate preview.

### Plus

- full debate,
- domain lead conclusion,
- Alerts,
- eligible lightweight AI actions.

### Pro

- full report,
- specialist detail,
- evidence/counterevidence detail,
- Bull/Base/Bear,
- forecast price/path,
- report-history comparison,
- advanced Alert rules.

### Max

- expert invitation,
- Red Team request,
- debate rerun,
- report refresh,
- new report request,
- custom/deep research,
- scheduled research,
- research-trigger Alerts.

## 6. Required NEW domain models

Before UI implementation, define versioned contracts for:

### Report

- report_id
- report_type
- subject_id
- version
- as_of
- published_at
- evidence_cutoff
- grade
- confidence
- one_line_assessment
- lead_analyst_id
- status
- supersedes_report_version_id

### AnalystReview

- analyst_id
- analyst_version
- domain
- horizon
- assessment
- grade_or_score where applicable
- confidence
- evidence_ids
- counterevidence_ids
- assumptions
- data_gaps
- forecast contribution
- created_at

### DebateSession

- debate_id
- report_id/version
- trigger_reason
- participants
- rounds
- unresolved_disagreements
- evidence_refs
- final_summary
- cost telemetry

### Forecast

- forecast_id
- report_id/version
- as_of
- horizon
- bull
- base
- bear
- path/band representation
- invalidation conditions
- evaluation_status

### ForecastEvaluation

- forecast_id
- observed_window
- direction_result
- price_error
- timing_error
- calibration result
- notes
- evaluated_at

### Alert

- alert_id
- user_id
- subject scope
- rule tree
- semantic-analysis requirement
- start/end
- quoted Credits
- action trigger
- action spend cap
- status

### CreditLedgerEntry

- wallet bucket
- action type
- quote
- debit/credit/reversal
- job ID
- status
- provider cost telemetry link.

## 7. Simplified Agent runtime

Target:

Source/Evidence update
→ report trigger
→ Activation Router
→ selected specialists
→ disagreement detector
→ optional debate
→ optional Red Team
→ Domain Lead
→ report publication
→ later forecast evaluation
→ analyst performance evaluation
→ R&D challenger proposal.

Avoid:

- always-on LLM agents,
- all-agent calls for every report,
- repeated internet search by every analyst,
- automatic self-modification of production prompts,
- debate when independent conclusions already converge.

## 8. Analyst improvement loop

Analysts are versioned.

Current version
→ performance/error attribution
→ identify prompt/method/data failure mode
→ create challenger version
→ archived replay / prospective evaluation
→ promote only when challenger improves under defined metrics.

An analyst should not self-edit its production prompt without validation.

## 9. Data and cost optimization

Primary cost controls:

1. collect evidence once centrally,
2. deduplicate and normalize once,
3. select only relevant analysts,
4. skip debate when disagreement is immaterial,
5. cache published reports,
6. run delta analysis rather than full rebuilds,
7. allow user-triggered expensive research only under Plan + Credits,
8. make requested reports shareable after validation when appropriate,
9. store structured analyst memory rather than replaying full chat history.

## 10. Deletion gate

No AutoTrade-related code is deleted until:

1. dependency graph is known,
2. target AutoTrade repository/project exists,
3. reusable shared modules are identified,
4. trading history/ledger compatibility is preserved,
5. report-first code no longer imports execution modules,
6. CI passes without the migrated runtime,
7. rollback tag/commit is recorded.

## 11. Immediate implementation sequence

1. Approve Constitution v3 direction.
2. Inventory current source paths by migration class.
3. Define Report/Analyst/Debate/Forecast/Credit schemas.
4. Build read-only Report pipeline alongside existing runtime.
5. Build report-first Home/Discover/Reports/Watchlist shell.
6. Implement entitlements before real Credits.
7. Instrument cost telemetry before final Credit pricing.
8. Build Credit quote/debit/reversal ledger.
9. Add Alerts.
10. Migrate AutoTrade project and only then remove execution code from BLACK ORACLE.
