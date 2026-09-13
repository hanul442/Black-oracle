# V10 Implementation Checklist

## Completed in this branch

- [x] 5 independent trading horizons
- [x] 8 canonical timeframes and aggregation utilities
- [x] KRX hard universe gate: 500k shares, KRW 100B market cap, crypto-linked exclusion
- [x] 24-seat Investment Committee roster
- [x] Independent nomination contract
- [x] Cross-review contract
- [x] Red-team hard veto support
- [x] Head Council top-30% survival / bottom-70% cut
- [x] Horizon-specific forecast and trade-plan contract
- [x] Large-participant footprint proxy without unsupported actor attribution
- [x] Horizon-scoped shadow position identity
- [x] V10 mobile Investment Cycle UI shell
- [x] Unit tests for the new policy and aggregation layer

## Next runtime work

- [ ] Market-cap provider for KRX
- [ ] Company/sector/crypto-exposure classification provider
- [ ] Persistent intraday candle store for multi-day 1H/4H KRX history
- [ ] Live market-state packet
- [ ] Live sector-strength packet by horizon
- [ ] Structured Committee nomination endpoint
- [ ] Cross-review / debate / Red Team endpoint
- [ ] Head Council report persistence
- [ ] Canonical Event Ledger event extensions
- [ ] V10 live status projection in UI
- [ ] Shadow multi-horizon position book
- [ ] Outcome attribution by horizon, strategy, committee member and signal family
- [ ] Paper qualification evidence collection
- [ ] Separate promotion review before any execution-authority change

## Explicitly not changed

- Existing S1R2 Paper qualification runtime
- Existing market-keyed production Paper position storage
- Existing Council execution authority (`false`)
- Automatic strategy promotion / live deployment
