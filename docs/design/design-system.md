# BLACK ORACLE Mobile Design System v1

## Direction

Premium mobile fintech with a light editorial feel: white surfaces, warm ivory atmosphere, restrained metallic-gold accents, dark navy/charcoal typography, and dense but calm financial information hierarchy.

## Layout

- Mobile-first baseline: 390–430 px CSS viewport.
- Prefer one primary content block per row.
- Avoid persistent two-pane layouts on mobile; use drill-down pages, accordions, tabs, drawers, or stacked cards instead.
- Keep a persistent bottom navigation for the five core destinations: Home, Markets, Council, Trade, Lab.
- Respect safe areas and leave comfortable top/bottom breathing room around system UI and navigation.

## Brand

- Master wordmark: `public/brand/black-oracle-wordmark.png`.
- Do not regenerate, redraw, or replace the master logo without an explicit branding decision.
- Visual tone: precise, calm, institutional, premium. Avoid excessive cyberpunk neon, casino-like glow, and ornamental clutter.

## Color intent

- Canvas: clean white.
- Secondary surfaces: warm white / ivory.
- Text: near-black / deep navy-charcoal.
- Accent: muted champagne / antique gold.
- Positive: restrained financial green.
- Negative: restrained financial red.
- Neutral / inactive: cool gray.

Exact tokens should be derived during implementation and centralized in theme variables rather than sampled independently per page.

## Typography

- High-contrast editorial display type may be used selectively for hero/page statements.
- Product UI, numbers, controls, tables, labels, and charts should use a highly legible sans-serif.
- Financial figures must retain strong numeric hierarchy and tabular alignment where appropriate.

## Components

Reusable primitives should include:

- App header + wordmark
- Bottom navigation
- Section/page hero
- Metric card
- Market ticker / sparkline card
- Status badge
- Segmented tabs
- Data list/table row
- Consensus gauge
- Risk-gate row
- Portfolio performance card
- Trade lifecycle timeline
- Council member row
- Debate / Red Team callout
- Strategy ranking row
- Monte Carlo distribution card
- Experiment ledger row
- Empty / loading / error states

## Data visualization

- Charts must be generated from runtime data using code/SVG/canvas, not embedded as static screenshots.
- Keep axes and labels minimal on overview cards; reveal detail on tap/drill-down.
- Positive/negative color alone must not be the only status cue.
- Monte Carlo, drawdown, confidence, and risk outputs should expose assumptions and context in detail views.

## Motion

- Motion should clarify state changes and hierarchy, not decorate every interaction.
- Recommended: subtle card entrance, tab transition, chart draw, gauge progress, bottom-sheet motion, trade-lifecycle state transition.
- Respect reduced-motion preferences.

## Current visual source of truth

Approved mockups are stored under `docs/design/mockups/mobile-v1/`:

- Home
- Markets
- Council
- Trade
- Lab

These are implementation references. Runtime truth, accessibility, responsive behavior, and existing BLACK ORACLE data lineage take precedence over illustrative values shown in the images.
