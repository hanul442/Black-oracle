create or replace view public.nars_cluster_metrics_v1 as
select
  (select count(*) from public.nars_documents) as documents,
  (select count(*) from public.nars_stories) as stories,
  (select count(*) from public.nars_events) as events,
  (select count(*) from public.nars_documents d left join public.nars_story_documents sd on sd.document_id=d.id where sd.document_id is null) as unclustered_documents,
  (select count(*) from public.nars_stories where document_count > 1) as multi_document_stories,
  (select count(*) from public.nars_events where coalesce((metadata->>'story_count')::integer,0) > 1) as multi_story_events,
  (select coalesce(max(document_count),0) from public.nars_stories) as max_story_size,
  (select coalesce(max((metadata->>'story_count')::integer),0) from public.nars_events) as max_event_story_count,
  case when (select count(*) from public.nars_documents) = 0 then 0
       else 1 - ((select count(*) from public.nars_stories)::numeric / (select count(*) from public.nars_documents)::numeric)
  end as story_compression_ratio,
  case when (select count(*) from public.nars_stories) = 0 then 0
       else 1 - ((select count(*) from public.nars_events)::numeric / (select count(*) from public.nars_stories)::numeric)
  end as event_compression_ratio,
  now() as generated_at;

create or replace view public.nars_cluster_review_queue_v1 as
select
  'story_document'::text as review_type,
  sd.story_id as parent_id,
  sd.document_id as child_id,
  sd.similarity,
  sd.method,
  s.display_title as parent_title,
  d.title as child_title,
  d.retrieved_at as observed_at
from public.nars_story_documents sd
join public.nars_stories s on s.id=sd.story_id
join public.nars_documents d on d.id=sd.document_id
where not sd.is_anchor
  and sd.similarity < 0.80
union all
select
  'event_story'::text as review_type,
  es.event_id as parent_id,
  es.story_id as child_id,
  es.similarity,
  es.method,
  e.title as parent_title,
  s.display_title as child_title,
  s.first_seen_at as observed_at
from public.nars_event_stories es
join public.nars_events e on e.id=es.event_id
join public.nars_stories s on s.id=es.story_id
where es.similarity < 0.68
  and es.similarity < 0.999;

revoke all on public.nars_cluster_metrics_v1 from anon, authenticated;
revoke all on public.nars_cluster_review_queue_v1 from anon, authenticated;
grant select on public.nars_cluster_metrics_v1 to service_role;
grant select on public.nars_cluster_review_queue_v1 to service_role;

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
    'version','4.1.1-lexical'
  );
end;
$$;

revoke all on function public.nars_cluster_pending_documents(integer) from public, anon, authenticated;
grant execute on function public.nars_cluster_pending_documents(integer) to service_role;
