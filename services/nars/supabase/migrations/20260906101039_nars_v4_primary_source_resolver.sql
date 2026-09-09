-- NARS v4 N4-06 Primary Source Resolver

create table if not exists public.nars_primary_source_candidates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.nars_events(id) on delete cascade,
  candidate_url text not null,
  normalized_host text not null,
  authority_key text references public.nars_authority_registry(authority_key) on delete set null,
  artifact_id uuid references public.nars_evidence_artifacts(id) on delete set null,
  resolution_status text not null default 'candidate'
    check (resolution_status in ('candidate','url_verified','content_verified','rejected','revoked')),
  detected_by text not null default 'manual',
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,candidate_url)
);
alter table public.nars_primary_source_candidates enable row level security;
revoke all on public.nars_primary_source_candidates from anon,authenticated;
create index if not exists nars_primary_source_candidates_event_status_idx on public.nars_primary_source_candidates(event_id,resolution_status);
create index if not exists nars_primary_source_candidates_authority_idx on public.nars_primary_source_candidates(authority_key);
create index if not exists nars_primary_source_candidates_artifact_idx on public.nars_primary_source_candidates(artifact_id);

create or replace function public.nars_url_host(p_url text)
returns text
language sql
immutable
strict
set search_path=''
as $$
  select nullif(
    lower(
      split_part(
        split_part(
          split_part(regexp_replace(btrim(p_url),'^[a-zA-Z][a-zA-Z0-9+.-]*://','',''), '/', 1),
          '?',1
        ),
        '#',1
      )
    ),
    ''
  );
$$;
revoke execute on function public.nars_url_host(text) from public,anon,authenticated;
grant execute on function public.nars_url_host(text) to service_role;

create or replace function public.nars_match_authority_url(p_url text)
returns table(
  authority_key text,
  display_name text,
  authority_type text,
  country text,
  matched_domain text,
  normalized_host text
)
language sql
stable
security invoker
set search_path=''
as $$
  with host as (
    select split_part(public.nars_url_host(p_url),':',1) as value
  ), matches as (
    select
      a.authority_key,a.display_name,a.authority_type,a.country,d.domain,h.value as normalized_host,
      case when h.value=d.domain then 0 else length(h.value)-length(d.domain) end as suffix_distance
    from public.nars_authority_registry a
    cross join lateral unnest(a.official_domains) as d(domain)
    cross join host h
    where a.review_status='reviewed'
      and h.value is not null
      and (h.value=lower(d.domain) or h.value like '%.'||lower(d.domain))
  )
  select m.authority_key,m.display_name,m.authority_type,m.country,m.domain,m.normalized_host
  from matches m
  order by length(m.domain) desc,m.suffix_distance asc
  limit 1;
$$;
revoke execute on function public.nars_match_authority_url(text) from public,anon,authenticated;
grant execute on function public.nars_match_authority_url(text) to service_role;

create or replace function public.nars_resolve_primary_url(
  p_event_id uuid,
  p_url text,
  p_title text,
  p_content_hash text default null,
  p_content_verified boolean default false,
  p_relation text default 'supports',
  p_confidence numeric default 1.0,
  p_detected_by text default 'resolver',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_match record;
  v_role text;
  v_verification text;
  v_artifact_key text;
  v_attach jsonb;
  v_artifact_id uuid;
  v_host text;
begin
  if p_url is null or btrim(p_url)='' then raise exception 'url_required'; end if;
  if p_title is null or btrim(p_title)='' then raise exception 'title_required'; end if;
  if p_relation not in ('supports','context','contradicts','refutes','mentions') then raise exception 'invalid_relation'; end if;
  if p_content_verified and nullif(btrim(coalesce(p_content_hash,'')),'') is null then raise exception 'content_hash_required_for_content_verified'; end if;

  select * into v_match from public.nars_match_authority_url(p_url) limit 1;
  if v_match.authority_key is null then raise exception 'unrecognized_official_domain'; end if;

  v_host := v_match.normalized_host;
  v_role := case v_match.authority_type
    when 'regulator' then 'primary_regulatory'
    when 'exchange' then 'primary_market'
    when 'court' then 'primary_legal'
    when 'company_ir' then 'primary_corporate'
    when 'statistical_agency' then 'primary_statistical'
    else 'primary_official'
  end;
  v_verification := case when p_content_verified then 'content_verified' else 'url_verified' end;
  v_artifact_key := 'authority:'||v_match.authority_key||':url:'||md5(btrim(p_url));

  insert into public.nars_primary_source_candidates(
    event_id,candidate_url,normalized_host,authority_key,resolution_status,detected_by,metadata,updated_at
  ) values(
    p_event_id,btrim(p_url),v_host,v_match.authority_key,v_verification,coalesce(nullif(btrim(p_detected_by),''),'resolver'),coalesce(p_metadata,'{}'::jsonb),now()
  )
  on conflict(event_id,candidate_url) do update set
    normalized_host=excluded.normalized_host,
    authority_key=excluded.authority_key,
    resolution_status=excluded.resolution_status,
    detected_by=excluded.detected_by,
    rejection_reason=null,
    metadata=public.nars_primary_source_candidates.metadata||excluded.metadata,
    updated_at=now();

  v_attach := public.nars_attach_event_evidence(
    p_event_id,v_artifact_key,v_role,p_title,btrim(p_url),v_match.authority_key,null,null,null,
    v_verification,p_content_hash,p_relation,p_confidence,'authority_domain_resolver',
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object(
      'normalized_host',v_host,'matched_domain',v_match.matched_domain,'authority_type',v_match.authority_type,
      'resolver_version','4.4.0-primary-resolver-v1'
    )
  );

  v_artifact_id := nullif(v_attach->>'artifact_id','')::uuid;
  update public.nars_primary_source_candidates
  set artifact_id=v_artifact_id,updated_at=now()
  where event_id=p_event_id and candidate_url=btrim(p_url);

  return jsonb_build_object(
    'event_id',p_event_id,'authority_key',v_match.authority_key,'authority_name',v_match.display_name,
    'authority_type',v_match.authority_type,'matched_domain',v_match.matched_domain,'normalized_host',v_host,
    'artifact_role',v_role,'verification_status',v_verification,'artifact_id',v_artifact_id,'artifact_key',v_artifact_key
  );
end;
$$;
revoke execute on function public.nars_resolve_primary_url(uuid,text,text,text,boolean,text,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.nars_resolve_primary_url(uuid,text,text,text,boolean,text,numeric,text,jsonb) to service_role;

create or replace function public.nars_reject_primary_candidate(
  p_event_id uuid,
  p_url text,
  p_reason text,
  p_detected_by text default 'resolver'
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare v_host text;
begin
  v_host:=coalesce(split_part(public.nars_url_host(p_url),':',1),'unknown');
  insert into public.nars_primary_source_candidates(event_id,candidate_url,normalized_host,resolution_status,detected_by,rejection_reason,updated_at)
  values(p_event_id,p_url,v_host,'rejected',coalesce(nullif(btrim(p_detected_by),''),'resolver'),left(coalesce(p_reason,'unspecified'),500),now())
  on conflict(event_id,candidate_url) do update set
    resolution_status='rejected',detected_by=excluded.detected_by,rejection_reason=excluded.rejection_reason,updated_at=now();
  return jsonb_build_object('event_id',p_event_id,'url',p_url,'status','rejected','reason',left(coalesce(p_reason,'unspecified'),500));
end;
$$;
revoke execute on function public.nars_reject_primary_candidate(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.nars_reject_primary_candidate(uuid,text,text,text) to service_role;

create or replace view public.nars_primary_resolver_queue_v1
with (security_invoker=true)
as
with c as (
  select event_id,
    count(*)::int as candidate_count,
    count(*) filter(where resolution_status in ('url_verified','content_verified'))::int as verified_candidate_count,
    count(*) filter(where resolution_status='content_verified')::int as content_verified_candidate_count,
    max(updated_at) as candidate_updated_at
  from public.nars_primary_source_candidates
  group by event_id
)
select
  q.event_id,q.title,q.status,q.priority_score,q.evidence_grade,q.last_updated_at,q.review_reason,
  q.artifact_count,q.primary_artifact_count,q.verified_primary_count,q.content_verified_primary_count,q.verified_authority_count,
  coalesce(c.candidate_count,0) as candidate_count,
  coalesce(c.verified_candidate_count,0) as verified_candidate_count,
  coalesce(c.content_verified_candidate_count,0) as content_verified_candidate_count,
  c.candidate_updated_at
from public.nars_provenance_review_queue_v1 q
left join c on c.event_id=q.event_id
order by q.priority_score desc,q.last_updated_at desc;
revoke all on public.nars_primary_resolver_queue_v1 from anon,authenticated;

insert into public.nars_system_meta(key,value,updated_at)
values('primary_resolver_version',jsonb_build_object(
  'version','4.4.0-primary-resolver-v1','authority_domain_required',true,
  'content_hash_required_for_content_verified',true,'updated_at',now()
),now())
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
