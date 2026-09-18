# BLACK ORACLE Open-Core Boundary

Status: PROPOSED REDESIGN POLICY
Date: 2026-09-18
Depends on: BLACK_ORACLE_PRODUCT_CONSTITUTION_V2.md

BLACK ORACLE uses an **open-core** model: the public repository should expose enough of the product architecture to be useful, inspectable, reproducible, and contributable without requiring proprietary Alpha, production secrets, private commercial configuration, or live-capital controls to be published.

The public project may describe the product contract for **Report** and **AutoTrade** while keeping execution edge and production authority private.

This document defines the default boundary under the repository's Apache License 2.0.

## Public core

The following areas are strong candidates for the public repository.

### Product and observability

- mobile/web operating surfaces,
- Home / Report / AutoTrade / Community shell contracts,
- Report discovery/detail and AutoTrade observability surfaces,
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
- research-grade vs execution-grade Evidence contracts,
- evidence/data-gap contracts,
- Arbiter interfaces,
- shadow-only evaluation framework,
- reference rule: **reuse lineage, not authority**.

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
- private execution-grade thresholds or scoring details where disclosure would reveal Alpha,
- private data-provider contracts or licensed datasets,
- production portfolio-allocation weights,
- unreleased strategy-selection policies.

### Live-capital controls

- exact production capital limits when disclosure creates risk,
- production-only kill-switch credentials,
- broker/account identifiers and credentials,
- reconciliation secrets and operational credentials,
- broker-specific operational secrets,
- live execution routing details that are security-sensitive.

### Commercial secrets and billing operations

Public documentation may expose the semantic plan ladder (**Core / Plus / Pro / Max / Enterprise**), the fact that **Pro ×2 / ×5 / ×20** are capacity multipliers, and the invariant that safety-critical information cannot be Credit-gated.

The following may remain private or deployment-configured:

- exact prices and promotional offers,
- private cost models,
- billing-provider credentials and webhook secrets,
- fraud/risk rules,
- enterprise contract terms,
- internal margin targets,
- non-public Credit conversion tables when commercially sensitive.

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

Any public documentation describing AI Council, Arbiter, Router, Strategy Factory, Report, or AutoTrade must state actual current authority.

A component that is **SHADOW_ONLY** must not be marketed as autonomously controlling production capital.

A **PAPER-only** AutoTrade product must not be described as live trading.

A Report may be described as research, but not as an execution approval merely because AutoTrade can reference the same source lineage.

## Declassification rule

Moving a component from private to public should be an explicit decision. Before publication, review:

- security risk,
- credential leakage,
- contractual/licensing restrictions,
- intellectual-property value,
- live-capital operational risk,
- and whether the release would invalidate a private competitive advantage.

## License and third-party dependency rule

The repository is licensed under **Apache License 2.0**.

Before public distribution of any new third-party dependency, UI asset, font, icon set, animation package, or copied reference implementation, confirm that its license and redistribution terms are compatible with the repository and document attribution where required.

Commercial entitlements do not change the license of code already published in the public repository.
