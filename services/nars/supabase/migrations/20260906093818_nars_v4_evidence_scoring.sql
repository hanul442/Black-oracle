-- NARS v4 N4-04 Evidence + Intelligence Scoring
-- Version: 4.2.1-evidence-v1

create table if not exists public.nars_event_score_ledger (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.nars_events(id) on delete cascade,
  score_version text not null,
  raw_evidence_score numeric(6,2) not null check (raw_evidence_score between 0 and 100),
  final_evidence_score numeric(6,2) not null check (final_evidence_score between 0 and 100),
  evidence_grade text not null,
  priority_score numeric(6,2) not null check (priority_score between 0 and 100),
  priority_band text not null check (priority_band in ('FLASH','HIGH','WATCH','ROUTINE')),
  dimensions jsonb not null default '{}'::jsonb,
  hard_gates jsonb not null default '{}'::jsonb,
  input_snapshot jsonb not null default '{}'::jsonb,
  score_fingerprint text not null,
  evaluated_at timestamptz not null default now(),
  unique(event_id, score_version, score_fingerprint)
);

alter table public.nars_event_score_ledger enable row level security;
revoke all on public.nars_event_score_ledger from anon, authenticated;
create index if not exists nars_event_score_ledger_event_eval_idx
  on public.nars_event_score_ledger(event_id, evaluated_at desc);
comment on table public.nars_event_score_ledger is
  'NARS v4.2 event evidence and priority score audit ledger';

create table if not exists public.nars_source_evidence_profiles (
  publisher_key text primary key,
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed','provisional','reviewed','suspended')),
  reliability_score numeric(6,2) check (reliability_score between 0 and 100),
  reliability_grade text,
  methodology_version text not null default '4.2.0-source-v1',
  dimensions jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  notes text,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.nars_source_evidence_profiles enable row level security;
revoke all on public.nars_source_evidence_profiles from anon, authenticated;
comment on table public.nars_source_evidence_profiles is
  'NARS publisher evidence reliability profiles; empty until explicitly reviewed';

create or replace function public.nars_score_to_grade(p_score numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_score,0) >= 98 then 'AAA+'
    when p_score >= 96 then 'AAA0'
    when p_score >= 94 then 'AAA-'
    when p_score >= 91 then 'AA+'
    when p_score >= 88 then 'AA0'
    when p_score >= 85 then 'AA-'
    when p_score >= 82 then 'A+'
    when p_score >= 79 then 'A0'
    when p_score >= 76 then 'A-'
    when p_score >= 72 then 'BBB+'
    when p_score >= 68 then 'BBB0'
    when p_score >= 64 then 'BBB-'
    when p_score >= 60 then 'BB+'
    when p_score >= 56 then 'BB0'
    when p_score >= 52 then 'BB-'
    when p_score >= 48 then 'B+'
    when p_score >= 44 then 'B0'
    when p_score >= 40 then 'B-'
    when p_score >= 36 then 'CCC+'
    when p_score >= 32 then 'CCC0'
    when p_score >= 28 then 'CCC-'
    when p_score >= 24 then 'CC+'
    when p_score >= 20 then 'CC0'
    when p_score >= 16 then 'CC-'
    when p_score >= 13 then 'C+'
    when p_score >= 10 then 'C0'
    when p_score >= 7 then 'C-'
    when p_score >= 5 then 'D+'
    when p_score >= 3 then 'D0'
    when p_score >= 2 then 'D-'
    when p_score >= 1 then 'F+'
    when p_score >= 0.5 then 'F0'
    else 'F-'
  end;
$$;

revoke execute on function public.nars_score_to_grade(numeric) from public, anon, authenticated;

create or replace view public.nars_event_score_candidates_v2
with (security_invoker = true)
as
with doc_base as (
  select
    ed.event_id,
    d.id as document_id,
    d.canonical_url,
    d.published_at,
    d.retrieved_at,
    d.is_breaking,
    ed.relation,
    ed.confidence,
    s.id as source_id,
    public.nars_source_identity(s.name,s.metadata) as publisher_key,
    s.tier,
    s.health_status,
    coalesce((s.metadata->>'tier_unreviewed')::boolean,false) as tier_unreviewed
  from public.nars_event_documents ed
  join public.nars_documents d on d.id=ed.document_id
  join public.nars_sources s on s.id=d.source_id
), publisher_scores as (
  select
    b.event_id,
    b.publisher_key,
    max(greatest(0,least(100,coalesce(
      case when p.review_status in ('reviewed','provisional') then p.reliability_score end,
      (case coalesce(b.tier,4) when 1 then 92 when 2 then 80 when 3 then 65 else 50 end)
      +(case b.health_status when 'up' then 3 when 'degraded' then -8 when 'down' then -25 else -2 end)
      -(case when b.tier_unreviewed then 8 else 0 end)
    ))))::numeric as publisher_reliability,
    bool_or(p.review_status in ('reviewed','provisional')) as has_profile,
    bool_or(p.review_status='reviewed') as has_reviewed_profile
  from doc_base b
  left join public.nars_source_evidence_profiles p on p.publisher_key=b.publisher_key
  group by b.event_id,b.publisher_key
), pub_agg as (
  select
    event_id,
    count(*)::int as publisher_count,
    round(avg(publisher_reliability),2) as source_reliability,
    count(*) filter(where has_profile)::int as profiled_publishers,
    count(*) filter(where has_reviewed_profile)::int as reviewed_publishers
  from publisher_scores
  group by event_id
), doc_agg as (
  select
    event_id,
    count(*)::int as document_count,
    count(*) filter(where is_breaking)::int as breaking_count,
    count(*) filter(where relation='primary')::int as primary_count,
    count(*) filter(where relation='supporting')::int as supporting_count,
    count(*) filter(where relation='context')::int as context_count,
    count(*) filter(where relation='contradicting')::int as contradicting_count,
    round(100.0*count(*) filter(where relation='contradicting')/greatest(count(*),1),2) as contradiction_pct,
    round(avg(
      (case when canonical_url is not null then 35 else 0 end)
      +(case when source_id is not null then 20 else 0 end)
      +(case when retrieved_at is not null then 25 else 0 end)
      +(case when published_at is not null then 20 else 0 end)
    ),2) as traceability_score,
    round(avg(case relation
      when 'primary' then 90
      when 'supporting' then 75
      when 'context' then 55
      when 'contradicting' then 20
      else 40 end),2) as relation_quality
  from doc_base
  group by event_id
), story_agg as (
  select event_id,count(*)::int as story_count
  from public.nars_event_stories
  group by event_id
), inputs as (
  select
    e.id as event_id,
    e.title,
    e.status,
    e.first_detected_at,
    e.last_updated_at,
    coalesce(d.document_count,0) as document_count,
    coalesce(p.publisher_count,0) as publisher_count,
    coalesce(st.story_count,0) as story_count,
    coalesce(d.breaking_count,0) as breaking_count,
    coalesce(d.primary_count,0) as primary_count,
    coalesce(d.supporting_count,0) as supporting_count,
    coalesce(d.context_count,0) as context_count,
    coalesce(d.contradicting_count,0) as contradicting_count,
    coalesce(d.contradiction_pct,0) as contradiction_pct,
    coalesce(p.source_reliability,0) as source_reliability,
    coalesce(p.profiled_publishers,0) as profiled_publishers,
    coalesce(p.reviewed_publishers,0) as reviewed_publishers,
    coalesce(d.traceability_score,0) as traceability_score,
    coalesce(d.relation_quality,0) as relation_quality,
    case coalesce(p.publisher_count,0)
      when 0 then 0 when 1 then 35 when 2 then 65 when 3 then 82 when 4 then 92 else 98 end::numeric as independence_score,
    case
      when coalesce(st.story_count,0)=0 then 0
      when st.story_count=1 and coalesce(p.publisher_count,0)=1 then 45
      when st.story_count=1 and p.publisher_count=2 then 70
      when st.story_count=1 and p.publisher_count>=3 then 85
      when st.story_count=2 then least(90,72+6*greatest(p.publisher_count-1,0))
      when st.story_count=3 then least(96,86+4*greatest(p.publisher_count-1,0))
      else 97 end::numeric as convergence_score,
    greatest(0,100-coalesce(d.contradiction_pct,0))::numeric as consistency_score,
    least(100,greatest(0,
      (ln(greatest(coalesce(d.document_count,1),1)::numeric)*12)
      +(sqrt(greatest(coalesce(d.document_count,1),1)::numeric)*2)
      +(case when coalesce(d.breaking_count,0)>0 then 8 else 0 end)
    ))::numeric as legacy_activity_raw
  from public.nars_events e
  left join doc_agg d on d.event_id=e.id
  left join pub_agg p on p.event_id=e.id
  left join story_agg st on st.event_id=e.id
), scored as (
  select
    i.*,
    round(least(100,greatest(0,
      0.30*source_reliability
      +0.25*independence_score
      +0.15*convergence_score
      +0.15*traceability_score
      +0.10*relation_quality
      +0.05*consistency_score
    )),2) as raw_evidence_score,
    least(
      100::numeric,
      case when publisher_count<=1 then 75.99 when publisher_count=2 then 84.99 else 100 end,
      case when traceability_score<75 then 78.99 else 100 end,
      case when contradiction_pct>=25 then 78.99 else 100 end,
      case when source_reliability<60 then 71.99 else 100 end,
      case when reviewed_publishers=0 then 90.99 else 100 end
    ) as hard_cap_score,
    case
      when extract(epoch from (now()-last_updated_at))<=900 then 100
      when extract(epoch from (now()-last_updated_at))<=3600 then 90
      when extract(epoch from (now()-last_updated_at))<=10800 then 75
      when extract(epoch from (now()-last_updated_at))<=21600 then 60
      when extract(epoch from (now()-last_updated_at))<=86400 then 35
      else 10 end::numeric as recency_score,
    least(100,legacy_activity_raw/32.0*100)::numeric as activity_score,
    case when breaking_count>0 then least(100,65+10*breaking_count) else 20 end::numeric as urgency_score
  from inputs i
), final as (
  select
    s.*,
    round(least(raw_evidence_score,hard_cap_score),2) as final_evidence_score,
    round(least(100,greatest(0,
      0.35*activity_score
      +0.25*urgency_score
      +0.20*independence_score
      +0.10*recency_score
      +0.10*least(raw_evidence_score,hard_cap_score)
    )),2) as computed_priority_score
  from scored s
)
select
  f.*,
  public.nars_score_to_grade(final_evidence_score) as evidence_grade,
  case
    when computed_priority_score>=82 then 'FLASH'
    when computed_priority_score>=68 then 'HIGH'
    when computed_priority_score>=52 then 'WATCH'
    else 'ROUTINE' end as priority_band,
  jsonb_build_object(
    'source_reliability',source_reliability,
    'publisher_independence',independence_score,
    'story_convergence',convergence_score,
    'traceability',traceability_score,
    'relation_quality',relation_quality,
    'consistency',consistency_score,
    'activity',round(activity_score,2),
    'urgency',urgency_score,
    'recency',recency_score,
    'legacy_activity_raw',round(legacy_activity_raw,2)
  ) as dimensions,
  jsonb_build_object(
    'single_publisher_cap',publisher_count<=1,
    'two_publisher_cap',publisher_count=2,
    'low_traceability_cap',traceability_score<75,
    'contradiction_cap',contradiction_pct>=25,
    'low_source_reliability_cap',source_reliability<60,
    'no_reviewed_source_cap',reviewed_publishers=0,
    'cap_score',hard_cap_score
  ) as hard_gates,
  jsonb_build_object(
    'documents',document_count,
    'publishers',publisher_count,
    'profiled_publishers',profiled_publishers,
    'reviewed_publishers',reviewed_publishers,
    'stories',story_count,
    'breaking',breaking_count,
    'primary',primary_count,
    'supporting',supporting_count,
    'context',context_count,
    'contradicting',contradicting_count,
    'contradiction_pct',contradiction_pct,
    'event_status',status
  ) as input_snapshot
from final f;

revoke all on public.nars_event_score_candidates_v2 from anon, authenticated;

create or replace view public.nars_event_score_latest_v1
with (security_invoker = true)
as
select distinct on (l.event_id)
  l.*
from public.nars_event_score_ledger l
order by l.event_id,l.evaluated_at desc;

revoke all on public.nars_event_score_latest_v1 from anon, authenticated;

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
      md5(jsonb_build_object(
        'v','4.2.1-evidence-v1',
        'event',c.event_id,
        'raw',c.raw_evidence_score,
        'final',c.final_evidence_score,
        'grade',c.evidence_grade,
        'priority',c.computed_priority_score,
        'band',c.priority_band,
        'dimensions',c.dimensions,
        'gates',c.hard_gates,
        'inputs',c.input_snapshot
      )::text) as fp
    from public.nars_event_score_candidates_v2 c
    order by c.last_updated_at desc
    limit greatest(1,least(coalesce(p_limit,500),2000))
  ), ins as (
    insert into public.nars_event_score_ledger(
      event_id,score_version,raw_evidence_score,final_evidence_score,evidence_grade,
      priority_score,priority_band,dimensions,hard_gates,input_snapshot,score_fingerprint
    )
    select
      event_id,'4.2.1-evidence-v1',raw_evidence_score,final_evidence_score,evidence_grade,
      computed_priority_score,priority_band,dimensions,hard_gates,input_snapshot,fp
    from candidates
    on conflict(event_id,score_version,score_fingerprint) do nothing
    returning event_id
  )
  select count(*) into v_inserted from ins;

  with latest as (
    select distinct on (l.event_id)
      l.event_id,l.priority_score,l.evidence_grade,l.final_evidence_score,
      l.priority_band,l.dimensions,l.hard_gates,l.score_version
    from public.nars_event_score_ledger l
    where l.score_version='4.2.1-evidence-v1'
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
        'score_hard_gates',l.hard_gates
      )
    from latest l
    where e.id=l.event_id
      and (
        e.priority_score is distinct from l.priority_score
        or e.evidence_grade is distinct from l.evidence_grade
        or e.metadata->>'score_version' is distinct from l.score_version
      )
    returning e.id
  )
  select count(*) into v_updated from upd;

  return jsonb_build_object(
    'version','4.2.1-evidence-v1',
    'ledger_inserted',v_inserted,
    'events_updated',v_updated
  );
end;
$$;

revoke execute on function public.nars_score_events(integer) from public, anon, authenticated;
grant execute on function public.nars_score_events(integer) to service_role;

create or replace view public.nars_event_wire_v1
with (security_invoker = true)
as
select
  e.id as event_id,
  e.event_key,
  e.title,
  e.status,
  e.priority_score,
  e.evidence_grade,
  e.first_detected_at,
  e.last_updated_at,
  coalesce((e.metadata->>'story_count')::integer,0) as story_count,
  coalesce((e.metadata->>'document_count')::integer,0) as document_count,
  coalesce((e.metadata->>'source_count')::integer,0) as source_count,
  coalesce((e.metadata->>'breaking_count')::integer,0) as breaking_count,
  e.metadata->>'cluster_method' as cluster_method,
  e.metadata->>'cluster_language' as language,
  nullif(e.metadata->>'evidence_score','')::numeric as evidence_score,
  e.metadata->>'priority_band' as priority_band,
  e.metadata->>'score_version' as score_version,
  e.metadata->'score_dimensions' as score_dimensions,
  e.metadata->'score_hard_gates' as score_hard_gates
from public.nars_events e;

revoke all on public.nars_event_wire_v1 from anon, authenticated;

select cron.schedule(
  'nars-score-5m',
  '2-59/5 * * * *',
  $$select public.nars_score_events(500);$$
);

insert into public.nars_system_meta(key,value,updated_at)
values (
  'evidence_scoring_version',
  jsonb_build_object(
    'version','4.2.1-evidence-v1',
    'grade_scale','NARS Evidence Grade v1',
    'updated_at',now()
  ),
  now()
)
on conflict(key) do update
set value=excluded.value,updated_at=excluded.updated_at;
