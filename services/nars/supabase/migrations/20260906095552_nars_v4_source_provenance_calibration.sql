-- NARS v4 N4-05 provenance calibration
-- Missing primary evidence should cap the top end, not double-penalize the base evidence score.

create or replace view public.nars_event_score_candidates_v3 with (security_invoker=true) as
with p as (
  select event_id,artifact_count,primary_artifact_count,verified_primary_count,content_verified_primary_count,verified_authority_count,primary_contradiction_count
  from public.nars_event_provenance_v1
), base as (
  select b.*,
    coalesce(p.artifact_count,0) as artifact_count,
    coalesce(p.primary_artifact_count,0) as primary_artifact_count,
    coalesce(p.verified_primary_count,0) as verified_primary_count,
    coalesce(p.content_verified_primary_count,0) as content_verified_primary_count,
    coalesce(p.verified_authority_count,0) as verified_authority_count,
    coalesce(p.primary_contradiction_count,0) as primary_contradiction_count,
    case
      when coalesce(p.content_verified_primary_count,0)>0 then 100
      when coalesce(p.verified_primary_count,0)>0 then 90
      when coalesce(p.primary_artifact_count,0)>0 then 80
      when coalesce(p.artifact_count,0)>0 then 75
      else 70
    end::numeric as provenance_score,
    case greatest(0,b.publisher_count+coalesce(p.verified_authority_count,0))
      when 0 then 0 when 1 then 35 when 2 then 65 when 3 then 82 when 4 then 92 else 98
    end::numeric as effective_independence_score,
    greatest(0,b.consistency_score-(case when coalesce(p.primary_contradiction_count,0)>0 then 25 else 0 end))::numeric as provenance_consistency_score
  from public.nars_event_score_candidates_v2 b
  left join p on p.event_id=b.event_id
), scored as (
  select b.*,
    round(least(100,greatest(0,
      0.85*raw_evidence_score
      +0.15*provenance_score
      +(case when verified_authority_count>0 then least(4,verified_authority_count*1.5) else 0 end)
      -(case when primary_contradiction_count>0 then 8 else 0 end)
    )),2) as provenance_raw_evidence_score,
    least(
      100::numeric,
      case when publisher_count+verified_authority_count<=1 then 75.99 when publisher_count+verified_authority_count=2 then 84.99 else 100 end,
      case when traceability_score<75 then 78.99 else 100 end,
      case when contradiction_pct>=25 or primary_contradiction_count>0 then 78.99 else 100 end,
      case when source_reliability<60 and verified_primary_count=0 then 71.99 else 100 end,
      case when verified_primary_count=0 then 90.99 when content_verified_primary_count=0 then 93.99 else 100 end
    ) as provenance_hard_cap_score
  from base b
)
select s.*,
  round(least(provenance_raw_evidence_score,provenance_hard_cap_score),2) as provenance_final_evidence_score,
  public.nars_score_to_grade(round(least(provenance_raw_evidence_score,provenance_hard_cap_score),2)) as provenance_evidence_grade,
  round(least(100,greatest(0,
    0.35*activity_score
    +0.25*urgency_score
    +0.20*effective_independence_score
    +0.10*recency_score
    +0.10*least(provenance_raw_evidence_score,provenance_hard_cap_score)
  )),2) as provenance_priority_score,
  jsonb_build_object(
    'base_evidence',raw_evidence_score,
    'source_reliability',source_reliability,
    'effective_independence',effective_independence_score,
    'story_convergence',convergence_score,
    'traceability',traceability_score,
    'relation_quality',relation_quality,
    'consistency',provenance_consistency_score,
    'provenance',provenance_score,
    'activity',round(activity_score,2),
    'urgency',urgency_score,
    'recency',recency_score,
    'legacy_activity_raw',round(legacy_activity_raw,2)
  ) as provenance_dimensions,
  jsonb_build_object(
    'effective_corrob_count',publisher_count+verified_authority_count,
    'single_corrob_cap',publisher_count+verified_authority_count<=1,
    'two_corrob_cap',publisher_count+verified_authority_count=2,
    'low_traceability_cap',traceability_score<75,
    'contradiction_cap',contradiction_pct>=25 or primary_contradiction_count>0,
    'low_source_reliability_cap',source_reliability<60 and verified_primary_count=0,
    'no_verified_primary_cap',verified_primary_count=0,
    'url_only_primary_cap',verified_primary_count>0 and content_verified_primary_count=0,
    'cap_score',provenance_hard_cap_score
  ) as provenance_hard_gates,
  jsonb_build_object(
    'documents',document_count,
    'publishers',publisher_count,
    'stories',story_count,
    'breaking',breaking_count,
    'artifacts',artifact_count,
    'primary_artifacts',primary_artifact_count,
    'verified_primary',verified_primary_count,
    'content_verified_primary',content_verified_primary_count,
    'verified_authorities',verified_authority_count,
    'primary_contradictions',primary_contradiction_count,
    'event_status',status
  ) as provenance_input_snapshot
from scored s;

revoke all on public.nars_event_score_candidates_v3 from anon,authenticated;

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
    select c.*,
      case
        when c.provenance_priority_score>=82 then 'FLASH'
        when c.provenance_priority_score>=68 then 'HIGH'
        when c.provenance_priority_score>=52 then 'WATCH'
        else 'ROUTINE'
      end as provenance_priority_band,
      md5(jsonb_build_object(
        'v','4.3.1-provenance-v1',
        'event',c.event_id,
        'raw',c.provenance_raw_evidence_score,
        'final',c.provenance_final_evidence_score,
        'grade',c.provenance_evidence_grade,
        'priority',c.provenance_priority_score,
        'dimensions',c.provenance_dimensions,
        'gates',c.provenance_hard_gates,
        'inputs',c.provenance_input_snapshot
      )::text) as fp
    from public.nars_event_score_candidates_v3 c
    order by c.last_updated_at desc
    limit greatest(1,least(coalesce(p_limit,500),2000))
  ), ins as (
    insert into public.nars_event_score_ledger(
      event_id,score_version,raw_evidence_score,final_evidence_score,evidence_grade,
      priority_score,priority_band,dimensions,hard_gates,input_snapshot,score_fingerprint
    )
    select
      event_id,'4.3.1-provenance-v1',provenance_raw_evidence_score,provenance_final_evidence_score,
      provenance_evidence_grade,provenance_priority_score,provenance_priority_band,
      provenance_dimensions,provenance_hard_gates,provenance_input_snapshot,fp
    from candidates
    on conflict(event_id,score_version,score_fingerprint) do nothing
    returning event_id
  )
  select count(*) into v_inserted from ins;

  with latest as (
    select distinct on (l.event_id)
      l.event_id,l.priority_score,l.evidence_grade,l.final_evidence_score,l.priority_band,
      l.dimensions,l.hard_gates,l.score_version,l.input_snapshot
    from public.nars_event_score_ledger l
    where l.score_version='4.3.1-provenance-v1'
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
    where e.id=l.event_id
      and (
        e.priority_score is distinct from l.priority_score
        or e.evidence_grade is distinct from l.evidence_grade
        or e.metadata->>'score_version' is distinct from l.score_version
        or e.metadata->'score_inputs' is distinct from l.input_snapshot
      )
    returning e.id
  )
  select count(*) into v_updated from upd;

  return jsonb_build_object(
    'version','4.3.1-provenance-v1',
    'ledger_inserted',v_inserted,
    'events_updated',v_updated
  );
end;
$$;

revoke execute on function public.nars_score_events(integer) from public,anon,authenticated;
grant execute on function public.nars_score_events(integer) to service_role;

update public.nars_system_meta
set value=jsonb_build_object(
      'version','4.3.1-provenance-v1',
      'grade_scale','NARS Evidence Grade v1',
      'provenance_layer',true,
      'calibration','base85_provenance15',
      'updated_at',now()
    ),
    updated_at=now()
where key='evidence_scoring_version';
