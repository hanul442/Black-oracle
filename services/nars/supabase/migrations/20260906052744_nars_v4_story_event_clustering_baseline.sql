create extension if not exists pg_trgm with schema extensions;

create table if not exists public.nars_stories (
  id uuid primary key default gen_random_uuid(),
  story_key text not null unique,
  display_title text not null,
  canonical_title text not null,
  language text,
  status text not null default 'detected' check (status in ('detected','developing','stabilized','archived')),
  anchor_document_id uuid references public.nars_documents(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  document_count integer not null default 0,
  source_count integer not null default 0,
  breaking_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nars_story_documents (
  story_id uuid not null references public.nars_stories(id) on delete cascade,
  document_id uuid not null references public.nars_documents(id) on delete cascade,
  similarity numeric not null default 1 check (similarity >= 0 and similarity <= 1),
  method text not null default 'title_trgm' check (method in ('exact','title_trgm','manual')),
  is_anchor boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (story_id, document_id),
  unique (document_id)
);

create table if not exists public.nars_event_stories (
  event_id uuid not null references public.nars_events(id) on delete cascade,
  story_id uuid not null references public.nars_stories(id) on delete cascade,
  similarity numeric not null default 1 check (similarity >= 0 and similarity <= 1),
  method text not null default 'lexical_v1' check (method in ('lexical_v1','manual')),
  created_at timestamptz not null default now(),
  primary key (event_id, story_id),
  unique (story_id)
);

create index if not exists nars_stories_language_last_seen_idx on public.nars_stories(language, last_seen_at desc);
create index if not exists nars_story_documents_story_id_idx on public.nars_story_documents(story_id);
create index if not exists nars_event_stories_event_id_idx on public.nars_event_stories(event_id);
create index if not exists nars_events_last_updated_idx on public.nars_events(last_updated_at desc);

alter table public.nars_stories enable row level security;
alter table public.nars_story_documents enable row level security;
alter table public.nars_event_stories enable row level security;

revoke all on public.nars_stories from anon, authenticated;
revoke all on public.nars_story_documents from anon, authenticated;
revoke all on public.nars_event_stories from anon, authenticated;
grant all on public.nars_stories to service_role;
grant all on public.nars_story_documents to service_role;
grant all on public.nars_event_stories to service_role;

create or replace function public.nars_refresh_story_stats(p_story_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.nars_stories s
  set first_seen_at = a.first_seen_at,
      last_seen_at = a.last_seen_at,
      document_count = a.document_count,
      source_count = a.source_count,
      breaking_count = a.breaking_count,
      status = case when a.document_count >= 2 or a.source_count >= 2 then 'developing' else 'detected' end,
      updated_at = now()
  from (
    select min(d.retrieved_at) as first_seen_at,
           max(d.retrieved_at) as last_seen_at,
           count(*)::integer as document_count,
           count(distinct d.source_id)::integer as source_count,
           count(*) filter (where d.is_breaking)::integer as breaking_count
    from public.nars_story_documents sd
    join public.nars_documents d on d.id = sd.document_id
    where sd.story_id = p_story_id
  ) a
  where s.id = p_story_id;
end;
$$;

create or replace function public.nars_refresh_event_stats(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc_count integer;
  v_source_count integer;
  v_breaking_count integer;
  v_story_count integer;
  v_first timestamptz;
  v_last timestamptz;
begin
  select count(*)::integer,
         count(distinct d.source_id)::integer,
         count(*) filter (where d.is_breaking)::integer,
         min(d.retrieved_at),
         max(d.retrieved_at)
  into v_doc_count, v_source_count, v_breaking_count, v_first, v_last
  from public.nars_event_documents ed
  join public.nars_documents d on d.id = ed.document_id
  where ed.event_id = p_event_id;

  select count(*)::integer into v_story_count
  from public.nars_event_stories es
  where es.event_id = p_event_id;

  update public.nars_events e
  set first_detected_at = coalesce(v_first, e.first_detected_at),
      last_updated_at = coalesce(v_last, e.last_updated_at),
      status = case
        when e.status in ('confirmed','stabilized','resolved','archived') then e.status
        when coalesce(v_story_count,0) >= 2 or coalesce(v_source_count,0) >= 2 then 'developing'
        else 'detected'
      end,
      metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object(
        'cluster_method', 'lexical_v1',
        'story_count', coalesce(v_story_count,0),
        'document_count', coalesce(v_doc_count,0),
        'source_count', coalesce(v_source_count,0),
        'breaking_count', coalesce(v_breaking_count,0)
      )
  where e.id = p_event_id;
end;
$$;

create or replace function public.nars_assign_story_event(
  p_story_id uuid,
  p_event_threshold real default 0.58,
  p_window interval default interval '24 hours'
)
returns table(event_id uuid, event_created boolean, event_similarity real)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_story public.nars_stories%rowtype;
  v_event_id uuid;
  v_similarity real;
  v_created boolean := false;
begin
  select * into v_story from public.nars_stories where id = p_story_id;
  if not found then raise exception 'story_not_found'; end if;

  select es.event_id, es.similarity::real
  into v_event_id, v_similarity
  from public.nars_event_stories es
  where es.story_id = p_story_id
  limit 1;

  if v_event_id is null then
    select e.id,
           extensions.similarity(v_story.canonical_title, coalesce(e.metadata->>'cluster_canonical_title', lower(e.title)))::real
    into v_event_id, v_similarity
    from public.nars_events e
    where e.status not in ('resolved','archived')
      and e.last_updated_at >= v_story.first_seen_at - p_window
      and e.first_detected_at <= v_story.last_seen_at + p_window
      and coalesce(e.metadata->>'cluster_language','') = coalesce(v_story.language,'')
    order by extensions.similarity(v_story.canonical_title, coalesce(e.metadata->>'cluster_canonical_title', lower(e.title))) desc,
             e.last_updated_at desc
    limit 1;

    if v_event_id is null or coalesce(v_similarity,0) < p_event_threshold then
      insert into public.nars_events(event_key, title, status, priority_score, evidence_grade, summary, first_detected_at, last_updated_at, metadata)
      values (
        'evt:' || gen_random_uuid()::text,
        v_story.display_title,
        'detected',
        0,
        null,
        null,
        v_story.first_seen_at,
        v_story.last_seen_at,
        jsonb_build_object(
          'cluster_method','lexical_v1',
          'cluster_language',v_story.language,
          'cluster_canonical_title',v_story.canonical_title,
          'cluster_version','4.1.0'
        )
      )
      returning id into v_event_id;
      v_similarity := 1;
      v_created := true;
    end if;

    insert into public.nars_event_stories(event_id, story_id, similarity, method)
    values (v_event_id, p_story_id, coalesce(v_similarity,1), 'lexical_v1')
    on conflict (story_id) do nothing;
  end if;

  insert into public.nars_event_documents(event_id, document_id, relation, confidence)
  select v_event_id, sd.document_id,
         case when sd.is_anchor then 'primary' else 'supporting' end,
         greatest(0::numeric, least(1::numeric, sd.similarity))
  from public.nars_story_documents sd
  where sd.story_id = p_story_id
  on conflict (event_id, document_id) do update
    set confidence = greatest(public.nars_event_documents.confidence, excluded.confidence);

  perform public.nars_refresh_event_stats(v_event_id);

  return query select v_event_id, v_created, coalesce(v_similarity,1)::real;
end;
$$;

create or replace function public.nars_assign_document_story(
  p_document_id uuid,
  p_story_threshold real default 0.72,
  p_event_threshold real default 0.58,
  p_story_window interval default interval '12 hours',
  p_event_window interval default interval '24 hours'
)
returns table(
  story_id uuid,
  story_created boolean,
  story_similarity real,
  event_id uuid,
  event_created boolean,
  event_similarity real
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_doc public.nars_documents%rowtype;
  v_story_id uuid;
  v_story_similarity real;
  v_story_created boolean := false;
  v_event_id uuid;
  v_event_created boolean;
  v_event_similarity real;
begin
  select * into v_doc from public.nars_documents where id = p_document_id;
  if not found then raise exception 'document_not_found'; end if;

  select sd.story_id, sd.similarity::real
  into v_story_id, v_story_similarity
  from public.nars_story_documents sd
  where sd.document_id = p_document_id
  limit 1;

  if v_story_id is null then
    select s.id,
           extensions.similarity(v_doc.normalized_title, s.canonical_title)::real
    into v_story_id, v_story_similarity
    from public.nars_stories s
    where s.status <> 'archived'
      and s.last_seen_at >= v_doc.retrieved_at - p_story_window
      and s.first_seen_at <= v_doc.retrieved_at + p_story_window
      and coalesce(s.language,'') = coalesce(v_doc.language,'')
    order by extensions.similarity(v_doc.normalized_title, s.canonical_title) desc,
             s.last_seen_at desc
    limit 1;

    if v_story_id is null or coalesce(v_story_similarity,0) < p_story_threshold then
      insert into public.nars_stories(
        story_key, display_title, canonical_title, language, status,
        anchor_document_id, first_seen_at, last_seen_at, document_count,
        source_count, breaking_count, metadata
      ) values (
        'story:' || gen_random_uuid()::text,
        v_doc.title,
        v_doc.normalized_title,
        v_doc.language,
        'detected',
        v_doc.id,
        v_doc.retrieved_at,
        v_doc.retrieved_at,
        0,0,0,
        jsonb_build_object('cluster_method','title_trgm','cluster_version','4.1.0')
      ) returning id into v_story_id;
      v_story_similarity := 1;
      v_story_created := true;
    end if;

    insert into public.nars_story_documents(story_id, document_id, similarity, method, is_anchor)
    values (
      v_story_id,
      v_doc.id,
      coalesce(v_story_similarity,1),
      case when v_story_created then 'exact' else 'title_trgm' end,
      v_story_created
    )
    on conflict (document_id) do nothing;
  end if;

  perform public.nars_refresh_story_stats(v_story_id);

  select x.event_id, x.event_created, x.event_similarity
  into v_event_id, v_event_created, v_event_similarity
  from public.nars_assign_story_event(v_story_id, p_event_threshold, p_event_window) x
  limit 1;

  return query select v_story_id, v_story_created, coalesce(v_story_similarity,1)::real,
                      v_event_id, coalesce(v_event_created,false), coalesce(v_event_similarity,1)::real;
end;
$$;

create or replace function public.nars_cluster_pending_documents(p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  r record;
  v_story_created boolean;
  v_event_created boolean;
  v_processed integer := 0;
  v_story_created_count integer := 0;
  v_event_created_count integer := 0;
  v_error_count integer := 0;
begin
  for r in
    select d.id
    from public.nars_documents d
    left join public.nars_story_documents sd on sd.document_id = d.id
    where sd.document_id is null
    order by d.retrieved_at asc
    limit greatest(1, least(coalesce(p_limit,200),1000))
  loop
    begin
      select a.story_created, a.event_created
      into v_story_created, v_event_created
      from public.nars_assign_document_story(r.id) a
      limit 1;
      v_processed := v_processed + 1;
      if coalesce(v_story_created,false) then v_story_created_count := v_story_created_count + 1; end if;
      if coalesce(v_event_created,false) then v_event_created_count := v_event_created_count + 1; end if;
    exception when others then
      v_error_count := v_error_count + 1;
      insert into public.nars_errors(component, error_code, message, retryable, context)
      values ('db:nars-cluster','CLUSTER_DOCUMENT_FAILED',left(sqlerrm,2000),true,jsonb_build_object('document_id',r.id));
    end;
  end loop;

  return jsonb_build_object(
    'processed',v_processed,
    'stories_created',v_story_created_count,
    'events_created',v_event_created_count,
    'errors',v_error_count,
    'version','4.1.0-lexical'
  );
end;
$$;

revoke all on function public.nars_refresh_story_stats(uuid) from public, anon, authenticated;
revoke all on function public.nars_refresh_event_stats(uuid) from public, anon, authenticated;
revoke all on function public.nars_assign_story_event(uuid,real,interval) from public, anon, authenticated;
revoke all on function public.nars_assign_document_story(uuid,real,real,interval,interval) from public, anon, authenticated;
revoke all on function public.nars_cluster_pending_documents(integer) from public, anon, authenticated;
grant execute on function public.nars_refresh_story_stats(uuid) to service_role;
grant execute on function public.nars_refresh_event_stats(uuid) to service_role;
grant execute on function public.nars_assign_story_event(uuid,real,interval) to service_role;
grant execute on function public.nars_assign_document_story(uuid,real,real,interval,interval) to service_role;
grant execute on function public.nars_cluster_pending_documents(integer) to service_role;

create or replace view public.nars_story_wire_v1 as
select s.id as story_id,
       s.story_key,
       s.display_title,
       s.canonical_title,
       s.language,
       s.status,
       s.first_seen_at,
       s.last_seen_at,
       s.document_count,
       s.source_count,
       s.breaking_count,
       es.event_id,
       e.status as event_status,
       e.priority_score,
       e.evidence_grade,
       es.similarity as event_similarity,
       array_agg(distinct src.name order by src.name) filter (where src.name is not null) as sources
from public.nars_stories s
left join public.nars_story_documents sd on sd.story_id = s.id
left join public.nars_documents d on d.id = sd.document_id
left join public.nars_sources src on src.id = d.source_id
left join public.nars_event_stories es on es.story_id = s.id
left join public.nars_events e on e.id = es.event_id
group by s.id, es.event_id, e.status, e.priority_score, e.evidence_grade, es.similarity;

create or replace view public.nars_event_wire_v1 as
select e.id as event_id,
       e.event_key,
       e.title,
       e.status,
       e.priority_score,
       e.evidence_grade,
       e.first_detected_at,
       e.last_updated_at,
       coalesce((e.metadata->>'story_count')::integer,0) as story_count,
       coalesce((e.metadata->>'document_count')::integer,0) as document_count,
       coalesce((e.metadata->>'source_count')::integer,0) as source_count,
       coalesce((e.metadata->>'breaking_count')::integer,0) as breaking_count,
       e.metadata->>'cluster_method' as cluster_method,
       e.metadata->>'cluster_language' as language
from public.nars_events e;

revoke all on public.nars_story_wire_v1 from anon, authenticated;
revoke all on public.nars_event_wire_v1 from anon, authenticated;
grant select on public.nars_story_wire_v1 to service_role;
grant select on public.nars_event_wire_v1 to service_role;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'nars-cluster-5m' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule('nars-cluster-5m','*/5 * * * *','select public.nars_cluster_pending_documents(200);');
end $$;
