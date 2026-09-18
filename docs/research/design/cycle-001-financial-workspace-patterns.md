# Cycle 001 — Financial Workspace Patterns

Date: 2026-09-19

## D-001 — OpenBB Workspace as interaction reference

**Source:** OpenBB Workspace official documentation (reviewed 2026-09-19).

**Evidence:** A for product behavior/documentation; this is a product reference, not evidence of investment performance.

### Useful patterns
- Widgets are self-contained data units with source, metadata, visual layer and parameters.
- Dashboard parameters can coordinate interactive analysis.
- AI can receive dashboard/selected-widget context rather than operating as a detached chat surface.
- Generative UI can update widget parameters, add widgets and convert AI outputs into persistent dashboard objects.
- Iframe/widget protocols demonstrate a clean boundary between external analytical tools and the workspace shell.

### BLACK ORACLE gap
BO already has purpose-built surfaces (Markets, Council, Trade, Lab), but the research/decision experience can benefit from a shared context contract: `instrument + timeframe + regime + case/evidence IDs + strategy/model IDs`. Without that contract, each screen risks becoming an isolated dashboard.

### Hypothesis H-D001
A shared context contract plus persistent research cards will reduce navigation/context reconstruction while preserving the simpler mobile-first shell.

### Experiment EXP-D001
Prototype the pattern only in `Market Detail → Council → Strategy/Trade` flow. Add a compact context header and allow one evidence/research result to persist as a card when moving between these surfaces. Do not introduce a generic draggable desktop dashboard into the mobile app.

### Success criteria
- no duplicate instrument/timeframe selection during the test flow;
- all generated cards expose source timestamp and lineage IDs;
- mobile primary action remains reachable without horizontal scrolling;
- no material increase in first-screen information density;
- accessibility check includes keyboard/focus behavior on desktop and reduced-motion behavior.

**Decision:** `TEST` for shared context + persistent research object; `REFERENCE` for OpenBB's fully configurable dashboard shell.

## D-002 — Accessible financial visualization

**Source:** WCAG-oriented fintech implementation patterns reviewed 2026-09-19.

**Evidence:** C as implementation/design precedent. Accessibility requirements should ultimately be grounded in WCAG and tested directly in BO.

### Proposed BO design gate
Charts must not encode state using color alone. Each critical financial visualization should expose explicit units, textual/semantic alternatives for important values, visible focus states where interactive, and reduced-motion behavior. Real-time updates should not create disruptive announcements.

**Decision:** `TEST` as a design-system acceptance checklist before broad adoption.
