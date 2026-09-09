-- N4-12 hardening: distinguish versioned official-document series.
-- Repair the historical BOK MPC-minutes event that mixed meetings 5/6/7/10/11/12/13/14.

create or replace function public.nars_official_series_version(p_title text)
returns text language sql immutable strict set search_path='pg_catalog','public' as $$
  select case
    when p_title ~ '^금융통화위원회 의사록\([0-9]{4}년 제[0-9]+차\)'
      then 'bok_mpc_minutes:'||coalesce(substring(p_title from '\(([0-9]{4})년'),'')||':'||coalesce(substring(p_title from '제([0-9]+)차'),'')
    else null
  end
$$;

create or replace function public.nars_assign_document_story(p_document_id uuid,p_story_threshold real default 0.72,p_event_threshold real default 0.58,p_story_window interval default '12:00:00'::interval,p_event_window interval default '24:00:00'::interval)
returns table(story_id uuid,story_created boolean,story_similarity real,event_id uuid,event_created boolean,event_similarity real)
language plpgsql security definer set search_path='public','extensions','pg_temp' as $$
declare v_doc public.nars_documents%rowtype; v_doc_subject text; v_doc_series text; v_story_id uuid; v_story_similarity real; v_story_created boolean:=false; v_event_id uuid; v_event_created boolean; v_event_similarity real;
begin
  select * into v_doc from public.nars_documents where id=p_document_id; if not found then raise exception 'document_not_found'; end if;
  v_doc_subject:=public.nars_structured_subject(v_doc.title); v_doc_series:=public.nars_official_series_version(v_doc.title);
  select sd.story_id,sd.similarity::real into v_story_id,v_story_similarity from public.nars_story_documents sd where sd.document_id=p_document_id limit 1;
  if v_story_id is null then
    select s.id,extensions.similarity(v_doc.normalized_title,s.canonical_title)::real into v_story_id,v_story_similarity
    from public.nars_stories s
    where s.status<>'archived' and s.last_seen_at>=v_doc.retrieved_at-p_story_window and s.first_seen_at<=v_doc.retrieved_at+p_story_window
      and coalesce(s.language,'')=coalesce(v_doc.language,'')
      and (v_doc_subject is null or coalesce(s.metadata->>'structured_subject',public.nars_structured_subject(s.display_title)) is null or coalesce(s.metadata->>'structured_subject',public.nars_structured_subject(s.display_title))=v_doc_subject)
      and (v_doc_series is null or coalesce(s.metadata->>'official_series_version',public.nars_official_series_version(s.display_title)) is null or coalesce(s.metadata->>'official_series_version',public.nars_official_series_version(s.display_title))=v_doc_series)
    order by extensions.similarity(v_doc.normalized_title,s.canonical_title) desc,s.last_seen_at desc limit 1;
    if v_story_id is null or coalesce(v_story_similarity,0)<p_story_threshold then
      insert into public.nars_stories(story_key,display_title,canonical_title,language,status,anchor_document_id,first_seen_at,last_seen_at,document_count,source_count,breaking_count,metadata)
      values('story:'||gen_random_uuid()::text,v_doc.title,v_doc.normalized_title,v_doc.language,'detected',v_doc.id,v_doc.retrieved_at,v_doc.retrieved_at,0,0,0,
        jsonb_strip_nulls(jsonb_build_object('cluster_method','title_trgm','cluster_version','4.10.1-series-guard','structured_subject',v_doc_subject,'official_series_version',v_doc_series))) returning id into v_story_id;
      v_story_similarity:=1; v_story_created:=true;
    end if;
    insert into public.nars_story_documents(story_id,document_id,similarity,method,is_anchor)
    values(v_story_id,v_doc.id,coalesce(v_story_similarity,1),case when v_story_created then 'exact' else 'title_trgm_subject_guard' end,v_story_created) on conflict(document_id) do nothing;
  end if;
  perform public.nars_refresh_story_stats(v_story_id);
  select x.event_id,x.event_created,x.event_similarity into v_event_id,v_event_created,v_event_similarity from public.nars_assign_story_event(v_story_id,p_event_threshold,p_event_window) x limit 1;
  return query select v_story_id,v_story_created,coalesce(v_story_similarity,1)::real,v_event_id,coalesce(v_event_created,false),coalesce(v_event_similarity,1)::real;
end;$$;

create or replace function public.nars_assign_story_event(p_story_id uuid,p_event_threshold real default 0.58,p_window interval default '24:00:00'::interval)
returns table(event_id uuid,event_created boolean,event_similarity real)
language plpgsql security definer set search_path='public','extensions','pg_temp' as $$
declare v_story public.nars_stories%rowtype; v_story_subject text; v_story_series text; v_event_id uuid; v_similarity real; v_created boolean:=false;
begin
  select * into v_story from public.nars_stories where id=p_story_id; if not found then raise exception 'story_not_found'; end if;
  v_story_subject:=coalesce(v_story.metadata->>'structured_subject',public.nars_structured_subject(v_story.display_title));
  v_story_series:=coalesce(v_story.metadata->>'official_series_version',public.nars_official_series_version(v_story.display_title));
  select es.event_id,es.similarity::real into v_event_id,v_similarity from public.nars_event_stories es where es.story_id=p_story_id limit 1;
  if v_event_id is null then
    select e.id,public.nars_event_match_score(v_story.canonical_title,coalesce(e.metadata->>'cluster_canonical_title',lower(e.title)),least(abs(extract(epoch from(v_story.first_seen_at-e.last_updated_at))),abs(extract(epoch from(v_story.last_seen_at-e.first_detected_at)))))::real
    into v_event_id,v_similarity from public.nars_events e
    where e.status not in('resolved','archived') and e.last_updated_at>=v_story.first_seen_at-p_window and e.first_detected_at<=v_story.last_seen_at+p_window
      and coalesce(e.metadata->>'cluster_language','')=coalesce(v_story.language,'')
      and (v_story_subject is null or coalesce(e.metadata->>'structured_subject',public.nars_structured_subject(e.title)) is null or coalesce(e.metadata->>'structured_subject',public.nars_structured_subject(e.title))=v_story_subject)
      and (v_story_series is null or coalesce(e.metadata->>'official_series_version',public.nars_official_series_version(e.title)) is null or coalesce(e.metadata->>'official_series_version',public.nars_official_series_version(e.title))=v_story_series)
    order by public.nars_event_match_score(v_story.canonical_title,coalesce(e.metadata->>'cluster_canonical_title',lower(e.title)),least(abs(extract(epoch from(v_story.first_seen_at-e.last_updated_at))),abs(extract(epoch from(v_story.last_seen_at-e.first_detected_at))))) desc,e.last_updated_at desc limit 1;
    if v_event_id is null or coalesce(v_similarity,0)<p_event_threshold then
      insert into public.nars_events(event_key,title,status,priority_score,evidence_grade,summary,first_detected_at,last_updated_at,metadata)
      values('evt:'||gen_random_uuid()::text,v_story.display_title,'detected',0,null,null,v_story.first_seen_at,v_story.last_seen_at,
        jsonb_strip_nulls(jsonb_build_object('cluster_method','lexical_v2_subject_guard','cluster_language',v_story.language,'cluster_canonical_title',v_story.canonical_title,'cluster_version','4.10.1-series-guard','structured_subject',v_story_subject,'official_series_version',v_story_series))) returning id into v_event_id;
      v_similarity:=1; v_created:=true;
    end if;
    insert into public.nars_event_stories(event_id,story_id,similarity,method) values(v_event_id,p_story_id,coalesce(v_similarity,1),'lexical_v2_subject_guard') on conflict(story_id) do nothing;
  end if;
  insert into public.nars_event_documents(event_id,document_id,relation,confidence)
  select v_event_id,sd.document_id,case when sd.is_anchor then 'primary' else 'supporting' end,greatest(0::numeric,least(1::numeric,sd.similarity)) from public.nars_story_documents sd where sd.story_id=p_story_id
  on conflict on constraint nars_event_documents_pkey do update set confidence=greatest(public.nars_event_documents.confidence,excluded.confidence);
  perform public.nars_refresh_event_stats(v_event_id);
  return query select v_event_id,v_created,coalesce(v_similarity,1)::real;
end;$$;

-- Data repair is intentionally idempotent: it runs only while the contaminated event exists.
do $$
declare v_old uuid:='f127fb6f-8556-492a-ab02-2a8a0c003ef4'::uuid; r record; v_new uuid; v_artifact_event uuid;
begin
  if exists(select 1 from public.nars_events where id=v_old) then
    create temporary table if not exists pg_temp.nars_series_repair_map(story_id uuid primary key,new_event_id uuid not null) on commit drop;
    truncate pg_temp.nars_series_repair_map;
    for r in select s.id story_id,s.display_title,s.canonical_title,s.language,s.first_seen_at,s.last_seen_at,
      coalesce(s.metadata->>'structured_subject',public.nars_structured_subject(s.display_title)) subject,public.nars_official_series_version(s.display_title) series_version
      from public.nars_event_stories es join public.nars_stories s on s.id=es.story_id where es.event_id=v_old order by s.first_seen_at,s.display_title
    loop
      update public.nars_stories set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object('cluster_version','4.10.1-series-guard','official_series_version',r.series_version)) where id=r.story_id;
      insert into public.nars_events(event_key,title,status,priority_score,evidence_grade,summary,first_detected_at,last_updated_at,metadata)
      values('evt:series-repair:'||gen_random_uuid()::text,r.display_title,'detected',0,null,null,r.first_seen_at,r.last_seen_at,
        jsonb_strip_nulls(jsonb_build_object('cluster_method','lexical_v2_subject_guard','cluster_language',r.language,'cluster_canonical_title',r.canonical_title,'cluster_version','4.10.1-series-guard','structured_subject',r.subject,'official_series_version',r.series_version,'repaired_from_event',v_old))) returning id into v_new;
      insert into pg_temp.nars_series_repair_map values(r.story_id,v_new);
      update public.nars_event_stories set event_id=v_new,method='lexical_v2_subject_guard',similarity=1 where story_id=r.story_id and event_id=v_old;
      insert into public.nars_event_documents(event_id,document_id,relation,confidence)
      select v_new,sd.document_id,case when sd.is_anchor then 'primary' else 'supporting' end,greatest(0::numeric,least(1::numeric,sd.similarity)) from public.nars_story_documents sd where sd.story_id=r.story_id
      on conflict on constraint nars_event_documents_pkey do update set confidence=greatest(public.nars_event_documents.confidence,excluded.confidence);
      perform public.nars_refresh_event_stats(v_new);
    end loop;
    insert into public.nars_event_evidence_links(event_id,artifact_id,relation,confidence,link_method,is_direct,metadata)
    select m.new_event_id,l.artifact_id,l.relation,l.confidence,l.link_method,l.is_direct,coalesce(l.metadata,'{}'::jsonb)||jsonb_build_object('series_repair_from_event',v_old)
    from public.nars_event_evidence_links l join public.nars_evidence_artifacts a on a.id=l.artifact_id join public.nars_story_documents sd on sd.document_id=a.document_id join pg_temp.nars_series_repair_map m on m.story_id=sd.story_id
    where l.event_id=v_old on conflict(event_id,artifact_id,relation) do nothing;
    update public.nars_primary_source_candidates p set event_id=m.new_event_id,metadata=coalesce(p.metadata,'{}'::jsonb)||jsonb_build_object('series_repair_from_event',v_old),updated_at=now()
      from public.nars_evidence_artifacts a join public.nars_story_documents sd on sd.document_id=a.document_id join pg_temp.nars_series_repair_map m on m.story_id=sd.story_id
      where p.event_id=v_old and p.artifact_id=a.id;
    update public.nars_evidence_acquisition_attempts x set event_id=m.new_event_id from public.nars_story_documents sd join pg_temp.nars_series_repair_map m on m.story_id=sd.story_id where x.event_id=v_old and x.document_id=sd.document_id;
    delete from public.nars_intel_outbox where event_id=v_old and status='pending';
    delete from public.nars_events where id=v_old;
    for r in select new_event_id from pg_temp.nars_series_repair_map loop perform public.nars_refresh_event_stats(r.new_event_id); end loop;
    perform public.nars_score_events(500);
    select distinct l.event_id into v_artifact_event from public.nars_event_evidence_links l where l.artifact_id='3c69bab1-fefd-4ed5-bbde-d0f27a6fa1f1'::uuid limit 1;
    if v_artifact_event is not null then perform public.nars_enqueue_evidence_packet(v_artifact_event); end if;
  end if;
end $$;

insert into public.nars_system_meta(key,value,updated_at) values('official_series_guard',jsonb_build_object('version','4.10.1-series-guard','bok_mpc_minutes',true,'repaired_event','f127fb6f-8556-492a-ab02-2a8a0c003ef4'),now()) on conflict(key) do update set value=excluded.value,updated_at=now();
