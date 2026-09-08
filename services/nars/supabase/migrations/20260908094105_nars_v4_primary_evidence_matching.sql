-- N4-12 Primary Evidence Matching / Claim Linker baseline
-- Precision-first: verified primary artifacts only; no trade authority.

create table if not exists public.nars_event_claims (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.nars_events(id) on delete cascade,
  claim_key text not null,
  claim_text text not null,
  claim_type text not null default 'headline_assertion' check (claim_type in ('headline_assertion')),
  status text not null default 'active' check (status in ('active','superseded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,claim_key)
);
create index if not exists nars_event_claims_event_status_idx on public.nars_event_claims(event_id,status);
alter table public.nars_event_claims enable row level security;
revoke all on table public.nars_event_claims from public,anon,authenticated;
grant all on table public.nars_event_claims to service_role;

create table if not exists public.nars_evidence_match_candidates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.nars_events(id) on delete cascade,
  claim_id uuid not null references public.nars_event_claims(id) on delete cascade,
  artifact_id uuid not null references public.nars_evidence_artifacts(id) on delete cascade,
  match_version text not null,
  algorithmic_decision text not null check (algorithmic_decision in ('AUTO_LINK','REVIEW','REJECT')),
  review_status text not null check (review_status in ('NOT_REQUIRED','PENDING','APPROVED','REJECTED')),
  relation_suggestion text not null default 'supports' check (relation_suggestion in ('supports','context','mentions')),
  lexical_similarity numeric(6,5) not null check (lexical_similarity between 0 and 1),
  token_jaccard numeric(6,5) not null check (token_jaccard between 0 and 1),
  shared_tokens integer not null check (shared_tokens >= 0),
  temporal_score numeric(6,5) not null check (temporal_score between 0 and 1),
  time_distance_hours numeric(12,3) not null check (time_distance_hours >= 0),
  subject_gate text not null check (subject_gate in ('MATCH','NONE','CONFLICT','DART_ISSUER_MISSING')),
  final_score numeric(6,5) not null check (final_score between 0 and 1),
  is_existing_link boolean not null default false,
  rationale jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,artifact_id,match_version)
);
create index if not exists nars_evidence_match_candidates_status_idx on public.nars_evidence_match_candidates(algorithmic_decision,review_status,final_score desc);
create index if not exists nars_evidence_match_candidates_event_idx on public.nars_evidence_match_candidates(event_id,updated_at desc);
create index if not exists nars_evidence_match_candidates_claim_idx on public.nars_evidence_match_candidates(claim_id);
create index if not exists nars_evidence_match_candidates_artifact_idx on public.nars_evidence_match_candidates(artifact_id);
alter table public.nars_evidence_match_candidates enable row level security;
revoke all on table public.nars_evidence_match_candidates from public,anon,authenticated;
grant all on table public.nars_evidence_match_candidates to service_role;

create table if not exists public.nars_claim_evidence_links (
  claim_id uuid not null references public.nars_event_claims(id) on delete cascade,
  artifact_id uuid not null references public.nars_evidence_artifacts(id) on delete cascade,
  relation text not null check (relation in ('supports','context','contradicts','refutes','mentions')),
  confidence numeric(6,5) not null check (confidence between 0 and 1),
  link_method text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key(claim_id,artifact_id,relation)
);
create index if not exists nars_claim_evidence_links_artifact_idx on public.nars_claim_evidence_links(artifact_id);
alter table public.nars_claim_evidence_links enable row level security;
revoke all on table public.nars_claim_evidence_links from public,anon,authenticated;
grant all on table public.nars_claim_evidence_links to service_role;

create or replace function public.nars_sync_event_headline_claims(p_limit integer default 2000)
returns jsonb language plpgsql set search_path='' as $$
declare v_superseded integer:=0; v_upserted integer:=0;
begin
  with target as (
    select e.id,e.title from public.nars_events e
    left join public.nars_event_score_latest_v1 s on s.event_id=e.id
    order by coalesce(s.priority_score,0) desc,e.last_updated_at desc
    limit greatest(1,least(coalesce(p_limit,2000),10000))
  )
  update public.nars_event_claims c set status='superseded',updated_at=now()
  from target t where c.event_id=t.id and c.claim_type='headline_assertion' and c.status='active' and c.claim_text is distinct from t.title;
  get diagnostics v_superseded=row_count;
  with target as (
    select e.id,e.title from public.nars_events e
    left join public.nars_event_score_latest_v1 s on s.event_id=e.id
    order by coalesce(s.priority_score,0) desc,e.last_updated_at desc
    limit greatest(1,least(coalesce(p_limit,2000),10000))
  )
  insert into public.nars_event_claims(event_id,claim_key,claim_text,claim_type,status,metadata)
  select t.id,'headline:'||encode(extensions.digest(lower(t.title),'sha256'),'hex'),t.title,'headline_assertion','active',jsonb_build_object('source','event_title','claim_version','4.10.0-match-v1') from target t
  on conflict(event_id,claim_key) do update set claim_text=excluded.claim_text,status='active',metadata=public.nars_event_claims.metadata||excluded.metadata,updated_at=now();
  get diagnostics v_upserted=row_count;
  return jsonb_build_object('superseded',v_superseded,'upserted',v_upserted);
end;$$;

create or replace function public.nars_refresh_primary_evidence_matches(p_event_limit integer default 500,p_artifact_days integer default 45)
returns jsonb language plpgsql set search_path='' as $$
declare v_claim_sync jsonb; v_candidates integer:=0; v_direct_claims integer:=0; v_auto_claims integer:=0; v_event_links integer:=0; v_rescore jsonb;
begin
  v_claim_sync:=public.nars_sync_event_headline_claims(greatest(2000,coalesce(p_event_limit,500)*3));
  with ev as (
    select e.id,e.title,e.first_detected_at,e.last_updated_at,s.priority_score,s.priority_band,public.nars_structured_subject(e.title) structured_subject
    from public.nars_events e join public.nars_event_score_latest_v1 s on s.event_id=e.id
    where s.priority_score>=45 order by s.priority_score desc,e.last_updated_at desc
    limit greatest(1,least(coalesce(p_event_limit,500),5000))
  ), cl as (
    select distinct on(c.event_id)c.id,c.event_id,c.claim_text from public.nars_event_claims c join ev on ev.id=c.event_id
    where c.status='active' and c.claim_type='headline_assertion' order by c.event_id,c.updated_at desc
  ), art as (
    select a.id,a.title,a.authority_key,a.publisher_key,a.published_at,a.retrieved_at,a.created_at,public.nars_structured_subject(a.title) structured_subject
    from public.nars_evidence_artifacts a where a.verification_status='content_verified'
  ), raw as (
    select ev.id event_id,cl.id claim_id,art.id artifact_id,ev.title event_title,art.title artifact_title,art.authority_key,art.publisher_key,
      ev.structured_subject event_subject,art.structured_subject artifact_subject,
      extensions.similarity(lower(ev.title),lower(art.title))::numeric tri,public.nars_token_jaccard(ev.title,art.title)::numeric jac,public.nars_shared_token_count(ev.title,art.title) shared,
      least(abs(extract(epoch from(coalesce(art.published_at,art.retrieved_at,art.created_at)-ev.first_detected_at)))/3600.0,abs(extract(epoch from(coalesce(art.retrieved_at,art.created_at)-ev.first_detected_at)))/3600.0)::numeric hours,
      exists(select 1 from public.nars_event_evidence_links x where x.event_id=ev.id and x.artifact_id=art.id) existing_link,
      case when ev.structured_subject is not null and art.structured_subject is not null and ev.structured_subject<>art.structured_subject then 'CONFLICT'
        when art.authority_key='kr:fss-dart' and art.structured_subject is not null and position(art.structured_subject in lower(ev.title))=0 then 'DART_ISSUER_MISSING'
        when art.structured_subject is not null and ((ev.structured_subject is not null and ev.structured_subject=art.structured_subject) or position(art.structured_subject in lower(ev.title))>0) then 'MATCH' else 'NONE' end gate
    from ev join cl on cl.event_id=ev.id join art on (
      coalesce(art.published_at,art.retrieved_at,art.created_at) between ev.first_detected_at-make_interval(days=>greatest(1,least(coalesce(p_artifact_days,45),90))) and coalesce(ev.last_updated_at,ev.first_detected_at)+make_interval(days=>greatest(1,least(coalesce(p_artifact_days,45),90)))
      or coalesce(art.retrieved_at,art.created_at) between ev.first_detected_at-make_interval(days=>greatest(1,least(coalesce(p_artifact_days,45),90))) and coalesce(ev.last_updated_at,ev.first_detected_at)+make_interval(days=>greatest(1,least(coalesce(p_artifact_days,45),90)))
    )
  ), f as (
    select raw.*,(case when hours<=6 then 1.0 when hours<=24 then .85 when hours<=72 then .60 when hours<=168 then .35 else .10 end)::numeric temporal,
      least(1.0,0.35*tri+0.25*jac+0.15*(case when hours<=6 then 1.0 when hours<=24 then .85 when hours<=72 then .60 when hours<=168 then .35 else .10 end)+0.15*least(shared/4.0,1.0)+0.10*(case when gate='MATCH' then 1.0 else 0.0 end))::numeric final_score
    from raw where tri>=0.18 or jac>=0.20 or shared>=2 or gate in('MATCH','CONFLICT','DART_ISSUER_MISSING')
  ), decided as (
    select f.*,case when gate in('CONFLICT','DART_ISSUER_MISSING') then 'REJECT'
      when gate='MATCH' and final_score>=0.70 and shared>=3 and (jac>=0.45 or tri>=0.50) and hours<=336 then 'AUTO_LINK'
      when final_score>=0.80 and shared>=4 and jac>=0.50 and tri>=0.45 and hours<=720 then 'AUTO_LINK'
      when final_score>=0.48 and shared>=2 and (jac>=0.25 or tri>=0.30) and hours<=1080 then 'REVIEW' else 'REJECT' end decision
    from f
  )
  insert into public.nars_evidence_match_candidates(event_id,claim_id,artifact_id,match_version,algorithmic_decision,review_status,relation_suggestion,lexical_similarity,token_jaccard,shared_tokens,temporal_score,time_distance_hours,subject_gate,final_score,is_existing_link,rationale)
  select event_id,claim_id,artifact_id,'4.10.0-match-v1',decision,case when decision='REVIEW' then 'PENDING' else 'NOT_REQUIRED' end,'supports',round(tri,5),round(jac,5),shared,round(temporal,5),round(hours,3),gate,round(final_score,5),existing_link,
    jsonb_build_object('event_title',event_title,'artifact_title',artifact_title,'authority_key',authority_key,'publisher_key',publisher_key,'event_subject',event_subject,'artifact_subject',artifact_subject,'precision_policy','auto>=0.80; structured>=0.70; review>=0.48') from decided
  on conflict(event_id,artifact_id,match_version) do update set claim_id=excluded.claim_id,algorithmic_decision=excluded.algorithmic_decision,
    review_status=case when public.nars_evidence_match_candidates.review_status in('APPROVED','REJECTED') then public.nars_evidence_match_candidates.review_status else excluded.review_status end,
    relation_suggestion=excluded.relation_suggestion,lexical_similarity=excluded.lexical_similarity,token_jaccard=excluded.token_jaccard,shared_tokens=excluded.shared_tokens,temporal_score=excluded.temporal_score,time_distance_hours=excluded.time_distance_hours,subject_gate=excluded.subject_gate,final_score=excluded.final_score,is_existing_link=excluded.is_existing_link,rationale=excluded.rationale,updated_at=now();
  get diagnostics v_candidates=row_count;
  insert into public.nars_claim_evidence_links(claim_id,artifact_id,relation,confidence,link_method,metadata)
  select c.id,l.artifact_id,l.relation,l.confidence,'direct_event_link_backfill_v1',jsonb_build_object('event_id',l.event_id,'source_link_method',l.link_method,'is_direct',l.is_direct)
  from public.nars_event_evidence_links l join public.nars_evidence_artifacts a on a.id=l.artifact_id and a.verification_status='content_verified'
  join public.nars_event_claims c on c.event_id=l.event_id and c.status='active' and c.claim_type='headline_assertion' where l.relation in('supports','context','mentions')
  on conflict(claim_id,artifact_id,relation) do nothing; get diagnostics v_direct_claims=row_count;
  insert into public.nars_claim_evidence_links(claim_id,artifact_id,relation,confidence,link_method,metadata)
  select m.claim_id,m.artifact_id,'supports',m.final_score,'primary_evidence_match_v1',jsonb_build_object('candidate_id',m.id,'match_version',m.match_version,'subject_gate',m.subject_gate,'shared_tokens',m.shared_tokens,'token_jaccard',m.token_jaccard,'lexical_similarity',m.lexical_similarity,'time_distance_hours',m.time_distance_hours)
  from public.nars_evidence_match_candidates m where m.match_version='4.10.0-match-v1' and m.algorithmic_decision='AUTO_LINK' and m.review_status='NOT_REQUIRED' and not m.is_existing_link
  on conflict(claim_id,artifact_id,relation) do nothing; get diagnostics v_auto_claims=row_count;
  insert into public.nars_event_evidence_links(event_id,artifact_id,relation,confidence,link_method,is_direct,metadata)
  select m.event_id,m.artifact_id,'supports',m.final_score,'primary_evidence_match_v1',false,jsonb_build_object('candidate_id',m.id,'claim_id',m.claim_id,'match_version',m.match_version,'subject_gate',m.subject_gate,'shared_tokens',m.shared_tokens,'token_jaccard',m.token_jaccard,'lexical_similarity',m.lexical_similarity,'time_distance_hours',m.time_distance_hours)
  from public.nars_evidence_match_candidates m where m.match_version='4.10.0-match-v1' and m.algorithmic_decision='AUTO_LINK' and m.review_status='NOT_REQUIRED' and not m.is_existing_link
  on conflict(event_id,artifact_id,relation) do nothing; get diagnostics v_event_links=row_count;
  if v_event_links>0 then v_rescore:=public.nars_score_events(500); end if;
  return jsonb_build_object('version','4.10.0-match-v1','claim_sync',v_claim_sync,'candidate_rows',v_candidates,'direct_claim_links_inserted',v_direct_claims,'auto_claim_links_inserted',v_auto_claims,'event_links_inserted',v_event_links,'rescore',v_rescore);
end;$$;

create or replace function public.nars_review_primary_evidence_match(p_candidate_id uuid,p_approve boolean,p_relation text default 'supports')
returns jsonb language plpgsql set search_path='' as $$
declare v record; v_inserted integer:=0; v_claim_inserted integer:=0; v_rescore jsonb;
begin
  if p_relation not in('supports','context','mentions','contradicts','refutes') then raise exception 'invalid_relation'; end if;
  select * into v from public.nars_evidence_match_candidates where id=p_candidate_id for update;
  if not found then raise exception 'candidate_not_found'; end if;
  if v.algorithmic_decision<>'REVIEW' then raise exception 'candidate_not_reviewable'; end if;
  if not p_approve then update public.nars_evidence_match_candidates set review_status='REJECTED',updated_at=now() where id=p_candidate_id; return jsonb_build_object('candidate_id',p_candidate_id,'review_status','REJECTED'); end if;
  insert into public.nars_claim_evidence_links(claim_id,artifact_id,relation,confidence,link_method,metadata)
  values(v.claim_id,v.artifact_id,p_relation,v.final_score,'primary_evidence_match_review_v1',jsonb_build_object('candidate_id',v.id,'match_version',v.match_version,'reviewed',true)) on conflict do nothing;
  get diagnostics v_claim_inserted=row_count;
  insert into public.nars_event_evidence_links(event_id,artifact_id,relation,confidence,link_method,is_direct,metadata)
  values(v.event_id,v.artifact_id,p_relation,v.final_score,'primary_evidence_match_review_v1',false,jsonb_build_object('candidate_id',v.id,'claim_id',v.claim_id,'match_version',v.match_version,'reviewed',true)) on conflict do nothing;
  get diagnostics v_inserted=row_count;
  update public.nars_evidence_match_candidates set review_status='APPROVED',updated_at=now() where id=p_candidate_id;
  if v_inserted>0 then v_rescore:=public.nars_score_events(500); end if;
  return jsonb_build_object('candidate_id',p_candidate_id,'review_status','APPROVED','relation',p_relation,'claim_link_inserted',v_claim_inserted>0,'event_link_inserted',v_inserted>0,'rescore',v_rescore);
end;$$;

create or replace view public.nars_primary_evidence_review_queue_v1 with (security_invoker=true) as
select m.id candidate_id,m.event_id,e.title event_title,s.priority_score,s.priority_band,m.claim_id,c.claim_text,m.artifact_id,a.title artifact_title,a.authority_key,a.publisher_key,a.canonical_url,m.final_score,m.lexical_similarity,m.token_jaccard,m.shared_tokens,m.temporal_score,m.time_distance_hours,m.subject_gate,m.review_status,m.rationale,m.updated_at
from public.nars_evidence_match_candidates m join public.nars_events e on e.id=m.event_id join public.nars_event_score_latest_v1 s on s.event_id=m.event_id join public.nars_event_claims c on c.id=m.claim_id join public.nars_evidence_artifacts a on a.id=m.artifact_id
where m.algorithmic_decision='REVIEW' and m.review_status='PENDING' order by s.priority_score desc,m.final_score desc,m.updated_at desc;

create or replace view public.nars_primary_evidence_match_metrics_v1 with (security_invoker=true) as
with hp as(select e.id from public.nars_events e join public.nars_event_score_latest_v1 s on s.event_id=e.id where s.priority_band in('HIGH','FLASH')),
covered as(select distinct hp.id from hp join public.nars_event_evidence_links l on l.event_id=hp.id join public.nars_evidence_artifacts a on a.id=l.artifact_id and a.verification_status='content_verified'),
c as(select count(*)::int total_candidates,count(*) filter(where algorithmic_decision='AUTO_LINK')::int auto_candidates,count(*) filter(where algorithmic_decision='REVIEW')::int review_candidates,count(*) filter(where algorithmic_decision='REVIEW' and review_status='PENDING')::int pending_review,count(*) filter(where is_existing_link)::int positive_controls,count(*) filter(where is_existing_link and algorithmic_decision='AUTO_LINK')::int positive_controls_auto,avg(final_score) filter(where is_existing_link) positive_control_avg_score from public.nars_evidence_match_candidates where match_version='4.10.0-match-v1')
select (select count(*) from public.nars_event_claims where status='active')::int active_claims,(select count(*) from public.nars_evidence_artifacts where verification_status='content_verified')::int verified_artifacts,(select count(*) from public.nars_claim_evidence_links)::int claim_evidence_links,c.*,(select count(*) from hp)::int high_priority_events,(select count(*) from covered)::int high_priority_covered,case when (select count(*) from hp)=0 then 0::numeric else round((select count(*) from covered)::numeric/(select count(*) from hp),4) end high_priority_coverage,now() generated_at from c;

revoke all on table public.nars_primary_evidence_review_queue_v1 from public,anon,authenticated;
revoke all on table public.nars_primary_evidence_match_metrics_v1 from public,anon,authenticated;
grant select on table public.nars_primary_evidence_review_queue_v1 to service_role;
grant select on table public.nars_primary_evidence_match_metrics_v1 to service_role;
revoke execute on function public.nars_sync_event_headline_claims(integer) from public,anon,authenticated;
revoke execute on function public.nars_refresh_primary_evidence_matches(integer,integer) from public,anon,authenticated;
revoke execute on function public.nars_review_primary_evidence_match(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.nars_sync_event_headline_claims(integer) to service_role;
grant execute on function public.nars_refresh_primary_evidence_matches(integer,integer) to service_role;
grant execute on function public.nars_review_primary_evidence_match(uuid,boolean,text) to service_role;

insert into public.nars_system_meta(key,value,updated_at) values('primary_evidence_matching',jsonb_build_object('version','4.10.0-match-v1','auto_threshold',0.80,'structured_auto_threshold',0.70,'review_threshold',0.48,'high_priority_target_coverage',0.80,'execution_authority',false,'schedule','7-59/10 * * * *'),now()) on conflict(key) do update set value=excluded.value,updated_at=now();
do $$ declare v_id bigint; begin select jobid into v_id from cron.job where jobname='nars-primary-evidence-match-10m' limit 1; if v_id is not null then perform cron.unschedule(v_id); end if; perform cron.schedule('nars-primary-evidence-match-10m','7-59/10 * * * *',$cmd$select public.nars_refresh_primary_evidence_matches(500,45);$cmd$); end $$;
