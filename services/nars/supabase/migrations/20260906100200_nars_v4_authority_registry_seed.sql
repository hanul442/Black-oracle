-- Identity-only authority registry seed. No reliability scores are assigned here.

insert into public.nars_authority_registry(
  authority_key,display_name,authority_type,country,official_domains,review_status,provenance,metadata,reviewed_at,updated_at
) values
('kr:bok','Bank of Korea','central_bank','KR',array['bok.or.kr'],'reviewed',jsonb_build_object('method','official_domain_check','verified_on','2026-09-06','evidence','bok.or.kr official Bank of Korea site'),jsonb_build_object('registry_scope','identity_only'),now(),now()),
('kr:fsc','Financial Services Commission','regulator','KR',array['fsc.go.kr'],'reviewed',jsonb_build_object('method','official_domain_check','verified_on','2026-09-06','evidence','fsc.go.kr official Financial Services Commission site'),jsonb_build_object('registry_scope','identity_only'),now(),now()),
('kr:fss-dart','Financial Supervisory Service / DART','regulator','KR',array['dart.fss.or.kr','opendart.fss.or.kr','engopendart.fss.or.kr'],'reviewed',jsonb_build_object('method','official_domain_check','verified_on','2026-09-06','evidence','OpenDART terms state service is operated by Financial Supervisory Service'),jsonb_build_object('registry_scope','identity_only'),now(),now()),
('kr:krx','Korea Exchange','exchange','KR',array['krx.co.kr','global.krx.co.kr'],'reviewed',jsonb_build_object('method','official_domain_check','verified_on','2026-09-06','evidence','global.krx.co.kr official Korea Exchange site'),jsonb_build_object('registry_scope','identity_only'),now(),now()),
('kr:finance-ministry','Korea Ministry of Finance','government','KR',array['moef.go.kr','english.moef.go.kr'],'reviewed',jsonb_build_object('method','official_domain_check','verified_on','2026-09-06','evidence','english.moef.go.kr official finance ministry site'),jsonb_build_object('registry_scope','identity_only'),now(),now()),
('kr:kostat','Statistics Korea','statistical_agency','KR',array['kostat.go.kr'],'reviewed',jsonb_build_object('method','official_domain_check','verified_on','2026-09-06','evidence','kostat.go.kr official Statistics Korea domain'),jsonb_build_object('registry_scope','identity_only'),now(),now()),
('us:sec','U.S. Securities and Exchange Commission','regulator','US',array['sec.gov'],'reviewed',jsonb_build_object('method','official_domain_check','verified_on','2026-09-06','evidence','sec.gov official SEC and EDGAR site'),jsonb_build_object('registry_scope','identity_only'),now(),now()),
('us:federal-reserve','Federal Reserve Board','central_bank','US',array['federalreserve.gov'],'reviewed',jsonb_build_object('method','official_domain_check','verified_on','2026-09-06','evidence','federalreserve.gov official Federal Reserve Board site'),jsonb_build_object('registry_scope','identity_only'),now(),now())
on conflict(authority_key) do update set
  display_name=excluded.display_name,
  authority_type=excluded.authority_type,
  country=excluded.country,
  official_domains=excluded.official_domains,
  review_status=excluded.review_status,
  provenance=excluded.provenance,
  metadata=excluded.metadata,
  reviewed_at=excluded.reviewed_at,
  updated_at=excluded.updated_at;
