-- NARS v4 N4-07 source diversification registry

create table if not exists public.nars_source_identity_registry (
  publisher_key text primary key,
  display_name text not null,
  source_class text not null default 'general_news' check (source_class in (
    'primary_official','regulatory_filing','exchange_market_data','company_ir','wire_service',
    'financial_media','general_news','public_broadcaster','global_news','research_institution',
    'academic','statistical_database','specialist_newsletter','social_public','unknown'
  )),
  independence_group text not null,
  ownership_group text,
  syndication_group text,
  country text,
  language text,
  geography_scope text[] not null default '{}',
  specialties text[] not null default '{}',
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','provisional','reviewed','suspended')),
  provenance jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.nars_source_identity_registry enable row level security;
revoke all on public.nars_source_identity_registry from anon,authenticated;
create index if not exists nars_source_identity_registry_class_idx on public.nars_source_identity_registry(source_class,review_status);
create index if not exists nars_source_identity_registry_independence_idx on public.nars_source_identity_registry(independence_group);

create table if not exists public.nars_document_source_lineage (
  document_id uuid primary key references public.nars_documents(id) on delete cascade,
  origin_publisher_key text,
  upstream_publisher_key text,
  lineage_type text not null default 'unknown' check (lineage_type in ('original','wire','syndicated','repost','aggregation','unknown')),
  confidence numeric not null default 0 check (confidence between 0 and 1),
  method text not null default 'unreviewed',
  metadata jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.nars_document_source_lineage enable row level security;
revoke all on public.nars_document_source_lineage from anon,authenticated;
create index if not exists nars_document_source_lineage_upstream_idx on public.nars_document_source_lineage(upstream_publisher_key,lineage_type);

create table if not exists public.nars_source_connectors (
  connector_key text primary key,
  display_name text not null,
  source_class text not null,
  publisher_key text,
  authority_key text references public.nars_authority_registry(authority_key),
  adapter_kind text not null check (adapter_kind in ('rss','atom','rest_json','sdmx','xml','html_discovery','manual')),
  endpoint text not null,
  auth_mode text not null default 'none' check (auth_mode in ('none','api_key','user_agent','oauth','manual')),
  runtime_status text not null default 'planned' check (runtime_status in ('planned','shadow','active','blocked','disabled')),
  poll_interval_minutes integer check (poll_interval_minutes is null or poll_interval_minutes between 1 and 10080),
  country text,
  language text,
  priority smallint not null default 50 check (priority between 0 and 100),
  config jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.nars_source_connectors enable row level security;
revoke all on public.nars_source_connectors from anon,authenticated;
create index if not exists nars_source_connectors_authority_idx on public.nars_source_connectors(authority_key);
create index if not exists nars_source_connectors_status_class_idx on public.nars_source_connectors(runtime_status,source_class,priority desc);

insert into public.nars_source_identity_registry(
  publisher_key,display_name,source_class,independence_group,country,language,review_status,provenance,metadata
) values
  ('경향신문','경향신문','general_news','publisher:경향신문','KR','ko','provisional',jsonb_build_object('method','observed_nars_source','verified_on','2026-09-06'),jsonb_build_object('identity_only',true)),
  ('동아일보','동아일보','general_news','publisher:동아일보','KR','ko','provisional',jsonb_build_object('method','observed_nars_source','verified_on','2026-09-06'),jsonb_build_object('identity_only',true)),
  ('매일경제','매일경제','financial_media','publisher:매일경제','KR','ko','provisional',jsonb_build_object('method','observed_nars_source','verified_on','2026-09-06'),jsonb_build_object('identity_only',true)),
  ('연합뉴스','연합뉴스','wire_service','publisher:연합뉴스','KR','ko','provisional',jsonb_build_object('method','observed_nars_source','verified_on','2026-09-06'),jsonb_build_object('identity_only',true)),
  ('한겨레','한겨레','general_news','publisher:한겨레','KR','ko','provisional',jsonb_build_object('method','observed_nars_source','verified_on','2026-09-06'),jsonb_build_object('identity_only',true)),
  ('한국경제','한국경제','financial_media','publisher:한국경제','KR','ko','provisional',jsonb_build_object('method','observed_nars_source','verified_on','2026-09-06'),jsonb_build_object('identity_only',true)),
  ('al jazeera','Al Jazeera','global_news','publisher:al-jazeera','QA','en','provisional',jsonb_build_object('method','observed_nars_source','verified_on','2026-09-06'),jsonb_build_object('identity_only',true))
on conflict(publisher_key) do update set
  display_name=excluded.display_name,source_class=excluded.source_class,independence_group=excluded.independence_group,
  country=excluded.country,language=excluded.language,review_status=excluded.review_status,
  provenance=public.nars_source_identity_registry.provenance||excluded.provenance,
  metadata=public.nars_source_identity_registry.metadata||excluded.metadata,updated_at=now();

insert into public.nars_source_connectors(
  connector_key,display_name,source_class,authority_key,adapter_kind,endpoint,auth_mode,runtime_status,
  poll_interval_minutes,country,language,priority,config,provenance,last_verified_at
) values
('api:opendart:list','OpenDART disclosure search','regulatory_filing','kr:fss-dart','rest_json','https://opendart.fss.or.kr/api/list.json','api_key','planned',5,'KR','ko',98,jsonb_build_object('secret_name','OPENDART_API_KEY'),jsonb_build_object('verification','official_api_docs','verified_on','2026-09-06'),now()),
('api:sec:data','SEC EDGAR data APIs','regulatory_filing','us:sec','rest_json','https://data.sec.gov/','user_agent','planned',5,'US','en',98,jsonb_build_object('notes','submissions and XBRL APIs; per-filer polling or index discovery required'),jsonb_build_object('verification','official_api_docs','verified_on','2026-09-06'),now()),
('rss:fed:press','Federal Reserve press releases','primary_official','us:federal-reserve','rss','https://www.federalreserve.gov/feeds/press_all.xml','none','shadow',10,'US','en',95,'{}'::jsonb,jsonb_build_object('verification','official_feed','verified_on','2026-09-06'),now()),
('api:krx:open','KRX Open API','exchange_market_data','kr:krx','rest_json','https://openapi.krx.co.kr/','api_key','planned',10,'KR','ko',94,jsonb_build_object('secret_name','KRX_API_KEY'),jsonb_build_object('verification','official_api_docs','verified_on','2026-09-06'),now()),
('rss:fsc:press','FSC press releases','primary_official','kr:fsc','rss','https://www.fsc.go.kr/about/fsc_bbs_rss/?fid=0111','none','planned',10,'KR','ko',94,'{}'::jsonb,jsonb_build_object('verification','official_rss_page','verified_on','2026-09-06'),now()),
('api:kosis','KOSIS Open API','statistical_database','kr:kostat','rest_json','https://kosis.kr/openapi/','api_key','planned',60,'KR','ko',90,jsonb_build_object('secret_name','KOSIS_API_KEY'),jsonb_build_object('verification','official_api_docs','verified_on','2026-09-06'),now())
on conflict(connector_key) do update set
  display_name=excluded.display_name,source_class=excluded.source_class,authority_key=excluded.authority_key,
  adapter_kind=excluded.adapter_kind,endpoint=excluded.endpoint,auth_mode=excluded.auth_mode,runtime_status=excluded.runtime_status,
  poll_interval_minutes=excluded.poll_interval_minutes,country=excluded.country,language=excluded.language,priority=excluded.priority,
  config=excluded.config,provenance=excluded.provenance,last_verified_at=excluded.last_verified_at,updated_at=now();

insert into public.nars_system_meta(key,value,updated_at)
values('source_diversification_registry_version',jsonb_build_object('version','4.5.0-registry-v1','updated_at',now()),now())
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
