# BOT-A17 — Alpha Release-Readiness Truth Audit

Date: 2026-09-22
Target: Alpha v0.1 — 2026-10-20
Scope: read-only product/runtime truth audit
Disposition: **BLOCKED — remediation required before deployment decision**

## Research review

Constraints/precedents reviewed:
- `BOT-A15-H1 / BOT-A15-E1` — Decision Replay label requires canonical replay verification; event context alone is not replay.
- `BOT-A16-H1 / BOT-A16-E1` — five-primary-surface IA and global Ledger are adopted only as a read-only product slice.
- `EV-006 / EXP-EV006` — deterministic execution safety remains independent of strategy/Council/LLM authority.
- `DI-003 / EXP-DI003` — stale/future/missing decision evidence fails closed.
- `DI-004 / EXP-DI004` — snapshot/trace identity must remain explicit for replay continuity.
- S9 `bot.risk-execution-boundary.v1` — PAPER/LIVE_SHADOW only; `ALLOW_INTENT` is not order authority.
- S11 `bot.live-canary-readiness.v1` — readiness evidence never grants submission/execution/capital/LIVE authority.

No research result is promoted into production behavior by this audit.

## Evidence inspected

- `src/mobile/BlackOracleMobileAppV11_1.tsx`
- `api/trading-status.ts`
- `api/events.ts`
- A15/A16 product-truth records
- S9/S11 execution/readiness boundary records
- current `docs/automation/ACTIVE_SPRINT.md`
- current open PR inventory

## Surface truth matrix

| Surface | Canonical source | Result | Evidence / finding |
| --- | --- | --- | --- |
| Overview | `/api/trading-status` + canonical events-derived instrument universe | **BLOCKED** | Source exists, but the shell does not expose source failure/degraded state. A rejected refresh leaves prior state intact; an HTTP error can still be parsed as JSON because `response.ok` is not checked. |
| Strategy Lab | `/api/strategy-factory-status` | **BLOCKED** | Canonical source exists, but the shell has the same missing HTTP/degraded-state contract. Stale prior data can remain visible after a failed refresh without a visible stale/degraded marker. |
| Trading | `/api/trading-status` | **BLOCKED** | PAPER-backed fields are source-backed, but API/read failures are not surfaced by the shell. The product cannot yet prove displayed trading state is fresh/current during upstream failure. |
| Risk | `/api/trading-status` + canonical Risk events | **BLOCKED** | A16 correctly removed invented thresholds, but upstream operational reads in `api/trading-status.ts` can collapse missing config/non-OK Supabase reads to `[]`; absence and verified-empty are therefore not mechanically distinguishable for all operational evidence. |
| Ledger | `/api/events?limit=500` | **BLOCKED** | API truth is strong (`canonical`, `appendOnly`, `coverage`, `healthDegraded`, `healthError`), but the shell discards those metadata fields and renders only `events`. Ledger health degradation can therefore be hidden from the operator. |

## Cross-cutting findings

### A17-F1 — UI refresh does not fail closed on HTTP/API degradation — BLOCKING
The active shell uses `Promise.allSettled` and directly calls `response.json()` without checking `response.ok`. Failed requests do not clear or mark prior state stale. This violates the A17 acceptance criterion that unavailable/degraded canonical sources be truthfully exposed.

Required remediation: introduce a bounded per-source load-state contract (`OK | DEGRADED | UNAVAILABLE`, observed timestamp/error) and render it on affected primary surfaces. Never replace known-good prior data silently; if retained for context, label it stale/degraded.

### A17-F2 — Canonical Ledger health metadata is dropped — BLOCKING
`/api/events` explicitly returns `canonical`, `coverage`, `health`, `healthDegraded`, and `healthError`. The mobile shell narrows the response to `events` and loses the health semantics.

Required remediation: retain and display Ledger coverage/health. `healthDegraded=true` or a non-OK request must visibly degrade the Ledger; it must not look equivalent to a healthy empty event tape.

### A17-F3 — Some operational reads conflate unavailable with empty — BLOCKING
`api/trading-status.ts` helper `supabaseOperationalRead` returns `[]` when Supabase configuration is absent or a REST read is non-OK. For release-readiness truth, verified-empty and unavailable are materially different states.

Required remediation: return explicit operational-source health alongside data (or throw into an explicit degraded envelope) without exposing service-role secrets. Existing PAPER execution behavior must not be changed by this presentation/observability remediation.

### A17-F4 — Decision Replay semantic boundary — PASS
A15 mechanically verifies a concrete trace through `/api/decision-replay` before rendering canonical replay; generic market events remain context. Preserve unchanged.

### A17-F5 — Authority boundary — PASS
The audited A15/A16 product slices are read-only. S9/S11 explicitly keep execution/capital/LIVE authority false and deterministic Risk mandatory. No A17 change grants new financial authority.

### A17-F6 — Repository/runtime/database separation — PASS
This audit changes repository documentation only. No deployment, database migration, broker credential access, scheduler mutation, or PAPER-history mutation is part of A17.

## Release-readiness decision

**BLOCKED.** The five-surface IA is structurally mapped to real sources, but Alpha deployment readiness cannot be claimed while source failure, freshness, and Ledger health can be hidden or conflated with empty data.

This is a product-truth/observability blocker, not a trading-authority blocker. Existing PAPER behavior and lineage remain untouched.

## Exact remediation order

1. A18: add a read-only canonical source-health envelope to the active shell; enforce `response.ok`, preserve observed-at timestamps, and visibly mark stale/degraded/unavailable state.
2. A18: carry `/api/events` coverage + health metadata through the Ledger UI.
3. A18: distinguish unavailable vs verified-empty operational Supabase reads in `trading-status` without changing deterministic PAPER execution behavior.
4. Re-run this truth audit and require all five primary surfaces PASS before any deployment decision.

## Safety / rollback

No runtime or database mutation. Revert this audit PR if any evidence is shown incorrect. Do not relax Risk, enable unrestricted LIVE, expose credentials, or rewrite PAPER history to make the audit pass.
