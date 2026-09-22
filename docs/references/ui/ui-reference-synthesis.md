# BLACK ORACLE UI Reference Synthesis

Status: **CANONICAL REFERENCE CONTEXT**
Captured: 2026-09-22

This note consolidates the durable intent behind previously supplied UI references. It does not replace `docs/design/design-system.md`; the design system remains implementation guidance.

## REF-UI-001 — Approved mobile mockups

Current approved mockups live under:
`docs/design/mockups/mobile-v1/`

Primary principles:
- mobile-first;
- white / warm ivory surfaces;
- restrained gold accent;
- strong numeric hierarchy;
- live code-rendered financial components;
- progressive disclosure rather than desktop-density compression;
- bottom-navigation-driven core flows.

These references are already preserved in the repository and have implementation lineage through prior mobile UI work.

## REF-UI-002 — Toss Securities × Palantir synthesis

Use the combination as a *design tension*:

**From Toss-like consumer fintech**
- immediate readability;
- clean hierarchy;
- low interaction cost;
- mobile comfort;
- polished microinteractions.

**From Palantir-like decision systems**
- traceability;
- dense but structured intelligence;
- explicit state;
- drill-down;
- provenance and operational truth.

BLACK ORACLE should not become a clone of either. The product target is:
**consumer-grade clarity + institutional-grade decision traceability.**

PR #158 is historical implementation lineage for the command-first phase, but later product/design documents may supersede specific navigation decisions.

## REF-UI-003 — Poker-style decision UI screenshots

User-supplied screenshots are retained conceptually as a reference for:
- clear decision/action zones;
- visible state hierarchy;
- compact numeric information;
- tension between current state and available action;
- fast scanning under uncertainty.

Do not import casino aesthetics, gambling metaphors, chips, neon, or ornamental table visuals into BLACK ORACLE.

Translate only the interaction lessons:
- obvious primary decision;
- compact context;
- clear state changes;
- strong disabled/blocked states;
- fast one-handed mobile operation.

## Cross-reference rule

When a new external screenshot, product, GitHub component, or app is supplied, add it to `docs/references/README.md` first. If it implies a testable product change, create a BO hypothesis/experiment in `docs/research/` before broad implementation.
