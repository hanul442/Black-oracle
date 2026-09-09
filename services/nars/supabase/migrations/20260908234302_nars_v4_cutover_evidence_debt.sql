-- N4-13 Cutover evidence debt and stale-first scoring drain.
-- This migration adds read-only operational debt surfaces. It does not retire NARS v3.

create or replace function public.nars_score_events(p_limit integer default 500)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_inserted int:=0;
  v_updated int:=0;
begin
  with candidates as (
    select
      c.*,
      case when c.diversity_priority_score>=82 then 'FLASH'
           when c.diversity_priority_score>=68 then 'HIGH'
           when c.diversity_priority_score>=52 then 'WATCH'
           else 'ROUTINE' end as diversity_priority_band,
      md5(jsonb_build_object(
        'v','4.5.0-diversity-v1','event',c.event_id,
        'raw',c.diversity_raw_evidence_score,
        'final',c.diversity_final_evidence_score,
        'grade',c.diversity_evidence_grade,
        'priority',c.diversity_priority_score,
        'dimensions',c.diversity_dimensions,
        'gates',c.diversity_hard_gates,
        'inputs',c.diversity_input_snapshot
      )::text) as fp
    from public.nars_event_score_candidates_v4 c
    left join public.nars_event_score_latest_v1 s on s.event_id=c.event_id
    order by
      (s.event_id is null or s.evaluated_at<c.last_updated_at) desc,
      c.last_updated_at desc
    limit greatest(1,least(coalesce(p_limit,500),2000))
  ), ins as (
    insert into public.nars_event_score_ledger(
      event_id,score_version,raw_evidence_score,final_evidence_score,evidence_grade,
      priority_score,priority_band,dimensions,hard_gates,input_snapshot,score_fingerprint
    )
    select
      event_id,'4.5.0-diversity-v1',diversity_raw_evidence_score,diversity_final_evidence_score,
      diversity_evidence_grade,diversity_priority_score,diversity_priority_band,
      diversity_dimensions,diversity_hard_gates,diversity_input_snapshot,fp
    from candidates
    on conflict(event_id,score_version,score_fingerprint) do nothing
    returning event_id
  )
  select count(*) into v_inserted from ins;

  with latest as (
    select distinct on(l.event_id)
      l.event_id,l.priority_score,l.evidence_grade,l.final_evidence_score,l.priority_band,
      l.dimensions,l.hard_gates,l.score_version,l.input_snapshot
    from public.nars_event_score_ledger l
    where l.score_version='4.5.0-diversity-v1'
    order by l.event_id,l.evaluated_at desc
  ), upd as (
    update public.nars_events e
    set
      priority_score=l.priority_score,
      evidence_grade=l.evidence_grade,
      metadata=coalesce(e.metadata,'{}'::jsonb)||jsonb_build_object(
        'evidence_score',l.final_evidence_score,
        'priority_band',l.priority_band,
        'score_version',l.score_version,
        'score_dimensions',l.dimensions,
        'score_hard_gates',l.hard_gates,
        'score_inputs',l.input_snapshot
      )
    from latest l
    where e.id=l.event_id and (
      e.priority_score is distinct from l.priority_score or
      e.evidence_grade is distinct from l.evidence_grade or
      e.metadata->>'score_version' is distinct from l.score_version or
      e.metadata->'score_inputs' is distinct from l.input_snapshot
    )
    returning e.id
  )
  select count(*) into v_updated from upd;

  return jsonb_build_object(
    'version','4.5.0-diversity-v1',
    'scheduler_version','4.5.1-stale-first',
    'ledger_inserted',v_inserted,
    'events_updated',v_updated
  );
end;
$$;

revoke execute on function public.nars_score_events(integer) from public,anon,authenticated;
grant execute on function public.nars_score_events(integer) to service_role;

create or replace view public.nars_cutover_evidence_debt_v1
with (security_invoker=true)
as
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
  from public.nars_calibration_policy where enabled
), x as (
  select m.*,p.*,
    greatest(merge_labels_min,case when false_merges>0 then ceiling(false_merges/merge_false_rate_max) else merge_labels_min end) merge_required_total,
    greatest(split_labels_min,case when false_splits>0 then ceiling(false_splits/split_false_rate_max) else split_labels_min end) split_required_total,
    ceiling(high_priority_events*min_primary_coverage) evidence_required_events
  from m cross join p
)
select * from (
  select 'pipeline'::text gate_family,'aged_unclustered'::text debt_key,aged_unclustered_documents::numeric current_value,max_aged_unclustered required_value,greatest(aged_unclustered_documents-max_aged_unclustered,0) deficit,'events'::text unit,case when aged_unclustered_documents<=max_aged_unclustered then 'PASS' else 'BLOCKED' end status,'cluster every aged Document and verify a fresh zero-backlog run'::text next_action,generated_at from x
  union all select 'pipeline','aged_unscored',aged_unscored_events,max_aged_unscored,greatest(aged_unscored_events-max_aged_unscored,0),'events',case when aged_unscored_events<=max_aged_unscored then 'PASS' else 'BLOCKED' end,'score every aged or stale Event and verify a fresh zero-backlog run',generated_at from x
  union all select 'pipeline','healthy_shadow_rate',healthy_shadow_rate,min_healthy_rate,greatest(min_healthy_rate-healthy_shadow_rate,0),'rate',case when healthy_shadow_rate>=min_healthy_rate then 'PASS' else 'BLOCKED' end,'restore unhealthy shadow connectors without lowering the policy floor',generated_at from x
  union all select 'pipeline','critical_connectors_down',critical_connectors_down,max_critical_down,greatest(critical_connectors_down-max_critical_down,0),'connectors',case when critical_connectors_down<=max_critical_down then 'PASS' else 'BLOCKED' end,'restore every critical connector',generated_at from x
  union all select 'calibration','merge_reviewed',merge_labels,merge_required_total,greatest(merge_required_total-merge_labels,0),'reviewed samples',case when merge_labels>=merge_required_total and coalesce(false_merge_rate,1)<=merge_false_rate_max then 'PASS' else 'BLOCKED' end,'review lowest-margin merge candidates; repair matcher before continuing if a structural defect appears',generated_at from x
  union all select 'calibration','merge_false_rate',false_merge_rate,merge_false_rate_max,case when false_merge_rate is null then null else greatest(false_merge_rate-merge_false_rate_max,0) end,'rate',case when merge_labels>=merge_labels_min and coalesce(false_merge_rate,1)<=merge_false_rate_max then 'PASS' else 'BLOCKED' end,'keep reviewed false-merge rate at or below policy; never relabel to force PASS',generated_at from x
  union all select 'calibration','split_reviewed',split_labels,split_required_total,greatest(split_required_total-split_labels,0),'reviewed samples',case when split_labels>=split_required_total and coalesce(false_split_rate,1)<=split_false_rate_max then 'PASS' else 'BLOCKED' end,'review closest-below-threshold split candidates; repair matcher before continuing if a structural defect appears',generated_at from x
  union all select 'calibration','split_false_rate',false_split_rate,split_false_rate_max,case when false_split_rate is null then null else greatest(false_split_rate-split_false_rate_max,0) end,'rate',case when split_labels>=split_labels_min and coalesce(false_split_rate,1)<=split_false_rate_max then 'PASS' else 'BLOCKED' end,'keep reviewed false-split rate at or below policy; never relabel to force PASS',generated_at from x
  union all select 'comparator','v3_sample_count',v3_seen_documents,comparator_min_v3_samples,greatest(comparator_min_v3_samples-v3_seen_documents,0),'documents',case when v3_seen_documents>=comparator_min_v3_samples then 'PASS' else 'BLOCKED' end,'collect genuine live v3_shadow observations on publishers also covered by v4',generated_at from x
  union all select 'comparator','observation_span',comparator_span_days,comparator_min_span_days,greatest(comparator_min_span_days-comparator_span_days,0),'days',case when comparator_span_days>=comparator_min_span_days then 'PASS' else 'BLOCKED' end,'keep the live comparator running until the minimum observation span is reached',generated_at from x
  union all select 'comparator','v3_freshness',v3_age_minutes,comparator_max_v3_age_minutes,case when v3_age_minutes is null then null else greatest(v3_age_minutes-comparator_max_v3_age_minutes,0) end,'minutes old',case when coalesce(v3_age_minutes,1000000000)<=comparator_max_v3_age_minutes then 'PASS' else 'BLOCKED' end,'restore the v3 shadow bridge and keep the newest observation within the freshness ceiling',generated_at from x
  union all select 'comparator','collector_recall',collector_recall_vs_v3,comparator_min_recall,greatest(comparator_min_recall-coalesce(collector_recall_vs_v3,0),0),'rate',case when coalesce(collector_recall_vs_v3,0)>=comparator_min_recall then 'PASS' else 'BLOCKED' end,'investigate every v3-only miss and accumulate matched prospective observations',generated_at from x
  union all select 'evidence','high_priority_primary_coverage',high_priority_with_content_verified_primary,evidence_required_events,greatest(evidence_required_events-high_priority_with_content_verified_primary,0),'events',case when high_priority_primary_coverage>=min_primary_coverage then 'PASS' else 'BLOCKED' end,'acquire canonical primary content, hash it, promote it, and link it to HIGH/FLASH Events',generated_at from x
) debt
order by gate_family,debt_key;

create or replace view public.nars_cutover_next_samples_v1
with (security_invoker=true)
as
with m as (
  select * from public.nars_calibration_metrics_v1
), p as (
  select
    max(numeric_value) filter(where policy_key='merge_labels_min') merge_labels_min,
    max(numeric_value) filter(where policy_key='merge_false_rate_max') merge_false_rate_max,
    max(numeric_value) filter(where policy_key='split_labels_min') split_labels_min,
    max(numeric_value) filter(where policy_key='split_false_rate_max') split_false_rate_max,
    max(numeric_value) filter(where policy_key='comparator_min_v3_samples') comparator_min_v3_samples,
    max(numeric_value) filter(where policy_key='comparator_max_v3_age_minutes') comparator_max_v3_age_minutes,
    max(numeric_value) filter(where policy_key='comparator_min_span_days') comparator_min_span_days,
    max(numeric_value) filter(where policy_key='comparator_min_collector_recall_vs_v3') comparator_min_recall,
    max(numeric_value) filter(where policy_key='evidence_min_high_priority_primary_coverage') min_primary_coverage
  from public.nars_calibration_policy where enabled
), need as (
  select m.*,p.*,
    greatest(0,greatest(merge_labels_min,case when false_merges>0 then ceiling(false_merges/merge_false_rate_max) else merge_labels_min end)-merge_labels)::int merge_needed,
    greatest(0,greatest(split_labels_min,case when false_splits>0 then ceiling(false_splits/split_false_rate_max) else split_labels_min end)-split_labels)::int split_needed,
    greatest(0,ceiling(high_priority_events*min_primary_coverage)-high_priority_with_content_verified_primary)::int evidence_needed,
    greatest(0,comparator_min_v3_samples-v3_seen_documents)::int comparator_samples_needed
  from m cross join p
), ranked_merge as (
  select s.*,row_number() over(order by
    (s.similarity-case when s.sample_type='merge_story_document' then 0.72 else 0.58 end) asc,
    s.created_at desc,s.id) priority_rank
  from public.nars_calibration_samples s
  where s.decision is null and s.sample_type like 'merge_%'
), ranked_split as (
  select s.*,row_number() over(order by s.similarity desc,s.created_at desc,s.id) priority_rank
  from public.nars_calibration_samples s
  where s.decision is null and s.sample_type='split_event_pair'
), ranked_evidence as (
  select e.id,e.title,s.priority_score,s.priority_band,
    row_number() over(order by s.priority_score desc,e.last_updated_at desc,e.id) priority_rank
  from public.nars_events e
  join public.nars_event_score_latest_v1 s on s.event_id=e.id
  left join public.nars_event_provenance_v1 pr on pr.event_id=e.id
  where s.priority_score>=coalesce((select numeric_value from public.nars_calibration_policy where policy_key='evidence_high_priority_threshold'),68)
    and coalesce(pr.content_verified_primary_count,0)=0
), common_publishers as (
  select distinct v.metadata->>'publisher_key' publisher_key
  from public.nars_sources v
  join public.nars_sources c on c.source_key like 'direct:%'
    and c.metadata->>'publisher_key'=v.metadata->>'publisher_key'
  where v.source_key like 'v3:%' and coalesce(v.metadata->>'publisher_key','')<>''
), comparator_documents as (
  select d.id,d.title,s.metadata->>'publisher_key' publisher_key,
    bool_or(ds.origin='v3_shadow') v3_seen,bool_or(ds.origin='collector') collector_seen,
    max(ds.last_seen_at) filter(where ds.origin='v3_shadow') v3_last_seen_at
  from public.nars_documents d
  join public.nars_sources s on s.id=d.source_id
  join public.nars_document_sightings ds on ds.document_id=d.id
  where s.metadata->>'publisher_key' in(select publisher_key from common_publishers)
  group by d.id,d.title,s.metadata->>'publisher_key'
), comparator_misses as (
  select *,row_number() over(order by v3_last_seen_at desc,id) priority_rank
  from comparator_documents where v3_seen and not collector_seen
)
select * from (
  select 'pipeline'::text gate_family,row_number() over(order by e.last_updated_at,e.id)::bigint priority_rank,'stale_event_score'::text sample_kind,e.id::text sample_id,e.title subject_title,null::text comparison_title,extract(epoch from(now()-e.last_updated_at))/60.0 observed_value,15::numeric threshold_value,'run stale-first scoring and verify a current score at or after Event update'::text required_action,jsonb_build_object('last_updated_at',e.last_updated_at,'last_score_at',s.evaluated_at) metadata
  from public.nars_events e left join public.nars_event_score_latest_v1 s on s.event_id=e.id
  where e.last_updated_at<now()-interval '15 minutes' and (s.event_id is null or s.evaluated_at<e.last_updated_at)
  union all
  select 'calibration',r.priority_rank::bigint,r.sample_type,r.id::text,r.parent_title,r.child_title,r.similarity,case when r.sample_type='merge_story_document' then 0.72 else 0.58 end,'review as correct_merge, false_merge, or uncertain; fix structural defects before bulk labeling',jsonb_build_object('method',r.method,'created_at',r.created_at,'snapshot',r.snapshot)
  from ranked_merge r cross join need n where r.priority_rank<=n.merge_needed
  union all
  select 'calibration',r.priority_rank::bigint,r.sample_type,r.id::text,r.parent_title,r.child_title,r.similarity,0.58,'review as correct_split, false_split, or uncertain; fix structural defects before bulk labeling',jsonb_build_object('method',r.method,'created_at',r.created_at,'snapshot',r.snapshot)
  from ranked_split r cross join need n where r.priority_rank<=n.split_needed
  union all
  select 'comparator',1,'live_sample_requirement','requirement:v3-live',null,null,n.v3_seen_documents,n.comparator_min_v3_samples,'restore genuine v3_shadow ingestion; collect the remaining comparable live observations without synthetic backfill',jsonb_build_object('new_v3_samples_needed',n.comparator_samples_needed,'current_both_count',n.both_count,'current_v3_only',n.v3_only,'minimum_new_matches_if_target_stays_at_minimum',greatest(0,ceiling(n.comparator_min_recall*greatest(n.comparator_min_v3_samples,n.v3_seen_documents))-n.both_count)) from need n
  union all
  select 'comparator',2,'freshness_requirement','requirement:v3-freshness',null,null,n.v3_age_minutes,n.comparator_max_v3_age_minutes,'keep the newest genuine v3 observation within the freshness ceiling',jsonb_build_object('unit','minutes_old') from need n
  union all
  select 'comparator',3,'span_requirement','requirement:v3-span',null,null,n.comparator_span_days,n.comparator_min_span_days,'continue the live comparison until the observation span reaches policy',jsonb_build_object('unit','days') from need n
  union all
  select 'comparator',(10+c.priority_rank)::bigint,'collector_recall_miss',c.id::text,c.title,null,null,null,'investigate why v4 did not observe this genuine v3 document; do not fabricate a collector sighting',jsonb_build_object('publisher_key',c.publisher_key,'v3_last_seen_at',c.v3_last_seen_at) from comparator_misses c
  union all
  select 'evidence',r.priority_rank::bigint,'high_priority_primary_evidence',r.id::text,r.title,null,r.priority_score,coalesce((select numeric_value from public.nars_calibration_policy where policy_key='evidence_high_priority_threshold'),68),'acquire canonical primary content, validate authority continuity, hash, promote, and link to this Event',jsonb_build_object('priority_band',r.priority_band) from ranked_evidence r cross join need n where r.priority_rank<=n.evidence_needed
) samples;

revoke all on table public.nars_cutover_evidence_debt_v1 from public,anon,authenticated;
revoke all on table public.nars_cutover_next_samples_v1 from public,anon,authenticated;
grant select on table public.nars_cutover_evidence_debt_v1 to service_role;
grant select on table public.nars_cutover_next_samples_v1 to service_role;

insert into public.nars_system_meta(key,value,updated_at)
values('cutover_evidence_debt',jsonb_build_object(
  'version','4.11.0-cutover-debt-v1',
  'scoring_scheduler_version','4.5.1-stale-first',
  'automatic_retirement',false,
  'retirement_requires_human_authorization',true,
  'execution_authority',false,
  'updated_at',now()
),now())
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
