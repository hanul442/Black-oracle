# BOT-A18 — Alpha Source-Truth Re-Audit

Date: 2026-09-22
Scope: repository/runtime-read contract only
Disposition: **PASS at repository boundary; deployment attestation remains separate**

## Re-audit matrix

| Surface | Canonical source | Result | A18 evidence |
| --- | --- | --- | --- |
| Overview | `/api/trading-status` + canonical events | **PASS** | HTTP failures are rejected; retained state is marked `UNAVAILABLE / STALE RETAINED`; trading payload exposes source health. |
| Strategy Lab | `/api/strategy-factory-status` | **PASS** | API emits canonical source health and a 36-hour source-specific staleness boundary; shell renders degraded/unavailable state. |
| Trading | `/api/trading-status` | **PASS** | checkpoint-backed state has source health; failed refresh cannot silently present retained data as current. |
| Risk | `/api/trading-status` + canonical Risk truth | **PASS** | UI continues to display observed runtime values only; source degradation is visible and no UI risk threshold is invented. |
| Ledger | `/api/events` | **PASS** | coverage, `sourceHealth`, `healthDegraded`, and `healthError` survive the client boundary and are rendered. |

## Blocking findings from A17

### A17-F1 — shell refresh failed open
**RESOLVED.** Canonical requests now require HTTP success. A failed source refresh retains last-known-good data only with explicit unavailable/stale health.

### A17-F2 — Ledger health metadata dropped
**RESOLVED.** The shell stores the complete Ledger payload and renders coverage / health state / observation time / health error.

### A17-F3 — operational reads conflated unavailable and empty
**RESOLVED.** `supabaseOperationalRead` now returns an attached canonical source-health envelope. A successful zero-row read is `OK + verifiedEmpty=true`; missing configuration, non-OK REST reads, timeout, or exception are `UNAVAILABLE + verifiedEmpty=false`.

### A17-F4 — Decision Replay semantic boundary
**PASS / unchanged.** Canonical replay remains separately verified from event context.

### A17-F5 — authority boundary
**PASS / unchanged.** A18 grants no execution, order, capital, broker, promotion, or unrestricted LIVE authority.

### A17-F6 — repository/runtime/database separation
**PASS for A18 change.** No schema or deployment mutation is performed by A18.

## CI evidence
Implementation head `0887fef3534e956f4a9dce53dd0e8b046d356438`:
- Black Oracle CI `35709793587`: SUCCESS
- Black Oracle Trading CI `35709793619`: SUCCESS

A prior A18 red build was also used as evidence. The final blocking compile defect was not optional-number narrowing; it was an invalid comparison of `LedgerHealthStatus = HEALTHY | DEGRADED | CRITICAL` to `OK`. The implementation now compares against `HEALTHY`.

## Decision
The A17 repository-level source-truth blockers are closed. **Do not infer production deployment readiness from this PASS.** Runtime Foundation still requires exact-revision deployment attestation and one authoritative PAPER writer/scheduler per protected runtime.
