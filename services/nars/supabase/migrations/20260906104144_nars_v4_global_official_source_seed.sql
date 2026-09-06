-- NARS v4 N4-07 global official source identity/connector seed

insert into public.nars_authority_registry(
  authority_key,display_name,authority_type,country,official_domains,review_status,provenance,metadata,reviewed_at,updated_at
) values
(
  'eu:ecb','European Central Bank','central_bank','EU',array['ecb.europa.eu'],'reviewed',
  jsonb_build_object('method','official_domain_and_rss_check','evidence','ECB official RSS page and data services','verified_on','2026-09-06'),
  jsonb_build_object('registry_scope','identity_only'),now(),now()
),
(
  'int:bis','Bank for International Settlements','international_org','INT',array['bis.org'],'reviewed',
  jsonb_build_object('method','official_domain_and_rss_check','evidence','BIS official RSS page','verified_on','2026-09-06'),
  jsonb_build_object('registry_scope','identity_only'),now(),now()
)
on conflict(authority_key) do update set
  display_name=excluded.display_name,
  authority_type=excluded.authority_type,
  country=excluded.country,
  official_domains=excluded.official_domains,
  review_status=excluded.review_status,
  provenance=public.nars_authority_registry.provenance||excluded.provenance,
  metadata=public.nars_authority_registry.metadata||excluded.metadata,
  reviewed_at=excluded.reviewed_at,
  updated_at=now();

insert into public.nars_source_identity_registry(
  publisher_key,display_name,source_class,independence_group,country,language,review_status,provenance,metadata,reviewed_at,updated_at
) values
(
  'federal reserve board','Federal Reserve Board','primary_official','authority:us:federal-reserve','US','en','reviewed',
  jsonb_build_object('method','official_feed_identity','verified_on','2026-09-06'),
  jsonb_build_object('authority_key','us:federal-reserve'),now(),now()
),
(
  'european central bank','European Central Bank','primary_official','authority:eu:ecb','EU','en','reviewed',
  jsonb_build_object('method','official_feed_identity','verified_on','2026-09-06'),
  jsonb_build_object('authority_key','eu:ecb'),now(),now()
),
(
  'bank for international settlements','Bank for International Settlements','research_institution','authority:int:bis','INT','en','reviewed',
  jsonb_build_object('method','official_feed_identity','verified_on','2026-09-06'),
  jsonb_build_object('authority_key','int:bis'),now(),now()
),
(
  'financial services commission','Financial Services Commission','primary_official','authority:kr:fsc','KR','ko','reviewed',
  jsonb_build_object('method','official_rss_identity','verified_on','2026-09-06'),
  jsonb_build_object('authority_key','kr:fsc'),now(),now()
)
on conflict(publisher_key) do update set
  display_name=excluded.display_name,
  source_class=excluded.source_class,
  independence_group=excluded.independence_group,
  country=excluded.country,
  language=excluded.language,
  review_status=excluded.review_status,
  provenance=public.nars_source_identity_registry.provenance||excluded.provenance,
  metadata=public.nars_source_identity_registry.metadata||excluded.metadata,
  reviewed_at=excluded.reviewed_at,
  updated_at=now();

insert into public.nars_source_connectors(
  connector_key,display_name,source_class,authority_key,adapter_kind,endpoint,auth_mode,runtime_status,
  poll_interval_minutes,country,language,priority,config,provenance,last_verified_at,updated_at
) values
(
  'rss:ecb:press','ECB press releases','primary_official','eu:ecb','rss','https://www.ecb.europa.eu/rss/press.html',
  'none','shadow',10,'EU','en',92,'{}'::jsonb,
  jsonb_build_object('verification','official_feed','verified_on','2026-09-06'),now(),now()
),
(
  'rss:bis:press','BIS media releases','research_institution','int:bis','rss','https://www.bis.org/doclist/all_pressrels.rss',
  'none','shadow',15,'CH','en',88,'{}'::jsonb,
  jsonb_build_object('verification','official_feed','verified_on','2026-09-06'),now(),now()
)
on conflict(connector_key) do update set
  display_name=excluded.display_name,
  source_class=excluded.source_class,
  authority_key=excluded.authority_key,
  adapter_kind=excluded.adapter_kind,
  endpoint=excluded.endpoint,
  auth_mode=excluded.auth_mode,
  runtime_status=excluded.runtime_status,
  poll_interval_minutes=excluded.poll_interval_minutes,
  country=excluded.country,
  language=excluded.language,
  priority=excluded.priority,
  config=excluded.config,
  provenance=excluded.provenance,
  last_verified_at=excluded.last_verified_at,
  updated_at=now();

insert into public.nars_system_meta(key,value,updated_at)
values('global_official_source_seed_version',jsonb_build_object(
  'version','4.5.0-global-official-v1',
  'fed',true,
  'ecb',true,
  'bis',true,
  'updated_at',now()
),now())
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
