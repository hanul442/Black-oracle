# V10 runtime module map

- `marketState.ts`: horizon-aware market state scoring.
- `sectorStrengthRuntime.ts`: constituent observations -> sector runtime packets.
- `marketSectorRuntime.ts`: shadow composition layer.
- Existing `equityUniversePolicy.ts`: 500k-share / KRW 100B / non-crypto-linked hard gate.
- Existing `largeParticipantFootprint.ts`: observable accumulation/distribution-like volume footprint proxy.
- Existing `investmentCommittee.ts`: 24-seat nomination, cross-review and Head Council cut.
- Existing `horizonPolicy.ts`: five independent trading horizons.
- Existing `timeframeAggregation.ts`: 1m/5m/15m/1h/4h/1D/1W/1M canonical frames.
- Existing `horizonTradePlan.ts`: forecast, entry, invalidation, stop and targets per horizon.

Runtime authority remains SHADOW and executionAuthority=false.
