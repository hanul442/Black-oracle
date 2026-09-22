# BOT-A16 Product Integration Review — Alpha IA + Global Canonical Ledger

Date: 2026-09-22
Status: VERIFIED / ADOPT
Hypothesis: BOT-A16-H1
Experiment: BOT-A16-E1

## Problem
The active mobile/Fold shell still used legacy primary destinations (Command / Markets / Oracle / Trade / Lab / System) and did not expose a global canonical Ledger even though /api/events was already a product truth source.

## Hypothesis
The shell can become simpler without losing capability by making the primary destinations Overview / Strategy Lab / Trading / Risk / Ledger, while Markets and Oracle remain contextual drill-ins from Overview and decision detail.

## Implementation
- primary navigation becomes Overview / Strategy Lab / Trading / Risk / Ledger
- existing Markets and Oracle views remain reachable contextually and are not deleted
- add global read-only Ledger over the already-loaded canonical /api/events data
- Ledger exposes event type, market, time, source, authority, severity, and whether a trace reference exists
- trace availability is not called Decision Replay; A15 remains the only canonical replay verification path
- Risk surface now prioritizes observed current drawdown, daily P&L, open positions, and recent Risk rejections
- no UI-invented thresholds or execution authority

## Verification result
Exact implementation/docs head b7cde7e18109fb6fc590ab41ba1e105c85edcb93:
- Black Oracle CI #35684257298 — SUCCESS
- Black Oracle Trading CI #35684257249 — SUCCESS
- PR #232 mergeable after implementation CI — true

Typecheck, production build, trading-core tests, runtime bundle checks, scheduler bundle smoke, and production build remain green. No trading/Risk/database contract changed.

## Adopt / Reject
**ADOPT.** BOT-A16-E1 supports the hypothesis. The active shell can use five primary Alpha destinations while keeping Markets/Oracle context reachable and exposing the canonical event ledger without overstating trace semantics.

## Authority impact
None. Read-only UI/IA change.
