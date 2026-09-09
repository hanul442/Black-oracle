create or replace function public.nars_source_identity(p_name text, p_metadata jsonb)
returns text
language sql
immutable
as $$
  select coalesce(nullif(lower(btrim(p_metadata->>'publisher_key')),''), lower(btrim(p_name)));
$$;

create or replace function public.nars_title_tokens(p_text text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(token order by token), array[]::text[])
  from (
    select distinct x as token
    from unnest(regexp_split_to_array(lower(regexp_replace(coalesce(p_text,''), '[^[:alnum:]가-힣]+', ' ', 'g')), '\s+')) as x
    where length(x) >= 2
      and x not in ('속보','단독','종합','오늘','이번','관련','대한','통해','위해','등','및','기자','뉴스','발표','예정')
  ) q;
$$;

create or replace function public.nars_token_jaccard(p_a text, p_b text)
returns real
language sql
immutable
as $$
  with a as (select unnest(public.nars_title_tokens(p_a)) token),
       b as (select unnest(public.nars_title_tokens(p_b)) token),
       i as (select count(*)::real n from (select token from a intersect select token from b) x),
       u as (select count(*)::real n from (select token from a union select token from b) x)
  select case when u.n = 0 then 0::real else (i.n/u.n)::real end from i,u;
$$;

create or replace function public.nars_shared_token_count(p_a text, p_b text)
returns integer
language sql
immutable
as $$
  with a as (select unnest(public.nars_title_tokens(p_a)) token),
       b as (select unnest(public.nars_title_tokens(p_b)) token)
  select count(*)::integer from (select token from a intersect select token from b) x;
$$;

create or replace function public.nars_event_match_score(p_a text, p_b text, p_delta_seconds double precision)
returns real
language plpgsql
immutable
set search_path = public, extensions, pg_temp
as $$
declare
  v_tri real := greatest(extensions.similarity(p_a,p_b), extensions.word_similarity(p_a,p_b));
  v_jac real := public.nars_token_jaccard(p_a,p_b);
  v_shared integer := public.nars_shared_token_count(p_a,p_b);
  v_time real := case
    when p_delta_seconds <= 3600 then 0.08
    when p_delta_seconds <= 10800 then 0.06
    when p_delta_seconds <= 21600 then 0.04
    when p_delta_seconds <= 43200 then 0.02
    else 0
  end;
  v_score real;
begin
  if v_tri >= 0.55 then
    v_score := least(1.0, 0.78*v_tri + 0.17*v_jac + v_time);
  elsif p_delta_seconds <= 21600 and v_shared >= 3 and v_jac >= 0.20 then
    v_score := least(0.82, 0.48 + least(v_shared,5)*0.045 + 0.22*v_jac + v_time);
  else
    v_score := 0.45*v_tri + 0.25*v_jac + least(v_shared,3)*0.035 + v_time;
  end if;
  return greatest(0::real, least(1::real, v_score));
end;
$$;

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
      source_count = a.publisher_count,
      breaking_count = a.breaking_count,
      status = case when a.document_count >= 2 or a.publisher_count >= 2 then 'developing' else 'detected' end,
      updated_at = now()
  from (
    select min(d.retrieved_at) as first_seen_at,
           max(d.retrieved_at) as last_seen_at,
           count(*)::integer as document_count,
           count(distinct public.nars_source_identity(src.name,src.metadata))::integer as publisher_count,
           count(*) filter (where d.is_breaking)::integer as breaking_count
    from public.nars_story_documents sd
    join public.nars_documents d on d.id = sd.document_id
    join public.nars_sources src on src.id = d.source_id
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
         count(distinct public.nars_source_identity(src.name,src.metadata))::integer,
         count(*) filter (where d.is_breaking)::integer,
         min(d.retrieved_at),
         max(d.retrieved_at)
  into v_doc_count, v_source_count, v_breaking_count, v_first, v_last
  from public.nars_event_documents ed
  join public.nars_documents d on d.id = ed.document_id
  join public.nars_sources src on src.id = d.source_id
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
        'cluster_method', 'lexical_v2',
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
           public.nars_event_match_score(
             v_story.canonical_title,
             coalesce(e.metadata->>'cluster_canonical_title', lower(e.title)),
             least(
               abs(extract(epoch from (v_story.first_seen_at - e.last_updated_at))),
               abs(extract(epoch from (v_story.last_seen_at - e.first_detected_at)))
             )
           )::real
    into v_event_id, v_similarity
    from public.nars_events e
    where e.status not in ('resolved','archived')
      and e.last_updated_at >= v_story.first_seen_at - p_window
      and e.first_detected_at <= v_story.last_seen_at + p_window
      and coalesce(e.metadata->>'cluster_language','') = coalesce(v_story.language,'')
    order by public.nars_event_match_score(
               v_story.canonical_title,
               coalesce(e.metadata->>'cluster_canonical_title', lower(e.title)),
               least(
                 abs(extract(epoch from (v_story.first_seen_at - e.last_updated_at))),
                 abs(extract(epoch from (v_story.last_seen_at - e.first_detected_at)))
               )
             ) desc,
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
          'cluster_method','lexical_v2',
          'cluster_language',v_story.language,
          'cluster_canonical_title',v_story.canonical_title,
          'cluster_version','4.1.1'
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
  on conflict on constraint nars_event_documents_pkey do update
    set confidence = greatest(public.nars_event_documents.confidence, excluded.confidence);

  perform public.nars_refresh_event_stats(v_event_id);

  return query select v_event_id, v_created, coalesce(v_similarity,1)::real;
end;
$$;

revoke all on function public.nars_source_identity(text,jsonb) from public, anon, authenticated;
revoke all on function public.nars_title_tokens(text) from public, anon, authenticated;
revoke all on function public.nars_token_jaccard(text,text) from public, anon, authenticated;
revoke all on function public.nars_shared_token_count(text,text) from public, anon, authenticated;
revoke all on function public.nars_event_match_score(text,text,double precision) from public, anon, authenticated;
revoke all on function public.nars_refresh_story_stats(uuid) from public, anon, authenticated;
revoke all on function public.nars_refresh_event_stats(uuid) from public, anon, authenticated;
revoke all on function public.nars_assign_story_event(uuid,real,interval) from public, anon, authenticated;

grant execute on function public.nars_source_identity(text,jsonb) to service_role;
grant execute on function public.nars_title_tokens(text) to service_role;
grant execute on function public.nars_token_jaccard(text,text) to service_role;
grant execute on function public.nars_shared_token_count(text,text) to service_role;
grant execute on function public.nars_event_match_score(text,text,double precision) to service_role;
grant execute on function public.nars_refresh_story_stats(uuid) to service_role;
grant execute on function public.nars_refresh_event_stats(uuid) to service_role;
grant execute on function public.nars_assign_story_event(uuid,real,interval) to service_role;

update public.nars_sources
set metadata = metadata || jsonb_build_object('publisher_key', lower(btrim(name)))
where coalesce(metadata->>'publisher_key','') = '';
