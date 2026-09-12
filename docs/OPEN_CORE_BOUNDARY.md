# BLACK ORACLE Open-Core Boundary

Status: launch policy draft

BLACK ORACLE is intended to use an **open-core** model: the public repository should expose enough of the architecture to be useful, inspectable, reproducible, and contributable without requiring proprietary Alpha or production secrets to be published.

This document defines the default boundary. It does not replace the final software license, which must be selected explicitly before the public launch campaign.

## Public core

The following areas are strong candidates for the public repository.

### Product and observability

- mobile/web operating surfaces,
- runtime-health read models,
- decision logs and trace drill-down,
- visualization components,
- public architecture documentation.

### Decision lineage

- canonical event contracts,
- trace identifiers and linkage rules,
- Decision Replay,
- outcome linkage,
- calibration interfaces,
- audit-preservation utilities.

### Research framework

- Strategy Factory lifecycle interfaces,
- Router abstractions,
- baseline/sample strategies,
- experiment-ledger contracts,
- OOS / walk-forward / Monte Carlo utilities,
- grade-system methodology,
- reproducible validation examples.

### AI decision framework

- Council Constitution,
- role definitions,
- independent Red Team architecture,
- evidence/data-gap contracts,
- Arbiter interfaces,
- shadow-only evaluation framework.

### Safety architecture

Where publication does not create a material security risk:

- deterministic risk-gate interfaces,
- authority semantics,
- qualification principles,
- fail-closed behavior,
- Paper execution framework,
- fault-containment and recovery design.

## Private / proprietary Alpha

The following should remain outside the public repository unless explicitly declassified.

### Secrets and infrastructure

- API keys,
- broker credentials,
- Supabase service-role keys,
- cron/internal secrets,
- signing keys,
- production-only infrastructure credentials,
- private network or access-control details.

### Proprietary investment edge

- private strategy parameters,
- production strategy weights,
- non-public feature engineering,
- private Alpha models,
- proprietary signal-combination logic,
- private data-provider contracts or licensed datasets,
- production portfolio-allocation weights,
- unreleased strategy-selection policies.

### Live-capital controls

- exact production capital limits when disclosure creates risk,
- production-only kill-switch credentials,
- broker-specific operational secrets,
- live execution routing details that are security-sensitive.

## Public example policy

When a private component is required to demonstrate the architecture, prefer one of these approaches:

1. publish an interface and a deterministic mock,
2. publish a baseline/reference implementation,
3. publish a synthetic dataset,
4. publish a Paper-only adapter,
5. publish the validation contract without the proprietary model.

The public example must be clearly labeled so it is not mistaken for the production Alpha implementation.

## Performance disclosure

Public performance claims should identify:

- PAPER vs live,
- runtime/cohort identity,
- date range,
- valid sample size,
- fees/slippage assumptions,
- strategy/policy version,
- whether results are in-sample or out-of-sample,
- and whether a metric is observational, counterfactual, or causal.

Do not publish cherry-picked returns as evidence of production readiness.

## Authority disclosure

Any public documentation describing AI Council, Arbiter, Router, or Strategy Factory must state their actual current authority.

A component that is `SHADOW_ONLY` must not be marketed as autonomously controlling production capital.

## Declassification rule

Moving a component from private to public should be an explicit decision. Before publication, review:

- security risk,
- credential leakage,
- contractual/licensing restrictions,
- intellectual-property value,
- live-capital operational risk,
- and whether the release would invalidate a private competitive advantage.

## License dependency

Open core only works cleanly when the public license is explicit. Before the launch campaign, select and add the repository license, then confirm that all third-party dependencies/assets and contributed code are compatible with that choice.
