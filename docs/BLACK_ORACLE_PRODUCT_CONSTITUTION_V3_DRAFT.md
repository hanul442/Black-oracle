# BLACK ORACLE Product Constitution v3 — DRAFT

Status: PROPOSED / NOT CANONICAL  
Date: 2026-09-20  
Base: Product Constitution v2  
Purpose: Redefine BLACK ORACLE as a report-first AI investment research product and separate AutoTrade into a different project.

## 0. Status and migration rule

This document is a proposal. It does not supersede Product Constitution v2 until explicitly approved and merged as the new canonical product baseline.

No trading runtime, Paper qualification, broker, order, position, risk, scheduler, database authority, or production deployment is changed by this document.

AutoTrade code must not be deleted until a separate migration audit classifies every affected module as KEEP, REFACTOR, MOVE_TO_AUTOTRADE, DELETE, or NEW.

## 1. Product definition

BLACK ORACLE becomes a **Report-first AI Investment Research Platform**.

The public product exists to help users:

- understand current market conditions,
- discover important investment issues,
- monitor watchlisted assets,
- discover high-grade new research,
- inspect price and technical context,
- understand why AI analysts disagree,
- inspect source-backed evidence and counterevidence,
- inspect forecast ranges and their historical accuracy,
- receive general investment action guidance without executing orders.

BLACK ORACLE is not the execution surface for automated trading.

AutoTrade, Paper execution, future live trading, position sizing, broker integration, strategy routing for order generation, execution protection, and trading-runtime qualification move to a separate project.

## 2. Primary user experience

The default journey is:

Market state
→ investment issues
→ watchlist changes
→ new/high-grade reports
→ asset chart
→ historical report markers and grade changes
→ report preview/full report
→ analyst disagreement and debate
→ domain lead synthesis
→ forecast and general action guidance
→ later forecast-vs-actual evaluation

The product should make the user naturally ask:

1. What changed?
2. Why did the grade change?
3. Which analysts disagree?
4. What evidence supports each side?
5. What does the domain lead conclude?
6. What price path was expected?
7. How accurate was the prior report?

## 3. Canonical report types

BLACK ORACLE supports seven report families:

- Market Report
- Industry Report
- Sector Report
- Company Report
- Security Report
- Event Report
- Crypto Report

Company Report asks whether the underlying business is attractive or changing.

Security Report asks whether the listed security is attractive **at the current price**.

## 4. Investment Attractiveness Grade

The user-facing AAA-to-F family grade represents **current-price investment attractiveness**, not company quality, model confidence, or a guarantee of return.

The grade may incorporate, where relevant and supported:

- fundamentals,
- earnings and growth,
- financial condition,
- industry and sector environment,
- current valuation,
- technical position,
- flows and liquidity,
- catalysts and events,
- macro conditions,
- expected upside/downside,
- uncertainty,
- counterevidence,
- risk.

Confidence is displayed separately from Grade.

A strong company may have a weak current Grade when price is unattractive. A weaker company may temporarily have a stronger Grade when expected reward relative to risk improves.

## 5. Report lifecycle

Reports are created through two triggers:

### Scheduled research

Scheduled scans check whether material information has changed. A schedule does not require a full report rewrite when nothing meaningful changed.

### Event-triggered research

Material events may trigger immediate review, including earnings, filings, policy decisions, major news, unusual price/volume moves, or other supported evidence changes.

The preferred update path is:

Existing report
+ new evidence
→ delta analysis
→ relevant analyst activation
→ debate only when warranted
→ domain lead synthesis
→ versioned report update

Historical report versions and forecasts are immutable after publication except for clearly labeled corrections.

## 6. Agent operating model

AI analysts are persistent analytical roles, not entertainment characters.

Each analyst has:

- stable role identity,
- domain,
- method version,
- prompt/config version,
- eligible evidence types,
- forecast horizon,
- track record,
- known strengths and weaknesses,
- evaluation metrics.

Persistent identity does **not** mean persistent inference. Analysts are invoked only when relevant work exists.

An Activation Router selects the smallest useful set of analysts for each report.

## 7. Debate and synthesis

The default research topology is:

Evidence
→ independent specialist analysis
→ disagreement detection
→ debate/counterargument when material
→ Red Team when warranted
→ domain lead synthesis
→ final report

Debate is not mandatory for every update.

When specialists materially agree, the system may skip debate and proceed to synthesis.

When conclusions materially conflict, a structured debate records claims, supporting evidence, counterevidence, assumptions, and data gaps.

The final synthesis is performed by a **domain-specific Lead Analyst**, not one universal arbiter.

## 8. Evidence model

NARS and the Evidence layer remain core infrastructure.

Supported evidence classes include:

- official filings and company disclosures,
- financial statements and IR material,
- market prices, volume and technical data,
- institutional/foreign flow where available,
- macroeconomic, rates, FX and commodity data,
- industry/sector data,
- research papers and institutional reports,
- policy/regulatory sources,
- news,
- social/community sentiment where appropriate.

Evidence processing should centralize collection, normalization, deduplication, provenance, timestamp integrity, contradiction detection and freshness.

Analysts should consume the relevant structured evidence subset instead of independently repeating the same searches.

## 9. Chart-first research interface

Security and Crypto detail use the chart as a primary research surface.

The chart may show:

- price/candles,
- support/resistance zones,
- selected technical indicators,
- historical report markers,
- historical Grade,
- report publication time,
- Bull/Base/Bear forecast paths or bands for entitled users,
- actual price after publication,
- relevant event markers.

Past forecasts must remain visible for later evaluation.

The interface should support direct transitions from a report marker to the exact historical report version.

## 10. Forecast and accountability

A report forecast may include:

- Bull case,
- Base case,
- Bear case,
- expected horizon,
- price range or path,
- invalidation conditions,
- major risks.

Forecasts are evaluated against later observed outcomes.

Evaluation may include direction, price error, timing error, calibration, and horizon-specific accuracy.

Report and analyst track records must preserve failed forecasts rather than displaying only successful research.

## 11. General action guidance

BLACK ORACLE may provide general report-level guidance such as:

- whether current attractiveness is strong or weak,
- whether chasing price appears unfavorable,
- whether staged entry may be more reasonable,
- relevant support/resistance,
- risk and invalidation conditions,
- suitable analytical horizon.

The report product does not perform user-specific portfolio sizing or execute trades.

Deep capital allocation, position sizing and execution move to AutoTrade.

## 12. Product information architecture

Proposed public navigation:

- Home
- Discover
- Reports
- Watchlist

Global Search remains available across the shell.

### Home

Home prioritizes:

1. overall market condition,
2. major investment issues,
3. meaningful changes in watchlisted assets,
4. new/high-grade reports.

### Discover

Discover supports market, industry, sector, company, security, event and crypto exploration.

The preferred discovery loop is:

High-grade or materially upgraded new report
→ price/grade/one-line view
→ chart
→ report.

### Reports

Report cards remain deliberately simple:

- current price where applicable,
- Grade,
- one-line assessment.

### Watchlist

Watchlist owns:

- saved assets,
- Alerts,
- Alert History.

## 13. Commercial model

Plans and Credits are separate.

**Plan = entitlement.**  
**Credits = usage of eligible compute/research actions.**

Credits do not bypass Plan gates.

Reading already-produced content should normally consume zero Credits.

New AI work, persistent monitoring, reruns, requested analysis or custom research may consume Credits.

The commercial ladder remains:

Core → Plus → Pro → Max → Enterprise

Detailed Credit policy is defined in `docs/product/CREDIT_ECONOMY_V1.md`.

## 14. Proposed plan roles

### Core — Discover

- price/chart,
- Grade,
- one-line assessment,
- news/filings,
- report preview,
- debate preview.

### Plus — Observe

- Alerts,
- full analyst debate,
- domain lead conclusion,
- Plus-eligible Credit actions.

### Pro — Understand

- full report detail,
- evidence/counterevidence,
- Bull/Base/Bear,
- forecast price/path,
- deeper report history/comparison,
- advanced Alerts,
- Pro-eligible AI actions.

### Max — Direct research

- expert invitation,
- Red Team request,
- debate rerun,
- new report request,
- report refresh,
- deep/custom research,
- scheduled research,
- research-trigger Alerts.

### Enterprise — Organization

- shared workspaces,
- organization watchlists,
- role/permission controls,
- API/bulk workflows where separately implemented,
- contracted Credit pools.

## 15. AutoTrade separation

The following concepts are candidates to move out of the public BLACK ORACLE product:

- Paper broker and execution,
- orders,
- positions,
- execution protection,
- automated entry/exit,
- strategy routing used to generate orders,
- deterministic trade risk,
- trading-runtime qualification,
- future live-capital integration.

The following concepts remain potentially reusable by the report product:

- NARS,
- evidence provenance,
- research lineage,
- report/forecast history,
- outcome evaluation,
- analyst evaluation,
- chart primitives,
- experiment/research ledger,
- validation concepts relevant to forecasts and research quality.

Deletion is prohibited until migration ownership is explicit.

## 16. Non-fabrication and provenance

BLACK ORACLE must not invent prices, evidence, forecasts, Grade inputs, analyst opinions, track records, or performance.

Material claims must preserve source/provenance and knowledge time where relevant.

Unavailable information is rendered as unavailable.

## 17. Next design gates

Before implementation:

1. approve or revise this v3 product definition,
2. complete feature/file migration classification,
3. define canonical Report schema,
4. define Agent/Analysis/Forecast schemas,
5. define entitlement and Credit contracts,
6. redesign IA and Design System,
7. implement report-first UI without mutating AutoTrade runtime,
8. migrate AutoTrade only through a separately controlled project transfer.
