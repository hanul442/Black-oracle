-- NARS v4 N4-07 source diversification scoring
-- Version: 4.5.0-diversity-v1

create or replace view public.nars_event_source_diversity_v1
with (security_invoker=true)
as
with doc_nodes as (
  select
    ed.event_id,
    public.nars_source_identity(s.name,s.metadata) as publisher_key,
    coalesce(r.source_class,'unknown') as source_class,
    coalesce(r.country,s.country,'ZZ') as country,
    case
      when l.lineage_type in ('wire','syndicated','repost','aggregation')
        and l.confidence >= 0.70
        and l.upstream_publisher_key is not null
      then 'upstream:'||l.upstream_publisher_key
      else coalesce(r.ownership_group,r.independence_group,'publisher:'||public.nars_source_identity(s.name,s.metadata))
    end as effective_group,
    coalesce(r.review_status,'unreviewed') as identity_review_status
  from public.nars_event_documents ed
  join public.nars_documents d on d.id=ed.document_id
  join public.nars_sources s on s.id=d.source_id
  left join public.nars_source_identity_registry r
    on r.publisher_key=public.nars_source_identity(s.name,s.metadata)
  left join public.nars_document_source_lineage l on l.document_id=d.id
), publisher_nodes as (
  select event_id,publisher_key,
    max(source_class) as source_class,
    max(country) as country,
    max(effective_group) as effective_group,
    max(identity_review_status) as identity_review_status
  from doc_nodes
  group by event_id,publisher_key
), group_counts as (
  select event_id,effective_group,count(*)::numeric as publishers_in_group
  from publisher_nodes
  group by event_id,effective_group
), group_totals as (
  select event_id,sum(publishers_in_group) as total_publishers
  from group_counts
  group by event_id
), group_stats as (
  select
    g.event_id,
    count(*)::integer as independent_group_count,
    max(g.publishers_in_group) as max_group_publishers,
    t.total_publishers,
    sum(power(g.publishers_in_group/nullif(t.total_publishers,0),2)) as hhi
  from group_counts g
  join group_totals t on t.event_id=g.event_id
  group by g.event_id,t.total_publishers
), agg as (
  select
    p.event_id,
    count(*)::integer as publisher_count,
    count(distinct p.source_class)::integer as source_class_count,
    count(distinct p.country)::integer as country_count,
    count(*) filter(where p.identity_review_status in ('provisional','reviewed'))::integer as classified_publisher_count,
    count(*) filter(where p.identity_review_status='unreviewed')::integer as unreviewed_identity_count,
    array_agg(distinct p.source_class order by p.source_class) as source_classes,
    array_agg(distinct p.country order by p.country) as countries
  from publisher_nodes p
  group by p.event_id
), scored as (
  select
    a.*,
    g.independent_group_count,
    round(g.max_group_publishers/nullif(g.total_publishers,0),4) as dominant_group_share,
    round(g.hhi,4) as source_hhi,
    case g.independent_group_count when 0 then 0 when 1 then 35 when 2 then 65 when 3 then 82 when 4 then 92 else 98 end::numeric as group_breadth_score,
    case a.source_class_count when 0 then 0 when 1 then 40 when 2 then 70 when 3 then 88 else 96 end::numeric as class_diversity_score,
    case a.country_count when 0 then 0 when 1 then 50 when 2 then 80 when 3 then 92 else 98 end::numeric as geography_diversity_score,
    least(100,greatest(0,(1-g.hhi)*125))::numeric as concentration_score
  from agg a
  join group_stats g on g.event_id=a.event_id
)
select
  event_id,publisher_count,source_class_count,country_count,
  classified_publisher_count,unreviewed_identity_count,source_classes,countries,
  independent_group_count,dominant_group_share,source_hhi,
  group_breadth_score,class_diversity_score,geography_diversity_score,concentration_score,
  round(least(100,greatest(0,
    0.55*group_breadth_score+
    0.20*class_diversity_score+
    0.15*concentration_score+
    0.10*geography_diversity_score
  )),2) as source_diversity_score
from scored;
revoke all on public.nars_event_source_diversity_v1 from anon,authenticated;

create or replace view public.nars_event_score_candidates_v4
with (security_invoker=true)
as
with joined as (
  select
    v3.*,
    coalesce(d.publisher_count,v3.publisher_count) as diversity_publisher_count,
    coalesce(d.independent_group_count,v3.publisher_count) as independent_group_count,
    coalesce(d.source_class_count,1) as source_class_count,
    coalesce(d.country_count,1) as country_count,
    coalesce(d.classified_publisher_count,0) as classified_publisher_count,
    coalesce(d.unreviewed_identity_count,v3.publisher_count) as unreviewed_identity_count,
    coalesce(d.dominant_group_share,1::numeric) as dominant_group_share,
    coalesce(d.source_hhi,1::numeric) as source_hhi,
    coalesce(d.group_breadth_score,v3.effective_independence_score) as group_breadth_score,
    coalesce(d.class_diversity_score,40::numeric) as class_diversity_score,
    coalesce(d.geography_diversity_score,50::numeric) as geography_diversity_score,
    coalesce(d.concentration_score,0::numeric) as concentration_score,
    coalesce(d.source_diversity_score,v3.effective_independence_score) as source_diversity_score,
    coalesce(d.source_classes,array['unknown'::text]) as source_classes,
    coalesce(d.countries,array['ZZ'::text]) as countries
  from public.nars_event_score_candidates_v3 v3
  left join public.nars_event_source_diversity_v1 d on d.event_id=v3.event_id
), calc as (
  select
    j.*,
    greatest(0,j.independent_group_count+j.verified_authority_count) as diversified_corrob_count,
    round(least(100,greatest(0,
      0.90*j.provenance_raw_evidence_score+
      0.10*j.source_diversity_score
    )),2) as diversity_raw_evidence_score
  from joined j
), gated as (
  select
    c.*,
    least(
      c.provenance_hard_cap_score,
      case when c.diversified_corrob_count<=1 then 75.99 when c.diversified_corrob_count=2 then 84.99 else 100 end,
      case when c.dominant_group_share>=0.67 and c.diversity_publisher_count>=2 then 84.99 else 100 end
    ) as diversity_hard_cap_score
  from calc c
)
select
  g.*,
  round(least(diversity_raw_evidence_score,diversity_hard_cap_score),2) as diversity_final_evidence_score,
  public.nars_score_to_grade(round(least(diversity_raw_evidence_score,diversity_hard_cap_score),2)) as diversity_evidence_grade,
  round(least(100,greatest(0,
    0.35*activity_score+
    0.25*urgency_score+
    0.15*source_diversity_score+
    0.05*group_breadth_score+
    0.10*recency_score+
    0.10*least(diversity_raw_evidence_score,diversity_hard_cap_score)
  )),2) as diversity_priority_score,
  jsonb_build_object(
    'base_provenance',provenance_raw_evidence_score,
    'source_reliability',source_reliability,
    'source_diversity',source_diversity_score,
    'independent_group_breadth',group_breadth_score,
    'source_class_diversity',class_diversity_score,
    'geography_diversity',geography_diversity_score,
    'concentration',concentration_score,
    'dominant_group_share',dominant_group_share,
    'source_hhi',source_hhi,
    'provenance',provenance_score,
    'activity',round(activity_score,2),
    'urgency',urgency_score,
    'recency',recency_score
  ) as diversity_dimensions,
  provenance_hard_gates || jsonb_build_object(
    'independent_group_count',independent_group_count,
    'diversified_corrob_count',diversified_corrob_count,
    'ownership_or_lineage_concentration_cap',dominant_group_share>=0.67 and diversity_publisher_count>=2,
    'dominant_group_share',dominant_group_share,
    'cap_score',diversity_hard_cap_score
  ) as diversity_hard_gates,
  provenance_input_snapshot || jsonb_build_object(
    'independent_groups',independent_group_count,
    'source_classes',source_class_count,
    'countries',country_count,
    'source_class_names',to_jsonb(source_classes),
    'country_codes',to_jsonb(countries),
    'classified_publishers',classified_publisher_count,
    'unreviewed_identities',unreviewed_identity_count
  ) as diversity_input_snapshot
from gated g;
revoke all on public.nars_event_score_candidates_v4 from anon,authenticated;

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
    order by c.last_updated_at desc
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
    'ledger_inserted',v_inserted,
    'events_updated',v_updated
  );
end;
$$;
revoke execute on function public.nars_score_events(integer) from public,anon,authenticated;
grant execute on function public.nars_score_events(integer) to service_role;

insert into public.nars_system_meta(key,value,updated_at)
values('source_diversification_scoring_version',jsonb_build_object(
  'version','4.5.0-diversity-v1',
  'independence_groups',true,
  'source_class_diversity',true,
  'hhi_concentration',true,
  'updated_at',now()
),now())
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
