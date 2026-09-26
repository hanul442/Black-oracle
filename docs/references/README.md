# BLACK ORACLE Reference Library

Status: **Canonical reference index**
Last updated: 2026-09-23

This directory preserves external references explicitly selected for BLACK ORACLE. It is the durable source of truth for *what was referenced, why it matters, what may be reused, what must not be copied blindly, and whether implementation exists*.

## Rule

Before reference-driven product, UI, component, market-data, or competitor work:

1. Read this registry.
2. Read the relevant reference note.
3. Check linked PRs / implementation files.
4. Preserve BLACK ORACLE Product Constitution, runtime truth, mobile-first constraints, evidence lineage, and authority boundaries.
5. A reference is **not** an implementation mandate.

## Status vocabulary

- **REFERENCE** — useful precedent; no implementation implied.
- **TEST** — candidate pattern/component requires isolated validation.
- **ADOPTED** — intentionally implemented and accepted.
- **IMPLEMENTED / UNMERGED PR** — code exists in a PR but has not been merged to main.
- **REJECTED** — intentionally not adopted.
- **SUPERSEDED** — retained for historical context only.

## Registry

| ID | Reference | Domain | BO use | Status | Implementation |
|---|---|---|---|---|---|
| REF-PROD-001 | Algory.app | Product / Competitor / Strategy UX | strategy discovery, automation lifecycle, strategy portfolio UX | REFERENCE | none |
| REF-PROD-002 | Agent OS / AI-assisted R&D reference bundle | Agent Architecture / UI / Quant R&D / Observability | skill registry, memory, browser fallback, design workflow, HeroUI v3, Oracle Trace patterns | REFERENCE / TEST | none |
| REF-COMP-001 | Thinking Orbs | Component / AI State UX | visible AI/runtime phase state | IMPLEMENTED / UNMERGED PR | PR #222 closed, not merged |
| REF-COMP-002 | ThreeUI / Rectangle Buttons | UI Component | premium compact action controls; motion/interaction inspiration | REFERENCE | none |
| REF-DATA-001 | London Strategic Edge (LSE) | Market Data | read-only multi-asset research/model inputs | ADOPTED | PR #223 merged |
| REF-UI-001 | BLACK ORACLE approved mobile mockups | Product UI | mobile-first white/ivory/gold financial shell | ADOPTED | docs/design + PR #64 lineage |
| REF-UI-002 | Toss Securities × Palantir synthesis | Product UI / IA | clarity + dense decision intelligence | ADOPTED / EVOLVING | PR #158 lineage |
| REF-UI-003 | Poker-style decision UI screenshots | UI / Decision Visualization | state hierarchy, table/action density, decision tension | REFERENCE | no standalone implementation |

## Canonical notes

- [Algory](product/algory.md)
- [Agent OS / AI-assisted R&D bundle](product/agent-os-rnd-reference-bundle-2026-09-23.md)
- [Thinking Orbs](components/thinking-orbs.md)
- [ThreeUI / Rectangle Buttons](components/threeui-rectangle-buttons.md)
- [London Strategic Edge](data/london-strategic-edge.md)
- [UI reference synthesis](ui/ui-reference-synthesis.md)

## Integration principle

External references should be decomposed into patterns, not copied as whole products.

Preferred lineage:

`REFERENCE → BO GAP → HYPOTHESIS → TEST → RESULT → ADOPT / REJECT`

When implementation exists, link it explicitly:

`REF-* → EXP-* (if needed) → PR → merged files → runtime/design truth`

## Important boundary

Reference notes may guide design and research, but they cannot override:
- canonical BLACK ORACLE product direction;
- authority and execution safety boundaries;
- provenance/freshness/data-truth rules;
- mobile accessibility and responsive behavior;
- evidence-backed validation requirements.
