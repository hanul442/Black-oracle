# V10 Runtime Market + Sector Layer

This increment turns the V10 market/sector architecture into deterministic, horizon-aware scoring primitives while preserving all existing Paper execution boundaries.

## Market state

`src/trading/marketState.ts` produces a separate snapshot for every trading horizon. It combines index trend, breadth, turnover, volatility, source-backed Evidence, FX risk, rates risk and cross-asset context. Missing optional inputs reduce confidence and remain explicit DATA_GAPs.

The output includes a risk-on/risk-off stance and a conservative risk multiplier. It is analytical context only and does not grant execution authority.

## Sector strength runtime

`src/trading/sectorStrengthRuntime.ts` aggregates constituent-level observations by sector and horizon. It derives breadth, relative strength and volume participation and carries Evidence/fundamental gaps forward rather than filling them with invented data.

The resulting packet feeds the existing V10 `scoreSectorStrength` contract.

## Next wiring

1. Export the new modules through the trading barrel during integration.
2. Build live KOSPI/KOSDAQ breadth and turnover adapters.
3. Build a canonical sector taxonomy / constituent map.
4. Connect NARS Evidence to horizon market-state and sector packets.
5. Persist MARKET_STATE and SECTOR_STATE events in the Canonical Event Ledger.
6. Project live states into the V10 Investment Cycle UI.
7. Keep Council shadow-only and preserve S1R2 Paper qualification until separate promotion review.
