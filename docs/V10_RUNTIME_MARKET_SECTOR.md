# BLACK ORACLE V10 — Market + Sector Runtime

This increment converts the V10 architecture into deterministic, horizon-aware market and sector scoring primitives without changing the current S1R2 Paper qualification runtime.

## Market state

A separate state is produced for `ULTRA_SHORT`, `SHORT`, `MEDIUM`, `MEDIUM_LONG`, and `LONG`. Inputs include index trend, breadth, turnover, volatility, source-backed Evidence, and optional FX/rates/cross-asset context. Missing optional inputs reduce confidence and remain explicit `DATA_GAP`s.

## Sector strength

Constituent observations are grouped by sector and horizon. The runtime derives breadth, relative strength, volume participation, Evidence support, fundamental momentum and risk penalty before feeding the existing V10 sector-strength scoring contract.

## Volume / large-participant footprint

The existing V10 footprint module is treated as behavioural evidence only: abnormal volume, repeated participation, absorption/distribution-like price response, VWAP/volume-profile context, and independently sourced foreign/institutional flow when available. The system does not infer a specific actor or manipulation from volume alone.

## UI projection

The V10 Investment Cycle should evolve from a static architecture screen to a live operational read model showing:
- five horizon market-state chips and score history
- ranked strong sectors with breadth and volume charts
- funnel counts from universe -> eligible -> nominations -> debate -> survivors -> trade plans
- candidate rows with market cap, volume, Evidence, footprint state and Council score
- 1m / 5m / 15m / 1h / 4h / 1D / 1W / 1M chart selector
- Council cross-review matrix, Red Team objections and Head Council report
- horizon-specific forecast range, entry, invalidation, SL, TP1, TP2 and outcome review

## Next runtime sequence

1. KRX market-cap + sector/company classification provider with fail-closed crypto-linked exclusion.
2. Persisted KRX intraday history for reliable multi-session 1H/4H frames.
3. NARS Evidence wiring into market/sector packets.
4. Canonical Ledger events for MARKET_STATE and SECTOR_STATE.
5. Structured Committee nomination/cross-review/debate endpoints.
6. Live V10 UI projection.
7. Shadow multi-horizon position book and outcome attribution.
8. Separate Paper qualification and promotion review before any execution-authority change.
