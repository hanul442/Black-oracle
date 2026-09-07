# N4-09 Official Feed Expansion

## Goal

Expand NARS with high-value first-party discovery feeds while preserving the N4-06 rule:

> collection from an official domain is not the same thing as content-verified Evidence.

N4-09 also fixes canonical publisher forwarding in the dynamic connector runtime so multiple feeds from the same institution cannot inflate source independence.

## Live sources added

### Bank of Korea

Four official RSS feeds are enabled in `shadow` mode:

- monetary policy releases
- economic statistics releases
- Monetary Policy Board decisions
- Monetary Policy Board minutes

All four resolve to canonical publisher `bank of korea` and independence group `authority:kr:bok`.

### DART / Financial Supervisory Service

The DART recent-filings RSS feed is enabled in `shadow` mode.

- canonical publisher: `dart`
- source class: `regulatory_filing`
- independence group: `authority:kr:fss-dart`
- max items per run: 50

This captures the full recent-50 discovery window exposed by DART instead of truncating it to the generic 8-item feed default.

## SEC EDGAR

Official EDGAR RSS support was verified from SEC documentation, and 8-K / 6-K Atom connector definitions are registered.

Runtime requests from the current Supabase egress returned SEC Fair Access HTTP 403 even after a contact-bearing User-Agent was supplied. NARS therefore records both connectors as `blocked` rather than attempting to bypass the restriction.

The blocked state is intentional and auditable. A later dedicated SEC adapter can be activated only after a compliant egress path succeeds.

## Canonical publisher fix

N4-08 loaded connector rows dynamically but did not forward `publisher_key` into `nars_sources.metadata`. Since diversity scoring resolves canonical identity from `metadata.publisher_key` first, official feed display names could fail to match the source identity registry.

N4-09 fixes this by forwarding `publisher_key` on source and document metadata.

Existing official connectors are normalized to:

- Fed -> `federal reserve board`
- ECB -> `european central bank`
- BIS -> `bank for international settlements`
- FSC -> `financial services commission`

## Runtime changes

`nars-shadow-poll` version: `4.7.0-official-feeds`

- dynamic connector registry remains the control plane
- max RSS/Atom items per source increases from 25 to 50
- per-source batch timeout scales with item count, capped at 40 seconds
- optional per-connector User-Agent config is supported
- canonical publisher identity is included in source and document metadata

## Live validation

First N4-09 run:

- sources: 12
- fetched items: 138
- successful ingest outcomes: 138
- ingest failures: 0
- source failures: 0
- DART: 50/50 new Documents
- BOK: 32/32 new Documents across four feeds

Second run:

- 138/138 successful again
- BOK: all 32 were duplicates/re-observations
- DART: 49 duplicates + 1 newly arrived filing

Clustering coverage after activation:

- BOK monetary policy: 8/8
- BOK economic statistics: 8/8
- BOK MPC decisions: 8/8
- BOK MPC minutes: 8/8
- DART recent filings: 50/50

At validation the Event corpus was 706/706 on `4.5.0-diversity-v1`.

## Evidence-boundary validation

A BOK event linked from more than one BOK feed still reports `independent_groups = 1`.

DART/BOK feed-derived events do not automatically have a verified primary artifact. Example grades remained in the BBB range until content verification/corroboration occurs.

## Scope boundary

N4-09 is a discovery/source-expansion sprint. It does not automatically promote RSS items into `content_verified` Evidence Artifacts.

Next candidates:

- BOK/FSC/DART content resolver and artifact promotion
- OpenDART structured filings adapter when API credentials are available
- SEC EDGAR dedicated compliant adapter
- KRX/KOSIS authenticated adapters
