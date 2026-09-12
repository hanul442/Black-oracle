# Contributing to BLACK ORACLE

Thanks for considering a contribution. BLACK ORACLE is an experimental investment operating system, so changes that look small can alter trading semantics, qualification comparability, or audit lineage.

## Good contribution areas

Contributions are especially welcome around:

- quantitative validation and backtesting methodology,
- event lineage, replay, and observability,
- probability calibration and uncertainty measurement,
- market-data quality and microstructure,
- multi-agent decision-system evaluation,
- deterministic risk controls,
- mobile financial-data UX,
- runtime reliability and fault containment,
- documentation and reproducible examples.

## Before you start

For architecture-level changes, read:

- `docs/BLACK_ORACLE_PRODUCT_CONSTITUTION_V1.md`
- `docs/BLACK_ORACLE_MASTER_PLAN_V2.md`
- `docs/OPEN_CORE_BOUNDARY.md`

If your change modifies strategy selection, risk, sizing, execution, qualification identity, or authority, open an issue/design discussion before implementation.

## Development

```bash
npm install
cp .env.example .env
npm run dev
```

Never put real secrets into `.env.example`, source files, tests, screenshots, issues, or PR descriptions.

## Required validation

Before submitting a PR, run the relevant checks:

```bash
npm run lint
npm run test:trading
npm run smoke:trading
npm run build
```

If a check cannot run in your environment, say so explicitly in the PR.

## Authority rules

Every PR should state whether it changes any of the following:

- strategy semantics,
- Strategy Router eligibility/selection,
- Council or Arbiter authority,
- deterministic Risk,
- position sizing,
- order/fill behavior,
- scheduler behavior,
- durable trading state,
- qualification identity/cohort,
- canonical event lineage.

A change that introduces a new intelligence layer should default to **shadow / observation-only** unless an existing approved policy explicitly grants authority.

AI Council output must not silently override deterministic Risk.

## Qualification-cohort integrity

Do not silently change strategy, risk, sizing, or execution semantics inside an active/frozen qualification cohort.

When a change would invalidate comparability, create a new explicit version/cohort boundary rather than rewriting the historical interpretation.

Historical trades and outcomes must not be retroactively presented as if newer policy existed at the time.

## Data integrity

- Missing data must remain missing; do not synthesize values for presentation.
- Counterfactual or observational diagnostics must not be described as causal unless the design supports a causal claim.
- Performance claims require clearly identified samples and methodology.
- Sample gates must fail closed where metrics are statistically unsupported.

## Pull request format

Please include:

1. **Purpose** — what problem is being solved.
2. **Scope** — files/modules and intended behavior.
3. **Authority impact** — `NONE`, `SHADOW_ONLY`, or an explicitly approved higher level.
4. **Qualification impact** — whether a current cohort changes.
5. **Lineage impact** — what events/traces are added, changed, or preserved.
6. **Validation** — tests/builds run and their results.
7. **Rollback** — how to revert safely if the change affects runtime behavior.

## Scope discipline

Prefer small PRs that can be independently reviewed. Avoid combining visual cleanup, investment-policy changes, persistence migrations, and runtime-control changes in a single PR unless they are inseparable.

## Public vs private Alpha

Do not submit credentials, live broker configuration, proprietary private-data contracts, or private Alpha parameters to the public repository. See `docs/OPEN_CORE_BOUNDARY.md`.

## Financial disclaimer

Contributions to BLACK ORACLE are software/research contributions. They are not investment advice and do not establish that a strategy is safe or profitable for live capital.
