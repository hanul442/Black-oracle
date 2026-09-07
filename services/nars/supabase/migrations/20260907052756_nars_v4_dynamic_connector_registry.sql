-- NARS v4 N4-08 Dynamic Connector Control Plane
-- Version: 4.6.0-dynamic-connectors-v1

insert into public.nars_source_connectors(
  connector_key,display_name,source_class,publisher_key,authority_key,adapter_kind,endpoint,auth_mode,runtime_status,
  poll_interval_minutes,country,language,priority,config,provenance,last_verified_at,updated_at
) values
(
  'rss:khan:all','경향신문 전체뉴스','general_news','경향신문',null,'rss',
  'https://www.khan.co.kr/rss/rssdata/total_news.xml','none','shadow',10,'KR','ko',78,
  jsonb_build_object('source_key','direct:khan:all','tier',2,'tier_unreviewed',true,'max_items',8),
  jsonb_build_object('migration','4.6.0-dynamic-connectors-v1','origin','existing_shadow_runtime'),now(),now()
),
(
  'rss:mk:all','매일경제 전체뉴스','financial_media','매일경제',null,'rss',
  'https://www.mk.co.kr/rss/40300001/','none','shadow',10,'KR','ko',82,
  jsonb_build_object('source_key','direct:mk:all','tier',2,'tier_unreviewed',true,'max_items',8),
  jsonb_build_object('migration','4.6.0-dynamic-connectors-v1','origin','existing_shadow_runtime'),now(),now()
),
(
  'rss:donga:all','동아일보 전체뉴스','general_news','동아일보',null,'rss',
  'https://rss.donga.com/total.xml','none','shadow',10,'KR','ko',76,
  jsonb_build_object('source_key','direct:donga:all','tier',2,'tier_unreviewed',true,'max_items',8),
  jsonb_build_object('migration','4.6.0-dynamic-connectors-v1','origin','existing_shadow_runtime'),now(),now()
)
on conflict(connector_key) do update set
  display_name=excluded.display_name,
  source_class=excluded.source_class,
  publisher_key=excluded.publisher_key,
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
  provenance=public.nars_source_connectors.provenance||excluded.provenance,
  last_verified_at=excluded.last_verified_at,
  updated_at=now();

update public.nars_source_connectors
set config = coalesce(config,'{}'::jsonb) || jsonb_build_object(
      'source_key',case connector_key
        when 'rss:fed:press' then 'official:fed:press'
        when 'rss:ecb:press' then 'official:ecb:press'
        when 'rss:bis:press' then 'official:bis:press'
        when 'rss:fsc:press' then 'official:fsc:press'
        else connector_key end,
      'tier',1,
      'tier_unreviewed',false,
      'max_items',8
    ),
    runtime_status = case when connector_key='rss:fsc:press' then 'shadow' else runtime_status end,
    updated_at=now()
where connector_key in ('rss:fed:press','rss:ecb:press','rss:bis:press','rss:fsc:press');

insert into public.nars_system_meta(key,value,updated_at)
values(
  'dynamic_connector_version',
  jsonb_build_object(
    'version','4.6.0-dynamic-connectors-v1',
    'control_plane','nars_source_connectors',
    'rss_atom_dynamic',true,
    'updated_at',now()
  ),
  now()
)
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
