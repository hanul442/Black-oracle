-- NARS v4 N4-10 Calibration hardening v2
-- Production migration version: 20260907100540

create or replace function public.nars_refresh_calibration_samples(p_limit integer default 100)
returns jsonb
language plpgsql
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_merge integer := 0;
  v_split integer := 0;
  v_pruned integer := 0;
begin
  delete from public.nars_calibration_samples s
  where s.decision is null and (
    (s.sample_type='merge_story_document' and (
      not exists(select 1 from public.nars_stories st where st.id=s.parent_id)
      or not exists(select 1 from public.nars_documents d where d.id=s.child_id)
    ))
    or (s.sample_type='merge_event_story' and (
      not exists(select 1 from public.nars_events e where e.id=s.parent_id)
      or not exists(select 1 from public.nars_stories st where st.id=s.child_id)
    ))
    or (s.sample_type='split_event_pair' and (
      not exists(select 1 from public.nars_events e where e.id=s.parent_id)
      or not exists(select 1 from public.nars_events e where e.id=s.child_id)
      or (
        public.nars_structured_subject(s.parent_title) is not null
        and public.nars_structured_subject(s.child_title) is not null
        and public.nars_structured_subject(s.parent_title)<>public.nars_structured_subject(s.child_title)
      )
    ))
  );
  get diagnostics v_pruned=row_count;

  insert into public.nars_calibration_samples(
    sample_key,sample_type,parent_id,child_id,similarity,method,parent_title,child_title,snapshot,updated_at
  )
  select 'merge:'||r.review_type||':'||r.parent_id::text||':'||r.child_id::text,
    case r.review_type when 'story_document' then 'merge_story_document' else 'merge_event_story' end,
    r.parent_id,r.child_id,r.similarity,r.method,r.parent_title,r.child_title,
    jsonb_build_object('observed_at',r.observed_at,'source','nars_cluster_review_queue_v1'),now()
  from public.nars_cluster_review_queue_v1 r
  where r.review_type in('story_document','event_story')
  order by r.observed_at desc
  limit greatest(1,p_limit)
  on conflict(sample_key) do update set
    similarity=excluded.similarity,
    method=excluded.method,
    parent_title=excluded.parent_title,
    child_title=excluded.child_title,
    snapshot=public.nars_calibration_samples.snapshot||excluded.snapshot,
    updated_at=now();
  get diagnostics v_merge=row_count;

  with candidate_pairs as (
    select e1.id parent_id,e2.id child_id,e1.title parent_title,e2.title child_title,
      abs(extract(epoch from(e1.first_detected_at-e2.first_detected_at))) delta_seconds,
      public.nars_event_match_score(
        e1.title,e2.title,
        abs(extract(epoch from(e1.first_detected_at-e2.first_detected_at)))
      )::numeric candidate_score
    from public.nars_events e1
    join public.nars_events e2 on e1.id<e2.id
      and abs(extract(epoch from(e1.first_detected_at-e2.first_detected_at)))<=86400
    where e1.last_updated_at>=now()-interval '7 days'
      and e2.last_updated_at>=now()-interval '7 days'
      and extensions.similarity(lower(e1.title),lower(e2.title))>=0.20
      and (
        public.nars_structured_subject(e1.title) is null
        or public.nars_structured_subject(e2.title) is null
        or public.nars_structured_subject(e1.title)=public.nars_structured_subject(e2.title)
      )
  ), ranked as (
    select * from candidate_pairs
    where candidate_score>=0.40 and candidate_score<0.58
    order by candidate_score desc,delta_seconds asc
    limit greatest(1,p_limit)
  )
  insert into public.nars_calibration_samples(
    sample_key,sample_type,parent_id,child_id,similarity,method,parent_title,child_title,snapshot,updated_at
  )
  select 'split:event:'||parent_id::text||':'||child_id::text,
    'split_event_pair',parent_id,child_id,candidate_score,
    'lexical_v2_near_threshold',parent_title,child_title,
    jsonb_build_object(
      'delta_seconds',delta_seconds,
      'threshold',0.58,
      'source','near_threshold_separate_events',
      'structured_subject_guard','4.8.1'
    ),now()
  from ranked
  on conflict(sample_key) do update set
    similarity=excluded.similarity,
    parent_title=excluded.parent_title,
    child_title=excluded.child_title,
    snapshot=public.nars_calibration_samples.snapshot||excluded.snapshot,
    updated_at=now();
  get diagnostics v_split=row_count;

  return jsonb_build_object(
    'pruned_stale_or_hard_veto_samples',v_pruned,
    'merge_candidates_touched',v_merge,
    'split_candidates_touched',v_split,
    'refreshed_at',now()
  );
end;
$function$;

create or replace view public.nars_cutover_readiness_v1 as
with m as (
  select * from public.nars_calibration_metrics_v1
), p as (
  select
    max(numeric_value) filter(where policy_key='pipeline_max_aged_unclustered') max_aged_unclustered,
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
  from public.nars_calibration_policy
  where enabled
), e as (
  select m.*,
    aged_unclustered_documents::numeric<=max_aged_unclustered
      and aged_unscored_events::numeric<=max_aged_unscored
      and healthy_shadow_rate>=min_healthy_rate
      and critical_connectors_down::numeric<=max_critical_down pipeline_pass,
    merge_labels::numeric>=merge_labels_min
      and coalesce(false_merge_rate,1)<=merge_false_rate_max
      and split_labels::numeric>=split_labels_min
      and coalesce(false_split_rate,1)<=split_false_rate_max calibration_pass,
    v3_seen_documents::numeric>=comparator_min_v3_samples
      and comparator_span_days>=comparator_min_span_days
      and coalesce(v3_age_minutes,1000000000)<=comparator_max_v3_age_minutes
      and coalesce(collector_recall_vs_v3,0)>=comparator_min_recall comparator_pass,
    high_priority_primary_coverage>=min_primary_coverage evidence_pass,
    p.*
  from m cross join p
)
select
  '4.8.2-calibration-v2'::text calibration_version,
  case when pipeline_pass then 'PASS' else 'BLOCKED' end pipeline_status,
  case when calibration_pass then 'PASS' else 'BLOCKED' end calibration_status,
  case when comparator_pass then 'PASS' else 'BLOCKED' end comparator_status,
  case when evidence_pass then 'PASS' else 'BLOCKED' end evidence_status,
  case when pipeline_pass and calibration_pass and comparator_pass and evidence_pass then 'READY' else 'BLOCKED' end cutover_status,
  false automatic_retirement,
  coalesce((select (value->>'authorized')::boolean from public.nars_system_meta where key='legacy_retirement_authorization'),false) retirement_authorized,
  jsonb_build_object(
    'pipeline',jsonb_build_object(
      'pass',pipeline_pass,'aged_unclustered_documents',aged_unclustered_documents,'max_aged_unclustered',max_aged_unclustered,
      'aged_unscored_events',aged_unscored_events,'max_aged_unscored',max_aged_unscored,
      'healthy_shadow_rate',healthy_shadow_rate,'min_healthy_rate',min_healthy_rate,
      'critical_connectors_down',critical_connectors_down,'max_critical_down',max_critical_down
    ),
    'calibration',jsonb_build_object(
      'pass',calibration_pass,'merge_labels',merge_labels,'merge_labels_min',merge_labels_min,
      'false_merge_rate',false_merge_rate,'false_merge_rate_max',merge_false_rate_max,
      'split_labels',split_labels,'split_labels_min',split_labels_min,
      'false_split_rate',false_split_rate,'false_split_rate_max',split_false_rate_max
    ),
    'comparator',jsonb_build_object(
      'pass',comparator_pass,'comparable_publishers',comparable_publisher_count,
      'v3_seen_documents',v3_seen_documents,'min_v3_samples',comparator_min_v3_samples,
      'span_days',comparator_span_days,'min_span_days',comparator_min_span_days,
      'v3_age_minutes',v3_age_minutes,'max_v3_age_minutes',comparator_max_v3_age_minutes,
      'collector_recall_vs_v3',collector_recall_vs_v3,'min_recall',comparator_min_recall
    ),
    'evidence',jsonb_build_object(
      'pass',evidence_pass,'high_priority_events',high_priority_events,
      'high_priority_with_content_verified_primary',high_priority_with_content_verified_primary,
      'coverage',high_priority_primary_coverage,'min_coverage',min_primary_coverage,
      'official_documents',official_documents,'official_documents_with_content_hash',official_documents_with_content_hash
    )
  ) gates,
  to_jsonb(e.*)-array[
    'pipeline_pass','calibration_pass','comparator_pass','evidence_pass',
    'max_aged_unclustered','max_aged_unscored','min_healthy_rate','max_critical_down',
    'merge_labels_min','merge_false_rate_max','split_labels_min','split_false_rate_max',
    'comparator_min_v3_samples','comparator_min_span_days','comparator_max_v3_age_minutes',
    'comparator_min_recall','min_primary_coverage'
  ] metrics,
  generated_at
from e;

insert into public.nars_system_meta(key,value,updated_at)
values('calibration_version',jsonb_build_object(
  'version','4.8.2-calibration-v2',
  'evidence_required_for_cutover',true,
  'structured_subject_review_pruning',true,
  'updated_at',now()
),now())
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
