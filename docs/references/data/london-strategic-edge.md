# REF-DATA-001 — London Strategic Edge (LSE)

Status: **ADOPTED**
Domain: Market Data / Research Infrastructure
Provider: London Strategic Edge
Vault endpoint family: https://api.londonstrategicedge.com/vault
Captured: 2026-09-22

## BLACK ORACLE role

LSE is integrated as a read-only multi-asset market-data provider for internal research and model inputs.

## Implementation

PR #223 — `feat: add London Strategic Edge market-data provider`

Disposition:
- merged to `main` on 2026-09-21;
- server-side adapter implemented;
- authenticated API surface implemented;
- market-chart routing implemented;
- timeframe/normalization tests implemented.

Relevant surfaces include:
- `api/lse-market-data.ts`
- `server/market/lseMarketData.ts`
- `/api/market-chart?provider=LSE&...`

Capabilities:
- OHLCV candles;
- generic series (including macro/bond datasets where available);
- metadata;
- usage/allowance status.

## Authority boundary

The implementation intentionally declares:
- `executionEligible=false`
- `researchOnly=true`
- `redistributionAllowed=false`

LSE data must not silently become an execution-authorizing feed. Any later execution use requires a separately qualified live-data contract and explicit review of provider terms.

## Important naming note

This reference is **London Strategic Edge**, not the London Stock Exchange.
