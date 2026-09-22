# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: black_oracle_bot
Status: **BOT-A16 ACTIVE — ALPHA IA + GLOBAL LEDGER**

## Completed baseline
- BOT-S0 through BOT-S14 complete.
- BOT-A15 canonical Decision Replay UI merged as PR #231 / 6dbe7cf4d7d17f9af2cc4f99a3a0d679f4a688da.

## BOT-A16
### Objective
Reduce the active product shell to five primary destinations and expose the Canonical Ledger as a first-class read-only product surface.

### Delivered
- Overview / Strategy Lab / Trading / Risk / Ledger primary navigation
- Markets and Oracle retained as contextual drill-ins rather than deleted
- global canonical Ledger uses the existing /api/events truth already loaded by the shell
- filter/search by event/type/market/strategy/source/authority
- event rows expose source, authority, severity and trace availability
- trace availability does not imply Decision Replay; A15 remains the verified replay path
- Risk surface prioritizes observed drawdown, daily P&L, open positions and recent Risk rejects
- no invented Risk thresholds

## Safety boundary
UI/IA only. No trading, Risk policy, order, strategy, database, PAPER history, broker or authority mutation.

## Exact next gate
Open PR, require exact-head Black Oracle CI + Trading CI green, verify mobile navigation/typecheck/build, document BOT-A16-E1, then merge only if green and mergeable.

## Cycle exit record
- Phase: **IMPLEMENT → CI GATE**
- Blocker: exact-head CI pending
- Single next priority: **verify A16 product shell + global Ledger**
