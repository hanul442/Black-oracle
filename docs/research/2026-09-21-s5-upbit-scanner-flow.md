# BOT-S5 Upbit Scanner Flow Research Review

Date: 2026-09-21
Status: TEST

## Research → Hypothesis → Experiment → Result → Adopt/Reject

### Research
- **DI-003 / EXP-DI003:** scanner inputs must preserve when market metadata was actually observed; stale/future observations cannot be silently reused as current.
- **DI-004 / EXP-DI004:** scanner decisions should be reproducible from an exact persisted snapshot/read model rather than from an ephemeral network payload.
- **BOT bootstrap review:** repository/runtime separation and scanner input integrity are prerequisites before broader Strategy Factory/Council expansion.
- **BOT-S1:** the persisted read model recomputes freshness on every read; a last-good record may remain auditable while scanner eligibility fails closed.

### Hypothesis — BOT-S5-H1
One bounded scanner cycle can connect public collection to persisted/read-back eligibility while ensuring a network, persistence, freshness or lineage failure cannot leak an eligible market list downstream.

### Experiment — BOT-S5-E1
Implement a deterministic orchestration boundary:
`Upbit public collector → KRW universe snapshot → snapshot record → repository.save → readLatestUpbitUniverse → eligible markets`

Required failures:
- collector HTTP/payload error,
- persistence write error,
- stale/future read-back,
- read-back identity mismatch,
- zero eligible KRW markets.

### Production boundary
No alpha ranking, strategy promotion, execution, capital, portfolio, broker/private API or LIVE authority. This work controls scanner input integrity only.

### Result
Pending implementation and CI verification.

### Adopt / Reject gate
**ADOPT** only if all failure modes remain fail-closed and final scanner markets are derived exclusively from persisted/read-back canonical state.
