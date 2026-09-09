# N4-08 Dynamic Connector Expansion

## Goal

Remove the hard-coded source list from the shadow collector. `nars_source_connectors` is now the RSS/Atom source control plane.

The runtime becomes:

`Connector Registry -> dynamic RSS/Atom selection -> parallel fetch -> source batch ingest -> Document -> Story -> Event -> diversity scoring`

## Control plane

A connector is eligible for the generic poller when:

- `runtime_status = shadow`
- `adapter_kind` is `rss` or `atom`
- `auth_mode` is `none` or `user_agent`

Connector config may specify:

- `source_key`
- `tier`
- `tier_unreviewed`
- `max_items`

The poller fails closed when the connector registry cannot be read or returns no eligible sources. It does not silently fall back to a compiled source list.

## Initial dynamic set

N4-08 migrates the previous six hard-coded sources into the registry and adds FSC as the seventh source:

- Kyunghyang Shinmun
- Maeil Business Newspaper
- Dong-A Ilbo
- Federal Reserve Board
- Financial Services Commission
- European Central Bank
- Bank for International Settlements

SEC EDGAR, OpenDART, KRX and KOSIS remain planned because they require dedicated JSON/API authentication, discovery or noise-filtering logic rather than the generic RSS/Atom adapter.

## Evidence boundary

Official-feed collection remains distinct from score-eligible primary Evidence.

An official RSS item is a high-quality Document source, but it is not automatically promoted to a `content_verified` Evidence Artifact. N4-06 provenance and content-hash gates remain authoritative.

## Live validation

The first registry-driven validation run loaded 7 sources and returned:

- 56 fetched items
- 56 successful ingest outcomes
- 0 ingest failures
- 0 source failures
- FSC: 8/8 items successfully ingested

All 8 FSC Documents were subsequently clustered. The corpus remained fully scored with `4.5.0-diversity-v1` at the validation point.

## Operations

Source additions, removals or isolation can now be performed by changing `nars_source_connectors.runtime_status` and connector metadata rather than changing collector code.

This is the prerequisite for the next adapter layer: SEC EDGAR, OpenDART, KRX, KOSIS/BOK and additional source families.