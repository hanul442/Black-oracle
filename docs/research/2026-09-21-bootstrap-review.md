# 2026-09-21 BOT Bootstrap Research Review

Purpose: bind today's implementation plan to the existing BLACK ORACLE R&D ledger before development continues.

## Reviewed research

### DI-001 — Canonical experiment record
Status: ADOPT-SCHEMA-CANDIDATE.

Implication for BOT:
Strategy validation must converge on one versioned experiment record carrying code/config, data identity, split manifests, execution assumptions, outputs and promotion decisions. Do not add another disconnected backtest ledger.

### DI-003 — Point-in-time feature availability
Status: TEST.

Implication for BOT:
Scanner/strategy features must distinguish event time from when information was actually knowable. Snapshot identity alone is insufficient.

### DI-004 — Snapshot-addressable replay
Status: TEST / REFERENCE.

Implication for BOT:
The newly added Upbit universe snapshot boundary is directionally aligned with immutable replay. Repository/read-model work should preserve exact snapshot identity and freshness semantics.

### EV-001 + Q-002 — Engine reproducibility and execution-cost risk
Status: TEST.

Implication for BOT:
Backtest-engine differences and transaction-cost assumptions are separate risk families. Alpha validation should stress them independently before Champion promotion.

### AIML-005 + AIML-006 — Agent/Council evaluation
Status: TEST.

Implication for BOT:
Council topology, disagreement handling and NO_TRADE policy are experimental variables. Do not expand agent count without a frozen regression baseline and budget-matched ablation.

### D-005 — Decision dashboard progressive disclosure
Status: TEST / REFERENCE.

Implication for BOT:
Trading surfaces should expose:
1. **Decision** — state, signal, risk, NO_TRADE, freshness.
2. **Why** — evidence, counter-evidence, disagreement, regime.
3. **Audit** — ledger, model/strategy versions, source and experiment lineage.

## Decision for today's sprint

No new alpha generator is added. The implementation priority remains:
1. repository/runtime separation,
2. scanner input integrity,
3. canonical validation/replay foundation,
4. only then broader Strategy Factory/Council expansion.

Production/PAPER behavior impact from this review: **None**.
