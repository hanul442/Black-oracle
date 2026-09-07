-- NARS v4 N4-09 Official Feed Expansion
-- Version: 4.7.0-official-feeds-v1

insert into public.nars_source_identity_registry(
  publisher_key,display_name,source_class,independence_group,country,language,
  review_status,provenance,metadata,reviewed_at,updated_at
) values
('bank of korea','Bank of Korea','primary_official','authority:kr:bok','KR','ko','reviewed',
 jsonb_build_object('method','official_rss_registry','verified_on','2026-09-07'),
 jsonb_build_object('authority_key','kr:bok'),now(),now()),
('dart','DART / Financial Supervisory Service','regulatory_filing','authority:kr:fss-dart','KR','ko','reviewed',
 jsonb_build_object('method','official_rss_service_plus_live_endpoint','verified_on','2026-09-07'),
 jsonb_build_object('authority_key','kr:fss-dart'),now(),now()),
('sec','U.S. Securities and Exchange Commission','regulatory_filing','authority:us:sec','US','en','reviewed',
 jsonb_build_object('method','official_edgar_rss_docs','verified_on','2026-09-07'),
 jsonb_build_object('authority_key','us:sec'),now(),now())
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

update public.nars_source_connectors
set publisher_key=case connector_key
  when 'rss:fed:press' then 'federal reserve board'
  when 'rss:ecb:press' then 'european central bank'
  when 'rss:bis:press' then 'bank for international settlements'
  when 'rss:fsc:press' then 'financial services commission'
  else publisher_key end,
  updated_at=now()
where connector_key in ('rss:fed:press','rss:ecb:press','rss:bis:press','rss:fsc:press');

insert into public.nars_source_connectors(
  connector_key,display_name,source_class,publisher_key,authority_key,adapter_kind,endpoint,
  auth_mode,runtime_status,poll_interval_minutes,country,language,priority,config,provenance,
  last_verified_at,updated_at
) values
('rss:bok:monetary-policy','BOK monetary policy releases','primary_official','bank of korea','kr:bok','rss',
 'https://www.bok.or.kr/portal/bbs/P0000559/news.rss?menuNo=200690','none','shadow',10,'KR','ko',99,
 jsonb_build_object('source_key','official:bok:monetary-policy','tier',1,'tier_unreviewed',false,'max_items',8,'topic','monetary_policy'),
 jsonb_build_object('verification','official_bok_rss_registry_and_live_200','verified_on','2026-09-07'),now(),now()),
('rss:bok:economic-statistics','BOK economic statistics releases','primary_official','bank of korea','kr:bok','rss',
 'https://www.bok.or.kr/portal/bbs/B0000501/news.rss?menuNo=201264','none','shadow',10,'KR','ko',97,
 jsonb_build_object('source_key','official:bok:economic-statistics','tier',1,'tier_unreviewed',false,'max_items',8,'topic','economic_statistics'),
 jsonb_build_object('verification','official_bok_rss_registry_and_live_200','verified_on','2026-09-07'),now(),now()),
('rss:bok:mpc-decisions','BOK Monetary Policy Board decisions','primary_official','bank of korea','kr:bok','rss',
 'https://www.bok.or.kr/portal/bbs/P0000093/news.rss?menuNo=200761','none','shadow',10,'KR','ko',99,
 jsonb_build_object('source_key','official:bok:mpc-decisions','tier',1,'tier_unreviewed',false,'max_items',8,'topic','mpc_decisions'),
 jsonb_build_object('verification','official_bok_rss_registry_and_live_200','verified_on','2026-09-07'),now(),now()),
('rss:bok:mpc-minutes','BOK Monetary Policy Board minutes','primary_official','bank of korea','kr:bok','rss',
 'https://www.bok.or.kr/portal/bbs/B0000245/news.rss?menuNo=200789','none','shadow',10,'KR','ko',98,
 jsonb_build_object('source_key','official:bok:mpc-minutes','tier',1,'tier_unreviewed',false,'max_items',8,'topic','mpc_minutes'),
 jsonb_build_object('verification','official_bok_rss_registry_and_live_200','verified_on','2026-09-07'),now(),now()),
('rss:dart:recent','DART recent filings','regulatory_filing','dart','kr:fss-dart','rss',
 'https://dart.fss.or.kr/api/todayRSS.xml','user_agent','shadow',10,'KR','ko',100,
 jsonb_build_object('source_key','official:dart:recent','tier',1,'tier_unreviewed',false,'max_items',50,'topic','corporate_disclosure'),
 jsonb_build_object('verification','official_dart_rss_service_and_live_200','verified_on','2026-09-07'),now(),now()),
('atom:sec:8k','SEC EDGAR current 8-K filings','regulatory_filing','sec','us:sec','atom',
 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&company=&dateb=&owner=include&start=0&count=40&output=atom',
 'user_agent','blocked',5,'US','en',100,
 jsonb_build_object('source_key','official:sec:8k','tier',1,'tier_unreviewed',false,'max_items',40,'blocked_reason','sec_fair_access_403_from_supabase_egress'),
 jsonb_build_object('verification','official_sec_edgar_rss_docs_but_runtime_403','verified_on','2026-09-07'),now(),now()),
('atom:sec:6k','SEC EDGAR current 6-K filings','regulatory_filing','sec','us:sec','atom',
 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=6-K&company=&dateb=&owner=include&start=0&count=40&output=atom',
 'user_agent','blocked',5,'US','en',99,
 jsonb_build_object('source_key','official:sec:6k','tier',1,'tier_unreviewed',false,'max_items',40,'blocked_reason','sec_fair_access_403_from_supabase_egress'),
 jsonb_build_object('verification','official_sec_edgar_rss_docs_but_runtime_403','verified_on','2026-09-07'),now(),now())
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

insert into public.nars_system_meta(key,value,updated_at)
values('official_feed_expansion_version',jsonb_build_object(
  'version','4.7.0-official-feeds-v1',
  'bok_feeds',4,
  'dart_recent',true,
  'sec_edgar_runtime','blocked_fair_access_403',
  'publisher_identity_forwarding',true,
  'updated_at',now()
),now())
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
