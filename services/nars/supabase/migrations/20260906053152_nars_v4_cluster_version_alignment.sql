alter table public.nars_event_stories drop constraint if exists nars_event_stories_method_check;
alter table public.nars_event_stories add constraint nars_event_stories_method_check check (method in ('lexical_v1','lexical_v2','manual'));

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
    values (v_event_id, p_story_id, coalesce(v_similarity,1), 'lexical_v2')
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
        jsonb_build_object('cluster_method','title_trgm','cluster_version','4.1.1')
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

revoke all on function public.nars_assign_story_event(uuid,real,interval) from public, anon, authenticated;
revoke all on function public.nars_assign_document_story(uuid,real,real,interval,interval) from public, anon, authenticated;
grant execute on function public.nars_assign_story_event(uuid,real,interval) to service_role;
grant execute on function public.nars_assign_document_story(uuid,real,real,interval,interval) to service_role;
