# Security Policy

BLACK ORACLE handles trading-state infrastructure, server-side AI integrations, and potentially sensitive credentials. Please treat security reports responsibly.

## Reporting a vulnerability

Do **not** publish exploitable security details, secrets, credentials, or production endpoints in a public issue.

For now, use GitHub's private vulnerability reporting feature if it is enabled for this repository. If private vulnerability reporting is not yet enabled, contact the repository owner privately through an authenticated channel before disclosing technical details publicly.

A useful report includes:

- affected commit/version,
- affected component,
- reproduction steps,
- expected vs observed behavior,
- security impact,
- whether credentials/data/capital authority may be exposed,
- and a minimal proof of concept when safe.

## High-priority classes

Please prioritize reports involving:

- leaked API keys, Supabase service-role keys, broker credentials, or cron secrets,
- authentication or authorization bypass,
- unintended live-capital or execution authority,
- manipulation of Risk/Router/Council authority boundaries,
- canonical-ledger tampering or lineage loss,
- checkpoint corruption that can change portfolio/order state,
- remote code execution or server-side request abuse,
- dependency vulnerabilities with practical exploitability,
- accidental exposure of private Alpha/data contracts.

## Secrets

Never commit real credentials. `.env.example` must contain placeholders only.

If a real secret is accidentally committed, assume compromise and rotate/revoke it immediately; deleting the file in a later commit is not sufficient.

## Trading-safety principle

When security or data integrity is uncertain, BLACK ORACLE should fail closed for **new risk**. Observability failures must not silently become permission to trade.

## Scope

This policy covers the public BLACK ORACLE repository. Private infrastructure, broker accounts, and proprietary Alpha may have additional disclosure procedures.
