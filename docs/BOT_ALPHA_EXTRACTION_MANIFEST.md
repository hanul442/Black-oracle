# Black Oracle Trading (BOT) — Alpha Repository Extraction Manifest

Status: **BOT-A01 / Alpha scope frozen**  
Target: **BOT v0.1 Alpha — 2026-10-20**

## Purpose

This document is the migration contract for extracting Black Oracle Trading (BOT) from the legacy `Black-oracle` repository into an independent repository/runtime. It intentionally defines boundaries before code is copied so BOR/research-only concerns do not leak into the trading product.

## Product invariant

BOT must remain independently operable without BOR. Research/evidence may be consumed through explicit contracts later, but BOR availability must never be required for risk checks, execution, reconciliation, or recovery.

## Alpha core loop

`Market → Strategy → Validation → Decision → Risk → Execution → Outcome → Ledger/Replay`

Alpha is complete only when this loop works end-to-end in PAPER/LIVE_SHADOW. `LIVE` remains blocked. `LIVE_CANARY` is readiness-gated and is not a release requirement.

## Extract from legacy repository

### Runtime entrypoints
- `trading-server.ts`
- trading-specific API handlers, including current trading status/paper cycle/strategy-factory endpoints

### Trading domain
- `server/trading/**`
- `src/trading/**`
- trading event-ledger modules and tests required by the trading runtime

### Verification and operations
- `.github/workflows/trading-ci.yml`
- `scripts/trading-smoke.ts`
- `scripts/paper-protection-diagnostic.ts`
- `scripts/export-paper-protection-events.ts`
- `scripts/run-paper-protection-evidence.ts`
- `scripts/verify-paper-protection-baseline.ts`

### Shared code
Shared modules are copied only when required by BOT runtime/tests. Each copied shared module must be classified as one of:
1. BOT-owned after extraction;
2. temporary compatibility dependency with a removal issue;
3. explicit external/API contract.

No implicit import back to the legacy repository is allowed.

## Exclude from BOT

The following concerns belong to BOR or legacy archive unless a narrow BOT contract explicitly requires them:
- NARS/news ingestion and editorial briefing pipelines;
- report generation and report archive;
- research-only agent orchestration;
- general product UI unrelated to trading;
- BOR database tables and BOR deployment secrets.

## Safety invariants

1. `LIVE` authority is **blocked** in Alpha.
2. Risk Engine cannot be bypassed by Strategy Router, Council, agents, UI, or broker adapter.
3. Broker/API secrets never enter frontend bundles, prompts, agent context, logs, or committed files.
4. PAPER and LIVE-capable runtimes must not share broker credentials.
5. Broker/exchange state is settlement truth during reconciliation.
6. Duplicate-order protection and idempotent order identity are mandatory before LIVE_CANARY.
7. Kill switch and reconciliation failures fail closed: no new order may be emitted.
8. `NO_TRADE` is a valid normal decision.

## Target repository baseline

Recommended independent repository name: `black-oracle-trading`.

Minimum root structure:

```text
black-oracle-trading/
├── .github/workflows/trading-ci.yml
├── docs/
│   ├── ALPHA_SCOPE.md
│   └── ARCHITECTURE.md
├── scripts/
├── server/trading/
├── src/trading/
├── trading-server.ts
├── package.json
├── tsconfig.json
└── .env.example
```

The new repository must use its own database/runtime/environment variables and deployment. Legacy repository credentials must not be copied blindly; only required BOT variables should be recreated in the new deployment secret store.

## Extraction acceptance gates

### G0 — Repository
- Independent BOT repository exists.
- Default branch and CI are functional.
- No BOR-only runtime dependency is required to boot BOT.

### G1 — Build/test
- Typecheck/lint passes.
- Trading unit/integration suite passes.
- Trading smoke test passes.
- Paper-protection baseline verification passes.

### G2 — Runtime
- Trading gateway boots independently.
- `/health` is healthy with expected dependencies.
- Runtime checkpoint restore/autosave/shutdown path is verified.

### G3 — Safety
- `LIVE` cannot be selected accidentally.
- PAPER/LIVE_SHADOW authority checks are deterministic.
- Risk rejection is fail-closed.
- No broker secret is present in client code or repository history introduced by migration.

### G4 — Deploy
- BOT has an independent deployment/runtime.
- Deployment health check passes.
- PAPER loop can run without BOR.

## Alpha backlog order after extraction

1. **BOT-A02 — Authority model:** SHADOW/PAPER/LIVE_SHADOW/LIVE_CANARY/LIVE with LIVE hard-blocked.
2. **BOT-A03 — Deterministic risk gate:** exposure, per-position risk, drawdown, cooldown, kill-switch behavior.
3. **BOT-A04 — Market universe:** Upbit KRW scanner with listing/liquidity/spread/volatility/anomaly filters.
4. **BOT-A05 — Validation:** Backtest → OOS/Walk-Forward → Monte Carlo/cost stress → Paper gates.
5. **BOT-A06 — Strategy lifecycle:** registry, versioning, Champion/Challenger, degradation/retirement.
6. **BOT-A07 — Decision path:** Router + NO_TRADE + Council/Red Team/Arbiter with deterministic risk finality.
7. **BOT-A08 — Execution readiness:** Upbit adapter/dry-run, idempotency, private fill state, reconciliation.
8. **BOT-A09 — Ledger/replay:** trace-complete signal→decision→risk→order→fill→outcome replay.
9. **BOT-A10 — Alpha hardening:** incident recovery, regression suite, mobile product shell, release candidate.

## Definition of done for BOT-A01

BOT-A01 is complete when this extraction contract is accepted and the independent repository is created from the declared boundary. Repository creation itself is currently an external prerequisite if the connected GitHub capability cannot create repositories; migration must not be simulated by renaming the legacy repository.
