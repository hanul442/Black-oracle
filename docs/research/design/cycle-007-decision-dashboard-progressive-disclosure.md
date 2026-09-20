# Cycle 007 — Decision Dashboard Progressive Disclosure

Date: 2026-09-21
Research ID: D-005
Status: TEST / REFERENCE
Experiment: EXP-D005
Production impact: None

## Executive summary
Official GOV.UK data-visualisation guidance highlights a useful constraint for BLACK ORACLE: dashboards work best for frequently refreshed, high-level indicators and can fail when complex interpretation is pushed onto the user. The guidance recommends strong hierarchy, concise explanation, accessible alternatives, restrained colour use and source attribution.

For BO, this argues against putting every Forecast, Council vote, indicator, evidence item and strategy statistic on the default Market screen. The default surface should answer the next decision question; evidence and diagnostics should progressively disclose without losing traceability.

## Source quality
A- design-system precedent. The source is authoritative for accessibility and public-facing data communication, but it is not a trading-product usability trial. Treat as a design constraint/reference, not proof of trading performance.

## BLACK ORACLE gap
D-003/D-004 already define an accessible financial-chart wrapper and evidence-first semantics. The remaining gap is dashboard-level information architecture: what is visible by default versus behind an evidence/diagnostic layer.

## Proposed BO hierarchy
Layer 1 — Decision summary
- instrument / market state;
- current thesis or signal state;
- uncertainty / calibration state;
- risk and NO TRADE state;
- timestamp / freshness.

Layer 2 — Why
- top evidence and counter-evidence;
- Council disagreement;
- regime context;
- concise annotations near the relevant chart state.

Layer 3 — Audit
- full Evidence Ledger;
- model/strategy versions;
- experiment lineage;
- data/source lineage;
- execution assumptions and detailed diagnostics.

Essential claims shown graphically must remain available in text. Colour must not be the only carrier of signal/risk state. Charts should identify their data source and freshness.

## EXP-D005
Prototype two mobile-first Market Detail variants using the same data:
A. dense all-at-once dashboard;
B. three-layer progressive-disclosure dashboard.

Tasks:
1. identify current decision state;
2. explain why the signal exists;
3. locate strongest counter-evidence;
4. determine whether data are stale;
5. locate the exact evidence/experiment lineage.

Metrics:
- task completion;
- time-to-answer;
- critical-error rate;
- evidence retrieval success;
- stale-data detection;
- perceived workload;
- accessibility checklist failures.

## Decision
TEST / REFERENCE. Integrate with D-003/D-004 rather than creating another dashboard component stack.

## Sources
- GOV.UK Brand Guidelines — Data / Dashboards.
- GOV.UK Brand Guidelines — Data / Charts.
- GOV.UK Brand Guidelines — Charts / Colour.
