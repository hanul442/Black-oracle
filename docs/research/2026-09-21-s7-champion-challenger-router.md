# BOT-S7 Champion–Challenger + Strategy Router — Research Review

Date: 2026-09-21
Status: IMPLEMENTATION GATE

## Constraints reviewed
- **DI-001 / EXP-DI001:** consume canonical experiment/evidence identity; no parallel promotion truth.
- **DI-003 / EXP-DI003:** downstream routing cannot repair unsafe or non-point-in-time evidence.
- **DI-004 / EXP-DI004:** exact evidence lineage/fingerprints must remain replayable.
- **EV-001 / EXP-EV001:** engine/result identity is validation evidence, not a ranking score.
- **EV-002 / EXP-EV002:** robustness evidence remains distinct from performance ranking.
- **EV-003 / EXP-EV003, EV-005 / EXP-EV005:** DSR/PBO and trial-family thresholds remain TEST/REFERENCE; S7 adopts none.
- **Q-002 / EXP-Q002:** regime-aware routing is an experimental architecture direction. S7 implements deterministic fail-closed mechanics only, not a claimed profitable routing policy.
- **S6 precedent:** canonical PASS validation can make a candidate validation-eligible but grants no promotion/execution/capital authority.
- **Legacy Sprint-7 precedent (#29):** Champion replacement remains outside automatic lifecycle/Vault authority.

## Hypothesis — BOT-S7-H1
A small deterministic comparison/router contract can make insufficient, stale, tied, regime-incompatible, or validation-ineligible states explicit as `NO_TRADE`, while preserving exact candidate/evidence lineage and granting no trading authority.

## Experiment — BOT-S7-E1
Implement `bot.strategy-router-decision.v1` that accepts two S6 validation bindings plus explicit observation freshness, regime fit and comparison scores. It must fail closed unless both candidates are valid/fresh/regime-compatible and exactly one has the higher finite comparison score. Exact ties return `NO_TRADE`.

## Production boundary
This contract is proposal/evidence only. It cannot replace the Champion, bypass deterministic Risk, allocate capital, submit/cancel/resize orders, mutate PAPER state, access broker secrets, or enable LIVE. Numerical research thresholds are not promoted.

## Disposition before implementation
**PROCEED WITH BOUNDED CONTRACT.** Adoption requires deterministic tests and required repository CI.