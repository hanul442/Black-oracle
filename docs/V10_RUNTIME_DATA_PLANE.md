# BLACK ORACLE V10 — Runtime Data Plane

## Purpose

This increment turns the V10 investment-cycle architecture into a defensible KRX input layer without changing execution authority or the existing S1R2 Paper qualification runtime.

## KIS profile enrichment

The official KIS domestic-stock current-price response is used to obtain:

- current price and session OHLCV
- sector name
- listed share count
- foreign net-buy quantity
- program net-buy quantity
- foreign holding quantity / exhaustion rate
- volume turnover
- PER / PBR / EPS / BPS
- temporary stop / investment caution / market warning / short-term overheat / liquidation / management-issue flags

Market capitalization is derived as:

`current price × listed shares`

This produces a KRW-denominated value for the V10 KRW 100B hard gate and avoids depending on display-unit assumptions for `hts_avls`. The raw `hts_avls` value is retained only for audit.

## Source-backed crypto exposure

Crypto-linked exclusion is not inferred from silence or from a company name. `EquityExposureRegistry` requires explicit, expiring, source-backed classification records:

- `CLEAR`
- `CRYPTO_LINKED`
- `UNKNOWN`

`UNKNOWN` remains blocked by the universe gate. Conflicting records are preserved as a data gap even when the stronger record determines the provisional status.

## KRX universe packet

`buildKrxUniversePacket` performs:

1. KIS volume ranking discovery, up to 100 names.
2. 500,000-share hard prefilter.
3. KIS stock-profile enrichment for the configured candidate cap.
4. Market-cap, suspension/warning and crypto-exposure hard gates.
5. Structured output containing eligibility reasons, data gaps, valuation fields and observed foreign/program flows.

The packet is `mode=SHADOW`, `executionAuthority=false`.

## Large-participant / “세력” analysis

`participantFlowFootprint` combines:

- anonymous price/volume behavioral footprint
- published KIS foreign net flow
- published KIS program net flow

It can label accumulation-like / distribution-like behavior and can state that foreign or program flow was observed. It still cannot infer manipulation, a hidden private actor, or a specific “세력”.

## Production blockers observed on 2026-09-13

Connected Railway Production service configuration currently does not expose `KIS_APP_KEY` or `KIS_APP_SECRET`. Existing `kisReadiness` therefore correctly remains `BLOCKED` until credentials are supplied to the appropriate Paper/data service.

Additional blockers:

- source-backed crypto-exposure classifications are not yet persisted in Production
- robust multi-day KRX 1H/4H history still needs a persisted intraday store or deeper provider
- V10 Committee nomination/debate persistence is not yet wired into the Canonical Event Ledger

No fallback mock data should bypass these blockers.

## Next increment

1. Persist market-state and sector-strength packets by horizon.
2. Persist exposure classifications with provenance and expiry.
3. Add multi-day intraday candle persistence and 1H/4H projections.
4. Add structured Committee nomination and cross-review endpoints.
5. Persist debate, Red Team and Head Council outputs to the Canonical Event Ledger.
6. Connect live V10 UI projections to those persisted packets.
