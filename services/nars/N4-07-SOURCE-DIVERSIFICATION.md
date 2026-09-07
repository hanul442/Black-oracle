# N4-07 Source Diversification

## Goal

Diversify NARS along two separate axes:

1. **collection diversity** — add materially different source classes, not merely more publishers;
2. **evidence diversity** — count independent provenance groups rather than raw article count.

## Source classes

- `primary_official`
- `regulatory_filing`
- `exchange_market_data`
- `company_ir`
- `wire_service`
- `financial_media`
- `general_news`
- `public_broadcaster`
- `global_news`
- `research_institution`
- `academic`
- `statistical_database`
- `specialist_newsletter`
- `social_public`

## Independence dimensions

NARS distinguishes:

- publisher identity
- ownership group
- syndication / wire dependency
- source class
- geography
- primary vs secondary provenance

Five headlines copied from one wire service must not count as five independent corroborators.

## Initial expansion targets

### Korea / official

- Bank of Korea
- Financial Services Commission
- OpenDART / Financial Supervisory Service
- Korea Exchange Open API
- Statistics Korea / KOSIS
- finance ministry releases

### United States / official

- SEC EDGAR / data.sec.gov
- Federal Reserve releases and data

### Europe / international

- European Central Bank
- Bank for International Settlements

### Media / discovery

Keep current Korean news shadow feeds and add additional independently operated media where official feeds/APIs are available. Discovery sources must never outrank verified primary artifacts.

## Scoring

The evidence baseline replaces simple canonical-publisher breadth with **independence-group breadth** and exposes:

- source-class diversity
- geography diversity
- dominant-group share
- HHI concentration
- wire/syndication lineage

Source diversification must reduce correlated evidence inflation, not merely increase volume.

## Runtime changes

N4-07 adds:

- `nars_source_identity_registry`
- `nars_document_source_lineage`
- `nars_source_connectors`
- `nars_event_source_diversity_v1`
- `4.5.0-diversity-v1` event scoring
- global official shadow feeds for Fed / ECB / BIS
- `nars-ingest-batch` to avoid one Edge Function call per article

The batch topology is:

`parallel source fetch -> one batch ingest call per source -> document dedup/sightings -> Story/Event clustering -> diversity-aware scoring`

## Validation

The six-source shadow runner has been validated with 48 fetched items and 48 successful ingest outcomes in one run, with zero ingest failures and zero source-fetch failures. The event corpus continued through Story/Event clustering and `4.5.0-diversity-v1` scoring with no unscored Events at the validation point.
