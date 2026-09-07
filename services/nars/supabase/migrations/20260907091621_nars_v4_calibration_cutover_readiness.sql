-- NARS v4 N4-10 Calibration / Cutover Readiness baseline
-- Production migration version: 20260907091621
-- Current replay-safe baseline includes the later schema-qualified extension fixes.

create table if not exists public.nars_calibration_policy(
  policy_key text primary key,
  scope text not null check(scope in ('pipeline','calibration','comparator','evidence')),
  numeric_value numeric,
  text_value text,
  enabled boolean not null default true,
  hard_gate boolean not null default true,
  description text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.nars_calibration_samples(
  id uuid primary key default gen_random_uuid(),
  sample_key text not null unique,
  sample_type text not null check(sample_type in ('merge_story_document','merge_event_story','split_event_pair')),
  parent_id uuid not null,
  child_id uuid not null,
  similarity numeric,
  method text,
  parent_title text,
  child_title text,
  snapshot jsonb not null default '{}'::jsonb,
  decision text check(decision in ('correct_merge','false_merge','correct_split','false_split','uncertain')),
  reviewer text,
  decided_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nars_calibration_runs(
  id uuid primary key default gen_random_uuid(),
  calibration_version text not null,
  pipeline_status text not null check(pipeline_status in ('PASS','BLOCKED')),
  calibration_status text not null check(calibration_status in ('PASS','BLOCKED')),
  comparator_status text not null check(comparator_status in ('PASS','BLOCKED')),
  evidence_status text not null check(evidence_status in ('PASS','BLOCKED')),
  cutover_status text not null check(cutover_status in ('READY','BLOCKED')),
  metrics jsonb not null,
  gates jsonb not null,
  fingerprint text not null unique,
  evaluated_at timestamptz not null default now()
);

create index if not exists nars_calibration_samples_type_decision_idx
  on public.nars_calibration_samples(sample_type,decision,created_at desc);
create index if not exists nars_calibration_runs_evaluated_idx
  on public.nars_calibration_runs(evaluated_at desc);

alter table public.nars_calibration_policy enable row level security;
alter table public.nars_calibration_samples enable row level security;
alter table public.nars_calibration_runs enable row level security;
revoke all on public.nars_calibration_policy,public.nars_calibration_samples,public.nars_calibration_runs from anon,authenticated;
grant all on public.nars_calibration_policy,public.nars_calibration_samples,public.nars_calibration_runs to service_role;

insert into public.nars_calibration_policy(policy_key,scope,numeric_value,enabled,hard_gate,description)
values
('pipeline_max_aged_unclustered','pipeline',0,true,true,'Documents older than 15 minutes that still have no Story assignment.'),
('pipeline_max_aged_unscored','pipeline',0,true,true,'Events older than 15 minutes with no current score or a score older than the Event update.'),
('source_min_healthy_shadow_rate','pipeline',0.90,true,true,'Minimum healthy rate across shadow connectors.'),
('source_critical_priority','pipeline',95,true,false,'Connector priority at or above this value is considered critical.'),
('source_max_critical_down','pipeline',0,true,true,'Maximum unhealthy critical shadow connectors.'),
('merge_labels_min','calibration',30,true,true,'Minimum reviewed low-margin automatic merge samples.'),
('merge_false_rate_max','calibration',0.02,true,true,'Maximum accepted false-merge rate among reviewed merge samples.'),
('split_labels_min','calibration',30,true,true,'Minimum reviewed near-threshold separate-Event samples.'),
('split_false_rate_max','calibration',0.05,true,true,'Maximum accepted false-split rate among reviewed split samples.'),
('comparator_min_v3_samples','comparator',100,true,true,'Minimum v3 observations on publishers that are comparable in both v3 and v4.'),
('comparator_min_span_days','comparator',7,true,true,'Minimum live comparator observation span in days.'),
('comparator_max_v3_age_minutes','comparator',30,true,true,'Maximum age of the most recent v3 comparator observation.'),
('comparator_min_collector_recall_vs_v3','comparator',0.95,true,true,'Minimum fraction of v3-observed comparable Documents also seen by the v4 collector.'),
('evidence_high_priority_threshold','evidence',68,true,false,'Priority threshold used to define HIGH/FLASH Events for Evidence coverage.'),
('evidence_min_high_priority_primary_coverage','evidence',0.80,true,true,'Minimum HIGH/FLASH Event coverage by content-verified primary Evidence.')
on conflict(policy_key) do update set
  scope=excluded.scope,numeric_value=excluded.numeric_value,enabled=excluded.enabled,
  hard_gate=excluded.hard_gate,description=excluded.description,updated_at=now();

create or replace view public.nars_legacy_comparator_metrics_v1 as
with v3_publishers as (
  select distinct metadata->>'publisher_key' publisher_key from public.nars_sources
  where source_key like 'v3:%' and coalesce(metadata->>'publisher_key','')<>''
), collector_publishers as (
  select distinct metadata->>'publisher_key' publisher_key from public.nars_sources
  where source_key like 'direct:%' and coalesce(metadata->>'publisher_key','')<>''
), common_publishers as (
  select v.publisher_key from v3_publishers v join collector_publishers c using(publisher_key)
), doc_obs as (
  select d.id document_id,s.metadata->>'publisher_key' publisher_key,
    bool_or(ds.origin='v3_shadow') v3_seen,bool_or(ds.origin='collector') collector_seen,
    min(ds.first_seen_at) filter(where ds.origin='v3_shadow') v3_first_seen_at,
    min(ds.first_seen_at) filter(where ds.origin='collector') collector_first_seen_at,
    max(ds.last_seen_at) filter(where ds.origin='v3_shadow') v3_last_seen_at,
    max(ds.last_seen_at) filter(where ds.origin='collector') collector_last_seen_at
  from public.nars_documents d
  join public.nars_sources s on s.id=d.source_id
  left join public.nars_document_sightings ds on ds.document_id=d.id
  where s.metadata->>'publisher_key' in(select publisher_key from common_publishers)
  group by d.id,s.metadata->>'publisher_key'
), agg as (
  select count(*) filter(where v3_seen or collector_seen)::int comparable_documents,
    count(*) filter(where v3_seen)::int v3_seen_documents,
    count(*) filter(where collector_seen)::int collector_seen_documents,
    count(*) filter(where v3_seen and collector_seen)::int both_count,
    count(*) filter(where v3_seen and not collector_seen)::int v3_only,
    count(*) filter(where collector_seen and not v3_seen)::int collector_only,
    min(v3_first_seen_at) v3_first_seen_at,max(v3_last_seen_at) v3_last_seen_at,
    max(collector_last_seen_at) collector_last_seen_at
  from doc_obs
)
select (select count(*)::int from common_publishers) comparable_publisher_count,
  comparable_documents,v3_seen_documents,collector_seen_documents,both_count,v3_only,collector_only,
  case when v3_seen_documents>0 then both_count::numeric/v3_seen_documents else null end collector_recall_vs_v3,
  case when collector_seen_documents>0 then both_count::numeric/collector_seen_documents else null end v3_recall_vs_collector,
  case when v3_seen_documents+collector_seen_documents-both_count>0
    then both_count::numeric/(v3_seen_documents+collector_seen_documents-both_count) else null end jaccard_overlap,
  v3_first_seen_at,v3_last_seen_at,collector_last_seen_at,
  case when v3_first_seen_at is not null and v3_last_seen_at is not null then extract(epoch from(v3_last_seen_at-v3_first_seen_at))/86400.0 else 0 end comparator_span_days,
  case when v3_last_seen_at is not null then extract(epoch from(now()-v3_last_seen_at))/60.0 else null end v3_age_minutes,
  now() generated_at
from agg;

create or replace view public.nars_evidence_promotion_queue_v1 as
with linked as (
  select d.id document_id,ed.event_id,d.title,d.canonical_url,d.published_at,d.retrieved_at,d.content_hash,
    coalesce(d.raw_metadata->>'authority_key',s.metadata->>'authority_key') authority_key,
    coalesce(d.raw_metadata->>'publisher_key',s.metadata->>'publisher_key') publisher_key,
    d.excerpt is not null and length(trim(d.excerpt))>0 has_excerpt,
    sc.priority_score,sc.priority_band,sc.evidence_grade
  from public.nars_documents d
  join public.nars_sources s on s.id=d.source_id
  left join public.nars_event_documents ed on ed.document_id=d.id
  left join public.nars_event_score_latest_v1 sc on sc.event_id=ed.event_id
  where coalesce(d.raw_metadata->>'authority_key',s.metadata->>'authority_key') is not null
)
select l.*,
  case when exists(
    select 1 from public.nars_evidence_artifacts a
    join public.nars_event_evidence_links el on el.artifact_id=a.id and el.event_id=l.event_id
    where a.document_id=l.document_id and a.verification_status='content_verified'
  ) then 'VERIFIED'
  when content_hash is null then 'NEEDS_CANONICAL_CONTENT'
  else 'RESOLVER_ELIGIBLE' end promotion_state
from linked l;

create or replace view public.nars_calibration_metrics_v1 as
with pipeline as (
  select (select count(*)::int from public.nars_documents) documents,
    (select count(*)::int from public.nars_events) events,
    (select count(*)::int from public.nars_documents d where d.created_at<now()-interval '15 minutes'
      and not exists(select 1 from public.nars_story_documents sd where sd.document_id=d.id)) aged_unclustered_documents,
    (select count(*)::int from public.nars_events e left join public.nars_event_score_latest_v1 sc on sc.event_id=e.id
      where e.last_updated_at<now()-interval '15 minutes' and (sc.event_id is null or sc.evaluated_at<e.last_updated_at)) aged_unscored_events
), connector_health as (
  select c.connector_key,c.priority,c.poll_interval_minutes,
    case when s.health_status='up' and s.last_success_at>=now()-greatest(interval '30 minutes',(c.poll_interval_minutes*3)*interval '1 minute') then true else false end healthy
  from public.nars_source_connectors c
  left join public.nars_sources s on s.metadata->>'connector_key'=c.connector_key
  where c.runtime_status='shadow'
), sources as (
  select count(*)::int shadow_connectors,count(*) filter(where healthy)::int healthy_shadow_connectors,
    case when count(*)>0 then count(*) filter(where healthy)::numeric/count(*) else 0 end healthy_shadow_rate,
    count(*) filter(where priority>=coalesce((select numeric_value from public.nars_calibration_policy where policy_key='source_critical_priority'),95) and not healthy)::int critical_connectors_down
  from connector_health
), review as (
  select count(*) filter(where sample_type like 'merge_%' and decision in('correct_merge','false_merge'))::int merge_labels,
    count(*) filter(where sample_type like 'merge_%' and decision='false_merge')::int false_merges,
    case when count(*) filter(where sample_type like 'merge_%' and decision in('correct_merge','false_merge'))>0
      then count(*) filter(where sample_type like 'merge_%' and decision='false_merge')::numeric/count(*) filter(where sample_type like 'merge_%' and decision in('correct_merge','false_merge')) else null end false_merge_rate,
    count(*) filter(where sample_type='split_event_pair' and decision in('correct_split','false_split'))::int split_labels,
    count(*) filter(where sample_type='split_event_pair' and decision='false_split')::int false_splits,
    case when count(*) filter(where sample_type='split_event_pair' and decision in('correct_split','false_split'))>0
      then count(*) filter(where sample_type='split_event_pair' and decision='false_split')::numeric/count(*) filter(where sample_type='split_event_pair' and decision in('correct_split','false_split')) else null end false_split_rate,
    count(*) filter(where decision is null)::int pending_review_samples
  from public.nars_calibration_samples
), evidence as (
  select count(*) filter(where sc.priority_score>=coalesce((select numeric_value from public.nars_calibration_policy where policy_key='evidence_high_priority_threshold'),68))::int high_priority_events,
    count(*) filter(where sc.priority_score>=coalesce((select numeric_value from public.nars_calibration_policy where policy_key='evidence_high_priority_threshold'),68)
      and coalesce(p.content_verified_primary_count,0)>0)::int high_priority_with_content_verified_primary
  from public.nars_event_score_latest_v1 sc left join public.nars_event_provenance_v1 p on p.event_id=sc.event_id
), official_docs as (
  select count(*)::int official_documents,count(*) filter(where content_hash is not null)::int official_documents_with_content_hash
  from public.nars_evidence_promotion_queue_v1
)
select p.documents,p.events,p.aged_unclustered_documents,p.aged_unscored_events,
  s.shadow_connectors,s.healthy_shadow_connectors,s.healthy_shadow_rate,s.critical_connectors_down,
  r.merge_labels,r.false_merges,r.false_merge_rate,r.split_labels,r.false_splits,r.false_split_rate,r.pending_review_samples,
  c.comparable_publisher_count,c.comparable_documents,c.v3_seen_documents,c.collector_seen_documents,c.both_count,c.v3_only,c.collector_only,
  c.collector_recall_vs_v3,c.v3_recall_vs_collector,c.jaccard_overlap,c.comparator_span_days,c.v3_age_minutes,
  e.high_priority_events,e.high_priority_with_content_verified_primary,
  case when e.high_priority_events>0 then e.high_priority_with_content_verified_primary::numeric/e.high_priority_events else 0 end high_priority_primary_coverage,
  o.official_documents,o.official_documents_with_content_hash,
  case when o.official_documents>0 then o.official_documents_with_content_hash::numeric/o.official_documents else 0 end official_content_hash_coverage,
  now() generated_at
from pipeline p cross join sources s cross join review r cross join public.nars_legacy_comparator_metrics_v1 c cross join evidence e cross join official_docs o;

create or replace view public.nars_cutover_readiness_v1 as
with m as (select * from public.nars_calibration_metrics_v1), p as (
  select max(numeric_value) filter(where policy_key='pipeline_max_aged_unclustered') max_aged_unclustered,
    max(numeric_value) filter(where policy_key='pipeline_max_aged_unscored') max_aged_unscored,
    max(numeric_value) filter(where policy_key='source_min_healthy_shadow_rate') min_healthy_rate,
    max(numeric_value) filter(where policy_key='source_max_critical_down') max_critical_down,
    max(numeric_value) filter(where policy_key='merge_labels_min') merge_labels_min,
    max(numeric_value) filter(where policy_key='merge_false_rate_max') merge_false_rate_max,
    max(numeric_value) filter(where policy_key='split_labels_min') split_labels_min,
    max(numeric_value) filter(where policy_key='split_false_rate_max') split_false_rate_max,
    max(numeric_value) filter(where policy_key='comparator_min_v3_samples') comparator_min_v3_samples,
    max(numeric_value) filter(where policy_key='comparator_min_span_days') comparator_min_span_days,
    max(numeric_value) filter(where policy_key='comparator_max_v3_age_minutes') comparator_max_v3_age_minutes,
    max(numeric_value) filter(where policy_key='comparator_min_collector_recall_vs_v3') comparator_min_recall,
    max(numeric_value) filter(where policy_key='evidence_min_high_priority_primary_coverage') min_primary_coverage
  from public.nars_calibration_policy where enabled
), e as (
  select m.*,
    aged_unclustered_documents::numeric<=max_aged_unclustered and aged_unscored_events::numeric<=max_aged_unscored and healthy_shadow_rate>=min_healthy_rate and critical_connectors_down::numeric<=max_critical_down pipeline_pass,
    merge_labels::numeric>=merge_labels_min and coalesce(false_merge_rate,1)<=merge_false_rate_max and split_labels::numeric>=split_labels_min and coalesce(false_split_rate,1)<=split_false_rate_max calibration_pass,
    v3_seen_documents::numeric>=comparator_min_v3_samples and comparator_span_days>=comparator_min_span_days and coalesce(v3_age_minutes,1000000000)<=comparator_max_v3_age_minutes and coalesce(collector_recall_vs_v3,0)>=comparator_min_recall comparator_pass,
    high_priority_primary_coverage>=min_primary_coverage evidence_pass,p.*
  from m cross join p
)
select '4.8.2-calibration-v2'::text calibration_version,
  case when pipeline_pass then 'PASS' else 'BLOCKED' end pipeline_status,
  case when calibration_pass then 'PASS' else 'BLOCKED' end calibration_status,
  case when comparator_pass then 'PASS' else 'BLOCKED' end comparator_status,
  case when evidence_pass then 'PASS' else 'BLOCKED' end evidence_status,
  case when pipeline_pass and calibration_pass and comparator_pass and evidence_pass then 'READY' else 'BLOCKED' end cutover_status,
  false automatic_retirement,
  coalesce((select (value->>'authorized')::boolean from public.nars_system_meta where key='legacy_retirement_authorization'),false) retirement_authorized,
  jsonb_build_object('pipeline',jsonb_build_object('pass',pipeline_pass),'calibration',jsonb_build_object('pass',calibration_pass),'comparator',jsonb_build_object('pass',comparator_pass),'evidence',jsonb_build_object('pass',evidence_pass)) gates,
  to_jsonb(e.*)-array['pipeline_pass','calibration_pass','comparator_pass','evidence_pass','max_aged_unclustered','max_aged_unscored','min_healthy_rate','max_critical_down','merge_labels_min','merge_false_rate_max','split_labels_min','split_false_rate_max','comparator_min_v3_samples','comparator_min_span_days','comparator_max_v3_age_minutes','comparator_min_recall','min_primary_coverage'] metrics,
  generated_at
from e;

create or replace function public.nars_label_calibration_sample(p_sample_id uuid,p_decision text,p_reviewer text,p_notes text default null)
returns jsonb language plpgsql set search_path to 'public' as $$
declare v_type text;
begin
  if coalesce(trim(p_reviewer),'')='' then raise exception 'reviewer_required'; end if;
  select sample_type into v_type from public.nars_calibration_samples where id=p_sample_id;
  if v_type is null then raise exception 'sample_not_found'; end if;
  if v_type like 'merge_%' and p_decision not in('correct_merge','false_merge','uncertain') then raise exception 'invalid_merge_decision'; end if;
  if v_type='split_event_pair' and p_decision not in('correct_split','false_split','uncertain') then raise exception 'invalid_split_decision'; end if;
  update public.nars_calibration_samples set decision=p_decision,reviewer=trim(p_reviewer),decided_at=now(),notes=p_notes,updated_at=now() where id=p_sample_id;
  return jsonb_build_object('sample_id',p_sample_id,'sample_type',v_type,'decision',p_decision,'reviewer',trim(p_reviewer),'decided_at',now());
end $$;

create or replace function public.nars_refresh_calibration_samples(p_limit integer default 100)
returns jsonb language plpgsql set search_path to 'public','extensions','pg_temp' as $$
declare v_merge integer:=0; v_split integer:=0;
begin
  insert into public.nars_calibration_samples(sample_key,sample_type,parent_id,child_id,similarity,method,parent_title,child_title,snapshot,updated_at)
  select 'merge:'||r.review_type||':'||r.parent_id::text||':'||r.child_id::text,
    case r.review_type when 'story_document' then 'merge_story_document' else 'merge_event_story' end,
    r.parent_id,r.child_id,r.similarity,r.method,r.parent_title,r.child_title,jsonb_build_object('observed_at',r.observed_at,'source','nars_cluster_review_queue_v1'),now()
  from public.nars_cluster_review_queue_v1 r where r.review_type in('story_document','event_story') order by r.observed_at desc limit greatest(1,p_limit)
  on conflict(sample_key) do update set similarity=excluded.similarity,method=excluded.method,parent_title=excluded.parent_title,child_title=excluded.child_title,snapshot=public.nars_calibration_samples.snapshot||excluded.snapshot,updated_at=now();
  get diagnostics v_merge=row_count;
  with candidate_pairs as (
    select e1.id parent_id,e2.id child_id,e1.title parent_title,e2.title child_title,
      abs(extract(epoch from(e1.first_detected_at-e2.first_detected_at))) delta_seconds,
      public.nars_event_match_score(e1.title,e2.title,abs(extract(epoch from(e1.first_detected_at-e2.first_detected_at))))::numeric candidate_score
    from public.nars_events e1 join public.nars_events e2 on e1.id<e2.id and abs(extract(epoch from(e1.first_detected_at-e2.first_detected_at)))<=86400
    where e1.last_updated_at>=now()-interval '7 days' and e2.last_updated_at>=now()-interval '7 days' and extensions.similarity(lower(e1.title),lower(e2.title))>=0.20
  ), ranked as (select * from candidate_pairs where candidate_score>=0.40 and candidate_score<0.58 order by candidate_score desc,delta_seconds asc limit greatest(1,p_limit))
  insert into public.nars_calibration_samples(sample_key,sample_type,parent_id,child_id,similarity,method,parent_title,child_title,snapshot,updated_at)
  select 'split:event:'||parent_id::text||':'||child_id::text,'split_event_pair',parent_id,child_id,candidate_score,'lexical_v2_near_threshold',parent_title,child_title,
    jsonb_build_object('delta_seconds',delta_seconds,'threshold',0.58,'source','near_threshold_separate_events'),now() from ranked
  on conflict(sample_key) do update set similarity=excluded.similarity,parent_title=excluded.parent_title,child_title=excluded.child_title,snapshot=public.nars_calibration_samples.snapshot||excluded.snapshot,updated_at=now();
  get diagnostics v_split=row_count;
  return jsonb_build_object('merge_candidates_touched',v_merge,'split_candidates_touched',v_split,'refreshed_at',now());
end $$;

create or replace function public.nars_run_calibration()
returns jsonb language plpgsql set search_path to 'public','extensions','pg_temp' as $$
declare v_ready record; v_payload jsonb; v_fp text; v_inserted integer:=0;
begin
  perform public.nars_refresh_calibration_samples(100);
  select * into v_ready from public.nars_cutover_readiness_v1;
  v_payload:=jsonb_build_object('calibration_version',v_ready.calibration_version,'pipeline_status',v_ready.pipeline_status,'calibration_status',v_ready.calibration_status,'comparator_status',v_ready.comparator_status,'evidence_status',v_ready.evidence_status,'cutover_status',v_ready.cutover_status,'metrics',v_ready.metrics,'gates',v_ready.gates);
  v_fp:=encode(extensions.digest(v_payload::text,'sha256'),'hex');
  insert into public.nars_calibration_runs(calibration_version,pipeline_status,calibration_status,comparator_status,evidence_status,cutover_status,metrics,gates,fingerprint)
  values(v_ready.calibration_version,v_ready.pipeline_status,v_ready.calibration_status,v_ready.comparator_status,v_ready.evidence_status,v_ready.cutover_status,v_ready.metrics,v_ready.gates,v_fp)
  on conflict(fingerprint) do nothing;
  get diagnostics v_inserted=row_count;
  return v_payload||jsonb_build_object('fingerprint',v_fp,'ledger_inserted',(v_inserted>0),'evaluated_at',now());
end $$;

revoke all on public.nars_legacy_comparator_metrics_v1,public.nars_evidence_promotion_queue_v1,public.nars_calibration_metrics_v1,public.nars_cutover_readiness_v1 from anon,authenticated;
grant select on public.nars_legacy_comparator_metrics_v1,public.nars_evidence_promotion_queue_v1,public.nars_calibration_metrics_v1,public.nars_cutover_readiness_v1 to service_role;
revoke all on function public.nars_label_calibration_sample(uuid,text,text,text),public.nars_refresh_calibration_samples(integer),public.nars_run_calibration() from public,anon,authenticated;
grant execute on function public.nars_label_calibration_sample(uuid,text,text,text),public.nars_refresh_calibration_samples(integer),public.nars_run_calibration() to service_role;

do $$ begin
  if not exists(select 1 from cron.job where jobname='nars-calibrate-hourly') then
    perform cron.schedule('nars-calibrate-hourly','7 * * * *','select public.nars_run_calibration();');
  end if;
end $$;

insert into public.nars_system_meta(key,value,updated_at)
values('calibration_cutover_version',jsonb_build_object('version','4.8.2-calibration-v2','automatic_retirement',false,'updated_at',now()),now())
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
