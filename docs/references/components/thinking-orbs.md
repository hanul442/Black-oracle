# REF-COMP-001 — Thinking Orbs

Status: **IMPLEMENTED / OPEN PR**
Domain: Component / AI State UX
Source: https://github.com/Jakubantalik/thinking-orbs
Upstream version referenced by implementation: 0.3.1
Upstream commit referenced by PR #222: `de85557ca220332586d070d8788c0e1d6e877a0d`
Captured: 2026-09-22

## Why BLACK ORACLE references it

Thinking Orbs provides a compact visual language for communicating that an AI/system is in a specific reasoning or runtime phase without relying on generic spinners or fake progress bars.

## BLACK ORACLE phase mapping in PR #222

- `boot → connecting`
- `collect → searching`
- `reason → solving`
- `council → weaving`
- `compose → composing`
- `idle → breathing`

## Intended BO role

Use the orb only where it communicates *real system state*. It should not become decorative ambient motion.

Good:
- boot/connectivity;
- evidence collection;
- reasoning;
- Council synthesis;
- report composition.

Bad:
- fake progress;
- random animation unrelated to runtime state;
- replacing textual error/blocked/stale states;
- hiding provenance or latency.

## Accessibility / performance requirements

Preserve the upstream behavior already noted in PR #222:
- reduced-motion support;
- offscreen/hidden-tab pause;
- DPR cap;
- theme behavior;
- ARIA semantics.

## Implementation status

PR #222 — `feat(ui): integrate Thinking Orbs into BLACK ORACLE runtime states`

Current disposition when this note was created:
- code exists;
- PR is open;
- not yet merged into `main`.

Do not treat this reference note as authorization to merge #222 without normal review/testing.
