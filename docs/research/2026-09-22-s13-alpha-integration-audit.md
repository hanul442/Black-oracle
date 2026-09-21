# BOT-S13 Alpha integration audit — 2026-09-22

## Scope
S13 composes the merged Alpha evidence contracts into one deterministic PAPER fixture: canonical validation binding → Champion–Challenger Router → Council/Red Team/Arbiter → deterministic Risk → Upbit order dry-run/reconciliation → authority-free canary readiness → outcome attribution / Decision Replay lineage.

S5 Market Scanner / Upbit KRW universe remains the upstream market-data boundary. S13 does not grant scanner output execution authority and does not invent a new market-universe contract.

## Research constraints reviewed
- `DI-001 / EXP-DI001`: experiment identity and validation schema remain evidence; no research candidate is silently promoted.
- `DI-003 / EXP-DI003`: stale/future evidence must fail closed.
- `DI-004 / EXP-DI004`: replay/snapshot identity constrains lineage closure.
- `EV-006 / EXP-EV006`: deterministic execution safety is independent of agents/Council.
- `EV-007 / EXP-EV007`: isolated control PASSes are insufficient; composition must be reconstructable. S13 uses this as an audit precedent only and does not adopt `bo.audit_bundle.v1` into production behavior.

## Deterministic fixture coverage
The integration test proves a successful PAPER evidence chain while asserting `executionAuthority=false`, `capitalAuthority=false`, and `liveAuthority=false` at every downstream boundary. Negative fixtures cover stale governance evidence, Council rejection, deterministic kill switch, reconciliation mismatch, and Event Ledger lineage mismatch. Outcome mismatch suppresses numeric attribution.

## Integration gap discovered — release blocker before any canary authority
S9 and S10 are safe individually but their contracts are not yet mechanically bound end-to-end. `BotRiskExecutionDecision` proves strategy/revision/risk snapshot lineage, while S10 `RiskApprovedIntent` separately introduces `market`, `side`, `quantity`, and `referencePrice`. The current contracts therefore do not cryptographically/deterministically prove that the exact order economics previewed by S10 are the same economics evaluated by S9 Risk.

S13 deliberately does **not** hide this seam. The fixture uses an explicit test-only adapter so the mismatch is visible. Before any separately authorized live canary, a follow-up must bind canonical order-intent identity/economics into deterministic Risk input/output and require S10 to consume that exact attested identity. Until then, unrestricted LIVE remains prohibited and existing PAPER behavior remains authoritative.

## Scope decision
This audit does not widen S13 into a Risk contract migration because that would be a separate execution-contract change requiring its own acceptance tests and rollback gate. The safe S13 deliverable is the cross-contract fixture plus the explicit blocker. No runtime/database migration, deployment, credential use, broker submission, or financial authority is introduced.
