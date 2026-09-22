# BOT-A16 Product Integration Review — Alpha IA + Global Canonical Ledger

Date: 2026-09-22
Status: IMPLEMENTED / CI PENDING
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

## Acceptance
1. five primary destinations fit mobile/Fold navigation
2. Markets/Oracle remain reachable through contextual actions
3. Ledger is searchable/filterable and opens existing event detail
4. no contextual event list is mislabeled as Decision Replay
5. Risk values are runtime-backed only
6. Black Oracle CI + Trading CI pass

## Result
PENDING exact-head CI.

## Adopt / Reject
PENDING.

## Authority impact
None. Read-only UI/IA change.
