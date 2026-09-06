-- NARS v4 N4-05 Source Intelligence & Evidence Provenance

create table if not exists public.nars_authority_registry (
  authority_key text primary key,
  display_name text not null,
  authority_type text not null check (authority_type in ('government','regulator','central_bank','exchange','court','legislature','company_ir','statistical_agency','international_org','other')),
  country text,
  official_domains text[] not null default '{}',
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','provisional','reviewed','suspended')),
  provenance jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.nars_authority_registry enable row level security;
revoke all on public.nars_authority_registry from anon,authenticated;

create table if not exists public.nars_evidence_artifacts (
  id uuid primary key default gen_random_uuid(),
  artifact_key text not null unique,
  artifact_role text not null check (artifact_role in ('primary_official','primary_regulatory','primary_market','primary_legal','primary_corporate','primary_statistical','secondary_news','secondary_analysis','social_unverified','unknown')),
  authority_key text references public.nars_authority_registry(authority_key) on delete set null,
  publisher_key text,
  document_id uuid references public.nars_documents(id) on delete set null,
  title text not null,
  canonical_url text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','url_verified','content_verified','revoked')),
  content_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.nars_evidence_artifacts enable row level security;
revoke all on public.nars_evidence_artifacts from anon,authenticated;
create index if not exists nars_evidence_artifacts_authority_idx on public.nars_evidence_artifacts(authority_key);
create index if not exists nars_evidence_artifacts_document_idx on public.nars_evidence_artifacts(document_id);
create index if not exists nars_evidence_artifacts_role_verify_idx on public.nars_evidence_artifacts(artifact_role,verification_status);

create table if not exists public.nars_event_evidence_links (
  event_id uuid not null references public.nars_events(id) on delete cascade,
  artifact_id uuid not null references public.nars_evidence_artifacts(id) on delete cascade,
  relation text not null default 'supports' check (relation in ('supports','context','contradicts','refutes','mentions')),
  confidence numeric(5,4) not null default 1.0 check (confidence between 0 and 1),
  link_method text not null default 'manual',
  is_direct boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key(event_id,artifact_id,relation)
);
alter table public.nars_event_evidence_links enable row level security;
revoke all on public.nars_event_evidence_links from anon,authenticated;
create index if not exists nars_event_evidence_links_artifact_idx on public.nars_event_evidence_links(artifact_id);

alter table public.nars_source_evidence_profiles
  add column if not exists source_role text check (source_role in ('secondary_news','wire_service','specialist_media','official_publisher','analysis','other')),
  add column if not exists sample_size integer,
  add column if not exists primary_citation_rate numeric(6,3),
  add column if not exists correction_rate numeric(6,3),
  add column if not exists transparency_score numeric(6,2),
  add column if not exists syndication_dependence numeric(6,3),
  add column if not exists last_calibrated_at timestamptz;

insert into public.nars_source_evidence_profiles(
  publisher_key,review_status,reliability_score,reliability_grade,methodology_version,dimensions,provenance,source_role,notes
)
select distinct
  public.nars_source_identity(s.name,s.metadata),
  'unreviewed'::text,null::numeric,null::text,'4.3.0-source-v1'::text,'{}'::jsonb,
  jsonb_build_object('basis','observed_publisher_identity','generated_at',now()),
  case when lower(s.name)='연합뉴스' then 'wire_service' else 'secondary_news' end,
  'Profile stub only. No reliability score assigned before explicit review.'
from public.nars_sources s
where nullif(public.nars_source_identity(s.name,s.metadata),'') is not null
on conflict(publisher_key) do nothing;

create or replace function public.nars_attach_event_evidence(
  p_event_id uuid,
  p_artifact_key text,
  p_artifact_role text,
  p_title text,
  p_canonical_url text default null,
  p_authority_key text default null,
  p_publisher_key text default null,
  p_document_id uuid default null,
  p_published_at timestamptz default null,
  p_verification_status text default 'unverified',
  p_content_hash text default null,
  p_relation text default 'supports',
  p_confidence numeric default 1.0,
  p_link_method text default 'manual',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare v_artifact_id uuid;
begin
  if not exists(select 1 from public.nars_events where id=p_event_id) then raise exception 'event_not_found'; end if;
  if p_artifact_role not in ('primary_official','primary_regulatory','primary_market','primary_legal','primary_corporate','primary_statistical','secondary_news','secondary_analysis','social_unverified','unknown') then raise exception 'invalid_artifact_role'; end if;
  if p_verification_status not in ('unverified','url_verified','content_verified','revoked') then raise exception 'invalid_verification_status'; end if;
  if p_relation not in ('supports','context','contradicts','refutes','mentions') then raise exception 'invalid_relation'; end if;
  if p_authority_key is not null and not exists(select 1 from public.nars_authority_registry where authority_key=p_authority_key) then raise exception 'authority_not_found'; end if;

  insert into public.nars_evidence_artifacts(artifact_key,artifact_role,authority_key,publisher_key,document_id,title,canonical_url,published_at,verification_status,content_hash,metadata,updated_at)
  values(p_artifact_key,p_artifact_role,p_authority_key,p_publisher_key,p_document_id,p_title,p_canonical_url,p_published_at,p_verification_status,p_content_hash,coalesce(p_metadata,'{}'::jsonb),now())
  on conflict(artifact_key) do update set
    artifact_role=excluded.artifact_role,
    authority_key=coalesce(excluded.authority_key,public.nars_evidence_artifacts.authority_key),
    publisher_key=coalesce(excluded.publisher_key,public.nars_evidence_artifacts.publisher_key),
    document_id=coalesce(excluded.document_id,public.nars_evidence_artifacts.document_id),
    title=excluded.title,
    canonical_url=coalesce(excluded.canonical_url,public.nars_evidence_artifacts.canonical_url),
    published_at=coalesce(excluded.published_at,public.nars_evidence_artifacts.published_at),
    verification_status=excluded.verification_status,
    content_hash=coalesce(excluded.content_hash,public.nars_evidence_artifacts.content_hash),
    metadata=public.nars_evidence_artifacts.metadata||excluded.metadata,
    updated_at=now()
  returning id into v_artifact_id;

  insert into public.nars_event_evidence_links(event_id,artifact_id,relation,confidence,link_method,is_direct,metadata)
  values(p_event_id,v_artifact_id,p_relation,greatest(0,least(1,coalesce(p_confidence,1))),coalesce(p_link_method,'manual'),true,'{}'::jsonb)
  on conflict(event_id,artifact_id,relation) do update set confidence=excluded.confidence,link_method=excluded.link_method,is_direct=excluded.is_direct;

  return jsonb_build_object('event_id',p_event_id,'artifact_id',v_artifact_id,'artifact_key',p_artifact_key,'relation',p_relation);
end;
$$;
revoke execute on function public.nars_attach_event_evidence(uuid,text,text,text,text,text,text,uuid,timestamptz,text,text,text,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.nars_attach_event_evidence(uuid,text,text,text,text,text,text,uuid,timestamptz,text,text,text,numeric,text,jsonb) to service_role;

create or replace view public.nars_event_provenance_v1 with (security_invoker=true) as
select e.id as event_id,
  count(l.artifact_id)::int as artifact_count,
  count(l.artifact_id) filter(where a.artifact_role like 'primary_%')::int as primary_artifact_count,
  count(l.artifact_id) filter(where a.artifact_role like 'primary_%' and a.verification_status in ('url_verified','content_verified'))::int as verified_primary_count,
  count(l.artifact_id) filter(where a.artifact_role like 'primary_%' and a.verification_status='content_verified')::int as content_verified_primary_count,
  count(distinct a.authority_key) filter(where a.artifact_role like 'primary_%' and a.verification_status in ('url_verified','content_verified') and a.authority_key is not null)::int as verified_authority_count,
  count(l.artifact_id) filter(where l.relation in ('contradicts','refutes') and a.artifact_role like 'primary_%')::int as primary_contradiction_count,
  coalesce(jsonb_agg(jsonb_build_object(
    'artifact_id',a.id,'artifact_key',a.artifact_key,'role',a.artifact_role,'authority_key',a.authority_key,
    'publisher_key',a.publisher_key,'title',a.title,'canonical_url',a.canonical_url,'published_at',a.published_at,
    'verification',a.verification_status,'relation',l.relation,'confidence',l.confidence,'link_method',l.link_method
  ) order by a.published_at desc nulls last,a.created_at desc) filter(where a.id is not null),'[]'::jsonb) as artifacts
from public.nars_events e
left join public.nars_event_evidence_links l on l.event_id=e.id
left join public.nars_evidence_artifacts a on a.id=l.artifact_id
group by e.id;
revoke all on public.nars_event_provenance_v1 from anon,authenticated;

create or replace view public.nars_event_score_candidates_v3 with (security_invoker=true) as
with p as (
  select event_id,artifact_count,primary_artifact_count,verified_primary_count,content_verified_primary_count,verified_authority_count,primary_contradiction_count from public.nars_event_provenance_v1
), base as (
  select b.*,
    coalesce(p.artifact_count,0) as artifact_count,
    coalesce(p.primary_artifact_count,0) as primary_artifact_count,
    coalesce(p.verified_primary_count,0) as verified_primary_count,
    coalesce(p.content_verified_primary_count,0) as content_verified_primary_count,
    coalesce(p.verified_authority_count,0) as verified_authority_count,
    coalesce(p.primary_contradiction_count,0) as primary_contradiction_count,
    case when coalesce(p.content_verified_primary_count,0)>0 then 100 when coalesce(p.verified_primary_count,0)>0 then 85 when coalesce(p.primary_artifact_count,0)>0 then 60 when coalesce(p.artifact_count,0)>0 then 35 else 20 end::numeric as provenance_score,
    case greatest(0,b.publisher_count+coalesce(p.verified_authority_count,0)) when 0 then 0 when 1 then 35 when 2 then 65 when 3 then 82 when 4 then 92 else 98 end::numeric as effective_independence_score,
    greatest(0,b.consistency_score-(case when coalesce(p.primary_contradiction_count,0)>0 then 25 else 0 end))::numeric as provenance_consistency_score
  from public.nars_event_score_candidates_v2 b
  left join p on p.event_id=b.event_id
), scored as (
  select b.*,
    round(least(100,greatest(0,
      0.25*source_reliability+0.20*effective_independence_score+0.10*convergence_score+0.10*traceability_score+0.10*relation_quality+0.05*provenance_consistency_score+0.20*provenance_score
    )),2) as provenance_raw_evidence_score,
    least(100::numeric,
      case when publisher_count+verified_authority_count<=1 then 75.99 when publisher_count+verified_authority_count=2 then 84.99 else 100 end,
      case when traceability_score<75 then 78.99 else 100 end,
      case when contradiction_pct>=25 or primary_contradiction_count>0 then 78.99 else 100 end,
      case when source_reliability<60 and verified_primary_count=0 then 71.99 else 100 end,
      case when verified_primary_count=0 then 90.99 when content_verified_primary_count=0 then 93.99 else 100 end
    ) as provenance_hard_cap_score
  from base b
)
select s.*,
  round(least(provenance_raw_evidence_score,provenance_hard_cap_score),2) as provenance_final_evidence_score,
  public.nars_score_to_grade(round(least(provenance_raw_evidence_score,provenance_hard_cap_score),2)) as provenance_evidence_grade,
  round(least(100,greatest(0,0.35*activity_score+0.25*urgency_score+0.20*effective_independence_score+0.10*recency_score+0.10*least(provenance_raw_evidence_score,provenance_hard_cap_score))),2) as provenance_priority_score,
  jsonb_build_object('source_reliability',source_reliability,'effective_independence',effective_independence_score,'story_convergence',convergence_score,'traceability',traceability_score,'relation_quality',relation_quality,'consistency',provenance_consistency_score,'provenance',provenance_score,'activity',round(activity_score,2),'urgency',urgency_score,'recency',recency_score,'legacy_activity_raw',round(legacy_activity_raw,2)) as provenance_dimensions,
  jsonb_build_object('effective_corrob_count',publisher_count+verified_authority_count,'single_corrob_cap',publisher_count+verified_authority_count<=1,'two_corrob_cap',publisher_count+verified_authority_count=2,'low_traceability_cap',traceability_score<75,'contradiction_cap',contradiction_pct>=25 or primary_contradiction_count>0,'low_source_reliability_cap',source_reliability<60 and verified_primary_count=0,'no_verified_primary_cap',verified_primary_count=0,'url_only_primary_cap',verified_primary_count>0 and content_verified_primary_count=0,'cap_score',provenance_hard_cap_score) as provenance_hard_gates,
  jsonb_build_object('documents',document_count,'publishers',publisher_count,'stories',story_count,'breaking',breaking_count,'artifacts',artifact_count,'primary_artifacts',primary_artifact_count,'verified_primary',verified_primary_count,'content_verified_primary',content_verified_primary_count,'verified_authorities',verified_authority_count,'primary_contradictions',primary_contradiction_count,'event_status',status) as provenance_input_snapshot
from scored s;
revoke all on public.nars_event_score_candidates_v3 from anon,authenticated;

create or replace function public.nars_score_events(p_limit integer default 500)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_inserted int:=0; v_updated int:=0;
begin
  with candidates as (
    select c.*,
      case when c.provenance_priority_score>=82 then 'FLASH' when c.provenance_priority_score>=68 then 'HIGH' when c.provenance_priority_score>=52 then 'WATCH' else 'ROUTINE' end as provenance_priority_band,
      md5(jsonb_build_object('v','4.3.0-provenance-v1','event',c.event_id,'raw',c.provenance_raw_evidence_score,'final',c.provenance_final_evidence_score,'grade',c.provenance_evidence_grade,'priority',c.provenance_priority_score,'dimensions',c.provenance_dimensions,'gates',c.provenance_hard_gates,'inputs',c.provenance_input_snapshot)::text) as fp
    from public.nars_event_score_candidates_v3 c
    order by c.last_updated_at desc
    limit greatest(1,least(coalesce(p_limit,500),2000))
  ), ins as (
    insert into public.nars_event_score_ledger(event_id,score_version,raw_evidence_score,final_evidence_score,evidence_grade,priority_score,priority_band,dimensions,hard_gates,input_snapshot,score_fingerprint)
    select event_id,'4.3.0-provenance-v1',provenance_raw_evidence_score,provenance_final_evidence_score,provenance_evidence_grade,provenance_priority_score,provenance_priority_band,provenance_dimensions,provenance_hard_gates,provenance_input_snapshot,fp
    from candidates
    on conflict(event_id,score_version,score_fingerprint) do nothing
    returning event_id
  ) select count(*) into v_inserted from ins;

  with latest as (
    select distinct on (l.event_id)
      l.event_id,l.priority_score,l.evidence_grade,l.final_evidence_score,l.priority_band,l.dimensions,l.hard_gates,l.score_version,l.input_snapshot
    from public.nars_event_score_ledger l
    where l.score_version='4.3.0-provenance-v1'
    order by l.event_id,l.evaluated_at desc
  ), upd as (
    update public.nars_events e
    set priority_score=l.priority_score,evidence_grade=l.evidence_grade,
      metadata=coalesce(e.metadata,'{}'::jsonb)||jsonb_build_object(
        'evidence_score',l.final_evidence_score,'priority_band',l.priority_band,'score_version',l.score_version,
        'score_dimensions',l.dimensions,'score_hard_gates',l.hard_gates,'score_inputs',l.input_snapshot
      )
    from latest l
    where e.id=l.event_id
      and (e.priority_score is distinct from l.priority_score or e.evidence_grade is distinct from l.evidence_grade or e.metadata->>'score_version' is distinct from l.score_version or e.metadata->'score_inputs' is distinct from l.input_snapshot)
    returning e.id
  ) select count(*) into v_updated from upd;

  return jsonb_build_object('version','4.3.0-provenance-v1','ledger_inserted',v_inserted,'events_updated',v_updated);
end;
$$;
revoke execute on function public.nars_score_events(integer) from public,anon,authenticated;
grant execute on function public.nars_score_events(integer) to service_role;

create or replace view public.nars_provenance_review_queue_v1 with (security_invoker=true) as
select e.id as event_id,e.title,e.status,e.priority_score,e.evidence_grade,e.last_updated_at,
  p.artifact_count,p.primary_artifact_count,p.verified_primary_count,p.content_verified_primary_count,p.verified_authority_count,
  case
    when coalesce(p.verified_primary_count,0)=0 and e.priority_score>=68 then 'high_priority_no_primary'
    when coalesce(p.verified_primary_count,0)=0 and e.priority_score>=52 then 'watch_no_primary'
    when coalesce(p.primary_contradiction_count,0)>0 then 'primary_contradiction'
    when coalesce(p.verified_primary_count,0)>0 and coalesce(p.content_verified_primary_count,0)=0 then 'url_only_primary'
    else 'other' end as review_reason
from public.nars_events e
left join public.nars_event_provenance_v1 p on p.event_id=e.id
where (coalesce(p.verified_primary_count,0)=0 and e.priority_score>=52)
   or coalesce(p.primary_contradiction_count,0)>0
   or (coalesce(p.verified_primary_count,0)>0 and coalesce(p.content_verified_primary_count,0)=0)
order by e.priority_score desc,e.last_updated_at desc;
revoke all on public.nars_provenance_review_queue_v1 from anon,authenticated;

insert into public.nars_system_meta(key,value,updated_at)
values('evidence_scoring_version',jsonb_build_object('version','4.3.0-provenance-v1','grade_scale','NARS Evidence Grade v1','provenance_layer',true,'updated_at',now()),now())
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
