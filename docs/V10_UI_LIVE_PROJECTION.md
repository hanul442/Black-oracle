# V10 UI Live Projection

The V10 Investment Cycle UI should stop being a static architecture explainer and become an operational read model.

## Home / Oracle Radar
- Active cycle stage and last successful refresh
- Horizon market-state strip: Ultra-short, Short, Medium, Medium-long, Long
- Strong-sector ranking with score change and breadth
- Candidate funnel counts: universe -> eligible -> nominated -> debated -> survived -> executable
- Current NO_TRADE / blocker reasons

## Investment Cycle
- Vertical stage flow with per-stage status, count and latency
- Market-state charts by horizon
- Sector heatmap / ranked bars
- Candidate table with volume, market cap, footprint proxy, Evidence count, Council score and horizon
- Council member cards with persona, strategy family, nominations, hit rate, calibration and dissent
- Cross-review matrix and debate transcript
- Red Team objections and survivorship state
- Head Council top 30% report
- Horizon-specific forecast range and Trade Map

## Instrument Cockpit
For the selected stock, show five independent horizon rows. Each row owns strategy, required timeframes, thesis, Evidence, footprint state, score, expected price/range, entry, invalidation, stop, TP1/TP2, target and outcome history.

## Chart requirements
- 1m / 5m / 15m / 1h / 4h / 1D / 1W / 1M selector
- Price + volume
- VWAP and volume-profile context when available
- abnormal-volume / absorption markers
- entry, invalidation, SL, TP1, TP2 overlays
- horizon badges so a long-term thesis is never confused with a short-term entry

All UI projections are read-only until the shadow runtime is qualified. Council remains executionAuthority=false.
