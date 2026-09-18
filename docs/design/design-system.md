# BLACK ORACLE Mobile Product Design System v2

Status: REDESIGN BASELINE
Date: 2026-09-18

## Direction

Premium mobile fintech with institutional data discipline and consumer-grade clarity.

Visual language remains:

- white primary surfaces,
- warm ivory secondary atmosphere,
- restrained metallic-gold accents,
- deep navy / charcoal typography,
- calm and dense financial hierarchy,
- restrained positive/negative market colors.

Avoid:

- cyberpunk neon,
- casino-like glow,
- ornamental clutter,
- fake dashboard density,
- decorative certainty where runtime data is unavailable.

---

## Product architecture

The previous five-destination navigation model is no longer the final information-architecture source of truth.

Approved primary mobile navigation:

**Home / Report / AutoTrade / Community**

The redesign may also expose a fast product-mode switch:

**AUTOTRADE | REPORT**

The navigation establishes product destinations; the switch is a convenience for moving quickly between the two primary work modes.

### AutoTrade mode

Primary user jobs:

- understand what the engine is doing now,
- inspect market and Evidence state,
- inspect current strategy/Router decisions,
- inspect Council/Arbiter/Risk reasoning,
- inspect active positions and trade history,
- inspect Decision Replay and validation.

### Report mode

Primary user jobs:

- choose an asset, company, market, or research topic,
- generate/open research,
- inspect source-backed Evidence,
- compare report versions,
- archive/share/reference reports.

Report is independent from execution authority. Reports may be referenced by AutoTrade but are not mandatory order gates.

### Shared shell

Shared infrastructure may include:

- wordmark / identity,
- Home attention surface,
- market search,
- instrument detail,
- investor profile,
- notifications,
- plan/capacity/Credit usage,
- data freshness/status,
- account/settings.

Bottom navigation uses **Home / Report / AutoTrade / Community** unless a later Constitution version explicitly changes it.

Community can render a truthful PLANNED or limited state before social features ship; fake feeds, fake users, or fake engagement are prohibited.

---

## Layout

- Mobile-first baseline: 390-430 px CSS viewport.
- One primary content block per row.
- Prefer full-page drill-down over modal-overload.
- Avoid persistent two-pane layouts on mobile.
- Respect safe areas.
- Keep important execution/risk state reachable one-handed.
- Long financial detail views must scroll naturally at document level unless a component explicitly requires independent scrolling.
- Desktop may add width and density but must not become a separate product architecture.

---

## Hierarchy

Each screen should answer one primary question.

Examples:

- Home: **What needs my attention now?**
- Markets: **What is happening in this asset?**
- AutoTrade: **What is the engine doing and what is it allowed to do?**
- Decision: **Why was this action selected or rejected?**
- Trade: **Where are entry, mark, protection, and outcome?**
- Replay: **What exactly happened in sequence?**
- Report: **What does the research currently support?**
- Lab: **What has actually been validated?**

Do not put every subsystem on every screen.

---

## Brand

- Master wordmark: `public/brand/black-oracle-wordmark.png`.
- Do not redraw or replace the master logo without an explicit branding decision.
- Tone: precise, calm, institutional, premium.
- Gold is an accent, not a background requirement.

---

## Typography

- Product UI, financial figures, controls, tables, labels, and charts use a highly legible sans-serif.
- Editorial display type may be used selectively for report covers, hero statements, or major section titles.
- Financial numbers require strong numeric hierarchy and tabular alignment where appropriate.
- Units, timeframes, timestamps, and currencies must never be visually ambiguous.

---

## Core components

Reusable primitives should include:

- App header + wordmark
- AutoTrade / Report segmented mode switch
- Context-aware bottom navigation
- Page hero / attention summary
- Metric card
- Market ticker / sparkline card
- Instrument search/result row
- Status / authority badge
- Data freshness badge
- Segmented tabs
- Data list / table row
- Strategy grade row
- Strategy competition/ranking row
- Council member row
- Red Team challenge callout
- Arbiter summary card
- Risk gate row
- Position performance card
- Entry / mark / SL / TP trade map
- Trade lifecycle timeline
- Decision Replay event row
- Evidence source card
- Evidence contradiction/staleness state
- Report card / report version row
- Monte Carlo distribution card
- Experiment ledger row
- Investor mandate / profile summary
- Strategy Library performance row with Backtest / Forward / PAPER provenance
- Plan / capacity / Credit usage meter
- Empty / loading / error / degraded / stale states

---

## Runtime truth

Production surfaces must distinguish:

- LIVE / CURRENT,
- DELAYED,
- STALE,
- DEGRADED,
- DATA_GAP,
- NOT_AVAILABLE,
- NOT_APPLICABLE.

Do not substitute illustrative values for missing production data.

Where a number matters to a decision, show:

- unit,
- timestamp or observation time when relevant,
- provenance/source where relevant,
- scope/timeframe,
- status if delayed or estimated.

---

## Data visualization

- Runtime financial charts use code/SVG/canvas, not raster screenshots.
- Overview cards minimize axes/labels; detail pages reveal full context.
- Positive/negative color cannot be the only status cue.
- Monte Carlo, drawdown, calibration, confidence, and risk outputs expose assumptions and sample limitations.
- Trade views should prioritize entry, current mark, stop, target, exposure, and realized/unrealized outcome.
- Evidence markers and decision events may overlay price charts only when their timestamps and trace links are known.

---

## Verified external component rule

Third-party visual components such as RectangleButtons may be integrated only from the approved source bundle or a license-compatible implementation whose origin and checksum can be verified.

Do not recreate an external component from screenshots while claiming source fidelity. Functional accessibility, reduced motion, and product truth take precedence over visual imitation.

---

## Motion

Motion explains hierarchy and state change.

Recommended:

- restrained page/section entrance,
- segmented-mode transition,
- tab transition,
- chart draw/update,
- trade-state transition,
- trace expansion,
- success/failure state acknowledgement.

Avoid continuous decorative animation.

Respect reduced-motion preferences.

---

## Full-page drill-down rule

Major entities should open as dedicated pages when the user needs to inspect history or reasoning:

- instrument,
- strategy,
- Council session,
- risk decision,
- trade,
- position,
- trace/replay,
- report,
- experiment.

Bottom sheets may be used for short actions, pickers, filters, and previews, not as the default container for deep financial analysis.

---

## Current visual references

The mockups under `docs/design/mockups/mobile-v1/` remain useful references for:

- white/ivory/gold tone,
- card density,
- hierarchy,
- premium financial styling.

They are **not** the canonical navigation specification after the 2026-09-18 redesign.

Runtime truth, accessibility, Constitution v2, the **Home / Report / AutoTrade / Community** architecture, Report/AutoTrade authority separation, traceability, responsive behavior, and this v2 design system take precedence over illustrative mockup values or old navigation.
