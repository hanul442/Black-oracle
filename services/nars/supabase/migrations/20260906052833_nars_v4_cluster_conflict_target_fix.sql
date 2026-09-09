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
  on conflict on constraint nars_event_documents_pkey do update
    set confidence = greatest(public.nars_event_documents.confidence, excluded.confidence);

  perform public.nars_refresh_event_stats(v_event_id);

  return query select v_event_id, v_created, coalesce(v_similarity,1)::real;
end;
$$;

revoke all on function public.nars_assign_story_event(uuid,real,interval) from public, anon, authenticated;
grant execute on function public.nars_assign_story_event(uuid,real,interval) to service_role;
