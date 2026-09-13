# V10 Runtime Safety Boundary

- Existing S1R2 Paper qualification sample remains untouched.
- V10 Committee and new market/sector runtime are shadow-only.
- `executionAuthority=false` remains mandatory.
- Market-state, sector-state, volume footprint and Council scores are analytical inputs, never direct order authority.
- Missing required data is a DATA_GAP and must not silently pass.
- Same-symbol multi-horizon positions remain shadow identities until the market-keyed Paper position model is safely migrated.
- Production promotion requires separate evidence, replay, rollback and risk review.
