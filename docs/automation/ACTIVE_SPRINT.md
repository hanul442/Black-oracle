# ACTIVE SPRINT — BOT Alpha Product Integration

Date: **2026-09-22**
Target release: **2026-10-20 — Alpha v0.1**
Repository: `hanul442/black_oracle_bot`
Status: **BOT-A15 COMPLETE / BOT-A16 QUEUED**

## Completed
- BOT-S0 through BOT-S14 complete.
- S14 canonical order economics ↔ deterministic Risk merged as PR #229 / `66681b41856fe9fcff96df388167215f4e37bbdb`.
- Thinking Orbs normalized and merged as PR #230 / `78183f474db0938dce945d72f7a1fc7aca2bee01`.
- BOT-A15 canonical Decision Replay UI merged as PR #231 / `6dbe7cf4d7d17f9af2cc4f99a3a0d679f4a688da`.
- A15 final head passed Black Oracle CI + Trading CI and BOT-A15-E1 = **ADOPT**.
- Instrument Cockpit now shows **Canonical Decision Replay** only after exact trace verification; otherwise it truthfully shows **Market event context**.

## Safety boundary
Alpha product integration remains read-only unless a separately approved execution package says otherwise. Do not expand broker/Risk/order authority or mutate protected PAPER history.

## BOT-A16 candidate — active-shell Ledger / IA alignment
The active mobile/Fold shell still exposes legacy top-level `Command / Markets / Oracle / Trade / Lab / System`. The Alpha product target is simpler: Overview / Strategy Lab / Trading / Risk / Ledger, with Markets and Oracle/Council reachable in context rather than competing as primary destinations.

Next slice:
- preserve existing Markets and Oracle views as contextual drill-ins
- make primary navigation Overview / Strategy Lab / Trading / Risk / Ledger
- add one global canonical Ledger surface over the already-loaded `/api/events` truth
- show event type, market, timestamp, authority, source, severity and trace availability
- event detail remains read-only
- never call a contextual event stream Decision Replay unless A15 verifies a trace
- preserve mobile/Fold scrolling, empty/error/degraded states, and runtime-backed values only

## Exact next gate
Implement the smallest navigation + global Ledger slice on current main, run Black Oracle CI + Trading CI, and merge only if green and conflict-free.

## Current deployment state
Legacy Railway/PAPER services unchanged. No deployment/database mutation is required.

## Cycle exit record
- Phase: **BOT-A15 COMPLETE → BOT-A16 QUEUED**
- Blocker: none for repository UI work
- Alpha status: execution safety complete; product truth integration continuing
- Single next priority: **primary IA alignment + global canonical Ledger**
