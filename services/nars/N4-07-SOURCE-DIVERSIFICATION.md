# N4-07 Source Diversification

This note defines the next sprint boundary after N4-06. It is intentionally committed on the N4-06 branch so the follow-up branch can inherit the agreed source taxonomy.

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
- `research_institution`
- `academic`
- `statistical_database`
- `specialist_newsletter`
- `social_public`

## Independence dimensions

NARS should distinguish:

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

### Media / discovery

Keep current Korean news shadow feeds and add additional independently operated media where official feeds/APIs are available. Discovery sources must never outrank verified primary artifacts.

## Scoring change

The next evidence baseline should replace simple canonical-publisher breadth with **independence-group breadth** and expose concentration metrics such as dominant-group share and HHI.

Source diversification must reduce correlated evidence inflation, not merely increase volume.
