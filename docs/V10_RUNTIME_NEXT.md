# V10 Runtime — Next Integration Sequence

1. Wire market-state and sector-strength modules into the V10 Investment Cycle runtime.
2. Add KRX market-cap and sector/company classification provider with fail-closed crypto-linked exclusion.
3. Persist enough KRX intraday history to make 1H/4H signals multi-day rather than current-session only.
4. Connect NARS evidence IDs to market-state, sector-state and committee nominations.
5. Add structured Committee nomination, cross-review, debate and Red Team endpoints.
6. Persist Head Council reports and horizon trade plans.
7. Extend Canonical Event Ledger lineage: MARKET_STATE -> SECTOR_STATE -> UNIVERSE_GATE -> NOMINATION -> CROSS_REVIEW -> DEBATE -> RED_TEAM -> HEAD_COUNCIL -> HORIZON_PLAN -> RISK -> ORDER -> OUTCOME -> LEARNING.
8. Replace V10 static cycle UI with live packet status, charts and drill-downs.
9. Add shadow multi-horizon position book using market::horizon::strategyId identity.
10. Add outcome attribution and strategy/member score updates before any promotion review.
